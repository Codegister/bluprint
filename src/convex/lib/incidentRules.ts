/**
 * Rules for the AI provider health alert.
 *
 * The tutor broke in production because a model reached end of life and the
 * failure was only visible to students: the transport returned an error, the
 * chat showed it, and nobody running the deployment found out. These rules turn
 * a stream of sanitised provider failures into a single decision — "alert, or
 * stay quiet" — and they are pure so they can be tested without a deployment.
 */

/**
 * How far back a sweep looks. Wider than the sweep interval on purpose: a
 * failure in the gap between two sweeps must still be seen by the next one.
 */
export const INCIDENT_WINDOW_MS = 30 * 60 * 1000;

/** Do not send a second alert for the same window more often than this. */
export const ALERT_COOLDOWN_MS = 60 * 60 * 1000;

/** One repeated failure is a blip; this many in a window is an outage. */
export const INCIDENT_ALERT_THRESHOLD = 3;

/**
 * Causes that are fatal on their own.
 *
 * A retired model, a rejected key or an account with no credits does not get
 * better by retrying, so one occurrence is already an outage: waiting for three
 * is how the tutor stayed broken for every student while the first two failures
 * looked like noise.
 */
const FATAL_KINDS = new Set(["model-unavailable", "auth", "no-credits"]);

/** Whether this cause deserves an alert after a single failure. */
export function isFatalKind(kind: string): boolean {
  return FATAL_KINDS.has(kind);
}

export type IncidentKind =
  | "model-unavailable"
  | "auth"
  | "no-credits"
  | "rate-limit"
  | "server"
  | "network"
  | "empty-answer";

/** Groups an upstream status into the cause a person would act on. */
export function incidentKind(status: number): IncidentKind {
  if (status === 404 || status === 410) return "model-unavailable";
  if (status === 401 || status === 403) return "auth";
  if (status === 402) return "no-credits";
  if (status === 429) return "rate-limit";
  if (status === 0) return "network";
  if (status >= 500) return "server";
  return "empty-answer";
}

export type IncidentRow = {
  at: number;
  kind: string;
  purpose: string;
  model: string;
  status: number;
  alertedAt?: number;
};

/**
 * Whether this window deserves an alert.
 *
 * A fatal cause (retired model, rejected key, no credits) alerts on the first
 * failure. A transient cause (rate limit, network, a 5xx) has to repeat
 * `INCIDENT_ALERT_THRESHOLD` times, because one is normal traffic. One alert
 * covers the whole window, and the cooldown stops a single outage from sending
 * a message every sweep.
 */
export function shouldAlert(
  rows: Array<{ at: number; kind: string }>,
  now: number,
  lastAlertAt: number | undefined,
): boolean {
  if (lastAlertAt !== undefined && now - lastAlertAt < ALERT_COOLDOWN_MS) {
    return false;
  }
  const recent = rows.filter((row) => now - row.at <= INCIDENT_WINDOW_MS);
  if (recent.some((row) => isFatalKind(row.kind))) return true;

  const counts = new Map<string, number>();
  for (const row of recent) {
    counts.set(row.kind, (counts.get(row.kind) ?? 0) + 1);
  }
  return [...counts.values()].some((count) => count >= INCIDENT_ALERT_THRESHOLD);
}

/** The one-line headline on an alert, with counts and no secrets. */
export function alertSummary(rows: Array<{ kind: string; model: string }>): string {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.kind, (counts.get(row.kind) ?? 0) + 1);
  const models = [...new Set(rows.map((row) => row.model))].slice(0, 3).join(", ");
  const parts = [...counts.entries()].map(([kind, count]) => `${kind}=${count}`);
  return `Bluprint AI failures: ${parts.join(" ")} (models: ${models || "unknown"})`;
}

/** One sentence for the alert body explaining the most useful next step. */
export function alertAdvice(rows: Array<{ kind: string }>): string {
  if (rows.some((row) => row.kind === "model-unavailable")) {
    return (
      "A model reached end of life or is not installed on this account. " +
      "Set NVIDIA_TEXT_MODEL (and NVIDIA_VISION_MODEL) to a model from build.nvidia.com; " +
      "the transport already falls back to its checked models, so check the server log for the failing id."
    );
  }
  if (rows.some((row) => row.kind === "auth" || row.kind === "no-credits")) {
    return "Check the NVIDIA_API_KEY pool and the account's credits on the deployment.";
  }
  if (rows.some((row) => row.kind === "rate-limit")) {
    return "Sustained rate limiting: add another NVIDIA_API_KEY or lower the tutor level.";
  }
  return "Check the deployment's network access to the AI provider and the latest server log lines.";
}
