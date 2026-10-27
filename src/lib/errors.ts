/**
 * Turning a failure into a sentence a student can read.
 *
 * Everything a failure path shows goes through here, because Convex and its
 * client SDK surface engine-level text: "Uncaught Error: [Request ID: abc]
 * Server Error", "Update on nonexistent document ID kn7fs…", validator paths,
 * raw model JSON. None of that belongs on screen, and the audit reproduced
 * exactly that: deleting a set mid-build printed an engine message next to
 * "Set deleted."
 *
 * The rule is one-directional: a message is shown only when it is recognisably
 * written for a student. Anything unrecognised becomes the caller's fallback,
 * and the original is logged. Server-side detail (provider, model, HTTP status)
 * is logged by the Convex action that failed, never returned.
 */

import { toast } from "sonner";

/** What the app shows when it cannot name a cause a student can act on. */
export const BUILD_FAILED_MESSAGE =
  "We couldn't finish building this set. Your notes are saved — try again.";

/** The one AI failure a student can act on, so it is named rather than hidden. */
export const RATE_LIMIT_MESSAGE =
  "The AI is rate-limiting Bluprint right now. Wait about a minute, then try again.";

/** Sentences the app writes for students, shown as they are. */
const STUDENT_MESSAGES = [
  "Bluprint couldn't find enough readable text",
  "The AI did not return any usable material",
  "Bluprint's AI is having trouble right now",
  "The tutor is having trouble right now",
  "The AI is rate-limited right now",
  "The AI is rate-limiting Bluprint right now",
  "Dictation is not working right now",
  "We couldn't finish building this set",
  "We couldn't finish this paper",
  "Please verify your email",
  "Study set not found",
  "Flashcard not found",
  "Exam question not found",
  "Past paper question not found",
  "Course not found",
  "Write a question for the tutor first",
  "Write a fuller answer before sending it for grading",
  "Say or type an answer before checking it",
  "Paste at least a few sentences",
  "That's a lot of notes",
  "Your notes are too long",
  "Bluprint can build up to",
  "You've reached today's build limit",
  "You have reached the build limit",
];

/**
 * The underlying message is the useful part, so the wrapper is trimmed before
 * it reaches a toast or an inline alert.
 */
export function readableError(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message.trim()) return fallback;

  const uncaught = error.message.match(/Uncaught Error:\s*([^\n]+)/);
  const message = (uncaught?.[1] ?? error.message)
    .replace(/^\[[^\]]*Request ID[^\]]*\]\s*/i, "")
    .replace(/^Server Error\s*/i, "")
    .replace(/\s+at handler[\s\S]*$/, "")
    .trim();

  // A validator path, a stack fragment, an engine message or raw model JSON is
  // never a message a student can act on. Anything that looks internal is
  // replaced, not shown.
  if (looksInternal(message)) return fallback;
  return message || fallback;
}

/**
 * Whether a message is a developer error rather than something for a student.
 * A message is trusted only if it is one of the sentences written for students;
 * everything else is treated as internal, which is what keeps a new engine
 * error from leaking the day it appears.
 */
function looksInternal(message: string): boolean {
  // Engine and SDK text that has reached the UI before.
  if (
    /ArgumentValidationError|Validator|\bPath:\s*\.|nonexistent document|invalid ID|Document ID|SystemError|ConvexError|Request ID|Server Error|Uncaught|Cannot read propert|Cannot find|Cannot convert|\bat handler\b|\.tsx?:\d+|Unexpected token|JSON at position|\[CONVEX|fetch failed|Failed to fetch|NetworkError|Not found for account|Too many writes|transaction|Mutations cannot|HTTP \d{3}|NVIDIA|OpenRouter|_API_KEY|build\.nvidia|Deprecated|no longer available|end of life/i.test(
      message,
    )
  ) {
    return true;
  }
  // JSON or code shapes are never sentences.
  if (/[{}]|=>|;\s*$|^\s*\w+\(/.test(message)) return true;
  // A known student sentence is safe; anything else is not trusted.
  return !STUDENT_MESSAGES.some(
    (student) => message === student || message.startsWith(student),
  );
}

/**
 * Shows a failure to the student and logs the real detail.
 *
 * Used by every toast and inline alert whose text comes from an exception, so
 * no call site has to remember the rule. The raw error is logged in the browser
 * console for debugging; the message for the student is the sanitised sentence.
 */
export function notifyError(error: unknown, fallback: string): string {
  console.error(fallback, error);
  const message = readableError(error, fallback);
  toast.error(message);
  return message;
}

/**
 * The message shown for a failed build.
 *
 * New failures are already sanitised on the server. Sets that failed before
 * that change still carry messages like "ArgumentValidationError: Object
 * contains extra field `title` … Path: .summary", so the same rule is applied
 * again here, and the rate-limit hint appears only when the failure really was
 * a 429.
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

  const safe = readableError(new Error(value), BUILD_FAILED_MESSAGE);
  return { message: safe, rateLimited: false };
}
