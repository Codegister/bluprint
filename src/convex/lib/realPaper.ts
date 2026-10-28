/**
 * A real past-paper question, supplied by the student with its official mark
 * scheme, and mock papers assembled from a set.
 *
 * Pasted mark schemes are written for humans: bullets, "1 mark" prefixes,
 * numbered points, semicolons inside one line. They are parsed here into the
 * same discrete criteria the examiner already grades against, so a real scheme
 * gets the same per-criterion, evidence-quoted treatment as a generated one.
 */

import {
  alignCriteria,
  criterionText,
  distributeMarks,
  toCriteria,
  type MarkingCriterion,
} from "./markingCriteria";

/** A mark scheme line, without a leading bullet or numbering. */
function cleanLine(line: string): string {
  return line
    .replace(/^[\s\-–—*•·●▪]+/, "")
    .replace(/^\d{1,2}[.)]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Splits a pasted scheme into lines. A scheme pasted from a PDF often arrives
 * as one line with semicolons or "(1)" markers between points, so the split
 * happens on those too.
 */
export function schemeLines(text: string): string[] {
  return text
    .split(/\r?\n|;\s*|(?<=\(\d{1,2}\))\s+/)
    .map(cleanLine)
    .filter((line) => line.length > 1);
}

/**
 * The criteria for a real question, from its scheme and the marks it is worth.
 * Marks the scheme states explicitly are kept; the rest are distributed so the
 * total always matches the question, which is what makes the score auditable.
 */
export function parseMarkScheme(text: string, marks: number): MarkingCriterion[] {
  const lines = schemeLines(text).filter(
    // A heading ("Mark scheme", "Question 3") is not a creditable point.
    (line) => !/^(mark scheme|marks? scheme|question|total)\b/i.test(line),
  );
  if (lines.length === 0) return [];
  const total = Math.max(1, Math.min(100, Math.round(marks)));
  const derived = toCriteria(lines);
  return alignCriteria(derived, total);
}

/** The guide strings the examiner prompt consumes for a real question. */
export function criteriaToGuide(criteria: MarkingCriterion[]): string[] {
  return criteria.map(
    (criterion) =>
      `${criterion.marks} mark${criterion.marks === 1 ? "" : "s"}: ${criterion.text}`,
  );
}

/** Whether every criterion has text and at least one mark. */
export function schemeIsUsable(criteria: MarkingCriterion[]): boolean {
  return (
    criteria.length > 0 &&
    criteria.every(
      (criterion) => criterion.text.trim().length > 0 && criterion.marks >= 1,
    ) &&
    criteria.reduce((sum, criterion) => sum + criterion.marks, 0) > 0
  );
}

/** The scheme as the student pasted it, shown back beside the mark. */
export function schemePreview(criteria: MarkingCriterion[], limit = 12): string[] {
  return criteria.slice(0, limit).map((criterion) => criterionText(criterion.text));
}

// ---------------------------------------------------------------------------
// Mock papers
// ---------------------------------------------------------------------------

/** A GCSE paper's real tariff, in marks. One minute per mark is the convention. */
export const DEFAULT_TARIFF = 100;

export type MockCandidate = { id: string; marks: number };

export type MockAssembly = {
  items: Array<{ id: string; marks: number }>;
  totalMarks: number;
  /** The tariff the paper was assembled to. */
  tariff: number;
  /** Seconds allowed, at the board's one-minute-per-mark convention. */
  seconds: number;
  /** True when the set could not fill the tariff and the paper is shorter. */
  short: boolean;
};

/**
 * Assembles a mock from the set's written questions, in order, up to the board's
 * tariff. A question that would overshoot by more than two marks is skipped so
 * the paper lands on the tariff instead of sailing past it. A set that cannot
 * fill the tariff is marked short rather than padded with invented questions.
 */
export function assembleMock(
  questions: MockCandidate[],
  tariff: number = DEFAULT_TARIFF,
): MockAssembly {
  const target = Math.max(1, Math.round(tariff));
  const items: MockCandidate[] = [];
  let total = 0;
  for (const question of questions) {
    if (question.marks <= 0) continue;
    if (total + question.marks > target + 2) continue;
    items.push(question);
    total += question.marks;
    if (total >= target) break;
  }
  return {
    items,
    totalMarks: total,
    tariff: target,
    seconds: total * 60,
    short: total < target,
  };
}

/** Splits marks across questions, for a paper that must total a fixed tariff. */
export function scaleMarks(marks: number[], target: number): number[] {
  return distributeMarks(Math.max(1, Math.round(target)), marks.length);
}
