import { PAPER_CHECKLIST, PAPER_CHECKLIST_AQA_LIT } from "./checklist";
import { PAPER_FORMAT_GUIDELINE } from "./guideline";
import { PAPER_GENERATOR_PROMPT } from "./prompt";

export {
  PAPER_CHECKLIST,
  PAPER_CHECKLIST_AQA_LIT,
  PAPER_FORMAT_GUIDELINE,
  PAPER_GENERATOR_PROMPT,
};

/** The checklist excerpt for a request: one authoritative row where possible. */
export function paperChecklistFor(course: {
  subject: string;
  level: string;
  examBoard: string;
}): string {
  if (
    /english literature|eng lit|literature/i.test(course.subject) &&
    /gcse/i.test(course.level) &&
    /aqa/i.test(course.examBoard)
  ) {
    return PAPER_CHECKLIST_AQA_LIT;
  }
  return PAPER_CHECKLIST;
}

/**
 * The complete system message used when a practice paper is written.
 *
 * The supplied procedure is followed in full and the checklist excerpt for the
 * request is included. Bluprint's paper grid is appended as an explicit contract
 * because the app stores and marks one question at a time.
 */
export function paperGeneratorSystemMessage(checklist: string): string {
  return `${PAPER_GENERATOR_PROMPT}

REFERENCE DOCUMENT 1 — paper_format_guideline.txt
${PAPER_FORMAT_GUIDELINE}

REFERENCE DOCUMENT 2 — paper_checklist.csv
${checklist}

BLUPRINT INTEGRATION CONTRACT — this overrides Section 6 and any conflicting part
of the procedure above.

The caller's <paper_format> block is the authoritative question grid for this
request. It fixes the exact number of questions, their order, sections, marks,
command words and marking style. Follow that grid exactly; do not add, remove,
reorder or re-mark a question. Use the checklist and guideline for board voice,
tariffs, command words, AO balance, materials, mark-scheme conventions and the
row's authenticity checks; where the grid and a checklist row differ, the grid
wins. The app deliberately presents practice papers with the grid's marks, so do
not expand a paper beyond that grid.

Complete the applicable checklist internally and use it to audit the paper before
responding. Do not return the checklist, a paper_economy object or a nested paper
object. Return only strict JSON in exactly this shape:

{"questions":[{"question":"...","marks":3,"modelAnswer":"...","markingGuide":["..."],"commandWord":"Outline","specReference":"1.1","data":{"title":"...","columns":["..."],"rows":[["..."]]}}]}

Return exactly one entry per question in the grid, in the same order. Each entry
must include question, marks, modelAnswer and markingGuide. Include commandWord and
specReference on every question where they apply. The app supplies any required
extract separately; do not return an extract field. Include data only when the
question refers to a table, and then include the complete table with columns and
rows. Do not use markdown fences, commentary or any other top-level key.`;
}
