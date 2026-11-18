/**
 * A user's own NVIDIA key, as stored on their account.
 *
 * The key itself is never returned to the browser and never logged. Only the
 * last four characters are kept in the clear, so the sheet can say which key is
 * connected. Encryption happens in the Node action (`nvidiaKeys.connect`),
 * because this file runs in Convex's default isolate runtime.
 */

import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { readNvidiaKeys } from "./lib/nvidiaConfig";
import { requireUserId } from "./lib/requireUser";

/** One row per account; the index makes both reads a single lookup. */
async function rowFor(ctx: { db: any }, userId: string) {
  return await ctx.db
    .query("userNvidiaKeys")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
}

/** Used by the AI actions to open the caller's key. */
export const getStored = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const row = await rowFor(ctx, userId);
    if (!row) return null;
    return {
      ciphertext: row.ciphertext,
      last4: row.last4,
      validatedAt: row.validatedAt,
    };
  },
});

/** Written only by `nvidiaKeys.connect`, after NVIDIA accepted the key. */
export const save = internalMutation({
  args: {
    userId: v.id("users"),
    ciphertext: v.string(),
    last4: v.string(),
    validatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await rowFor(ctx, args.userId);
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ciphertext: args.ciphertext,
        last4: args.last4,
        validatedAt: args.validatedAt,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("userNvidiaKeys", {
      userId: args.userId,
      ciphertext: args.ciphertext,
      last4: args.last4,
      validatedAt: args.validatedAt,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * What the Connect NVIDIA sheet shows. No part of the key comes back — only
 * whether one is saved, its last four characters and when NVIDIA last accepted
 * it. `sharedPool` and `canSave` are deployment facts the UI needs to explain
 * what happens if the user skips this.
 */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const row = await rowFor(ctx, userId);
    return {
      saved: row !== null,
      last4: row?.last4 ?? null,
      validatedAt: row?.validatedAt ?? null,
      canSave: Boolean((process.env.NVIDIA_KEY_SECRET ?? "").trim()),
      sharedPool: readNvidiaKeys().length > 0,
    };
  },
});

/** Removes the caller's key; their requests fall back to the shared pool. */
export const forget = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const row = await rowFor(ctx, userId);
    if (!row) return { removed: false };
    await ctx.db.delete(row._id);
    return { removed: true };
  },
});
