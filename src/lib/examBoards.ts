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
  "IGCSE",
  "KS3",
  "AS",
  "A-Level",
  "IB",
  "AP",
  "National 5",
  "Higher",
  "Undergraduate",
] as const;

/**
 * Board/level pairs the picker may offer. IB and College Board AP are levels,
 * not boards that can be combined with GCSE or AQA; the checklist rows for
 * National 5 and Higher are reachable only through SQA.
 */
export function validBoardsForLevel(level: string): string[] {
  switch (level) {
    case "GCSE":
      return ["AQA", "Pearson Edexcel", "OCR", "WJEC / Eduqas", "Other"];
    case "IGCSE":
      return ["Pearson Edexcel", "Cambridge International", "Other"];
    case "AS":
    case "A-Level":
      return [
        "AQA",
        "Pearson Edexcel",
        "OCR",
        "WJEC / Eduqas",
        "Cambridge International",
        "Other",
      ];
    case "IB":
      return ["IB"];
    case "AP":
      return ["College Board AP"];
    case "National 5":
    case "Higher":
      return ["SQA"];
    case "KS3":
    case "Undergraduate":
      return ["Other"];
    default:
      return [...EXAM_BOARDS];
  }
}

/** The inverse filter, used when the board is chosen before the level. */
export function validLevelsForBoard(board: string): string[] {
  return STUDY_LEVELS.filter((level) => validBoardsForLevel(level).includes(board));
}

/** Whether the pair is a real qualification rather than a picker collision. */
export function isBoardLevelValid(board: string, level: string): boolean {
  if (!board || !level) return true;
  return validBoardsForLevel(level).includes(board);
}

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
