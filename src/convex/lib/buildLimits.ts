/**
 * How often one identity may spend an AI build.
 *
 * A build costs real tokens. When it runs on the deployment's shared key pool,
 * every account draws on the same keys, so that path is capped: three full
 * builds back-to-back with no friction is what this stops. An account that has
 * connected its own key is spending its own NVIDIA quota instead, so it has no
 * app-level cap — the only limit left is NVIDIA's own rate limit.
 *
 * The rules are pure so they can be tested without a deployment, and the Convex
 * side only has to fetch timestamps. The default tier is the capped one: a
 * caller that forgets to say whose key pays errs towards the shared allowance
 * rather than towards no limit at all.
 */

export type BuildKind = "set" | "rebuild" | "paper";
export type BuildIdentity = "guest" | "member";

/**
 * Whose key pays for the work. `shared` is the deployment's pool, `own` is a
 * connected personal key that NVIDIA is currently accepting.
 */
export type KeyTier = "own" | "shared";

export type BuildLimit = {
  perHour: number;
  perDay: number;
  /** No app-level cap: the personal key pays, so only NVIDIA limits this. */
  unlimited: boolean;
  /** What is being counted, in the words the student sees. */
  label: string;
};

/** A personal key removes the app-level cap entirely. */
const UNLIMITED: Record<BuildKind, BuildLimit> = {
  set: { perHour: 0, perDay: 0, unlimited: true, label: "new set" },
  rebuild: { perHour: 0, perDay: 0, unlimited: true, label: "rebuild" },
  paper: { perHour: 0, perDay: 0, unlimited: true, label: "past paper" },
};

/**
 * The allowance while a build runs on the shared key pool.
 *
 * Everyone without a personal key draws on the same keys, so one account cannot
 * spend the whole deployment's capacity. Connecting a personal key removes the
 * cap, which is what the refusal sentence tells the student.
 */
const SHARED_LIMITS: Record<BuildKind, Record<BuildIdentity, BuildLimit>> = {
  set: {
    guest: { perHour: 1, perDay: 3, unlimited: false, label: "new set" },
    member: { perHour: 3, perDay: 10, unlimited: false, label: "new set" },
  },
  rebuild: {
    guest: { perHour: 2, perDay: 5, unlimited: false, label: "rebuild" },
    member: { perHour: 4, perDay: 15, unlimited: false, label: "rebuild" },
  },
  paper: {
    guest: { perHour: 1, perDay: 2, unlimited: false, label: "past paper" },
    member: { perHour: 1, perDay: 4, unlimited: false, label: "past paper" },
  },
};

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/** The allowance for one identity and kind, on the key tier paying for it. */
export function buildLimit(
  kind: BuildKind,
  identity: BuildIdentity,
  tier: KeyTier = "shared",
): BuildLimit {
  return tier === "shared" ? SHARED_LIMITS[kind][identity] : UNLIMITED[kind];
}

/**
 * The half of the refusal that says how to get out of the shared allowance.
 * Deliberately free of provider names and key names: the browser's error
 * sanitiser treats those as internal detail and would show a generic message.
 */
export const OWN_KEY_UPGRADE_NOTE =
  "Connect your own API key from the account menu for no limit.";

export type AllowanceVerdict =
  | { allowed: true }
  | {
      allowed: false;
      /** The sentence the student sees, written for them, with both numbers. */
      message: string;
    };

/**
 * Decides whether one more build is allowed, given the timestamps already spent.
 *
 * The hourly limit is checked first because that is what a burst hits; the daily
 * limit catches a student (or a script) pacing itself just under the hour.
 */
export function checkAllowance(args: {
  kind: BuildKind;
  identity: BuildIdentity;
  now: number;
  /** Timestamps of previous builds of the same kind, any order. */
  spent: number[];
  /** Whose key pays; defaults to the capped, shared allowance. */
  tier?: KeyTier;
}): AllowanceVerdict {
  const { kind, identity, now, spent, tier = "shared" } = args;
  const limit = buildLimit(kind, identity, tier);
  // A personal key means no app-level cap: nothing to count.
  if (limit.unlimited) return { allowed: true };

  const guestNote =
    identity === "guest"
      ? " Guests share this lower limit; add an email address to sign in and raise it."
      : "";
  const keyNote = tier === "shared" ? ` ${OWN_KEY_UPGRADE_NOTE}` : "";

  const plural = (count: number) => (count === 1 ? "" : "s");
  const hourly = `${limit.perHour} ${limit.label}${plural(limit.perHour)} an hour`;
  const daily = `${limit.perDay} ${limit.label}${plural(limit.perDay)} a day`;

  const inHour = spent.filter((at) => now - at < HOUR_MS);
  if (inHour.length >= limit.perHour) {
    const oldest = Math.min(...inHour);
    const waitMinutes = Math.max(
      1,
      Math.ceil((HOUR_MS - (now - oldest)) / 60_000),
    );
    return {
      allowed: false,
      message:
        `You have reached the build limit: ${hourly} and ${daily}. The hourly limit resets in about ${waitMinutes} ${
          waitMinutes === 1 ? "minute" : "minutes"
        }.${keyNote}${guestNote} Nothing was built, so no tokens were spent.`,
    };
  }

  const inDay = spent.filter((at) => now - at < DAY_MS);
  if (inDay.length >= limit.perDay) {
    const oldest = Math.min(...inDay);
    const waitHours = Math.max(1, Math.ceil((DAY_MS - (now - oldest)) / HOUR_MS));
    return {
      allowed: false,
      message:
        `You have reached the build limit: ${daily}, with a maximum of ${hourly}. The daily limit resets in about ${waitHours} ${
          waitHours === 1 ? "hour" : "hours"
        }.${keyNote}${guestNote} Nothing was built, so no tokens were spent.`,
    };
  }

  return { allowed: true };
}
