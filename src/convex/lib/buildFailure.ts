/** Student-facing wording for a build that stopped part-way. */
export type BuildStage = "summary" | "cards" | "quiz" | "exam" | "save";

export type BuildCounts = {
  cards: number;
  quiz: number;
  exams: number;
};

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
    const finished =
      saved.cards > 0
        ? `Your ${saved.cards} flashcard${saved.cards === 1 ? " is" : "s are"} saved.`
        : "Your notes are safe.";
    super(
      `Bluprint built ${built} of ${requested} ${noun}, so this section is incomplete and the set was not marked ready. ${finished} Retry to complete the ${section}.`,
    );
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
