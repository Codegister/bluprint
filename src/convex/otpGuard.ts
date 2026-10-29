import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, query } from "./_generated/server";
import {
  MAX_CODE_ATTEMPTS,
  MAX_HOURLY_ATTEMPTS,
  MAX_SENDS_PER_HOUR,
  RESEND_COOLDOWN_MS,
} from "./lib/otpLimits";

/**
 * Brute-force and abuse protection for the six-digit email code.
 *
 * Nothing in this module is callable from the browser except `status`, which
 * answers only for the signed-in account and holds no email argument. Sends
 * are recorded by the email provider after the gateway accepts the mail, and a
 * successful verification clears the record from Convex Auth's own success
 * callback. A wrong code is counted by Convex Auth itself (see the
 * `maxFailedAttempsPerHour` setting in auth.ts), so a client can no longer
 * create, reset or discard a guard for somebody else's address.
 *
 * The arithmetic is in lib/otpLimits.ts so it can be tested, and the rules live
 * on the server so a reload cannot hand attempts back.
 */

const HOUR_MS = 60 * 60 * 1000;

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

type GuardRow = Doc<"otpGuards">;

async function rowFor(
  ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
  email: string,
): Promise<GuardRow | null> {
  return await ctx.db
    .query("otpGuards")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
}

/**
 * Live state for the caller's own account. The sign-in page no longer reads
 * this (it is signed out, so it has no identity to prove); it exists for an
 * account screen that needs to show its own cooldown or lock.
 *
 * Deliberately returns only the three fields a countdown needs: an address
 * cannot be probed for whether a code exists, how many codes were sent, or any
 * other account's state.
 */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const blank = {
      attemptsLeft: MAX_CODE_ATTEMPTS,
      resendAt: 0,
      lockedUntil: 0,
    };
    const userId = await getAuthUserId(ctx);
    if (!userId) return blank;
    const user = await ctx.db.get(userId);
    const email = user?.email?.trim();
    if (!email) return blank;

    const now = Date.now();
    const row = await rowFor(ctx, email.toLowerCase());
    const limit = await ctx.db
      .query("authRateLimits")
      .withIndex("identifier", (q) => q.eq("identifier", email))
      .unique();

    const attemptsLeft = limit
      ? Math.max(
          0,
          Math.min(MAX_CODE_ATTEMPTS, Math.ceil(limit.attemptsLeft)),
        )
      : MAX_CODE_ATTEMPTS;
    // Convex Auth refills attempts continuously at max/hour. The lock lifts
    // when one attempt is available again.
    const lockedUntil =
      limit && limit.attemptsLeft < 1
        ? limit.lastAttemptTime +
          (1 - limit.attemptsLeft) * (HOUR_MS / MAX_HOURLY_ATTEMPTS)
        : 0;

    return {
      attemptsLeft,
      resendAt: row ? row.lastCodeSentAt + RESEND_COOLDOWN_MS : 0,
      lockedUntil: Math.max(lockedUntil, 0),
    };
  },
});

/**
 * Every outstanding code for one address, oldest first.
 *
 * Accounts store the address as it was typed, so the scan compares the
 * lowercased form rather than trusting one exact spelling.
 */
async function codesForAddress(
  ctx: MutationCtx,
  address: string,
): Promise<Array<{ _id: Id<"authVerificationCodes">; _creationTime: number }>> {
  const accounts = await ctx.db
    .query("authAccounts")
    .withIndex("providerAndAccountId", (q) => q.eq("provider", "email-otp"))
    .collect();

  const codes: Array<{ _id: Id<"authVerificationCodes">; _creationTime: number }> = [];
  for (const account of accounts) {
    if (account.providerAccountId.trim().toLowerCase() !== address) continue;
    const rows = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", account._id))
      .collect();
    for (const row of rows) {
      codes.push({ _id: row._id, _creationTime: row._creationTime });
    }
  }
  return codes.sort((a, b) => a._creationTime - b._creationTime);
}

/**
 * Deletes every outstanding code for an address except the newest one. Called
 * right after a code has been emailed, so the code the student was just sent
 * survives and any earlier one stops working immediately.
 */
async function discardOlderCodes(
  ctx: MutationCtx,
  address: string,
): Promise<void> {
  const codes = await codesForAddress(ctx, address);
  const newest = codes[codes.length - 1];
  for (const code of codes) {
    if (code._id !== newest?._id) await ctx.db.delete(code._id);
  }
}

/**
 * Whether the server may send another code right now: one a minute, and a
 * hard hourly cap so one address cannot be used to flood an inbox. Called by
 * the email provider before it talks to the gateway, never by a client.
 */
export const beginSend = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const address = normaliseEmail(email);
    if (!address) return { allowed: false, retryAt: 0 };

    const now = Date.now();
    const row = await rowFor(ctx, address);
    if (!row) return { allowed: true, retryAt: 0 };

    const resendAt = row.lastCodeSentAt + RESEND_COOLDOWN_MS;
    if (resendAt > now) return { allowed: false, retryAt: resendAt };

    const windowStart = row.sendWindowStart ?? 0;
    const windowOpen = now - windowStart < HOUR_MS;
    const sent = windowOpen ? (row.sendWindowCount ?? 0) : 0;
    if (sent >= MAX_SENDS_PER_HOUR) {
      return { allowed: false, retryAt: windowStart + HOUR_MS };
    }

    return { allowed: true, retryAt: 0 };
  },
});

/**
 * Records that a code was just emailed. Resets the per-code count (a fresh code
 * deserves a fresh five) but keeps the hourly send window and the failures, so
 * resending is not a way to get more guesses.
 *
 * Issuing a new code also throws away every older outstanding code, except the
 * one just sent: two live codes would mean two sets of five guesses, and a
 * student who asked for a resend because their first code never arrived should
 * not leave that code usable for a brute-force attempt.
 */
export const noteCodeSent = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const address = normaliseEmail(email);
    if (!address) throw new Error("Enter an email address first.");

    const now = Date.now();
    const row = await rowFor(ctx, address);
    if (!row) {
      await discardOlderCodes(ctx, address);
      await ctx.db.insert("otpGuards", {
        email: address,
        codeFailures: 0,
        windowStart: now,
        windowFailures: 0,
        lastCodeSentAt: now,
        sendWindowStart: now,
        sendWindowCount: 1,
      });
      return;
    }

    await discardOlderCodes(ctx, address);

    const windowOpen = now - row.windowStart < HOUR_MS;
    const sendWindowStart = row.sendWindowStart ?? now;
    const sendWindowOpen = now - sendWindowStart < HOUR_MS;
    await ctx.db.patch(row._id, {
      codeFailures: 0,
      codeInvalidated: false,
      lastCodeSentAt: now,
      lastFailedAt: undefined,
      // A window older than an hour starts again, which is what lets a student
      // who mistyped five times yesterday try again today.
      windowStart: windowOpen ? row.windowStart : now,
      windowFailures: windowOpen ? row.windowFailures : 0,
      sendWindowStart: sendWindowOpen ? sendWindowStart : now,
      sendWindowCount: (sendWindowOpen ? (row.sendWindowCount ?? 0) : 0) + 1,
    });
  },
});

/** A correct code clears the record, so the next sign-in starts from zero. */
export async function clearGuard(
  ctx: MutationCtx,
  email: string,
): Promise<boolean> {
  const row = await rowFor(ctx, normaliseEmail(email));
  if (!row) return false;
  await ctx.db.delete(row._id);
  return true;
}

/** Internal wrapper so the success callback and server code share one path. */
export const recordSuccess = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return { cleared: await clearGuard(ctx, email) };
  },
});
