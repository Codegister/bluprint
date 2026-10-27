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

/**
 * Makes a question's wording match what the page renders.
 *
 * Papers can only render tables, not diagrams or photographs. A model that
 * supplies the data as a table but still writes "the graph shows…" would leave
 * the student looking for a graph that is not there. When a table is present,
 * the reference is renamed to "table"; when no table is present the question is
 * still rejected by `isSelfContained`, so this never hides missing data.
 */
export function alignDataReference<T extends { question: string; data?: QuestionData }>(
  question: T,
): T {
  if (!hasData(question.data)) return question;
  const aligned = question.question
    .replace(
      /\b(the|this)\s+(graph|chart|figure|diagram|photograph|photo|image)\b/gi,
      "$1 table",
    )
    .replace(
      /\b(graph|chart|figure|diagram|photograph|photo|image)\s+(\d+)\b/gi,
      (match, word: string, number: string) =>
        `${word[0] === word[0]?.toUpperCase() ? "Table" : "table"} ${number}`,
    );
  return aligned === question.question ? question : { ...question, question: aligned };
}
