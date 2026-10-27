/**
 * Server-side rate limiting for AI builds.
 *
 * One row per build, so the allowance can be counted from the database rather
 * than trusted from the browser. Every path that starts an AI build calls
 * `consumeBuildAllowance` first: creating a set, rebuilding one, and generating
 * a past paper. A refused call throws the sentence the student sees, and no AI
 * request is made.
 *
 * The rows are pruned as they are read, so the table holds at most a day of one
 * person's builds.
 */

import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  DAY_MS,
  checkAllowance,
  type BuildIdentity,
  type BuildKind,
} from "./lib/buildLimits";

/**
 * Counts this identity's builds of `kind`, refuses the build when the allowance
 * is gone, and records the new attempt when it is allowed.
 *
 * Called by mutations only: it writes, so it must run inside the same
 * transaction as the thing it is authorising.
 */
export async function consumeBuildAllowance(
  ctx: MutationCtx,
  userId: Id<"users">,
  kind: BuildKind,
): Promise<void> {
  const identity = await identityFor(ctx, userId);
  const now = Date.now();

  const rows = await ctx.db
    .query("buildUsage")
    .withIndex("by_user_at", (q) => q.eq("userId", userId))
    .collect();

  // A guest identity is the identity type that gets the smaller allowance.
  const spent = rows
    .filter((row) => row.kind === kind)
    .map((row) => row.at)
    .sort((a, b) => a - b);

  const verdict = checkAllowance({ kind, identity, now, spent });
  if (!verdict.allowed) {
    throw new Error(verdict.message);
  }

  // Pruning happens here, on the write path, so a quiet account leaves nothing
  // behind and there is no separate cleanup job to forget.
  for (const row of rows) {
    if (now - row.at > DAY_MS) await ctx.db.delete(row._id);
  }

  await ctx.db.insert("buildUsage", { userId, kind, at: now });
}

/** Guests (anonymous sessions) get the smaller allowance. */
async function identityFor(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<BuildIdentity> {
  const user = await ctx.db.get(userId);
  const anonymous =
    user !== null && (user as { isAnonymous?: boolean | null }).isAnonymous === true;
  return anonymous ? "guest" : "member";
}

/**
 * The same check, callable from an action.
 *
 * `processStudySet` is an action, so the limit is enforced through this
 * internal mutation. It throws the student's sentence, which the action passes
 * straight on, so a refused rebuild never reaches the model.
 */
export const consume = internalMutation({
  args: {
    userId: v.id("users"),
    kind: v.union(
      v.literal("set"),
      v.literal("rebuild"),
      v.literal("paper"),
    ),
  },
  handler: async (ctx, { userId, kind }) => {
    await consumeBuildAllowance(ctx, userId, kind);
    return { allowed: true };
  },
});

/** What the allowance looks like right now, for the account and the logs. */
export const myUsage = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("buildUsage")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .collect();
    return {
      identity: await identityFor(ctx, userId),
      spent: rows
        .filter((row) => now - row.at < DAY_MS)
        .map((row) => ({ kind: row.kind, at: row.at })),
    };
  },
});
