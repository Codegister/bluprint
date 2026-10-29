import { convexAuth, getAuthSessionId } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  action,
  type ActionCtx,
  type MutationCtx,
} from "./_generated/server";
import { emailOtp } from "./auth/emailOtp";

/**
 * The auth configuration also owns the two server-side protections that cannot
 * live in the browser:
 *
 * - `createOrUpdateUser` links an email code verified from a guest session to
 *   that same guest user, so adding an email keeps the user id and every set.
 * - the exported `signIn` action counts each verification attempt against the
 *   caller's IP before Convex Auth checks the code. A client cannot skip it by
 *   calling the generated action under another name because the original
 *   builder is not exported.
 */
const authConfig = convexAuth({
  providers: [emailOtp, Anonymous],
  // Convex Auth records every failed verification on the server, keyed by the
  // email being verified, and this is the limit that stops sustained guessing.
  // It is the same threshold as MAX_HOURLY_ATTEMPTS, so the page and the server
  // agree on when a student is locked out.
  signIn: { maxFailedAttempsPerHour: 5 },
  callbacks: {
    /**
     * Replaces Convex Auth's default user linking so a guest who adds an email
     * keeps the same `users` row. The default implementation creates a new user
     * for a new email address, which would strand every guest set behind the
     * old id.
     *
     * A real, already-verified account always wins: signing in with an email
     * that has an account must open that account, not fork it. A placeholder
     * created when the code was sent is anonymous and is removed once the
     * guest is linked.
     */
    async createOrUpdateUser(ctx, { existingUserId, type, profile }) {
      // The auth callback's context is generic, so its `db` only knows the
      // system indexes. Cast once to the app's generated writer so the email
      // and per-user indexes below are typed.
      const db = ctx.db as unknown as MutationCtx["db"];
      const email =
        typeof profile.email === "string"
          ? profile.email.trim().toLowerCase()
          : undefined;
      const verified =
        type === "verification" || profile.emailVerified === true;

      // A returning student: the account that already exists is the one to
      // open. Never move it onto the guest.
      if (existingUserId) {
        const existing = await ctx.db.get(existingUserId);
        if (existing && !existing.isAnonymous) {
          if (verified && email) {
            await ctx.db.patch(existing._id, {
              email,
              emailVerificationTime: Date.now(),
            });
          }
          return existing._id;
        }
      }

      // No account id was supplied (this is the send path, or the first
      // verification). Reuse a verified user with this email if there is one,
      // or the anonymous placeholder created by an earlier send.
      if (email) {
        const sameEmail = await db
          .query("users")
          .withIndex("email", (q) => q.eq("email", email))
          .collect();
        const verifiedUser = sameEmail.find(
          (user) => user.emailVerificationTime !== undefined,
        );
        if (verifiedUser) return verifiedUser._id;
        const placeholder = sameEmail.find(
          (user) => user.isAnonymous && user.emailVerificationTime === undefined,
        );
        if (placeholder && type !== "verification") return placeholder._id;
      }

      // The important conversion: a guest verifying an email code keeps the
      // guest's user id, so every set, card and answer stays attached.
      if (type === "verification" && email) {
        const sessionId = await getAuthSessionId(ctx);
        if (sessionId) {
          const session = await ctx.db.get(sessionId);
          const current = session ? await ctx.db.get(session.userId) : null;
          if (current?.isAnonymous) {
            await ctx.db.patch(current._id, {
              email,
              emailVerificationTime: Date.now(),
              isAnonymous: false,
            });
            // The code-send path may have created an empty placeholder for
            // this email. It has no data and is now unreachable; remove it.
            if (existingUserId && existingUserId !== current._id) {
              const placeholder = await ctx.db.get(existingUserId);
              if (placeholder?.isAnonymous && !placeholder.emailVerificationTime) {
                const [set, course] = await Promise.all([
                  db
                    .query("studySets")
                    .withIndex("by_user_updated", (q) =>
                      q.eq("userId", placeholder._id),
                    )
                    .first(),
                  db
                    .query("courses")
                    .withIndex("by_user_updated", (q) =>
                      q.eq("userId", placeholder._id),
                    )
                    .first(),
                ]);
                if (!set && !course) await ctx.db.delete(placeholder._id);
              }
            }
            return current._id;
          }
        }
      }

      // A placeholder created by the send path, verified from a signed-out
      // browser. There is no guest to preserve; this row becomes the account.
      if (existingUserId) {
        const existing = await ctx.db.get(existingUserId);
        if (existing) {
          if (email) {
            await ctx.db.patch(existing._id, {
              email,
              ...(verified ? { emailVerificationTime: Date.now() } : {}),
              ...(verified ? { isAnonymous: false } : {}),
            });
          }
          return existing._id;
        }
      }

      const userData: {
        name?: string;
        image?: string;
        email?: string;
        emailVerificationTime?: number;
        isAnonymous?: boolean;
      } = {};
      if (typeof profile.name === "string") userData.name = profile.name;
      if (typeof profile.image === "string") userData.image = profile.image;
      if (email) userData.email = email;
      if (verified && email) userData.emailVerificationTime = Date.now();
      // A user created only to hold a pending email code is anonymous until
      // the code is verified. The anonymous provider also sets this flag.
      if (type === "email" || profile.isAnonymous === true) {
        userData.isAnonymous = true;
      }
      return await ctx.db.insert("users", userData);
    },

    /**
     * A correct code clears its guard. This runs inside the verification
     * mutation after the account is created or linked, so the browser never
     * needs — and never gets — a way to clear the record itself.
     */
    async afterUserCreatedOrUpdated(ctx, { profile }) {
      // The send path also creates or touches the user row, so an email alone
      // is not proof that a code was entered. Only a verified profile clears
      // the counters; otherwise a send would reset the five-try limit.
      if (profile.emailVerified !== true) return;
      if (typeof profile.email !== "string" || !profile.email) return;
      await ctx.runMutation(internal.otpGuard.recordSuccess, {
        email: profile.email,
      });
    },
  },
});

