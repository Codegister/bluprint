/**
 * Which key pays for one account's AI work.
 *
 * A saved personal key means the account is spending its own quota, so the
 * app-level limits do not apply. That is only true while NVIDIA is accepting
 * the key: once the transport has recorded a rejection, or a 429 cooldown that
 * has not passed, the very next request falls back to the shared pool. The
 * account is then capped like everyone else on the pool, which is what this
 * checks — a saved row alone is not enough.
 *
 * The key is validated before it is ever saved, so `rejectedAt` only appears
 * after NVIDIA later refuses a key that once worked (revoked, deleted, or an
 * account out of quota).
 */

import type { MutationCtx, QueryCtx } from "../_generated/server";
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
  if (!stored) return "shared";
  return keyHealth(stored, Date.now()) === "healthy" ? "own" : "shared";
}

/**
 * Whether a saved key is currently usable. Exported so the sheet can say the
 * truth about which allowance the account is on.
 */
export function keyHealth(
  row: {
    rejectedAt?: number | null;
    coolingUntil?: number | null;
  },
  now: number,
): "healthy" | "rejected" | "cooling" {
  // Zero is the "cleared" value: Convex has no undefined in stored documents.
  if ((row.rejectedAt ?? 0) > 0) return "rejected";
  if ((row.coolingUntil ?? 0) > now) return "cooling";
  return "healthy";
}
