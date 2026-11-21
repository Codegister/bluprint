import { describe, expect, test } from "bun:test";
import { createAccount, retrieveAccount } from "@convex-dev/auth/server";
import { convexTest } from "convex-test";
import { api } from "../src/convex/_generated/api";
import schema from "../src/convex/schema";

// Convex Auth logs every store call at INFO level; the assertions below do not
// need that narration in the test output.
process.env.AUTH_LOG_LEVEL = "ERROR";

/**
 * The change-password action, run against an in-memory Convex backend rather
 * than by reading `@convex-dev/auth`'s source.
 *
 * The password account is created through the library's own `createAccount`,
 * so the hash under test is the Scrypt hash the app really stores, and both
 * "the new password works" and "the old one stopped" are checked with the
 * library's own verification. The only rows seeded by hand are the verified
 * user and the two sessions, which is what a signed-in student has.
 */

const EMAIL = "sam@school.uk";
const OLD_PASSWORD = "old-passphrase-1";
const NEW_PASSWORD = "new-passphrase-2";

/**
 * `convex-test` needs a module map. Under Bun there is no `import.meta.glob`,
 * so the handful of modules the action touches are listed explicitly. Keys are
 * relative to the functions directory; the `_generated` entry tells the harness
 * where that directory starts.
 */
const modules = {
  "convex/_generated/api.js": () => import("../src/convex/_generated/api.js"),
  "convex/auth.ts": () => import("../src/convex/auth"),
  "convex/changePassword.ts": () => import("../src/convex/changePassword"),
  "convex/users.ts": () => import("../src/convex/users"),
};

async function signedInStudent() {
  const t = convexTest(schema, modules);

  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      email: EMAIL,
      emailVerificationTime: Date.now(),
      isAnonymous: false,
    }),
  );

  // The session the student is standing on, and a second device that is also
  // signed in to the same account.
  const sessionId = await t.run((ctx) =>
    ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + 60 * 60 * 1000,
    }),
  );
  const otherSessionId = await t.run((ctx) =>
    ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + 60 * 60 * 1000,
    }),
  );

  // Attach the password exactly as the post-code "Set a password" step does.
  await t.action(async (ctx) => {
    await createAccount(ctx, {
      provider: "password",
      account: { id: EMAIL, secret: OLD_PASSWORD },
      profile: { email: EMAIL },
    });
  });

  return {
    t,
    userId,
    sessionId,
    otherSessionId,
    asStudent: t.withIdentity({ subject: `${userId}|${sessionId}` }),
  };
}

/** Ask the library whether `secret` opens the stored password account. */
async function passwordOpensAccount(
  t: ReturnType<typeof convexTest>,
  secret: string,
): Promise<boolean> {
  try {
    await t.action(async (ctx) => {
      await retrieveAccount(ctx, {
        provider: "password",
        account: { id: EMAIL, secret },
      });
    });
    return true;
  } catch {
    return false;
  }
}

describe("changePassword action against a real in-memory backend", () => {
  test("a wrong current password is refused and changes nothing", async () => {
    const { t, asStudent } = await signedInStudent();

    await expect(
      asStudent.action(api.changePassword.changePassword, {
        currentPassword: "not-the-password",
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toThrow(/current password doesn't match/i);

    // Neither password was written: the old one still opens the account and
    // the one the student asked for was not stored.
    expect(await passwordOpensAccount(t, OLD_PASSWORD)).toBe(true);
    expect(await passwordOpensAccount(t, NEW_PASSWORD)).toBe(false);
  });

  test("a correct current password replaces the hash", async () => {
    const { t, asStudent } = await signedInStudent();

    const result = await asStudent.action(api.changePassword.changePassword, {
      currentPassword: OLD_PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(result).toEqual({ changed: true });

    // The stored value is a hash, not the password itself.
    const account = await t.run((ctx) =>
      ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "password").eq("providerAccountId", EMAIL),
        )
        .unique(),
    );
    expect(account?.secret).toBeTruthy();
    expect(account?.secret).not.toContain(NEW_PASSWORD);

    // The library's own check: the old password is dead, the new one works.
    expect(await passwordOpensAccount(t, OLD_PASSWORD)).toBe(false);
    expect(await passwordOpensAccount(t, NEW_PASSWORD)).toBe(true);
  });

  test("the caller's session survives and the account's other sessions are dropped", async () => {
    const { t, userId, sessionId, otherSessionId, asStudent } =
      await signedInStudent();

    await asStudent.action(api.changePassword.changePassword, {
      currentPassword: OLD_PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    const sessions = await t.run((ctx) =>
      ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(sessions.map((session) => session._id)).toEqual([sessionId]);

    const other = await t.run((ctx) => ctx.db.get(otherSessionId));
    expect(other).toBeNull();
  });
});
