import { describe, expect, test } from "bun:test";

import { aiLimit, checkAiAllowance } from "../src/convex/lib/aiLimits";
import { buildLimit, checkAllowance } from "../src/convex/lib/buildLimits";
import { keyHealth, keyTierFor } from "../src/convex/lib/keyTier";

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
  test("every shared kind is capped, for both identities", () => {
    for (const kind of ["set", "rebuild", "paper"] as const) {
      for (const identity of ["guest", "member"] as const) {
        const limit = buildLimit(kind, identity, "shared");
        expect(limit.unlimited).toBe(false);
        expect(limit.perHour).toBeGreaterThan(0);
        expect(limit.perDay).toBeGreaterThan(0);
      }
    }
    for (const kind of ["tutor", "marking", "dictation", "vision", "explain"] as const) {
      for (const identity of ["guest", "member"] as const) {
        const limit = aiLimit(kind, identity, "shared");
        expect(limit.unlimited).toBe(false);
        expect(limit.perHour).toBeGreaterThan(0);
      }
    }
  });

  test("the shared build refusal says how to remove the limit", () => {
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
      expect(verdict.message).toContain("for no limit");
      expect(isStudentSafe(verdict.message, "You have reached the build limit")).toBe(true);
    }
  });

  test("the shared AI refusal says how to remove the limit", () => {
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

  test("the shared hourly cap is reached at its own number", () => {
    const shared = buildLimit("set", "member", "shared");
    expect(
      checkAllowance({
        kind: "set",
        identity: "member",
        now,
        spent: spent(shared.perHour - 1),
        tier: "shared",
      }).allowed,
    ).toBe(true);
    expect(
      checkAllowance({
        kind: "set",
        identity: "member",
        now,
        spent: spent(shared.perHour),
        tier: "shared",
      }).allowed,
    ).toBe(false);
  });

  test("a personal key has no app-level cap at all", () => {
    for (const kind of ["set", "rebuild", "paper"] as const) {
      expect(buildLimit(kind, "member", "own").unlimited).toBe(true);
    }
    for (const kind of ["tutor", "marking", "dictation", "vision", "explain"] as const) {
      expect(aiLimit(kind, "member", "own").unlimited).toBe(true);
    }
    // A thousand past the shared cap is still allowed on a personal key.
    expect(
      checkAllowance({
        kind: "set",
        identity: "member",
        now,
        spent: spent(1_000),
        tier: "own",
      }),
    ).toEqual({ allowed: true });
    expect(
      checkAiAllowance({
        kind: "marking",
        identity: "guest",
        now,
        spent: spent(1_000),
        tier: "own",
      }),
    ).toEqual({ allowed: true });
  });

  test("callers without a tier get the capped, shared allowance", () => {
    expect(buildLimit("set", "member")).toEqual(
      buildLimit("set", "member", "shared"),
    );
    expect(aiLimit("tutor", "member")).toEqual(aiLimit("tutor", "member", "shared"));
    expect(
      checkAllowance({
        kind: "set",
        identity: "member",
        now,
        spent: spent(buildLimit("set", "member", "shared").perHour),
      }).allowed,
    ).toBe(false);
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

  test("a healthy saved key is the own tier", async () => {
    const ctx = fakeCtx([{ _id: "userNvidiaKeys:1", userId: USER }]);
    expect(await keyTierFor(ctx, USER)).toBe("own");
  });

  test("no saved key means the shared pool", async () => {
    expect(await keyTierFor(fakeCtx([]), USER)).toBe("shared");
  });

  test("a key NVIDIA rejected drops the account back to the shared pool", async () => {
    const ctx = fakeCtx([
      { _id: "userNvidiaKeys:1", userId: USER, rejectedAt: now - 5_000 },
    ]);
    expect(await keyTierFor(ctx, USER)).toBe("shared");
  });

  test("a key inside its 429 cooldown is on the shared pool, and recovers after it", async () => {
    const cooling = fakeCtx([
      { _id: "userNvidiaKeys:1", userId: USER, coolingUntil: Date.now() + 30_000 },
    ]);
    expect(await keyTierFor(cooling, USER)).toBe("shared");

    const recovered = fakeCtx([
      { _id: "userNvidiaKeys:1", userId: USER, coolingUntil: Date.now() - 1 },
    ]);
    expect(await keyTierFor(recovered, USER)).toBe("own");
  });

  test("another account's key does not change this account's tier", async () => {
    const ctx = fakeCtx([{ _id: "userNvidiaKeys:1", userId: "users:other" }]);
    expect(await keyTierFor(ctx, USER)).toBe("shared");
  });

  test("keyHealth names each state", () => {
    expect(keyHealth({}, now)).toBe("healthy");
    // 0 is how a cleared rejection/cooldown is stored.
    expect(keyHealth({ rejectedAt: 0, coolingUntil: 0 }, now)).toBe("healthy");
    expect(keyHealth({ rejectedAt: now }, now)).toBe("rejected");
    expect(keyHealth({ coolingUntil: now + 1 }, now)).toBe("cooling");
    expect(keyHealth({ coolingUntil: now - 1 }, now)).toBe("healthy");
  });
});
