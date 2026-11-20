import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Whether an address has a password, so the sign-in page knows which form to
 * show: email and password for a returning student, the emailed code for
 * everyone else.
 *
 * This says nothing about whether an account exists. An address that has only
 * ever signed in with a code answers `false`, exactly like an address nobody
 * has ever used, so it cannot be read as a list of who has signed up. The
 * password account row itself is created only after a code has verified the
 * address (see `createOrUpdateUser` in auth.ts).
 */
export const hasPassword = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const address = email.trim().toLowerCase();
    if (!address) return false;
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", address),
      )
      .unique();
    return account !== null;
  },
});
