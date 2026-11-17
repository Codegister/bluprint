/** Student-facing wording for a build that stopped part-way. */
export type BuildStage = "summary" | "cards" | "quiz" | "exam" | "save";

/** Automatic background attempts after the initial build, then stop. */
export const MAX_AUTOMATIC_REBUILDS = 3;

/** Whether a stopped build left something the student can open. */
export function hasSavedBuildWork(set: {
  summary?: unknown;
  cardCount: number;
  quizCount: number;
  examCount: number;
}): boolean {
  return (
    set.summary !== undefined ||
    set.cardCount + set.quizCount + set.examCount > 0
  );
}

export type BuildCounts = {
  cards: number;
  quiz: number;
  exams: number;
};

/**
 * A big build that reached the end of a stage with a section still short.
 *
 * It is the internal signal to top the missing section up, not a failed build:
 * the caller keeps everything that was written and, once the automatic attempts
 * are spent, finishes the set with the honest "Built X of Y" note. The message
 * is a server-side description and is never shown as an error.
 */
export class StudySetShortfallError extends Error {
  readonly section: "quiz" | "exam";
  readonly built: number;
  readonly requested: number;
  readonly saved: BuildCounts;

  constructor(
    section: "quiz" | "exam",
    built: number,
    requested: number,
    saved: BuildCounts,
  ) {
    const noun =
      section === "quiz"
        ? requested === 1
          ? "quiz question"
          : "quiz questions"
        : requested === 1
          ? "exam question"
          : "exam questions";
    super(`Built ${built} of ${requested} ${noun}.`);
    this.name = "StudySetShortfallError";
    this.section = section;
    this.built = built;
    this.requested = requested;
    this.saved = saved;
  }
}

export const STAGE_LABEL: Record<BuildStage, string> = {
  summary: "summary",
  cards: "flashcard",
  quiz: "quiz",
  exam: "exam-question",
  save: "saving",
};

function keptSentence(counts: BuildCounts): string {
  const parts: string[] = [];
  if (counts.cards > 0) parts.push(`${counts.cards} flashcard${counts.cards === 1 ? "" : "s"}`);
  if (counts.quiz > 0) parts.push(`${counts.quiz} quiz question${counts.quiz === 1 ? "" : "s"}`);
  if (counts.exams > 0) parts.push(`${counts.exams} exam question${counts.exams === 1 ? "" : "s"}`);
  if (parts.length === 0) return "No cards or questions were saved, but your notes are safe.";
  return `The ${parts.join(", ")} that finished are saved and can be opened now.`;
}

/**
 * A failed stage has to say which stage failed and what survived. It never
 * includes provider text, an HTTP status or a raw error: those stay in the
 * server log. This function is pure so the failure path is testable without a
 * model call.
 */
export function buildFailureCopy(
  stage: BuildStage,
  counts: BuildCounts,
  rateLimited = false,
): string {
  const label = STAGE_LABEL[stage];
  const why = rateLimited
    ? `The AI was rate-limited during the ${label} stage`
    : `The ${label} stage did not finish`;
  return `${why}. ${keptSentence(counts)} You can retry immediately.`;
}

/** A note attached to a set that finished, but lost one section. */
export function partialStageNote(stage: BuildStage): string {
  return `The ${STAGE_LABEL[stage]} stage failed, so that section is missing. Everything else in this set is complete.`;
}

/**
 * Whether another attempt could plausibly finish the missing section. A short
 * result is worth retrying because the next batch may add the missing items; a
 * rejected key, a missing model or a validation error is not.
 */
export function isRetryableBuildError(error: unknown): boolean {
  if (error instanceof StudySetShortfallError) return true;
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === "number") {
    if (status === 0 || status === 429 || status >= 500) return true;
    if (status === 401 || status === 402 || status === 403 || status === 404 || status === 410) {
      return false;
    }
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /timeout|timed out|fetch failed|network|rate.?limit|too many requests/i.test(message);
}
