import { describe, expect, test } from "bun:test";

import { aiLimit, checkAiAllowance } from "../src/convex/lib/aiLimits";
import { buildLimit, checkAllowance } from "../src/convex/lib/buildLimits";
import { keyTierFor } from "../src/convex/lib/keyTier";

const now = 10_000_000_000;

function spent(count: number, age = 1_000): number[] {
  return Array.from({ length: count }, () => now - age);
}

/**
 * The browser replaces any message that looks internal, and provider names and
 * key variable names are on that list. A refusal that mentions them is thrown
 * away and the student sees a generic sentence instead, so the wording is part
 * of the behaviour.
 */
function isStudentSafe(message: string, prefix: string): boolean {
  return (
    message.startsWith(prefix) &&
    !/NVIDIA|build\.nvidia|_API_KEY|OpenRouter/i.test(message) &&
    !/[{}]|=>/.test(message)
  );
}

describe("limits while spending the shared key pool", () => {
  test("a personal key is the more generous allowance for every kind", () => {
    for (const kind of ["set", "rebuild", "paper"] as const) {
      const shared = buildLimit(kind, "member", "shared");
      const own = buildLimit(kind, "member", "own");
      expect(shared.perHour).toBeLessThan(own.perHour);
      expect(shared.perDay).toBeLessThan(own.perDay);
    }
    for (const kind of ["tutor", "marking", "dictation", "vision", "explain"] as const) {
      const shared = aiLimit(kind, "member", "shared");
      const own = aiLimit(kind, "member", "own");
      expect(shared.perHour).toBeLessThan(own.perHour);
    }
  });

  test("the shared build refusal says how to raise the limit", () => {
    const limit = buildLimit("set", "member", "shared");
    const verdict = checkAllowance({
      kind: "set",
      identity: "member",
      now,
      spent: spent(limit.perHour),
      tier: "shared",
    });
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.message).toContain("Connect your own API key");
      expect(verdict.message).toContain("the account menu");
      expect(isStudentSafe(verdict.message, "You have reached the build limit")).toBe(true);
    }
  });

  test("the shared AI refusal says how to raise the limit", () => {
    const limit = aiLimit("tutor", "member", "shared");
    const verdict = checkAiAllowance({
      kind: "tutor",
      identity: "member",
      now,
      spent: spent(limit.perHour),
      tier: "shared",
    });
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.message).toContain("Connect your own API key");
      expect(isStudentSafe(verdict.message, "You have reached the AI limit")).toBe(true);
    }
  });

  test("a personal key is refused only by the script guard, without an upsell", () => {
    const limit = buildLimit("set", "member", "own");
    const verdict = checkAllowance({
      kind: "set",
      identity: "member",
      now,
      spent: spent(limit.perHour),
      tier: "own",
    });
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.message).not.toContain("Connect your own API key");
  });

  test("the shared hourly cap is reached before the personal one", () => {
    const shared = buildLimit("set", "member", "shared");
    const spentNow = spent(shared.perHour);
    expect(
      checkAllowance({ kind: "set", identity: "member", now, spent: spentNow, tier: "shared" })
        .allowed,
    ).toBe(false);
    expect(
      checkAllowance({ kind: "set", identity: "member", now, spent: spentNow, tier: "own" })
        .allowed,
    ).toBe(true);
  });

  test("callers without a tier keep the personal allowance", () => {
    // Callers that predate keys keep the generous numbers.
    expect(buildLimit("set", "member")).toEqual(buildLimit("set", "member", "own"));
    expect(aiLimit("tutor", "member")).toEqual(aiLimit("tutor", "member", "own"));
    expect(
      checkAllowance({
        kind: "set",
        identity: "member",
        now,
        spent: spent(buildLimit("set", "member", "shared").perHour),
      }).allowed,
    ).toBe(true);
  });
});

describe("which tier an account is on", () => {
  const USER = "users:one";

  function fakeCtx(rows: Array<Record<string, any>>) {
    return {
      db: {
        query: (_table: string) => ({
          withIndex: (_index: string, build?: (q: any) => any) => {
            const filters: Array<[string, unknown]> = [];
            const q = {
              eq: (field: string, value: unknown) => {
                filters.push([field, value]);
                return q;
              },
            };
            build?.(q);
            const matched = rows.filter((row) =>
              filters.every(([field, value]) => row[field] === value),
            );
            return { first: async () => matched[0] ?? null };
          },
        }),
      },
    } as any;
  }

  test("a saved personal key is the own tier", async () => {
    const ctx = fakeCtx([{ _id: "userNvidiaKeys:1", userId: USER }]);
    expect(await keyTierFor(ctx, USER)).toBe("own");
  });

  test("no saved key means the shared pool", async () => {
    expect(await keyTierFor(fakeCtx([]), USER)).toBe("shared");
  });

  test("another account's key does not change this account's tier", async () => {
    const ctx = fakeCtx([{ _id: "userNvidiaKeys:1", userId: "users:other" }]);
    expect(await keyTierFor(ctx, USER)).toBe("shared");
  });

  test("the tier depends on the key row, not on anything else", async () => {
    const ctx = fakeCtx([{ _id: "userNvidiaKeys:1", userId: USER }]);
    expect(await keyTierFor(ctx, USER)).toBe("own");
  });
});
