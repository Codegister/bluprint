"use node";

/**
 * Model diagnostics and the scheduled liveness check.
 *
 * `check` is what turns "a retired model" from a user's error message into a
 * deployment alert. The transport already falls back at request time, but a
 * working fallback would otherwise hide the fact that the configured model is
 * gone. Once an hour each configured model is asked for a few tokens; a 404,
 * 410, 401, 402 or 403 is recorded as an AI incident, and the ten-minute health
 * sweep alerts on it (fatal causes alert on the first occurrence).
 *
 * The probes print and return status codes only: never a key, a prompt or an
 * answer. `list`, `tryOne` and `tryStream` are manual diagnostic helpers.
 */
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { incidentKind } from "./lib/incidentRules";
import {
  NVIDIA_CHAT_URL,
  TUTOR_TIERS,
  readNvidiaKeys,
  textModelCandidates,
  visionModelCandidates,
} from "./lib/nvidiaConfig";

export const list = internalAction({
  args: {},
  handler: async () => {
    const key = readNvidiaKeys()[0];
    if (!key) return { hasKey: false, ids: [] as string[] };
    const res = await fetch("https://integrate.api.nvidia.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    const body = (await res.json()) as { data?: Array<{ id?: string }> };
    return {
      hasKey: true,
      status: res.status,
      ids: (body.data ?? []).map((m) => m.id ?? "").filter(Boolean).sort(),
    };
  },
});

/** Probes one model per call, with its own timeout, so nothing hangs the run. */
export const tryOne = internalAction({
  args: { model: v.string() },
  handler: async (_ctx, { model }) => {
    const key = readNvidiaKeys()[0];
    if (!key) return { model, status: 0, note: "no key" };
    try {
      const res = await fetch(NVIDIA_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Say OK." }],
          max_tokens: 8,
        }),
        signal: AbortSignal.timeout(25_000),
      });
      const text = await res.text();
      return {
        model,
        status: res.status,
        note: res.ok ? text.slice(0, 30) : text.slice(0, 200),
      };
    } catch (error) {
      return {
        model,
        status: 0,
        note: error instanceof Error ? error.message.slice(0, 120) : "error",
      };
    }
  },
});

/**
 * Asks every configured model for a few tokens and records the failures that
 * mean a model is gone or an account cannot use it. Scheduled from crons.ts.
 */
export const check = internalAction({
  args: {},
  handler: async (ctx) => {
    const key = readNvidiaKeys()[0];
    if (!key) {
      return { checked: 0, message: "NVIDIA_API_KEY is not set" };
    }

    const models = [
      ...new Set([
        ...textModelCandidates(),
        ...visionModelCandidates(),
        ...TUTOR_TIERS.map((tier) => tier.model),
      ]),
    ];

    const results = await Promise.all(
      models.map(async (model) => {
        let status = 0;
        try {
          const response = await fetch(NVIDIA_CHAT_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: "Reply with OK." }],
              max_tokens: 4,
              stream: false,
            }),
            signal: AbortSignal.timeout(25_000),
          });
          status = response.status;
        } catch {
          // A timeout here is a network blip, not a dead model. The request
          // path records real network failures; the liveness check only wants
          // a definite answer from the provider.
        }

        // Only deterministic account/model failures are recorded. A 429 from a
        // health probe would be noise, and a 5xx needs the request path's
        // repetition rule before it deserves an alert.
        if ([401, 402, 403, 404, 410].includes(status)) {
          await ctx.runMutation(internal.incidents.record, {
            purpose: "health-check",
            model,
            status,
            kind: incidentKind(status),
          });
        }
        return { model, status };
      }),
    );

    return { checked: results.length, results };
  },
});

/** Same probe, but streaming with the tutor's flags, to match the real path. */
export const tryStream = internalAction({
  args: { model: v.string() },
  handler: async (_ctx, { model }) => {
    const key = readNvidiaKeys()[0];
    if (!key) return { model, status: 0, note: "no key" };
    try {
      const res = await fetch(NVIDIA_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Say OK." }],
          temperature: 0.3,
          top_p: 1,
          max_tokens: 64,
          stream: true,
          chat_template_kwargs: { enable_thinking: false },
        }),
        signal: AbortSignal.timeout(25_000),
      });
      const text = await res.text();
      return {
        model,
        status: res.status,
        note: text.slice(0, 200),
      };
    } catch (error) {
      return {
        model,
        status: 0,
        note: error instanceof Error ? error.message.slice(0, 120) : "error",
      };
    }
  },
});
