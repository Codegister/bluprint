/**
 * Sending one of the app's own emails through the Freebuff integrations
 * gateway.
 *
 * Sign-in codes and password-reset codes both arrive from BluPrint, not from
 * the integration project's slug, so both are sent through
 * `/v1/email/send` with a template written here. The gateway details live in
 * this one place so the two providers cannot drift.
 */
import axios from "axios";

export type OutgoingEmail = {
  from: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendAppEmail({
  to,
  message,
}: {
  to: string;
  message: OutgoingEmail;
}): Promise<void> {
  try {
    await axios.post(
      freebuffEmailSendUrl(),
      {
        to,
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
}

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
