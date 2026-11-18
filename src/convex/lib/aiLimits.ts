/**
 * Per-account ceilings for actions that spend AI credits.
 *
 * Builds already have their own allowance. Tutoring, marking, dictation and
 * vision do not produce a set, so they need a separate limit; without one a
 * script could call the public actions repeatedly and drain the deployment.
 *
 * The ceiling only exists while the shared key pool pays. An account on its own
 * connected key is spending its own NVIDIA quota, so there is no app-level cap
 * — only NVIDIA's own rate limit.
 */
import {
  DAY_MS,
  HOUR_MS,
  OWN_KEY_UPGRADE_NOTE,
  type BuildIdentity,
  type KeyTier,
} from "./buildLimits";

export type AiKind = "tutor" | "marking" | "dictation" | "vision" | "explain";

export type AiLimit = {
  perHour: number;
  perDay: number;
  /** No app-level cap: the personal key pays, so only NVIDIA limits this. */
  unlimited: boolean;
  label: string;
};

/** A personal key removes the app-level cap entirely. */
const UNLIMITED: Record<AiKind, AiLimit> = {
  tutor: { perHour: 0, perDay: 0, unlimited: true, label: "tutor questions" },
  marking: { perHour: 0, perDay: 0, unlimited: true, label: "marking requests" },
  dictation: { perHour: 0, perDay: 0, unlimited: true, label: "dictation clips" },
  vision: { perHour: 0, perDay: 0, unlimited: true, label: "photo readings" },
  explain: { perHour: 0, perDay: 0, unlimited: true, label: "explanation requests" },
};

/** The allowance while the shared key pool pays for the work. */
const SHARED_LIMITS: Record<AiKind, Record<BuildIdentity, AiLimit>> = {
  tutor: {
    guest: { perHour: 5, perDay: 15, unlimited: false, label: "tutor questions" },
    member: { perHour: 15, perDay: 50, unlimited: false, label: "tutor questions" },
  },
  marking: {
    guest: { perHour: 8, perDay: 25, unlimited: false, label: "marking requests" },
    member: { perHour: 20, perDay: 70, unlimited: false, label: "marking requests" },
  },
  dictation: {
    guest: { perHour: 5, perDay: 15, unlimited: false, label: "dictation clips" },
    member: { perHour: 15, perDay: 45, unlimited: false, label: "dictation clips" },
  },
  vision: {
    guest: { perHour: 5, perDay: 15, unlimited: false, label: "photo readings" },
    member: { perHour: 15, perDay: 45, unlimited: false, label: "photo readings" },
  },
  explain: {
    guest: { perHour: 10, perDay: 30, unlimited: false, label: "explanation requests" },
    member: { perHour: 20, perDay: 70, unlimited: false, label: "explanation requests" },
  },
};

/**
 * The allowance for one identity and kind, on the key tier paying for it.
 * The default is the capped one, so a caller that has not considered keys gets
 * the shared allowance rather than no limit at all.
 */
export function aiLimit(
  kind: AiKind,
  identity: BuildIdentity,
  tier: KeyTier = "shared",
): AiLimit {
  return tier === "shared" ? SHARED_LIMITS[kind][identity] : UNLIMITED[kind];
}

export type AiAllowanceVerdict =
  | { allowed: true }
  | { allowed: false; message: string };

export function checkAiAllowance(args: {
  kind: AiKind;
  identity: BuildIdentity;
  now: number;
  spent: number[];
  /** Whose key pays; defaults to the capped, shared allowance. */
  tier?: KeyTier;
}): AiAllowanceVerdict {
  const { kind, identity, now, spent, tier = "shared" } = args;
  const limit = aiLimit(kind, identity, tier);
  // A personal key means no app-level cap: nothing to count.
  if (limit.unlimited) return { allowed: true };

  const guestNote =
    identity === "guest"
      ? " Guests get the lower limit; add an email address to raise it."
      : "";
  const keyNote = tier === "shared" ? ` ${OWN_KEY_UPGRADE_NOTE}` : "";

  const inHour = spent.filter((at) => now - at < HOUR_MS);
  if (inHour.length >= limit.perHour) {
    const wait = Math.max(1, Math.ceil((HOUR_MS - (now - Math.min(...inHour))) / 60_000));
    return {
      allowed: false,
      message:
        `You have reached the AI limit for ${limit.label}: ${limit.perHour} an hour and ${limit.perDay} a day. ` +
        `It resets in about ${wait} ${wait === 1 ? "minute" : "minutes"}.${keyNote}${guestNote} Nothing was sent to the AI.`,
    };
  }

  const inDay = spent.filter((at) => now - at < DAY_MS);
  if (inDay.length >= limit.perDay) {
    const wait = Math.max(1, Math.ceil((DAY_MS - (now - Math.min(...inDay))) / HOUR_MS));
    return {
      allowed: false,
      message:
        `You have reached the AI limit for ${limit.label}: ${limit.perHour} an hour and ${limit.perDay} a day. ` +
        `It resets in about ${wait} ${wait === 1 ? "hour" : "hours"}.${keyNote}${guestNote} Nothing was sent to the AI.`,
    };
  }

  return { allowed: true };
}
