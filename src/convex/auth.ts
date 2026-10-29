import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { internal } from "./_generated/api";
import { emailOtp } from "./auth/emailOtp";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [emailOtp, Anonymous],
  // Convex Auth records every failed verification on the server, keyed by the
  // email being verified, and this is the limit that stops sustained guessing.
  // It is the same threshold as MAX_HOURLY_ATTEMPTS, so the page and the server
  // agree on when a student is locked out.
  signIn: { maxFailedAttempsPerHour: 5 },
  callbacks: {
    /**
     * A correct code clears its guard. This runs inside the verification
     * mutation after the account is created or linked, so the browser never
     * needs — and never gets — a way to clear the record itself.
     */
    async afterUserCreatedOrUpdated(ctx, { profile }) {
      if (typeof profile.email !== "string" || !profile.email) return;
      await ctx.runMutation(internal.otpGuard.recordSuccess, {
        email: profile.email,
      });
    },
  },
});
