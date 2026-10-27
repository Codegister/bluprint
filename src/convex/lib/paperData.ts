/**
 * Whether a paper question can be answered on its own.
 *
 * The paper generator once wrote "The table shows the percentage cover of three
 * plant species…" without a table, which makes the question impossible rather
 * than hard. A question that points at data must carry that data, so this check
 * runs after generation: a broken question is repaired, and dropped if it
 * cannot be.
 */

export type QuestionData = {
  title?: string;
  columns: string[];
  rows: string[][];
  note?: string;
};

/** A question pointing at a table, figure, graph or photograph. */
const DATA_REFERENCE =
  /(?:\b(?:the|this)\s+(?:table|graph|chart|figure|diagram|image|photograph|photo)\b|\b(?:table|figure|graph|chart|diagram)\s+\d|\b(?:results?|data|readings|observations)\s+(?:below|above)\b)/i;

export function referencesData(text: string): boolean {
  return DATA_REFERENCE.test(text);
}

/** A table with a header and at least one row is a table a student can read. */
export function hasData(data: QuestionData | undefined): boolean {
  return Boolean(data && data.columns.length >= 2 && data.rows.length > 0);
}

/** True when the question needs nothing that is not displayed with it. */
export function isSelfContained(question: {
  question: string;
  data?: QuestionData;
}): boolean {
  return !referencesData(question.question) || hasData(question.data);
}
