import { describe, expect, test } from "bun:test";
import { aiLimit, checkAiAllowance } from "../src/convex/lib/aiLimits";
import { HOUR_MS } from "../src/convex/lib/buildLimits";

describe("AI allowances", () => {
  const now = 10_000_000_000;

  test("allows a normal first request", () => {
    expect(
      checkAiAllowance({
        kind: "tutor",
        identity: "member",
        now,
        spent: [],
      }),
    ).toEqual({ allowed: true });
  });

  test("blocks a burst over the hourly tutor ceiling", () => {
    const limit = aiLimit("tutor", "member");
    const verdict = checkAiAllowance({
      kind: "tutor",
      identity: "member",
      now,
      spent: Array.from({ length: limit.perHour }, () => now - 1_000),
    });
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.message).toContain("You have reached the AI limit");
      expect(verdict.message).toContain("Nothing was sent to the AI");
    }
  });

  test("blocks the daily ceiling even when the hour is clear", () => {
    const limit = aiLimit("marking", "member");
    const verdict = checkAiAllowance({
      kind: "marking",
      identity: "member",
      now,
      spent: Array.from({ length: limit.perDay }, () => now - 2 * HOUR_MS),
    });
    expect(verdict.allowed).toBe(false);
  });

  test("explains the lower guest allowance", () => {
    const limit = aiLimit("dictation", "guest");
    const verdict = checkAiAllowance({
      kind: "dictation",
      identity: "guest",
      now,
      spent: Array.from({ length: limit.perHour }, () => now - 1_000),
    });
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.message).toContain("Guests get the lower limit");
  });
});
