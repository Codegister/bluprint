/**
 * What a password failure says, written for a student.
 *
 * Convex Auth throws bare errors ("Invalid credentials", "Invalid code",
 * "TooManyFailedAttempts", "InvalidAccountId"), and Convex redacts those to
 * "Server Error" before the browser sees them. The wrapper in auth.ts turns
 * them into ConvexErrors, which do reach the page, and this module is the one
 * place that decides the words.
 *
 * The flow matters: a refused reset is not a refused sign-in, and telling a
 * student their "email and password don't match" when they asked for a reset
 * code sends them looking for the wrong problem.
 */
export function passwordRefusal(error: unknown, flow?: string): string {
  const message = error instanceof Error ? error.message : String(error);

  // The email providers refuse a send with the sentence the page already
  // shows, wait included. Carrying it through keeps the countdown honest.
  if (
    /^(A code was requested recently|Too many codes have been requested for this address)/.test(
      message,
    )
  ) {
    return message;
  }

  if (/TooManyFailedAttempts|too many attempts/i.test(message)) {
    if (flow === "change") {
      return "Too many tries. Wait a few minutes, then try again.";
    }
    return flow === "reset" || flow === "reset-verification"
      ? "Too many tries. Wait a few minutes, then request a new reset code."
      : "Too many password tries. Wait a few minutes, or email yourself a code.";
  }

  if (flow === "change") {
    if (/InvalidAccountId/i.test(message)) {
      return "This account doesn't have a password to change yet.";
    }
    if (/InvalidSecret|Invalid credentials|Invalid password/i.test(message)) {
      return "That current password doesn't match. Check it, or use \"Forgot your password?\" on the sign-in page.";
    }
    return "We couldn't change that password. Try again in a moment.";
  }

  if (flow === "reset") {
    if (/InvalidAccountId/i.test(message)) {
      return "That address doesn't have a password to reset. Sign in with an emailed code instead.";
    }
    if (/could not send/i.test(message)) {
      return "We couldn't send the reset code. Check the address, then try again in a minute.";
    }
    return "We couldn't send a reset code. Try again in a minute, or email yourself a sign-in code.";
  }

  if (flow === "reset-verification") {
    if (/Missing `newPassword`/i.test(message)) {
      return "Choose a password with at least 8 characters.";
    }
    if (/Invalid code|Could not verify|InvalidSecret|InvalidAccountId/i.test(message)) {
      return "That code didn't work. Check it, or request a new one.";
    }
    return "We couldn't set that password. Try again, or email yourself a sign-in code.";
  }

  if (/already exists/i.test(message)) {
    // Now that a reset exists, a student who set a password and forgot it has a
    // way out of this sentence instead of being told to remember it.
    return "This account already has a password. Sign in with it, or reset it if you have forgotten it.";
  }

  if (/InvalidAccountId|InvalidSecret|Invalid credentials|Invalid password/i.test(message)) {
    return "That email and password don't match an account. Check them, or email yourself a code.";
  }
  return "The password could not be checked. Email yourself a code instead.";
}
