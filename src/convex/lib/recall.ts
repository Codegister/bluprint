/**
 * Short-answer grading shared by the quiz screen and the server.
 *
 * Cloze and typed questions have a canonical answer plus a few accepted
 * alternatives written by the generator. A student's dictation or typing will
 * never match character-for-character, so answers are compared as content
 * words: punctuation, case, articles and filler words are dropped before the
 * overlap is measured. No model call is involved, so checking an answer is
 * instant and free.
 *
 * This module is deliberately dependency-free so the browser and the Convex
 * runtime can import exactly the same rules.
 */

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "of",
  "to",
  "in",
  "on",
  "at",
  "for",
  "and",
  "or",
  "is",
  "are",
  "was",
  "were",
  "be",
  "by",
  "with",
  "that",
  "this",
  "it",
  "as",
  "from",
]);

/** Lowercase, strip punctuation and collapse whitespace. */
export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contentWords(value: string): string[] {
  return normalizeAnswer(value)
    .split(" ")
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word));
}

/** Whether every number in the expected answer appears in the response. */
function numbersMatch(expected: string, response: string): boolean {
  const wanted = normalizeAnswer(expected).match(/\b\d+(?:\.\d+)?\b/g) ?? [];
  if (wanted.length === 0) return true;
  const offered = new Set(normalizeAnswer(response).match(/\b\d+(?:\.\d+)?\b/g) ?? []);
  return wanted.every((number) => offered.has(number));
}

export type ShortAnswerGrade = {
  correct: boolean;
  /** 0–1 share of the expected answer's content words that were recalled. */
  score: number;
};

/**
 * Grades one typed or dictated answer against the expected answer and the
 * generator's accepted alternatives. A short answer (one or two content words)
 * must match almost exactly; a longer one can miss a word and still pass.
 */
export function gradeShortAnswer(
  expected: string,
  accepted: readonly string[] | undefined,
  response: string,
): ShortAnswerGrade {
  const cleaned = normalizeAnswer(response);
  if (cleaned.length === 0) return { correct: false, score: 0 };

  const options = [expected, ...(accepted ?? [])].filter(
    (option) => normalizeAnswer(option).length > 0,
  );

  let best = 0;
  for (const option of options) {
    const optionClean = normalizeAnswer(option);
    if (cleaned === optionClean) return { correct: true, score: 1 };

    const wanted = contentWords(option);
    if (wanted.length === 0) continue;
    const offered = new Set(contentWords(response));
    const hits = wanted.filter((word) => offered.has(word)).length;
    const score = hits / wanted.length;

    if (score > best) best = score;
    if (numbersMatch(option, response) && score >= (wanted.length <= 2 ? 1 : 0.6)) {
      return { correct: true, score: Math.max(score, 0.6) };
    }
  }

  return { correct: false, score: best };
}

/**
 * Marks a spoken card answer, which is usually a sentence rather than a single
 * term. A full model answer has too many content words to require all of them,
 * so a concise answer that stays on the model answer's vocabulary is accepted:
 * precision (how much of the student's answer is in the model) matters as much
 * as recall. The student still chooses the FSRS rating afterwards.
 */
export function gradeRecall(
  expected: string,
  response: string,
): ShortAnswerGrade {
  const strict = gradeShortAnswer(expected, [], response);
  if (strict.correct) return strict;

  const wanted = contentWords(expected);
  const offered = contentWords(response);
  if (wanted.length === 0 || offered.length === 0) return strict;

  const offeredInExpected =
    offered.filter((word) => wanted.includes(word)).length / offered.length;
  const score = Math.max(strict.score, offeredInExpected);
  const threshold = wanted.length >= 6 ? 0.5 : 0.8;
  return { correct: score >= threshold, score };
}

