/**
 * The sentences Bluprint shows when the AI itself fails.
 *
 * They live in one dependency-free module so the Convex action, the alert
 * sweep and the browser all show the same words, and so the rule they encode
 * is easy to check: a student-facing AI failure message never names a
 * provider, a model, an environment variable, an endpoint or an HTTP status.
 * Those details are logged server-side (see `lib/incidentRules.ts`).
 */

/** Generic: the provider rejected, retired a model, or is unreachable. */
export const AI_UNAVAILABLE_MESSAGE =
  "Bluprint's AI is having trouble right now. Please try again.";

/** The tutor's own wording, used inside a conversation. */
export const TUTOR_UNAVAILABLE_MESSAGE =
  "The tutor is having trouble right now, please try again.";

/** Rate limiting is the one failure a student can act on. */
export const AI_RATE_LIMIT_MESSAGE =
  "The AI is rate-limited right now. Wait about a minute, then try again.";

/** Shown under the composer when a dictation clip cannot be transcribed. */
export const DICTATION_UNAVAILABLE_MESSAGE =
  "Dictation is not working right now. Please type your answer instead.";

/**
 * Shown when the examiner cannot produce a usable verdict even after a retry.
 * The student's answer is persisted before this is thrown, so "saved" is true.
 */
export const MARKING_FAILED_MESSAGE =
  "We couldn't mark that one. Your answer is saved — try again.";

/** What the set page shows when a build fails for a reason it cannot name. */
export const BUILD_FAILED_MESSAGE =
  "We couldn't finish building this set. Your notes are saved — try again.";
