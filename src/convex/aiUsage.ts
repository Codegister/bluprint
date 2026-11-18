import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { DAY_MS, HOUR_MS, type BuildIdentity } from "./lib/buildLimits";
import { aiLimit, checkAiAllowance } from "./lib/aiLimits";
import { keyTierFor } from "./lib/keyTier";
import { requireUserId } from "./lib/requireUser";

const kindValidator = v.union(
  v.literal("tutor"),
  v.literal("marking"),
  v.literal("dictation"),
  v.literal("vision"),
  v.literal("explain"),
);

export const consume = internalMutation({
  args: { userId: v.id("users"), kind: kindValidator },
  handler: async (ctx, { userId, kind }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Please sign in to continue.");
    const identity: BuildIdentity =
      (user as { isAnonymous?: boolean | null }).isAnonymous === true
        ? "guest"
        : "member";
    // Tutoring and marking on the shared pool get the smaller allowance; a
    // connected personal key raises it, which the refusal sentence says.
    const tier = await keyTierFor(ctx, userId);
    const now = Date.now();
    const rows = await ctx.db
      .query("aiUsage")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .collect();
    const spent = rows.filter((row) => row.kind === kind).map((row) => row.at);
    const verdict = checkAiAllowance({ kind, identity, now, spent, tier });
    if (!verdict.allowed) throw new Error(verdict.message);

    for (const row of rows) {
      if (now - row.at > DAY_MS) await ctx.db.delete(row._id);
    }
    await ctx.db.insert("aiUsage", { userId, kind, at: now });
  },
});

/**
 * The remaining allowance for one kind, read before the cap is hit so the
 * student can see it coming instead of meeting it as a refusal. `unlimited` is
 * true while a healthy personal key pays, in which case there is nothing to
 * show.
 */
export const status = query({
  args: { kind: kindValidator },
  handler: async (ctx, { kind }) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    const identity: BuildIdentity =
      (user as { isAnonymous?: boolean | null } | null)?.isAnonymous === true
        ? "guest"
        : "member";
    const tier = await keyTierFor(ctx, userId);
    const limit = aiLimit(kind, identity, tier);
    const now = Date.now();

    if (limit.unlimited) {
      return {
        kind,
        tier,
        unlimited: true,
        label: limit.label,
        perHour: 0,
        perDay: 0,
        usedThisHour: 0,
        usedToday: 0,
        remainingHour: 0,
        remainingToday: 0,
        retryMinutes: 0,
        retryMinutesToday: 0,
      };
    }

    const rows = await ctx.db
      .query("aiUsage")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .collect();
    const spent = rows.filter((row) => row.kind === kind).map((row) => row.at);
    const inHour = spent.filter((at) => now - at < HOUR_MS);
    const inDay = spent.filter((at) => now - at < DAY_MS);
    const oldestHour = inHour.length > 0 ? Math.min(...inHour) : now;
    const oldestDay = inDay.length > 0 ? Math.min(...inDay) : now;
    const remainingHour = Math.max(0, limit.perHour - inHour.length);
    const remainingToday = Math.max(0, limit.perDay - inDay.length);

    return {
      kind,
      tier,
      unlimited: false,
      label: limit.label,
      perHour: limit.perHour,
      perDay: limit.perDay,
      usedThisHour: inHour.length,
      usedToday: inDay.length,
      remainingHour,
      remainingToday,
      // What the student waits for: the hour first, then the day.
      retryMinutes:
        remainingHour > 0
          ? 0
          : Math.max(1, Math.ceil((HOUR_MS - (now - oldestHour)) / 60_000)),
      retryMinutesToday:
        remainingToday > 0
          ? 0
          : Math.max(1, Math.ceil((DAY_MS - (now - oldestDay)) / 60_000)),
    };
  },
});
