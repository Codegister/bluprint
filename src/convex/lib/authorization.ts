import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";

/**
 * Server-side authorization helpers.
 *
 * This project stores almost everything per-user: study sets, courses,
 * flashcards, quiz questions, exam answers, tutor messages, revision plans,
 * and daily study records. The rule is simple: a signed-in user may only read
 * or change rows that belong to their own userId, unless a function is
 * explicitly written to allow another scope.
 *
 * Owner checks are separate from "is signed in" checks so a route can be
 * protected by authentication without granting broad data access.
 */

/** Rejects unauthenticated requests with a message safe to show in the UI. */
export async function requireUserId(ctx: {
  auth: Parameters<typeof getAuthUserId>[0]["auth"];
}): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError("Please sign in to continue.");
  }
  return userId;
}

/**
 * Owner check for any Convex document that stores `userId`.
 *
 * Convex contexts are strongly typed, so this helper does not try to replace
 * `ctx.db.get`. Instead, callers pass the same fetch function they already use
 * and this helper only verifies ownership after the row is loaded.
 */
export async function requireOwner<Row extends { userId: Id<"users"> }>(
  row: Row | null,
  userId: Id<"users">,
): Promise<Row> {
  if (!row) {
    throw new ConvexError("That item was not found.");
  }
  if (row.userId !== userId) {
    throw new ConvexError("That item does not belong to you.");
  }
  return row;
}

/**
 * Verified_account gate.
 *
 * Email OTP sign-in can leave `emailVerificationTime` unset. For flows that
 * should not be usable from an unverified address, gate them here instead of
 * relying on the client.
 */
export async function requireVerifiedUser(
  ctx: { db: { get: (id: Id<"users">) => unknown } },
  userId: Id<"users">,
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (!user || typeof user !== "object") {
    throw new ConvexError("Account not found.");
  }
  const record = user as {
    emailVerificationTime?: number | null;
    isAnonymous?: boolean | null;
  };
  // Guest (anonymous) sessions have no email address, so there is nothing to
  // verify. The gate only applies to accounts that signed in with an email.
  if (record.isAnonymous) return;
  if (!record.emailVerificationTime) {
    throw new ConvexError("Please verify your email before continuing.");
  }
}

/**
 * Admin gate.
 *
 * Roles are optional by default, so the absence of a role is not an admin
 * role. Only explicit `admin` access is granted here.
 */
export async function requireAdmin(
  ctx: { db: { get: (id: Id<"users">) => unknown } },
  userId: Id<"users">,
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (!user || typeof user !== "object") {
    throw new ConvexError("Account not found.");
  }
  if ((user as { role?: string | null }).role !== "admin") {
    throw new ConvexError("This action is restricted to admins.");
  }
}
