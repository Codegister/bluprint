/**
 * Which key pays for one account's AI work.
 *
 * A saved personal key means the account is spending its own quota, so it gets
 * the higher allowance. No row means the request will go out on the shared pool,
 * which is the scarce resource and carries the smaller one. The presence of the
 * row is enough: the transport falls back to the pool when the personal key is
 * rejected or cooling down, and the point of the limit is the normal case.
 */

import type { QueryCtx } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { KeyTier } from "./buildLimits";

export async function keyTierFor(
  ctx: MutationCtx | QueryCtx,
  userId: Id<"users">,
): Promise<KeyTier> {
  const stored = await ctx.db
    .query("userNvidiaKeys")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return stored ? "own" : "shared";
}
