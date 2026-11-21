/**
 * The two code emails: signing in, and resetting a forgotten password.
 *
 * The gateway's ready-made OTP template names the sender after the project slug
 * the integration key belongs to ("fancy-eggs-return") and its wording is fixed
 * by the gateway, so a code sent through `/v1/email/otp` never reads as
 * BluPrint. Codes are therefore sent through `/v1/email/send` with these
 * templates: the display name is the app's, not the project's.
 *
 * Kept pure so the subject, sender and body can be checked without a network
 * call or a Convex deployment.
 */
export const SIGN_IN_FROM = "BluPrint <noreply@project.freebuff.dev>";

export type SignInEmail = {
  from: string;
  subject: string;
  html: string;
  text: string;
};

export function signInEmail({
  code,
  expiresInMinutes = 15,
}: {
  code: string;
  expiresInMinutes?: number;
}): SignInEmail {
  const minutes = `${expiresInMinutes} minutes`;
  return renderCodeEmail({
    code,
    subject: "Your BluPrint sign-in code",
    heading: "Your sign-in code",
    intro: "Enter this code on the BluPrint page to finish signing in.",
    footer: `The code expires in ${minutes}. If you did not try to sign in, you can ignore this email.`,
    text: [
      "BluPrint",
      "",
      `Your sign-in code is: ${code}`,
      "",
      `Enter it on the BluPrint page. The code expires in ${minutes}.`,
      "If you did not try to sign in, you can ignore this email.",
    ],
  });
}

/**
 * The code a student who has forgotten their password needs before they can
 * choose a new one. Deliberately a different subject and a different sentence:
 * a reset code is never a sign-in code, and the page asks for it separately.
 */
export function passwordResetEmail({
  code,
  expiresInMinutes = 15,
}: {
  code: string;
  expiresInMinutes?: number;
}): SignInEmail {
  const minutes = `${expiresInMinutes} minutes`;
  return renderCodeEmail({
    code,
    subject: "Your BluPrint password reset code",
    heading: "Choose a new password",
    intro:
      "Enter this code on the BluPrint page, then choose the password you want to use from now on.",
    footer: `The code expires in ${minutes}. If you did not ask to reset your password, you can ignore this email — your password has not changed.`,
    text: [
      "BluPrint",
      "",
      `Your password reset code is: ${code}`,
      "",
      `Enter it on the BluPrint page and choose a new password. The code expires in ${minutes}.`,
      "If you did not ask to reset your password, you can ignore this email; your password has not changed.",
    ],
  });
}

/** The one layout both codes use, so an email always looks like BluPrint. */
function renderCodeEmail({
  code,
  subject,
  heading,
  intro,
  footer,
  text,
}: {
  code: string;
  subject: string;
  heading: string;
  intro: string;
  footer: string;
  text: string[];
}): SignInEmail {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
  </head>
  <body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
      <p style="margin:0 0 20px;font-size:15px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#4f46e5;">BluPrint</p>
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">${heading}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">${intro}</p>
      <p style="margin:0 0 20px;padding:16px 0;text-align:center;border-radius:10px;background:#111827;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:28px;font-weight:700;letter-spacing:0.3em;text-indent:0.3em;color:#ffffff;">${escapeHtml(code)}</p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">${footer}</p>
    </div>
  </body>
</html>`;

  return { from: SIGN_IN_FROM, subject, html, text: text.join("\n") };
}

/**
 * The code is digits today, but the html is built here and would otherwise be a
 * place for an unexpected character to break out of the markup.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
