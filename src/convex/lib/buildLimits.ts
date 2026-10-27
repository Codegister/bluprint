/**
 * How often one identity may spend an AI build.
 *
 * Guests can start a build without an email address, and a build costs real
 * NVIDIA tokens at the owner's expense; three full builds back-to-back with no
 * friction is what this fixes. The rules are pure so they can be tested without
 * a deployment, and the Convex side only has to fetch timestamps.
 *
 * Verified accounts get a deliberately more generous allowance: the limit is
 * there to stop a script, not a revision session.
 */

export type BuildKind = "set" | "rebuild" | "paper";
export type BuildIdentity = "guest" | "member";

export type BuildLimit = {
  perHour: number;
  perDay: number;
  /** What is being counted, in the words the student sees. */
  label: string;
};

const LIMITS: Record<BuildKind, Record<BuildIdentity, BuildLimit>> = {
  set: {
    guest: { perHour: 2, perDay: 6, label: "new set" },
    member: { perHour: 8, perDay: 40, label: "new set" },
  },
  rebuild: {
    guest: { perHour: 3, perDay: 10, label: "rebuild" },
    member: { perHour: 12, perDay: 60, label: "rebuild" },
  },
  paper: {
    guest: { perHour: 1, perDay: 3, label: "past paper" },
    member: { perHour: 4, perDay: 15, label: "past paper" },
  },
};

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/** The allowance for one identity and kind. */
export function buildLimit(kind: BuildKind, identity: BuildIdentity): BuildLimit {
  return LIMITS[kind][identity];
}

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
}): AllowanceVerdict {
  const { kind, identity, now, spent } = args;
  const limit = buildLimit(kind, identity);
  const guestNote =
    identity === "guest"
      ? " Guests share this lower limit; add an email address to sign in and raise it."
      : "";

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
        `You have reached the build limit for this hour (${limit.perHour} ${limit.label}` +
        `${limit.perHour === 1 ? "" : "s"} an hour). Try again in about ${waitMinutes} ${
          waitMinutes === 1 ? "minute" : "minutes"
        }.${guestNote} Nothing was built, so no tokens were spent.`,
    };
  }

  const inDay = spent.filter((at) => now - at < DAY_MS);
  if (inDay.length >= limit.perDay) {
    return {
      allowed: false,
      message:
        `You've reached today's build limit (${limit.perDay} ${limit.label}` +
        `${limit.perDay === 1 ? "" : "s"} a day). Try again tomorrow.${guestNote}`,
    };
  }

  return { allowed: true };
}
