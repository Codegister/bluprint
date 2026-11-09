import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { DAY_MS, type BuildIdentity } from "./lib/buildLimits";
import { checkAiAllowance } from "./lib/aiLimits";

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
    const now = Date.now();
    const rows = await ctx.db
      .query("aiUsage")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .collect();
    const spent = rows.filter((row) => row.kind === kind).map((row) => row.at);
    const verdict = checkAiAllowance({ kind, identity, now, spent });
    if (!verdict.allowed) throw new Error(verdict.message);

    for (const row of rows) {
      if (now - row.at > DAY_MS) await ctx.db.delete(row._id);
    }
    await ctx.db.insert("aiUsage", { userId, kind, at: now });
  },
});
