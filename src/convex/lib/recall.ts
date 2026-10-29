/**
 * Short-answer grading shared by the quiz screen and the server.
 *
 * Cloze and typed questions have a canonical answer plus a few accepted
 * alternatives written by the generator. A student's dictation or typing will
 * never match character-for-character, so answers are compared as content
 * words: punctuation, case, accents, articles, filler words and number
 * spellings are folded away before the overlap is measured. No model call is
 * involved, so checking an answer is instant and free.
 *
 * Flashcards do not stop here: an answer that differs in wording is re-checked
 * for meaning by the model (see gradeRecallAnswer in convex/ai.ts), and these
 * rules are the fallback when that call cannot be made.
 *
 * This module is deliberately dependency-free so the browser and the Convex
 * runtime can import exactly the same rules.
 */

const LANGUAGE_COURSE =
  /\b(spanish|french|german|italian|portuguese|mandarin|chinese|japanese|russian|arabic|latin|welsh|irish|english language)\b/i;

/** Articles that do not change a vocabulary answer ("la casa" = "casa"). */
const LEADING_ARTICLE = /^(?:the|a|an|el|la|los|las|un|una|unos|unas|le|les|des|du)\s+/;

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

const NUMBER_UNITS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const NUMBER_TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const NUMBER_SCALES: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
  million: 1_000_000,
};

function isNumberWord(token: string): boolean {
  return (
    token in NUMBER_UNITS || token in NUMBER_TENS || token in NUMBER_SCALES
  );
}

/**
 * Reads the tens-and-units part of a number: "twenty one" is 21, "nineteen" is
 * 19 and "sixty five" is 65. A second such run straight after the first is left
 * for the caller, which is how spoken years are assembled.
 */
function readNumberPart(
  tokens: string[],
  start: number,
): { value: number; next: number } | null {
  let index = start;
  let value = 0;
  let consumed = false;
  let last: "units" | "tens" | null = null;

  while (index < tokens.length) {
    const token = tokens[index]!;
    if (
      token === "and" &&
      index + 1 < tokens.length &&
      isNumberWord(tokens[index + 1]!)
    ) {
      index += 1;
      continue;
    }
    if (token in NUMBER_UNITS) {
      // A unit after anything but a tens word ("nineteen sixty", "five six")
      // starts a different number, so this run stops here.
      if (consumed && last !== "tens") break;
      value += NUMBER_UNITS[token]!;
      consumed = true;
      last = "units";
      index += 1;
      continue;
    }
    if (token in NUMBER_TENS) {
      // A tens word always opens a group: "twenty one" is one number, but the
      // "sixty" of "nineteen sixty nine" belongs to the next one.
      if (consumed) break;
      value += NUMBER_TENS[token]!;
      consumed = true;
      last = "tens";
      index += 1;
      continue;
    }
    break;
  }

  return consumed ? { value, next: index } : null;
}

/**
 * Reads a run of number words as one value: "twenty one" is 21, "three hundred
 * and sixty five" is 365, "nineteen sixty nine" is 1969 and "six point five"
 * is 6.5. Returns the value and the index of the first token it did not use.
 */
function readNumber(
  tokens: string[],
  start: number,
): { value: string; next: number } | null {
  const first = readNumberPart(tokens, start);
  if (!first) return null;

  let index = first.next;
  let total = 0;
  let current = first.value;

  while (tokens[index] !== undefined && tokens[index]! in NUMBER_SCALES) {
    total += (current || 1) * NUMBER_SCALES[tokens[index]!]!;
    current = 0;
    index += 1;
    const part = readNumberPart(tokens, index);
    if (part) {
      current = part.value;
      index = part.next;
    }
  }

  let whole = total + current;

  // Spoken years: when nothing was scaled and a second tens-and-units run
  // follows at once, the first run is the century ("nineteen sixty nine").
  if (
    total === 0 &&
    current >= 10 &&
    tokens[index] !== undefined &&
    isNumberWord(tokens[index]!)
  ) {
    const second = readNumberPart(tokens, index);
    if (second) {
      whole = current * 100 + second.value;
      index = second.next;
    }
  }

  // A spoken decimal: "six point five" is 6.5.
  if (
    tokens[index] === "point" &&
    tokens[index + 1] !== undefined &&
    tokens[index + 1]! in NUMBER_UNITS
  ) {
    let fraction = "";
    index += 1;
    while (
      tokens[index] !== undefined &&
      tokens[index]! in NUMBER_UNITS
    ) {
      fraction += String(NUMBER_UNITS[tokens[index]!]!);
      index += 1;
    }
    return { value: `${whole}.${fraction}`, next: index };
  }

  return { value: String(whole), next: index };
}

/**
 * Folds number words and numeric spellings onto one form, so a dictated "six"
 * marks the same as an answer key's "6" (and "3.5", "three point five" and
 * "3.50" all agree). Digits are canonicalised too: "6.0" becomes "6".
 */
function foldNumbers(value: string): string {
  if (value.length === 0) return value;
  const tokens = value.split(" ");
  const out: string[] = [];
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index]!;
    if (isNumberWord(token)) {
      const read = readNumber(tokens, index);
      if (read) {
        out.push(read.value);
        index = read.next;
        continue;
      }
    }
    if (/^\d+(?:\.\d+)?$/.test(token)) {
      out.push(String(Number(token)));
      index += 1;
      continue;
    }
    out.push(token);
    index += 1;
  }

  return out.join(" ");
}

/**
 * Lowercase, strip punctuation and accents, collapse whitespace and fold
 * numbers. Accents are folded rather than deleted, so "café" and "cafe" are
 * the same word and a language learner's dictation is not mangled.
 */
export function normalizeAnswer(value: string): string {
  const cleaned = value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    // Thousand separators first ("1,000"), then a decimal comma or point, so
    // "3,5" and "3.5" both survive as one number.
    .replace(/(\d),(\d{3})(?!\d)/g, "$1$2")
    .replace(/(\d),(\d+)/g, "$1.$2");
  const tokens = cleaned.match(/[\p{L}\p{N}]+(?:\.\p{N}+)*/gu) ?? [];
  return foldNumbers(tokens.join(" "));
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

/** True when the course is a modern or classical language. */
export function isLanguageCourse(course: string | undefined): boolean {
  return Boolean(course && LANGUAGE_COURSE.test(course));
}

/** True when the expected answer is a short term or phrase, not a sentence. */
export function isShortAnswer(expected: string, max = 2): boolean {
  const words = contentWords(expected);
  return words.length > 0 && words.length <= max;
}

/**
 * Marks a short vocabulary answer. A language card is a fact, not a topic:
 * "la casa" is not answered by "el perro", however confidently it is said.
 * Articles are ignored so "casa" still matches "la casa".
 */
export function gradeVocabularyAnswer(
  expected: string,
  response: string,
): ShortAnswerGrade {
  const wanted = normalizeAnswer(expected).replace(LEADING_ARTICLE, "").trim();
  const offered = normalizeAnswer(response).replace(LEADING_ARTICLE, "").trim();
  if (wanted.length > 0 && wanted === offered) {
    return { correct: true, score: 1 };
  }
  return gradeShortAnswer(wanted || expected, [], offered || response);
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

