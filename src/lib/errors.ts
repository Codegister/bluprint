/**
 * Convex surfaces uncaught server errors with a request id and stack trace.
 * The underlying message is the useful part, so trim the wrapper before it
 * reaches a toast or an inline alert.
 */
export function readableError(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message.trim()) return fallback;

  const uncaught = error.message.match(/Uncaught Error:\s*([^\n]+)/);
  const message = (uncaught?.[1] ?? error.message)
    .replace(/^\[[^\]]*Request ID[^\]]*\]\s*/i, "")
    .replace(/^Server Error\s*/i, "")
    .replace(/\s+at handler[\s\S]*$/, "")
    .trim();

  // A validator path, a stack fragment or raw model JSON is never a message a
  // student can act on. Anything that looks internal is replaced, not shown.
  if (looksInternal(message)) return fallback;
  return message || fallback;
}

/** Whether a message is a developer error rather than something for a student. */
function looksInternal(message: string): boolean {
  return /ArgumentValidationError|Validator|\bPath:\s*\.|\bat handler\b|Cannot read propert|\.tsx?:\d+|\bat [A-Za-z0-9_.]+ \(|Unexpected token|JSON at position|\[CONVEX|[{}]/.test(
    message,
  );
}

/** What a failed build stores when it cannot name a cause the student can act on. */
export const BUILD_FAILED_MESSAGE =
  "We couldn't finish building this set. Your notes are saved — try again.";

export const RATE_LIMIT_MESSAGE =
  "NVIDIA is rate-limiting Bluprint right now. Wait about a minute, then rebuild this set. Your notes are saved.";

/**
 * The message shown for a failed build.
 *
 * New failures are already sanitised on the server. Sets that failed before
 * that change still carry messages like "ArgumentValidationError: Object
 * contains extra field `title` … Path: .summary", so the same rule is applied
 * again here: only a sentence written for a student is shown, and the
 * rate-limit hint appears only when the failure really was a 429.
 */
export function buildErrorMessage(raw?: string | null): {
  message: string;
  rateLimited: boolean;
} {
  const value = (raw ?? "").trim();
  const rateLimited =
    /rate.?limit|too many requests|\b429\b/i.test(value) ||
    value === RATE_LIMIT_MESSAGE;
  if (rateLimited) return { message: RATE_LIMIT_MESSAGE, rateLimited: true };

  const safe = [
    "We couldn't finish building this set",
    "Bluprint couldn't find enough readable text",
    "NVIDIA did not return any usable material",
    "NVIDIA_API_KEY is not set on this deployment",
    "Your NVIDIA account has no available credits",
  ].some((start) => value.startsWith(start));

  return {
    message: safe && value ? value.slice(0, 400) : BUILD_FAILED_MESSAGE,
    rateLimited: false,
  };
}
