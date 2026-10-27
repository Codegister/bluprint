"use node";

// Temporary diagnostic used to pick a live NVIDIA model. Never prints a key.
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { NVIDIA_CHAT_URL, readNvidiaKeys } from "./lib/nvidiaConfig";

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
