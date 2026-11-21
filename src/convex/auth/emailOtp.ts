import { Email } from "@convex-dev/auth/providers/Email";
import type { GenericActionCtxWithAuthConfig } from "@convex-dev/auth/server";
import type { GenericDataModel } from "convex/server";
import { internal } from "../_generated/api";
import { sendAppEmail } from "../lib/emailGateway";
import { sixDigitCode } from "../lib/otpCode";
import { sendRefusalMessage } from "../lib/otpLimits";
import { signInEmail } from "../lib/signInEmail";

/**
 * The action context Convex Auth hands to `sendVerificationRequest` as a second
 * argument. The library's public type omits it, so it is declared here; the
 * guard writes below are only possible because the provider runs on the server.
 */
type OtpSendCtx = GenericActionCtxWithAuthConfig<GenericDataModel>;

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  async generateVerificationToken() {
    return sixDigitCode();
  },
  async sendVerificationRequest(
    { identifier: email, token }: { identifier: string; token: string },
    ctx?: OtpSendCtx,
  ) {
    // Convex Auth always supplies the context when it calls this provider. The
    // optional type keeps the config assignable to its one-argument signature.
    if (!ctx) throw new Error("Sign-in codes can only be sent by the server.");

    // The cooldown and hourly cap are checked here, server-side, before the
    // gateway is asked to send anything. The browser can neither skip nor
    // reset them.
    const gate = await ctx.runMutation(internal.otpGuard.beginSend, { email });
    // The same sentence the sign-in wrapper uses, so a send refused here and a
    // send refused before the code was written read identically.
    if (!gate.allowed) throw new Error(sendRefusalMessage(gate.retryAt, Date.now()));

    await sendAppEmail({ to: email, message: signInEmail({ code: token }) });

    // Only after the gateway accepted the mail: a failed send must not start a
    // cooldown or discard a code the student can still use.
    await ctx.runMutation(internal.otpGuard.noteCodeSent, { email });
  },
});
