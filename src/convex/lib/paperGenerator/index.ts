import { PAPER_CHECKLIST } from "./checklist";
import { PAPER_FORMAT_GUIDELINE } from "./guideline";
import { PAPER_GENERATOR_PROMPT } from "./prompt";

export {
  PAPER_CHECKLIST,
  PAPER_FORMAT_GUIDELINE,
  PAPER_GENERATOR_PROMPT,
};


/**
 * The complete system message used when a practice paper is written.
 *
 * The supplied procedure is followed in full, and both reference documents are
 * included so the model does not have to guess at board conventions. Bluprint's
 * paper grid is appended as an explicit contract because the app deliberately
 * builds a one-hour practice paper rather than reproducing a full board paper.
 */
export const PAPER_GENERATOR_SYSTEM_MESSAGE = `${PAPER_GENERATOR_PROMPT}

REFERENCE DOCUMENT 1 — paper_format_guideline.txt
${PAPER_FORMAT_GUIDELINE}

REFERENCE DOCUMENT 2 — paper_checklist.csv
${PAPER_CHECKLIST}

BLUPRINT INTEGRATION CONTRACT — this overrides Step 10 and any conflicting part of
the procedure above.

The caller's <paper_format> block is the authoritative question grid for this
request. It fixes the exact number of questions, their order, sections, marks,
command words and marking style. Follow that grid exactly; do not add, remove,
reorder or re-mark a question. Bluprint deliberately builds a one-hour practice
paper, so do not expand it to the full qualification duration or mark total in the
checklist. Use the checklist and guideline for board voice, tariffs, command words,
AO balance, materials, mark-scheme conventions and the fifteen authenticity checks;
where the grid and a checklist row differ, the grid wins.

Complete the applicable checklist internally and use it to audit the paper before
responding. Do not return the checklist, a paper_economy object or a nested paper
object. Return only strict JSON in exactly this shape:

{"questions":[{"question":"...","marks":3,"extract":{"source":"Macbeth","reference":"Act 1, Scene 3","text":"..."},"modelAnswer":"...","markingGuide":["..."],"commandWord":"Outline","specReference":"1.1","data":{"title":"...","columns":["..."],"rows":[["..."]]}}]}

Return exactly one entry per question in the grid, in the same order. Each entry
must include question, marks, modelAnswer and markingGuide. Include commandWord and
specReference on every question where they apply. The app supplies any required extract
separately; do not return an extract field unless the caller explicitly asks for one
inside the JSON. Include data only when the question refers to a table, and then include the complete table with columns and rows. Do
not use markdown fences, commentary or any other top-level key.`;
