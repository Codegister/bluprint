/**
 * The rules for the six-digit email code, as pure arithmetic.
 *
 * These live outside Convex so the counts, the lockout and the retry pauses can
 * be tested without a deployment, and so the page and the server are reading
 * one set of numbers rather than two that can drift.
 */

/** Wrong codes allowed against one code before it is thrown away. */
export const MAX_CODE_ATTEMPTS = 5;
/** How long the student waits before a new code can be requested. */
export const RESEND_COOLDOWN_MS = 60_000;
/** Wrong codes allowed in an hour, across any number of resent codes. */
export const MAX_HOURLY_ATTEMPTS = 5;

/** The wait before the next try, indexed by the failures already made. */
const RETRY_DELAYS_MS = [0, 0, 3_000, 8_000, 20_000];

const HOUR_MS = 60 * 60 * 1000;

export type OtpGuardRow = {
  codeFailures: number;
  windowStart: number;
  windowFailures: number;
  lastCodeSentAt: number;
  lastFailedAt?: number;
  codeInvalidated?: boolean;
};

export type OtpGuardState = {
  attemptsLeft: number;
  codeUsable: boolean;
  /** Absolute time a new code can be requested. */
  resendAt: number;
  /** Absolute time the next guess is accepted, after a growing pause. */
  retryAt: number;
  /** Absolute time the hourly lock lifts; 0 when not locked. */
  lockedUntil: number;
  failedAttempts: number;
};

/**
 * The state of play for one address, as absolute timestamps so the page can run
 * its own countdown without polling the server every second.
 */
export function describeAttempts(
  row: OtpGuardRow | null,
  now: number,
): OtpGuardState {
  if (!row) {
    return {
      attemptsLeft: MAX_CODE_ATTEMPTS,
      codeUsable: true,
      // A first request is never held back.
      resendAt: 0,
      retryAt: 0,
      lockedUntil: 0,
      failedAttempts: 0,
    };
  }

  const windowOpen = now - row.windowStart < HOUR_MS;
  const windowFailures = windowOpen ? row.windowFailures : 0;
  const lockedUntil =
    windowFailures >= MAX_HOURLY_ATTEMPTS ? row.windowStart + HOUR_MS : 0;

  const attemptsLeft = Math.max(0, MAX_CODE_ATTEMPTS - row.codeFailures);
  const codeUsable = attemptsLeft > 0 && !row.codeInvalidated;
  // The pause grows with the number of misses on this code. It only applies
  // while the code is still usable; a dead code is replaced, not retried.
  const delay =
    RETRY_DELAYS_MS[Math.min(row.codeFailures, RETRY_DELAYS_MS.length - 1)] ?? 0;
  const retryAt =
    codeUsable && row.lastFailedAt !== undefined && delay > 0
      ? Math.min(
          row.lastFailedAt + delay,
          lockedUntil > 0 ? lockedUntil : Number.MAX_SAFE_INTEGER,
        )
      : 0;

  return {
    attemptsLeft,
    codeUsable,
    resendAt: row.lastCodeSentAt + RESEND_COOLDOWN_MS,
    retryAt,
    lockedUntil,
    failedAttempts: row.codeFailures,
  };
}
