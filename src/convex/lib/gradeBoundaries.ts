/**
 * GCSE 9–1 grade prediction.
 *
 * Boundaries are a percentage of the paper's total marks, which is how every
 * board publishes them. They move a little each series and differ by subject,
 * so this table is deliberately indicative: it carries the series it was drawn
 * from, and every surface that shows a predicted grade also shows the date and
 * the ± band. A prediction without those three things would be a guess dressed
 * up as a mark.
 */

export type ExamBoardKey = "aqa" | "edexcel" | "ocr" | "eduqas" | "wjec" | "ccea" | "other";

/** Percentage of total marks needed for each grade, highest first. */
export type BoundaryRow = {
  board: ExamBoardKey;
  label: string;
  /** grade → minimum percentage. */
  thresholds: Array<{ grade: number; percent: number }>;
};

/** The summer series these indicative boundaries are drawn from. */
export const BOUNDARY_SERIES = "Summer 2026";
export const BOUNDARY_UPDATED_AT = "2026-08-20";

/**
 * Indicative mid-point boundaries. Real boundaries sit within a few points of
 * these on a typical paper; the UI always shows the band rather than the single
 * grade for that reason.
 */
const BASE_THRESHOLDS: Array<{ grade: number; percent: number }> = [
  { grade: 9, percent: 90 },
  { grade: 8, percent: 82 },
  { grade: 7, percent: 74 },
  { grade: 6, percent: 66 },
  { grade: 5, percent: 58 },
  { grade: 4, percent: 50 },
  { grade: 3, percent: 40 },
  { grade: 2, percent: 30 },
  { grade: 1, percent: 20 },
];

const BOARD_LABELS: Record<ExamBoardKey, string> = {
  aqa: "AQA",
  edexcel: "Edexcel",
  ocr: "OCR",
  eduqas: "Eduqas",
  wjec: "WJEC",
  ccea: "CCEA",
  other: "GCSE",
};

/** Boundaries are a couple of points apart between boards on the same paper. */
const BOARD_SHIFT: Record<ExamBoardKey, number> = {
  aqa: 0,
  edexcel: -1,
  ocr: 1,
  eduqas: 1,
  wjec: -2,
  ccea: -1,
  other: 0,
};

/** Reads a stored exam board string ("AQA", "Pearson Edexcel", …) as a key. */
export function boardKey(board?: string | null): ExamBoardKey {
  const value = (board ?? "").toLowerCase();
  if (value.includes("aqa")) return "aqa";
  if (value.includes("edexcel") || value.includes("pearson")) return "edexcel";
  if (value.includes("ocr")) return "ocr";
  if (value.includes("eduqas")) return "eduqas";
  if (value.includes("wjec")) return "wjec";
  if (value.includes("ccea")) return "ccea";
  return "other";
}

/** The boundary table for one board, shifted from the base table. */
export function boundaryRow(board?: string | null): BoundaryRow {
  const key = boardKey(board);
  const shift = BOARD_SHIFT[key];
  return {
    board: key,
    label: BOARD_LABELS[key],
    thresholds: BASE_THRESHOLDS.map((row) => ({
      grade: row.grade,
      percent: Math.max(1, Math.min(99, row.percent + shift)),
    })),
  };
}

export type GradePrediction = {
  /** The grade the percentage reaches, or null below grade 1. */
  grade: number | null;
  /** One grade either side, because boundaries move between series. */
  band: { low: number | null; high: number | null };
  /** U for below grade 1. */
  label: string;
  bandLabel: string;
  board: string;
  series: string;
  updatedAt: string;
  /** How far the percentage is from gaining the next grade, when close. */
  nextGrade: { grade: number; percentAway: number } | null;
};

/**
 * Turns a percentage into a 9–1 grade. Null percentages produce a "no data"
 * prediction rather than a grade 9 or a U, which would both be wrong.
 */
export function predictGrade(
  percentage: number | null,
  board?: string | null,
): GradePrediction {
  const row = boundaryRow(board);
  const gradeFor = (value: number): number | null => {
    for (const threshold of row.thresholds) {
      if (value >= threshold.percent) return threshold.grade;
    }
    return null;
  };

  if (percentage === null) {
    return {
      grade: null,
      band: { low: null, high: null },
      label: "—",
      bandLabel: "Not enough marked work yet",
      board: row.label,
      series: BOUNDARY_SERIES,
      updatedAt: BOUNDARY_UPDATED_AT,
      nextGrade: null,
    };
  }

  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const grade = gradeFor(clamped);
  // One grade either side, because a different series or a different paper in
  // the same subject moves a boundary by about that much.
  const bandLow = grade === null ? null : Math.max(1, grade - 1);
  const bandHigh = grade === null ? null : Math.min(9, grade + 1);
  const nextThreshold = [...row.thresholds]
    .reverse()
    .find((threshold) => threshold.percent > clamped);

  return {
    grade,
    band: { low: bandLow, high: bandHigh },
    label: grade === null ? "U" : String(grade),
    bandLabel: grade === null ? "U" : `${bandLow}–${bandHigh}`,
    board: row.label,
    series: BOUNDARY_SERIES,
    updatedAt: BOUNDARY_UPDATED_AT,
    nextGrade: nextThreshold
      ? { grade: nextThreshold.grade, percentAway: nextThreshold.percent - clamped }
      : null,
  };
}
