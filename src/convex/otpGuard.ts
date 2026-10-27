import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { MAX_CODE_ATTEMPTS, describeAttempts } from "./lib/otpLimits";

/**
 * Brute-force protection for the six-digit email code.
 *
 * Convex Auth verifies the code but leaves the number of wrong guesses open, so
 * a six-digit code could be guessed at for as long as it lives. This module
 * keeps the attempt record: five wrong codes invalidate the code outright, and
 * every further guess asks for a longer wait first. The hourly window survives
 * a resend, so requesting another code never buys more guesses.
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

/** Live state for one address; the sign-in page subscribes to this. */
export const status = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const address = normaliseEmail(email);
    if (!address) {
      return describeAttempts(null, Date.now());
    }
    return describeAttempts(await rowFor(ctx, address), Date.now());
  },
});

/**
 * Records that a code was just emailed. Resets the per-code count (a fresh code
 * deserves a fresh five) but keeps the hourly window, so resending is not a way
 * to get more guesses.
 */
export const noteCodeSent = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const address = normaliseEmail(email);
    if (!address) throw new Error("Enter an email address first.");

    const now = Date.now();
    const row = await rowFor(ctx, address);
    if (!row) {
      await ctx.db.insert("otpGuards", {
        email: address,
        codeFailures: 0,
        windowStart: now,
        windowFailures: 0,
        lastCodeSentAt: now,
      });
      return describeAttempts(null, now);
    }

    const windowOpen = now - row.windowStart < HOUR_MS;
    await ctx.db.patch(row._id, {
      codeFailures: 0,
      codeInvalidated: false,
      lastCodeSentAt: now,
      lastFailedAt: undefined,
      // A window older than an hour starts again, which is what lets a student
      // who mistyped five times yesterday try again today.
      windowStart: windowOpen ? row.windowStart : now,
      windowFailures: windowOpen ? row.windowFailures : 0,
    });
    return describeAttempts(await rowFor(ctx, address), now);
  },
});

/**
 * Records one wrong code. At five misses the code is deleted from Convex Auth's
 * table, so it cannot be verified at all — not even by a client that skips this
 * page — until a new one is sent.
 */
export const recordFailure = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const address = normaliseEmail(email);
    if (!address) throw new Error("Enter an email address first.");

    const now = Date.now();
    const row = await rowFor(ctx, address);
    if (!row) {
      await ctx.db.insert("otpGuards", {
        email: address,
        codeFailures: 1,
        windowStart: now,
        windowFailures: 1,
        lastCodeSentAt: now,
        lastFailedAt: now,
      });
      return describeAttempts(await rowFor(ctx, address), now);
    }

    const windowOpen = now - row.windowStart < HOUR_MS;
    const codeFailures = row.codeFailures + 1;
    const dead = codeFailures >= MAX_CODE_ATTEMPTS;

    await ctx.db.patch(row._id, {
      codeFailures,
      codeInvalidated: dead ? true : row.codeInvalidated,
      lastFailedAt: now,
      windowStart: windowOpen ? row.windowStart : now,
      windowFailures: (windowOpen ? row.windowFailures : 0) + 1,
    });

    if (dead) {
      // Throw the code away so the count is a real limit rather than a message.
      // Accounts store the address as it was typed, so the scan compares the
      // lowercased form rather than trusting one exact spelling.
      const accounts = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) => q.eq("provider", "email-otp"))
        .collect();
      for (const account of accounts) {
        if (account.providerAccountId.trim().toLowerCase() !== address) continue;
        const codes = await ctx.db
          .query("authVerificationCodes")
          .withIndex("accountId", (q) => q.eq("accountId", account._id))
          .collect();
        for (const code of codes) {
          await ctx.db.delete(code._id);
        }
      }
    }

    return describeAttempts(await rowFor(ctx, address), now);
  },
});

/** A correct code clears the record, so the next sign-in starts from zero. */
export const recordSuccess = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const row = await rowFor(ctx, normaliseEmail(email));
    if (row) await ctx.db.delete(row._id);
    return { cleared: row !== null };
  },
});