export const { auth, signOut, store, isAuthenticated } = authConfig;

/**
 * The client-facing sign-in action. It is deliberately a wrapper: every email
 * code verification is counted against the caller's request IP before the
 * library sees it, so one machine cannot spray codes across many addresses.
 *
 * The original action is invoked through its handler, not re-exported under
 * another public name, so a browser cannot bypass this check.
 */
const originalSignIn = authConfig.signIn;
type AuthSignInResult = {
  tokens?: unknown;
  started?: boolean;
  redirect?: string;
  verifier?: string;
};
type SignInArgs = {
  provider?: string;
  params?: Record<string, unknown>;
  verifier?: string;
  refreshToken?: string;
  calledBy?: string;
};

export const signIn = action({
  args: {
    provider: v.optional(v.string()),
    params: v.optional(v.any()),
    verifier: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    calledBy: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<AuthSignInResult> => {
    const verifyingEmailCode =
      args.params?.code !== undefined &&
      (args.provider === undefined || args.provider === "email-otp");

    if (verifyingEmailCode) {
      const email =
        typeof args.params?.email === "string" ? args.params.email : "";

      // Count the attempt against the caller's IP first, before looking at
      // any address, so one machine cannot spray verifications for free.
      const gate = await ctx.runMutation(internal.otpGuard.noteVerifyAttempt, {
        email,
      });
      if (!gate.allowed) {
        const wait =
          gate.retryAt > Date.now()
            ? Math.ceil((gate.retryAt - Date.now()) / 1000)
            : 0;
        throw new Error(
          wait > 0
            ? `Too many codes were tried from this network. Try again in ${wait}s.`
            : "Too many codes were tried from this network. Try again later.",
        );
      }

      // A per-address failure is only recorded when there is a code that could
      // still be entered. An expired or invented address is refused here,
      // before Convex Auth's failure counter is touched, so a stranger cannot
      // lock an address by guessing at nothing.
      const liveCode = await ctx.runQuery(internal.otpGuard.hasLiveCode, {
        email,
      });
      if (!liveCode) {
        throw new Error("That code has expired. Request a new code.");
      }
    }

    // Invoke the original builder's handler directly. Re-exporting the
    // generated action would give the browser a second, ungated entry point.
    const original = originalSignIn as unknown as {
      _handler: (ctx: ActionCtx, args: SignInArgs) => Promise<AuthSignInResult>;
    };
    return await original._handler(ctx, args as SignInArgs);
  },
});
