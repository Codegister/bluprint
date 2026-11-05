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
import { internalMutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUserId } from "./lib/requireUser";
import {
  DAY_MS,
  HOUR_MS,
  buildLimit,
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

/**
 * Returns the allowance for a build that failed before it produced anything.
 *
 * The timestamp scopes the refund to the attempt that failed, so a newer paper
 * started for another course is not quietly forgotten. Called by the paper
 * build action's failure path.
 */
export const refund = internalMutation({
  args: {
    userId: v.id("users"),
    kind: v.union(
      v.literal("set"),
      v.literal("rebuild"),
      v.literal("paper"),
    ),
    before: v.number(),
  },
  handler: async (ctx, { userId, kind, before }) => {
    const rows = await ctx.db
      .query("buildUsage")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .collect();
    const row = rows
      .filter((entry) => entry.kind === kind && entry.at <= before)
      .sort((a, b) => b.at - a.at)[0];
    if (!row) return { refunded: false };
    await ctx.db.delete(row._id);
    return { refunded: true };
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


/**
 * The student's remaining new-set allowance, read before the Add material
 * dialog opens. The cap and the minimum material length are then stated up
 * front instead of failing after an upload.
 */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const user = await ctx.db.get(userId);
    const identity: BuildIdentity =
      user !== null && (user as { isAnonymous?: boolean | null }).isAnonymous === true
        ? "guest"
        : "member";
    const limit = buildLimit("set", identity);
    const rows = await ctx.db
      .query("buildUsage")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .collect();
    const spent = rows.filter((row) => row.kind === "set").map((row) => row.at);
    const inHour = spent.filter((at) => now - at < HOUR_MS);
    const inDay = spent.filter((at) => now - at < DAY_MS);
    const verdict = checkAllowance({
      kind: "set",
      identity,
      now,
      spent,
    });
    const oldestHour = inHour.length > 0 ? Math.min(...inHour) : now;
    return {
      identity,
      perHour: limit.perHour,
      perDay: limit.perDay,
      usedThisHour: inHour.length,
      usedToday: inDay.length,
      remainingHour: Math.max(0, limit.perHour - inHour.length),
      remainingToday: Math.max(0, limit.perDay - inDay.length),
      canBuild: verdict.allowed,
      retryMinutes: verdict.allowed
        ? 0
        : Math.max(1, Math.ceil((HOUR_MS - (now - oldestHour)) / 60_000)),
      message: verdict.allowed ? undefined : verdict.message,
    };
  },
});
