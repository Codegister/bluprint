/**
 * Marking criteria.
 *
 * A mark scheme is a list of discrete creditable points, each carrying its own
 * marks, so it is stored that way: `{ id, marks, text }`. Generation still
 * produces the bullet strings the examiner prompt consumes ("1 mark: …"), and
 * this module turns them into criteria once, at save time. Every screen that
 * shows the guide or the awarded marks reads the same rows, which is what stops
 * the summary and the checklist from describing the same mark twice.
 */

export type MarkingCriterion = {
  id: string;
  marks: number;
  text: string;
};

/** "1 mark:", "2 marks -", "(3 marks)" — the prefix a board prints. */
const MARK_PREFIX = /^\s*\(?(\d{1,2})\s*(?:marks?|mks?)\)?\s*[:.–—-]?\s*/i;

/** One criterion per guide bullet, with the marks read from its own wording. */
export function toCriteria(guide: string[]): MarkingCriterion[] {
  return guide.map((raw, index) => {
    const text = raw.trim();
    const match = MARK_PREFIX.exec(text);
    const marks = match ? Number(match[1]) : 1;
    const withoutPrefix = match ? text.slice(match[0].length).trim() : text;
    return {
      id: `c${index + 1}`,
      marks: Math.max(1, Math.min(60, Number.isFinite(marks) ? marks : 1)),
      // The criterion text is shown in full; the mark prefix is a separate
      // column, so it is removed here rather than repeated in every row.
      text: withoutPrefix || text,
    };
  });
}

/**
 * The criteria for a question: the stored structured list when it exists, or
 * the same rows derived from an older guide. Order always matches the guide.
 */
export function criteriaFor(question: {
  criteria?: MarkingCriterion[];
  markingGuide: string[];
}): MarkingCriterion[] {
  if (question.criteria && question.criteria.length > 0) {
    return question.criteria;
  }
  return toCriteria(question.markingGuide);
}

/**
 * The examiner feedback without the bullet-by-bullet list it used to embed.
 * The checklist below it renders those rows; keeping both repeated every mark
 * in the summary and again in the list.
 */
export function feedbackSummary(feedback: string): string {
  return feedback
    .split(/\n(?=Credited:|Not credited:)/)[0]!
    .replace(/\s+$/, "")
    .trim();
}
