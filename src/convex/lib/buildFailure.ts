/** Student-facing wording for a build that stopped part-way. */
export type BuildStage = "summary" | "cards" | "quiz" | "exam" | "save";

export type BuildCounts = {
  cards: number;
  quiz: number;
  exams: number;
};

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
  return `${why}. ${keptSentence(counts)} You can retry immediately; this attempt was not counted against your build allowance.`;
}

/** A note attached to a set that finished, but lost one section. */
export function partialStageNote(stage: BuildStage): string {
  return `The ${STAGE_LABEL[stage]} stage failed, so that section is missing. Everything else in this set is complete.`;
}
