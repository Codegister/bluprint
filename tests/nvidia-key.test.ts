import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { internal } from "../src/convex/_generated/api";
import { encryptKey, decryptKey, vaultReady } from "../src/convex/lib/keyVault";
import {
  KEY_COOLDOWN_MS,
  KEY_REJECTION_COOLDOWN_MS,
  KeyRotation,
  keyChain,
  preferredApiKey,
} from "../src/convex/lib/nvidiaConfig";
import { connect } from "../src/convex/nvidiaKeys";
import { forget, getStored, markHealth, save, status } from "../src/convex/userKeys";

const FUNCTION_NAME = Symbol.for("functionName");

/** The name a generated `internal.*` reference carries, so a test can route it. */
function functionNameOf(ref: unknown): string {
  return String((ref as Record<symbol, unknown>)[FUNCTION_NAME]);
}

const USER = "users:one";
const SECRET = "a".repeat(64);

type Row = Record<string, any> & { _id: string };

function fakeContext(tables: Record<string, Row[]> = { userNvidiaKeys: [] }) {
  let nextId = 0;
  const db = {
    get: async (id: string) =>
      Object.values(tables)
        .flat()
        .find((row) => row._id === id) ?? null,
    insert: async (table: string, document: Record<string, any>) => {
      const row = { ...document, _id: `${table}:${++nextId}` };
      (tables[table] ??= []).push(row);
      return row._id;
    },
    patch: async (id: string, patch: Record<string, any>) => {
      const row = Object.values(tables)
        .flat()
        .find((candidate) => candidate._id === id);
      if (!row) throw new Error(`Missing row ${id}`);
      Object.assign(row, patch);
    },
    delete: async (id: string) => {
      for (const rows of Object.values(tables)) {
        const index = rows.findIndex((row) => row._id === id);
        if (index !== -1) rows.splice(index, 1);
      }
    },
    query: (table: string) => ({
      withIndex: (_index: string, build?: (q: any) => any) => {
        const filters: Array<[string, unknown]> = [];
        const q = {
          eq: (field: string, value: unknown) => {
            filters.push([field, value]);
            return q;
          },
        };
        build?.(q);
        const rows = (tables[table] ?? []).filter((row) =>
          filters.every(([field, value]) => row[field] === value),
        );
        return { first: async () => rows[0] ?? null };
      },
    }),
  };
  const dbCtx = { db, auth: { getUserIdentity: async () => ({ subject: USER }) } };
  // The action reaches its query and mutation through generated references, so
  // the test maps those references to the real handlers, exactly as the app
  // wires them at runtime.
  const handlers = new Map<string, any>([
    [functionNameOf(internal.userKeys.save), save],
    [functionNameOf(internal.userKeys.getStored), getStored],
  ]);
  const run = async (ref: unknown, args: Record<string, unknown>) => {
    const fn = handlers.get(functionNameOf(ref));
    if (!fn) throw new Error(`Unexpected reference ${functionNameOf(ref)}`);
    return await fn._handler(dbCtx, args);
  };

  return {
    ctx: {
      auth: dbCtx.auth,
      db,
      runMutation: run,
      runQuery: run,
    } as any,
    tables,
  };
}

const originalSecret = process.env.NVIDIA_KEY_SECRET;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  process.env.NVIDIA_KEY_SECRET = SECRET;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalSecret === undefined) delete process.env.NVIDIA_KEY_SECRET;
  else process.env.NVIDIA_KEY_SECRET = originalSecret;
});

describe("NVIDIA key vault", () => {
  test("a key survives a round trip and never appears in the stored value", () => {
    const key = `nvapi-${"x".repeat(60)}`;
    const sealed = encryptKey(key);
    expect(sealed).not.toContain(key);
    expect(sealed.startsWith("v1:")).toBe(true);
    expect(decryptKey(sealed)).toBe(key);
  });

  test("the same key seals differently each time", () => {
    const key = "nvapi-same-key-value-abcdefghijklmnop";
    expect(encryptKey(key)).not.toBe(encryptKey(key));
  });

  test("a tampered envelope is rejected rather than decrypted", () => {
    const sealed = encryptKey("nvapi-secret-value-abcdefghijklmnop");
    const parts = sealed.split(":");
    const flipped = `${parts[0]}:${parts[1]}:${parts[2]}:${Buffer.from("nope").toString("base64")}`;
    expect(() => decryptKey(flipped)).toThrow();
  });

  test("a missing or short secret means the vault is not ready", () => {
    delete process.env.NVIDIA_KEY_SECRET;
    expect(vaultReady()).toBe(false);
    process.env.NVIDIA_KEY_SECRET = "abc";
    expect(vaultReady()).toBe(false);
    process.env.NVIDIA_KEY_SECRET = SECRET;
    expect(vaultReady()).toBe(true);
  });
});

