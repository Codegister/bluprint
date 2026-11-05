/**
 * Exam-board metadata shared by the pickers and display labels.
 *
 * The catalogue in `convex/lib/catalogue.ts` is the single source of truth for
 * qualifications, subject availability, boards and tiers. This module keeps the
 * frontend-facing names that older screens import.
 */
import {
  QUALIFICATIONS,
  STUDY_LEVELS,
  boardsForLevel,
  defaultBoardFor,
} from "@/convex/lib/catalogue";

export { STUDY_LEVELS, defaultBoardFor };

/** Every body named by any qualification, for legacy free-text settings. */
export const EXAM_BOARDS = [
  ...new Set(QUALIFICATIONS.flatMap((entry) => entry.boards)),
];

/** Boards the qualification actually uses. A single body is still returned. */
export function validBoardsForLevel(level: string): string[] {
  return boardsForLevel(level);
}

/** The inverse filter, used when the board is chosen before the level. */
export function validLevelsForBoard(board: string): string[] {
  return STUDY_LEVELS.filter((level) => boardsForLevel(level).includes(board));
}

/** Whether the pair is a real qualification rather than a picker collision. */
export function isBoardLevelValid(board: string, level: string): boolean {
  if (!board || !level) return true;
  return boardsForLevel(level).includes(board);
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
