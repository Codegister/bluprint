import { Email } from "@convex-dev/auth/providers/Email";
import type { GenericActionCtxWithAuthConfig } from "@convex-dev/auth/server";
import type { GenericDataModel } from "convex/server";
import { internal } from "../_generated/api";
import { sendAppEmail } from "../lib/emailGateway";
import { sixDigitCode } from "../lib/otpCode";
import { sendRefusalMessage } from "../lib/otpLimits";
import { passwordResetEmail } from "../lib/signInEmail";

/**
 * The action context Convex Auth hands to `sendVerificationRequest` as a second
 * argument. The library's public type omits it, so it is declared here; the
 * guard writes below are only possible because the provider runs on the server.
 */
type OtpSendCtx = GenericActionCtxWithAuthConfig<GenericDataModel>;

/**
 * The code that lets a student who has forgotten their password choose a new
 * one.
 *
 * This is Convex Auth's own reset flow: the `reset` call emails this code to
 * the address on a password account, and only a correct code lets the
 * `reset-verification` call replace the password. A reset therefore always
 * proves the address, exactly like the first sign-in, and no screen can change
 * a password without that proof.
 *
 * It is a separate provider from `emailOtp` so a reset code reads as a reset in
 * the inbox, and so the two code kinds are stored apart: a sign-in code can
 * never be redeemed as a reset, or the other way round.
 */
export const passwordResetOtp = Email({
  id: "password-reset",
  maxAge: 60 * 15, // 15 minutes
  async generateVerificationToken() {
    return sixDigitCode();
  },
  async sendVerificationRequest(
    { identifier: email, token }: { identifier: string; token: string },
    ctx?: OtpSendCtx,
  ) {
    if (!ctx) throw new Error("Reset codes can only be sent by the server.");

    // The same per-address cooldown and hourly cap the sign-in code obeys. The
    // wrapper in auth.ts checks it before Convex Auth writes the new code, so a
    // refused resend never destroys a reset code the student can still use.
    const gate = await ctx.runMutation(internal.otpGuard.beginSend, { email });
    if (!gate.allowed) throw new Error(sendRefusalMessage(gate.retryAt, Date.now()));

    await sendAppEmail({ to: email, message: passwordResetEmail({ code: token }) });

    // Only after the gateway accepted the mail: a failed send must not start a
    // cooldown or discard a code the student can still use.
    await ctx.runMutation(internal.otpGuard.noteCodeSent, { email });
  },
});
