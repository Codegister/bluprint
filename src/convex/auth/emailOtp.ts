import { Email } from "@convex-dev/auth/providers/Email";
import type { GenericActionCtxWithAuthConfig } from "@convex-dev/auth/server";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import axios from "axios";
import type { GenericDataModel } from "convex/server";
import { internal } from "../_generated/api";
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
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
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

    try {
      const message = signInEmail({ code: token });
      await axios.post(
        freebuffEmailSendUrl(),
        {
          to: email,
          from: message.from,
          subject: message.subject,
          html: message.html,
          text: message.text,
        },
        { headers: freebuffEmailHeaders() },
      );
    } catch (error) {
      throw freebuffEmailError(error);
    }

    // Only after the gateway accepted the mail: a failed send must not start a
    // cooldown or discard a code the student can still use.
    await ctx.runMutation(internal.otpGuard.noteCodeSent, { email });
  },
});

// Sign-in codes are sent by the Freebuff integrations gateway, which knows
// this project by its own key: VLY_INTEGRATION_KEY, a Convex environment
// variable set when the project was created.
//
// The gateway's `/v1/email/otp` template is deliberately not used: it names the
// sender after the integration project's slug, so codes arrived from
// "fancy-eggs-return" with fixed wording. Sending the app's own template through
// `/v1/email/send` keeps the sender BluPrint.
function freebuffEmailSendUrl(): string {
  const base =
    process.env.VLY_INTEGRATION_BASE_URL || "https://integrations.vly.ai";
  return `${base.replace(/\/+$/, "")}/v1/email/send`;
}

function freebuffEmailHeaders(): Record<string, string> {
  const key = process.env.VLY_INTEGRATION_KEY;
  if (!key) {
    throw new Error(
      "VLY_INTEGRATION_KEY is not set on this Convex deployment, so email sign-in cannot send codes.",
    );
  }
  return { Authorization: `Bearer ${key}` };
}

// Never stringify the whole request error: it carries the request headers.
function freebuffEmailError(error: unknown): Error {
  const response = (
    error as { response?: { status?: number; data?: { error?: unknown } } }
  )?.response;
  if (response) {
    const detail =
      typeof response.data?.error === "string" ? `: ${response.data.error}` : "";
    return new Error(
      `Could not send the sign-in code (HTTP ${response.status})${detail}`,
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`Could not send the sign-in code: ${message}`);
}
