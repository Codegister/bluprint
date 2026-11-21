import {
  getAuthSessionId,
  getAuthUserId,
  invalidateSessions,
  modifyAccountCredentials,
  retrieveAccount,
  type GenericActionCtxWithAuthConfig,
} from "@convex-dev/auth/server";
import type { GenericDataModel } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { passwordRefusal } from "./lib/passwordRefusal";
import { MIN_PASSWORD_LENGTH } from "./lib/passwordRules";

/**
 * Changing a password from inside a signed-in session.
 *
 * The installed `@convex-dev/auth` has no "change password" flow of its own:
 * its `Password` provider offers sign-up, sign-in, reset and reset-verification
 * only. What it does expose is the two server-side pieces the reset flow is
 * built from — `retrieveAccount`, which checks a secret against the stored
 * hash, and `modifyAccountCredentials`, which hashes and stores a new one — and
 * both are callable from an app action. This action is the missing flow:
 *
 * 1. the caller must be signed in, and the password account is looked up from
 *    *that* session's user, never from an address the browser supplies, so the
 *    action cannot be aimed at somebody else's account;
 * 2. the current password must be correct, checked by the same hash
 *    verification and the same five-failures-an-hour counter as signing in;
 * 3. only then is the new password hashed and stored, and every other session
 *    on the account is deleted so an old device cannot keep the account.
 *
 * The code-based reset is untouched: it remains the way back in for a student
 * who has forgotten the password, and it still proves the address. This screen
 * is for the student who remembers it and would rather not sign out.
 */
export const changePassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { currentPassword, newPassword }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Please sign in to continue");

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new ConvexError(
        `Choose a password with at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }
    if (newPassword === currentPassword) {
      throw new ConvexError(
        "Choose a password different from your current one.",
      );
    }

    // The address comes from the signed-in account, so the client cannot point
    // this at another student's password account. An internal query is used on
    // purpose: it reads the row by the id this action already proved, rather
    // than depending on who the nested function can see.
    const address = await ctx.runQuery(internal.users.emailForAccount, {
      userId: userId as Id<"users">,
    });
    const email = address?.trim().toLowerCase();
    if (!email) {
      throw new ConvexError(
        "Your account has no email address to change a password for.",
      );
    }

    // The helpers below are typed against the auth config's action context; the
    // app's action context carries the same machinery at runtime.
    const authCtx =
      ctx as unknown as GenericActionCtxWithAuthConfig<GenericDataModel>;

    // A wrong current password is refused by the library, which also counts it
    // against the account's hourly limit, so this screen cannot be used to
    // guess at a password any faster than the sign-in form could.
    try {
      await retrieveAccount(authCtx, {
        provider: "password",
        account: { id: email, secret: currentPassword },
      });
    } catch (error) {
      throw new ConvexError(passwordRefusal(error, "change"));
    }

    try {
      await modifyAccountCredentials(authCtx, {
        provider: "password",
        account: { id: email, secret: newPassword },
      });
    } catch {
      // The library's own message names the account id; it is not for the page.
      throw new ConvexError(
        "We couldn't save that password. Try again in a moment.",
      );
    }

    // The password changed, so every other device holding a session for it is
    // signed out. This session stays, because the student is standing on it.
    const sessionId = await getAuthSessionId(ctx);
    await invalidateSessions(authCtx, {
      userId: userId as Id<"users">,
      ...(sessionId ? { except: [sessionId as Id<"authSessions">] } : {}),
    });

    return { changed: true };
  },
});
