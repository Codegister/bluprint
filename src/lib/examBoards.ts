/**
 * Exam-board metadata shared by the pickers and display labels.
 *
 * A set stores its board and level as plain strings so older sets (created
 * before boards existed) and custom qualifications still load. The AI prompts
 * in `convex/ai.ts` decide how each board's mark scheme is written; this file
 * only describes the choices offered in the UI.
 */
export const EXAM_BOARDS = [
  "AQA",
  "Pearson Edexcel",
  "OCR",
  "WJEC / Eduqas",
  "Cambridge International",
  "IB",
  "SQA",
  "College Board AP",
  "Other",
] as const;

export const STUDY_LEVELS = [
  "GCSE",
  "KS3",
  "A-Level",
  "IB",
  "AP",
  "Undergraduate",
] as const;

/**
 * "AQA · A-Level · Biology" — used wherever a set needs one line of context.
 * Returns an empty string when the set has no metadata at all.
 */
export function qualificationLabel(input: {
  examBoard?: string;
  level?: string;
  course?: string;
}): string {
  return [input.examBoard, input.level, input.course]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}