describe("per-request key order", () => {
  test("the user's own key comes first, then the shared pool", () => {
    expect(keyChain("nvapi-mine", ["nvapi-a", "nvapi-b"])).toEqual([
      "nvapi-mine",
      "nvapi-a",
      "nvapi-b",
    ]);
  });

  test("an own key is marked preferred, so it is used on its own", () => {
    const chain = keyChain("nvapi-mine", ["nvapi-a", "nvapi-b"]);
    expect(chain.preferred).toBe("nvapi-mine");
    expect(preferredApiKey(chain, () => true)).toBe("nvapi-mine");
  });

  test("the shared pool takes over while the own key is rejected or cooling down", () => {
    const chain = keyChain("nvapi-mine", ["nvapi-a"]);
    // Rejected (401/403) and cooling (429) both make it unusable, and the
    // transport then falls through to the pool.
    expect(preferredApiKey(chain, () => false)).toBeUndefined();
  });

  test("a pool-only chain has no preferred key", () => {
    const chain = keyChain(undefined, ["nvapi-a", "nvapi-b"]);
    expect(chain.preferred).toBeUndefined();
    expect(preferredApiKey(chain, () => true)).toBeUndefined();
  });

  test("no own key leaves the pool untouched", () => {
    expect(keyChain(undefined, ["nvapi-a"])).toEqual(["nvapi-a"]);
  });

  test("a key already in the pool is not tried twice", () => {
    expect(keyChain("nvapi-a", ["nvapi-a", "nvapi-b"])).toEqual([
      "nvapi-a",
      "nvapi-b",
    ]);
  });
});

describe("key rotation after a refusal", () => {
  const now = 1_800_000_000_000;

  test("a refused key is parked, then tried again once its window has passed", () => {
    const rotation = new KeyRotation();
    const chain = keyChain(undefined, ["nvapi-a"]);
    rotation.refuse("nvapi-a", now);

    // Parked: the request fails fast instead of hammering the key.
    expect(rotation.next(chain, now + 1_000)).toBeUndefined();
    expect(rotation.next(chain, now + KEY_REJECTION_COOLDOWN_MS - 1)).toBeUndefined();
    // And back in rotation afterwards, so the process is never wedged for good.
    expect(rotation.next(chain, now + KEY_REJECTION_COOLDOWN_MS)).toBe("nvapi-a");
  });

  test("a refusal parks longer than a throttle, so the window is not the 429 one", () => {
    expect(KEY_REJECTION_COOLDOWN_MS).toBeGreaterThan(KEY_COOLDOWN_MS);

    const rotation = new KeyRotation();
    const chain = keyChain(undefined, ["nvapi-a"]);
    rotation.refuse("nvapi-a", now);
    expect(rotation.next(chain, now + KEY_COOLDOWN_MS + 1)).toBeUndefined();
  });

  test("a refused own key hands the request to the pool and comes back later", () => {
    const rotation = new KeyRotation();
    const chain = keyChain("nvapi-mine", ["nvapi-a"]);
    rotation.refuse("nvapi-mine", now);

    expect(rotation.next(chain, now)).toBe("nvapi-a");
    expect(rotation.next(chain, now + KEY_REJECTION_COOLDOWN_MS)).toBe("nvapi-mine");
  });

  test("a 429 still cools a key briefly and is still tried when the pool is cooling", () => {
    const rotation = new KeyRotation();
    const chain = keyChain(undefined, ["nvapi-a"]);
    rotation.cool("nvapi-a", now);

    // Throttled keys are never parked out of a request: waiting is worse than a
    // possible second 429, and this is the behaviour a 429 already had.
    expect(rotation.next(chain, now + 1_000)).toBe("nvapi-a");
    expect(rotation.next(chain, now + KEY_COOLDOWN_MS)).toBe("nvapi-a");
  });

  test("every key refused means no key, not the retired one", () => {
    const rotation = new KeyRotation();
    const chain = keyChain(undefined, ["nvapi-a", "nvapi-b"]);
    rotation.refuse("nvapi-a", now);
    rotation.refuse("nvapi-b", now);

    expect(rotation.next(chain, now)).toBeUndefined();
    expect(rotation.next(chain, now + KEY_REJECTION_COOLDOWN_MS)).toBeDefined();
  });
});

