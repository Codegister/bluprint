"use node";

/**
 * Validating and saving a user's own NVIDIA key.
 *
 * The key is checked against NVIDIA before anything is stored, so a typo is
 * reported on the spot instead of failing in the middle of a study set. The
 * check is a one-token chat completion: NVIDIA answers 200 for a live key,
 * 401/403 for a dead one, and 429 when the key is real but rate-limited.
 * `GET /v1/models` is deliberately not used — that catalogue endpoint answers
 * 200 without any key at all, so it cannot tell a typo from a working key.
 *
 * Nothing here creates an NVIDIA account. The user signs in themselves and
 * copies their own key, which is what keeps this on the right side of NVIDIA's
 * trial terms.
 */

import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { encryptKey, vaultReady } from "./lib/keyVault";
import { NVIDIA_CHAT_URL } from "./lib/nvidiaConfig";
import { requireUserId } from "./lib/requireUser";

const VALIDATION_TIMEOUT_MS = 20_000;

/** What NVIDIA issues: `nvapi-` followed by a long token. */
const KEY_PATTERN = /^nvapi-[A-Za-z0-9_-]{16,}$/;

/**
 * The probe model. A small, fast, currently-live text model, and the request is
 * one token long, so checking a key costs almost nothing.
 */
const PROBE_MODEL = "nvidia/nemotron-3.5-bolt-e4b";

export type ConnectNvidiaResult =
  | { ok: true; last4: string; note?: string }
  | { ok: false; message: string };

/** Stores the key and returns the same shape as a successful check. */
async function remember(
  ctx: { runMutation: (fn: any, args: any) => Promise<unknown> },
  userId: Id<"users">,
  key: string,
  note?: string,
): Promise<ConnectNvidiaResult> {
  const last4 = key.slice(-4);
  await ctx.runMutation(internal.userKeys.save, {
    userId,
    ciphertext: encryptKey(key),
    last4,
    validatedAt: Date.now(),
  });
  return note ? { ok: true, last4, note } : { ok: true, last4 };
}

export const connect = action({
  args: { key: v.string() },
  handler: async (ctx, { key }): Promise<ConnectNvidiaResult> => {
    const userId = await requireUserId(ctx);
    const candidate = key.trim();

    if (!candidate) {
      return { ok: false, message: "Paste the key NVIDIA gave you." };
    }
    if (/\s/.test(candidate)) {
      return {
        ok: false,
        message: "That has a space in it — copy just the key, with nothing around it.",
      };
    }
    if (!KEY_PATTERN.test(candidate)) {
      return {
        ok: false,
        message:
          "NVIDIA keys start with nvapi- and are much longer than that. Check you copied the whole key.",
      };
    }
    if (!vaultReady()) {
      console.error("[nvidiaKeys] NVIDIA_KEY_SECRET is not set on this deployment");
      return {
        ok: false,
        message:
          "This workspace isn't set up to store personal keys yet, so nothing was saved. The shared key is still being used.",
      };
    }

    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);
      try {
        response = await fetch(NVIDIA_CHAT_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${candidate}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: PROBE_MODEL,
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1,
            temperature: 0,
            stream: false,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      // The status code and error class only: never the key.
      console.error("[nvidiaKeys] validation request failed", error);
      return {
        ok: false,
        message:
          "Couldn't reach NVIDIA from the server just now. Nothing was saved — try again in a moment.",
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        message:
          "NVIDIA rejected that key. Check you copied all of it and that it hasn't been deleted on build.nvidia.com.",
      };
    }
    if (response.status === 429) {
      // Rate limiting proves the key is real; saving it is still useful.
      return await remember(
        ctx,
        userId,
        candidate,
        "The key works, but NVIDIA is rate-limiting it right now. Your requests will use it as soon as the limit clears.",
      );
    }
    if (response.status >= 500) {
      return {
        ok: false,
        message:
          "NVIDIA is having trouble right now, so the key couldn't be checked. Nothing was saved — try again in a moment.",
      };
    }
    if (!response.ok) {
      // 400/404/410 here means authentication passed but the probe model did
      // not answer, which still proves the key is real.
      console.error("[nvidiaKeys] probe model answered", response.status);
      return await remember(
        ctx,
        userId,
        candidate,
        `NVIDIA accepted the key, though the check model answered ${response.status}. It's saved and will be tried first.`,
      );
    }
    return await remember(ctx, userId, candidate);
  },
});
