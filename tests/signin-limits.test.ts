import { describe, expect, test } from "bun:test";

import {
  MAX_CODE_ATTEMPTS,
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