describe("connect action", () => {
  test("a rejected key is reported and nothing is stored", async () => {
    globalThis.fetch = (async () =>
      new Response("unauthorized", { status: 401 })) as unknown as typeof fetch;
    const { ctx, tables } = fakeContext();

    const result = await connect._handler(ctx, { key: `nvapi-${"y".repeat(40)}` });

    expect(result.ok).toBe(false);
    expect(tables.userNvidiaKeys).toEqual([]);
  });

  test("a key that is not NVIDIA's is refused without a request", async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const { ctx } = fakeContext();

    const result = await connect._handler(ctx, { key: "sk-or-v1-something" });

    expect(result.ok).toBe(false);
    expect(called).toBe(false);
  });

  test("an accepted key is stored encrypted with only its last four readable", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    globalThis.fetch = (async (url: any, init: any) => {
      calls.push({ url: String(url), method: String(init?.method) });
      return new Response(JSON.stringify({ choices: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    const { ctx, tables } = fakeContext();
    const key = `nvapi-${"z".repeat(36)}4321`;

    const result = await connect._handler(ctx, { key });

    expect(result).toEqual({ ok: true, last4: "4321" });
    // Regression: `/v1/models` answers 200 with no key at all, so it once let
    // a random nvapi- string through. Validation must authenticate.
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toEndWith("/v1/chat/completions");
    expect(calls[0]!.method).toBe("POST");
    const stored = tables.userNvidiaKeys![0]!;
    expect(stored.last4).toBe("4321");
    expect(stored.ciphertext).not.toContain(key);
    expect(decryptKey(stored.ciphertext)).toBe(key);
  });

  test("a rate-limited but real key is still saved, with a note", async () => {
    globalThis.fetch = (async () =>
      new Response("too many", { status: 429 })) as unknown as typeof fetch;
    const { ctx, tables } = fakeContext();

    const result = await connect._handler(ctx, { key: `nvapi-${"q".repeat(40)}` });

    expect(result.ok).toBe(true);
    expect(result.ok && result.note).toContain("rate-limiting");
    expect(tables.userNvidiaKeys).toHaveLength(1);
  });

  test("a probe model that cannot answer still proves the key is real", async () => {
    globalThis.fetch = (async () =>
      new Response("model gone", { status: 404 })) as unknown as typeof fetch;
    const { ctx, tables } = fakeContext();

    const result = await connect._handler(ctx, { key: `nvapi-${"m".repeat(40)}` });

    expect(result.ok).toBe(true);
    expect(tables.userNvidiaKeys).toHaveLength(1);
  });

  test("an NVIDIA outage saves nothing", async () => {
    globalThis.fetch = (async () =>
      new Response("bad gateway", { status: 502 })) as unknown as typeof fetch;
    const { ctx, tables } = fakeContext();

    const result = await connect._handler(ctx, { key: `nvapi-${"n".repeat(40)}` });

    expect(result.ok).toBe(false);
    expect(tables.userNvidiaKeys).toEqual([]);
  });
});

describe("stored key row", () => {
  test("saving twice keeps one row for the account", async () => {
    const { ctx, tables } = fakeContext();
    const base = {
      userId: USER,
      ciphertext: encryptKey("nvapi-first-key-aaaaaaaaaaaaaaaa"),
      last4: "aaaa",
      validatedAt: 1,
    };
    await save._handler(ctx, base);
    await save._handler(ctx, {
      ...base,
      ciphertext: encryptKey("nvapi-second-key-bbbbbbbbbbbbbbbb"),
      last4: "bbbb",
      validatedAt: 2,
    });

    expect(tables.userNvidiaKeys).toHaveLength(1);
    expect(tables.userNvidiaKeys![0]!.last4).toBe("bbbb");
    expect(tables.userNvidiaKeys![0]!.validatedAt).toBe(2);
  });

  test("status reports the connected key without returning it", async () => {
    const { ctx } = fakeContext();
    await save._handler(ctx, {
      userId: USER,
      ciphertext: encryptKey("nvapi-hidden-key-cccccccccccccccc"),
      last4: "cccc",
      validatedAt: 7,
    });

    const view = await status._handler(ctx, {});

    expect(view.saved).toBe(true);
    expect(view.last4).toBe("cccc");
    expect(JSON.stringify(view)).not.toContain("nvapi-");
  });

  test("a rejection and a cooldown are recorded, and saving again clears them", async () => {
    const { ctx, tables } = fakeContext();
    await save._handler(ctx, {
      userId: USER,
      ciphertext: encryptKey("nvapi-health-key-eeeeeeeeeeeeeeee"),
      last4: "eeee",
      validatedAt: 4,
    });

    await markHealth._handler(ctx, { userId: USER, state: "rejected" });
    expect(tables.userNvidiaKeys![0]!.rejectedAt).toBeGreaterThan(0);

    await markHealth._handler(ctx, {
      userId: USER,
      state: "cooling",
      coolingUntil: Date.now() + 45_000,
    });
    expect(tables.userNvidiaKeys![0]!.coolingUntil).toBeGreaterThan(Date.now());

    // Re-saving a key NVIDIA just accepted puts the account back on the
    // personal tier, so both markers go back to the cleared value.
    await save._handler(ctx, {
      userId: USER,
      ciphertext: encryptKey("nvapi-health-key-ffffffffffffffff"),
      last4: "ffff",
      validatedAt: 5,
    });
    expect(tables.userNvidiaKeys![0]!.rejectedAt).toBe(0);
    expect(tables.userNvidiaKeys![0]!.coolingUntil).toBe(0);
  });

  test("forget removes the row", async () => {
    const { ctx, tables } = fakeContext();
    await save._handler(ctx, {
      userId: USER,
      ciphertext: encryptKey("nvapi-removable-key-dddddddddddddddd"),
      last4: "dddd",
      validatedAt: 3,
    });

    expect(await forget._handler(ctx, {})).toEqual({ removed: true });
    expect(tables.userNvidiaKeys).toEqual([]);
    expect(await forget._handler(ctx, {})).toEqual({ removed: false });
  });
});
