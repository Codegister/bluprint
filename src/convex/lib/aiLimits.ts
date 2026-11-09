/**
 * Per-account ceilings for actions that spend AI credits.
 *
 * Builds already have their own allowance. Tutoring, marking, dictation and
 * vision do not produce a set, so they need a separate limit; without one a
 * script could call the public actions repeatedly and drain the deployment.
 * The numbers are deliberately generous for a real revision session.
 */
import { DAY_MS, HOUR_MS, type BuildIdentity } from "./buildLimits";

export type AiKind = "tutor" | "marking" | "dictation" | "vision" | "explain";

type AiLimit = { perHour: number; perDay: number; label: string };

const LIMITS: Record<AiKind, Record<BuildIdentity, AiLimit>> = {
  tutor: {
    guest: { perHour: 10, perDay: 30, label: "tutor questions" },
    member: { perHour: 40, perDay: 120, label: "tutor questions" },
  },
  marking: {
    guest: { perHour: 15, perDay: 50, label: "marking requests" },
    member: { perHour: 60, perDay: 200, label: "marking requests" },
  },
  dictation: {
    guest: { perHour: 10, perDay: 30, label: "dictation clips" },
    member: { perHour: 40, perDay: 120, label: "dictation clips" },
  },
  vision: {
    guest: { perHour: 10, perDay: 30, label: "photo readings" },
    member: { perHour: 40, perDay: 120, label: "photo readings" },
  },
  explain: {
    guest: { perHour: 20, perDay: 60, label: "explanation requests" },
    member: { perHour: 60, perDay: 180, label: "explanation requests" },
  },
};

export function aiLimit(kind: AiKind, identity: BuildIdentity): AiLimit {
  return LIMITS[kind][identity];
}

export type AiAllowanceVerdict =
  | { allowed: true }
  | { allowed: false; message: string };

export function checkAiAllowance(args: {
  kind: AiKind;
  identity: BuildIdentity;
  now: number;
  spent: number[];
}): AiAllowanceVerdict {
  const { kind, identity, now, spent } = args;
  const limit = aiLimit(kind, identity);
  const guestNote =
    identity === "guest"
      ? " Guests get the lower limit; add an email address to raise it."
      : "";

  const inHour = spent.filter((at) => now - at < HOUR_MS);
  if (inHour.length >= limit.perHour) {
    const wait = Math.max(1, Math.ceil((HOUR_MS - (now - Math.min(...inHour))) / 60_000));
    return {
      allowed: false,
      message:
        `You have reached the AI limit for ${limit.label}: ${limit.perHour} an hour and ${limit.perDay} a day. ` +
        `It resets in about ${wait} ${wait === 1 ? "minute" : "minutes"}.${guestNote} Nothing was sent to the AI.`,
    };
  }

  const inDay = spent.filter((at) => now - at < DAY_MS);
  if (inDay.length >= limit.perDay) {
    const wait = Math.max(1, Math.ceil((DAY_MS - (now - Math.min(...inDay))) / HOUR_MS));
    return {
      allowed: false,
      message:
        `You have reached the AI limit for ${limit.label}: ${limit.perHour} an hour and ${limit.perDay} a day. ` +
        `It resets in about ${wait} ${wait === 1 ? "hour" : "hours"}.${guestNote} Nothing was sent to the AI.`,
    };
  }

  return { allowed: true };
}
