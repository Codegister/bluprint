import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { emailOtp } from "./auth/emailOtp";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [emailOtp, Anonymous],
  // A backstop for the attempt limit in convex/otpGuard.ts: this is enforced by
  // Convex Auth itself on every failed code, so a client that never calls the
  // guard still cannot guess codes indefinitely. It is the same threshold as
  // MAX_HOURLY_ATTEMPTS, so the page and the server agree on when a student is
  // locked out.
  signIn: { maxFailedAttempsPerHour: 5 },
});