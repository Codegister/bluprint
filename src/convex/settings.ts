import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { requireUserId } from "./lib/requireUser";
import {
  NVIDIA_KEY_NAME,
  NVIDIA_TEXT_MODEL,
  NVIDIA_VISION_MODEL,
} from "./lib/nvidiaConfig";

/**
 * Public status only. The stored key's value is never returned to the client —
 * just whether it exists and where it came from.
 */
export const aiStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);

    const envKey = (process.env.NVIDIA_API_KEY ?? "").trim();
    let source: "env" | "saved" | null = envKey ? "env" : null;

    if (!source) {
      const saved = await ctx.db
        .query("appSettings")
        .withIndex("by_key", (q) => q.eq("key", NVIDIA_KEY_NAME))
        .first();
      if (saved?.value.trim()) source = "saved";
    }

    return {
      configured: source !== null,
      source,
      keyName: NVIDIA_KEY_NAME,
      textModel: NVIDIA_TEXT_MODEL,
      visionModel: NVIDIA_VISION_MODEL,
    };
  },
});

/** Internal only: the NVIDIA action reads the saved fallback key here. */
export const getSavedKey = internalQuery({
  args: {},
  handler: async (ctx) => {
    const saved = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", NVIDIA_KEY_NAME))
      .first();
    return saved?.value.trim() || null;
  },
});

/**
 * Internal only: called by the saveNvidiaKey action *after* the key has been
 * verified with NVIDIA. Storing it in a table readable only by server
 * functions keeps it out of the browser entirely.
 */
export const saveKey = internalMutation({
  args: { value: v.string() },
  handler: async (ctx, { value }) => {
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", NVIDIA_KEY_NAME))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value });
    } else {
      await ctx.db.insert("appSettings", { key: NVIDIA_KEY_NAME, value });
    }
  },
});

