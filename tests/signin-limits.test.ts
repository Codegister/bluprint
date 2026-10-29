import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  MAX_CODE_ATTEMPTS,
  MAX_SENDS_PER_HOUR,
  RESEND_COOLDOWN_MS,
  describeAttempts,
  type OtpGuardRow,
} from "../src/convex/lib/otpLimits";
import {
  criteriaFor,
  distinctiveTermsFor,
  meaningAward,
} from "../src/convex/lib/markingCriteria";

const NOW = 1_700_000_000_000;

function row(overrides: Partial<OtpGuardRow> = {}): OtpGuardRow {
  return {
    codeFailures: 0,
    windowStart: NOW,
    windowFailures: 0,
    lastCodeSentAt: NOW,
    ...overrides,
  };
}

describe("email code attempts", () => {
  test("a fresh address gets five tries and no wait", () => {
    const state = describeAttempts(null, NOW);
    expect(state.attemptsLeft).toBe(MAX_CODE_ATTEMPTS);
    expect(state.codeUsable).toBe(true);
    expect(state.retryAt).toBe(0);
    expect(state.lockedUntil).toBe(0);
  });

  test("each wrong code takes one attempt off, and the message can say how many are left", () => {
    for (let failures = 1; failures < MAX_CODE_ATTEMPTS; failures += 1) {
      const state = describeAttempts(row({ codeFailures: failures }), NOW);
      expect(state.attemptsLeft).toBe(MAX_CODE_ATTEMPTS - failures);
      expect(state.codeUsable).toBe(true);
    }
  });

  test("the fifth wrong code kills the code and the code cannot be retried", () => {
    const state = describeAttempts(
      row({
        codeFailures: MAX_CODE_ATTEMPTS,
        codeInvalidated: true,
        windowFailures: MAX_CODE_ATTEMPTS,
      }),
      NOW,
    );
    expect(state.attemptsLeft).toBe(0);
    expect(state.codeUsable).toBe(false);
    expect(state.retryAt).toBe(0);
  });

  test("repeated failures ask for a growing pause", () => {
    const failedAt = NOW - 1_000;
    const third = describeAttempts(
      row({ codeFailures: 3, lastFailedAt: failedAt }),
      NOW,
    );
    const fourth = describeAttempts(
      row({ codeFailures: 4, lastFailedAt: failedAt }),
      NOW,
    );
    expect(third.retryAt).toBeGreaterThan(NOW);
    expect(fourth.retryAt).toBeGreaterThan(third.retryAt);

    // After the pause has passed, the next try is accepted.
    const later = describeAttempts(
      row({ codeFailures: 4, lastFailedAt: failedAt }),
      NOW + 60_000,
    );
    expect(later.retryAt).toBeLessThanOrEqual(NOW + 60_000);
  });

  test("the first miss does not pause the student; the third does", () => {
    expect(
      describeAttempts(row({ codeFailures: 1, lastFailedAt: NOW }), NOW).retryAt,
    ).toBe(0);
    expect(
      describeAttempts(row({ codeFailures: 2, lastFailedAt: NOW }), NOW).retryAt,
    ).toBeGreaterThan(NOW);
  });

  test("a resend cooldown is reported for sixty seconds after sending", () => {
    expect(describeAttempts(row(), NOW).resendAt).toBe(NOW + RESEND_COOLDOWN_MS);
    expect(describeAttempts(row(), NOW + 61_000).resendAt).toBeLessThan(NOW + 61_000);
  });

  test("five misses inside the hour lock the address for the rest of it", () => {
    const state = describeAttempts(row({ windowFailures: 5 }), NOW + 60_000);
    expect(state.lockedUntil).toBe(NOW + 60 * 60 * 1000);
  });

  test("a window older than an hour starts over", () => {
    const state = describeAttempts(
      row({ windowStart: NOW - 61 * 60 * 1000, windowFailures: 5 }),
      NOW,
    );
    expect(state.lockedUntil).toBe(0);
  });
});

describe("OTP guard is server-only", () => {
  const source = readFileSync(
    new URL("../src/convex/otpGuard.ts", import.meta.url),
    "utf8",
  );

  test("no guard write is exposed as a public mutation", () => {
    // A public client used to be able to lock, reset or discard any address's
    // guard. Every write must go through the server-only provider paths.
    expect(source).not.toMatch(/export const \w+ = mutation\(/);
    expect(source).not.toMatch(/export const recordFailure/);
    expect(source).toMatch(/export const noteCodeSent = internalMutation\(/);
    expect(source).toMatch(/export const recordSuccess = internalMutation\(/);
    expect(source).toMatch(/export const beginSend = internalMutation\(/);
  });

  test("status has no email argument and answers only for the signed-in account", () => {
    expect(source).toMatch(/export const status = query\(\{\s*args: \{\},/);
    expect(source).not.toMatch(/export const status = query\(\{\s*args: \{ email/);
    expect(source).toMatch(/getAuthUserId\(ctx\)/);
  });

  test("the request cap is a small, fixed number", () => {
    expect(MAX_SENDS_PER_HOUR).toBeGreaterThan(0);
    expect(MAX_SENDS_PER_HOUR).toBeLessThanOrEqual(10);
  });

  test("an invented address is refused before a failure is recorded", () => {
    const authSource = readFileSync(
      new URL("../src/convex/auth.ts", import.meta.url),
      "utf8",
    );
    // The wrapper asks whether a live code exists before it invokes the
    // library's sign-in action, so a guess at an address with no code cannot
    // consume that address's five tries.
    expect(authSource).toMatch(/internal\.otpGuard\.hasLiveCode/);
    expect(authSource).toMatch(/if \(!liveCode\) \{/);
    expect(authSource).toMatch(/That code has expired/);
  });

  test("only a verified profile clears the guard", () => {
    const authSource = readFileSync(
      new URL("../src/convex/auth.ts", import.meta.url),
      "utf8",
    );
    // A send also creates or updates a user row. Clearing on the send path
    // would let an attacker guess four codes, request a new one, and start
    // over with five more tries.
    expect(authSource).toMatch(/if \(profile\.emailVerified !== true\) return;/);
  });
});

describe("meaning-based credit for a paraphrase", () => {
  const criterion = "Controls the movement of substances into and out of the cell";
  const terms = distinctiveTermsFor([criterion])[0] ?? [];
  const paraphrase = "It controls what enters and leaves the cell.";

  test("a correct paraphrase is credited even though the words differ", () => {
    expect(meaningAward(1, 1, terms, paraphrase)).toBe(1);
  });

  test("a quote with none of the criterion's own terms is never credited", () => {
    const temperature =
      "A higher temperature increases the rate because molecules collide more often.";
    expect(meaningAward(1, 1, terms, temperature)).toBe(0);
  });

  test("a partial statement takes half the criterion, rounded up", () => {
    expect(meaningAward(3, 0.5, terms, paraphrase)).toBe(2);
  });

  test("nothing is credited without a statement", () => {
    expect(meaningAward(1, 0, terms, paraphrase)).toBe(0);
  });

  test("a criterion is never credited above its own marks", () => {
    const [row] = criteriaFor({ markingGuide: [`1 mark: ${criterion}`], marks: 1 });
    expect(meaningAward(row!.marks, 1, terms, paraphrase)).toBeLessThanOrEqual(
      row!.marks,
    );
  });
});
