import { describe, expect, test } from "bun:test";
import {
  HOUR_MS,
  MAX_SENDS_PER_HOUR,
  RESEND_COOLDOWN_MS,
  describeSendGate,
  sendRefusalMessage,
  type SendGateRow,
} from "../src/convex/lib/otpLimits";
import { readableError } from "../src/lib/errors";

const NOW = 1_800_000_000_000;

function row(overrides: Partial<SendGateRow> = {}): SendGateRow {
  return {
    lastCodeSentAt: NOW - RESEND_COOLDOWN_MS,
    sendWindowStart: NOW - 5 * 60_000,
    sendWindowCount: 1,
    ...overrides,
  };
}

describe("re-send gate for the email code", () => {
  test("a first request is always allowed", () => {
    expect(describeSendGate(null, NOW)).toEqual({ allowed: true, retryAt: 0 });
  });

  test("a code sent seconds ago blocks the re-send until the minute is up", () => {
    const sentAt = NOW - 10_000;
    const gate = describeSendGate(row({ lastCodeSentAt: sentAt }), NOW);
    expect(gate.allowed).toBe(false);
    expect(gate.retryAt).toBe(sentAt + RESEND_COOLDOWN_MS);
  });

  test("the gate opens exactly when the cooldown expires", () => {
    expect(
      describeSendGate(row({ lastCodeSentAt: NOW - RESEND_COOLDOWN_MS }), NOW)
        .allowed,
    ).toBe(true);
  });

  test("the hourly cap still refuses another code", () => {
    const start = NOW - 5 * 60_000;
    const gate = describeSendGate(
      row({ sendWindowStart: start, sendWindowCount: MAX_SENDS_PER_HOUR }),
      NOW,
    );
    expect(gate.allowed).toBe(false);
    expect(gate.retryAt).toBe(start + HOUR_MS);
  });

  test("a send window older than an hour starts again", () => {
    expect(
      describeSendGate(
        row({
          sendWindowStart: NOW - HOUR_MS - 1,
          sendWindowCount: MAX_SENDS_PER_HOUR,
        }),
        NOW,
      ).allowed,
    ).toBe(true);
  });
});

describe("what a refused re-send says", () => {
  test("names the seconds left instead of a generic failure", () => {
    expect(sendRefusalMessage(NOW + 42_000, NOW)).toBe(
      "A code was requested recently. Try again in 42s.",
    );
  });

  test("rounds a partial second up so the wait is never 0s", () => {
    expect(sendRefusalMessage(NOW + 900, NOW)).toBe(
      "A code was requested recently. Try again in 1s.",
    );
  });

  test("an expired cooldown reads as the hourly cap", () => {
    expect(sendRefusalMessage(NOW, NOW)).toBe(
      "Too many codes have been requested for this address. Try again later.",
    );
  });
});

describe("the sign-in page shows that sentence", () => {
  const fallback =
    "We couldn't send the code. Check the address and try again in a minute.";

  test("the real wait time reaches the page", () => {
    const sentence = "A code was requested recently. Try again in 42s.";
    const fromServer = new Error(
      `[Request ID: abc123] Server Error\nUncaught Error: ${sentence}\n    at handler`,
    );
    expect(readableError(fromServer, fallback)).toBe(sentence);
  });

  test("a ConvexError's real text reaches the page", () => {
    // What the Convex client actually hands the page: a generic message plus
    // the written sentence in `data`.
    const sentence = "A code was requested recently. Try again in 60s.";
    const fromServer = Object.assign(
      new Error(
        "[CONVEX A(auth:signIn)] [Request ID: abc] Server Error\n  Called by client",
      ),
      { name: "ConvexError", data: sentence },
    );
    expect(readableError(fromServer, fallback)).toBe(sentence);
  });

  test("the hourly cap reaches the page", () => {
    const sentence =
      "Too many codes have been requested for this address. Try again later.";
    expect(readableError(new Error(sentence), fallback)).toBe(sentence);
  });

  test("an unrelated send failure keeps the generic fallback", () => {
    expect(readableError(new Error("HTTP 502 from gateway"), fallback)).toBe(
      fallback,
    );
  });
});
