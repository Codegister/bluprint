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

/** Reads one number, including fractions and percentages, ignoring units. */
export function parseNumericValue(value: string): number | null {
  const text = normalizeAnswer(value);
  const fractionMatch = value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .match(/(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return numerator / denominator;
    }
  }
  const percentMatch = value.match(/(-?\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) return Number(percentMatch[1]) / 100;
  const number = text.match(/-?\d+(?:\.\d+)?/);
  if (!number) return null;
  const parsed = Number(number[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Two answers that are the same number, whatever their notation. */
export function numericEquivalent(expected: string, response: string): boolean {
  const left = parseNumericValue(expected);
  const right = parseNumericValue(response);
  if (left === null || right === null) return false;
  const tolerance = Math.max(1e-9, Math.abs(left) * 1e-6);
  return Math.abs(left - right) <= tolerance;
}

/** Whether every number in the expected answer has a numeric match. */
function numbersMatch(expected: string, response: string): boolean {
  const wanted = expected.match(/-?\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?|\s*%)?/g) ?? [];
  if (wanted.length === 0) return true;
  const offered = response.match(/-?\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?|\s*%)?/g) ?? [];
  return wanted.every((want) => offered.some((got) => numericEquivalent(want, got)));
}

export type ShortAnswerGrade = {
  correct: boolean;
  /** 0–1 share of the required concept units that were recalled. */
  score: number;
  /** Required units the student supplied, in the model answer's words. */
  coveredUnits?: string[];
  /** Required units the student missed. */
  missedUnits?: string[];
  /** Why the answer passed or failed, for the card screen. */
  method?: "exact" | "units" | "numeric" | "none";
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
    if (cleaned === optionClean) {
      return { correct: true, score: 1, method: "exact" };
    }
    if (numericEquivalent(option, response)) {
      return { correct: true, score: 1, method: "numeric" };
    }

    const wanted = contentWords(option);
    // If stop-word filtering empties either side, compare the normalised
    // strings and never fail an answer merely because nothing survived.
    if (wanted.length === 0) {
      if (cleaned === optionClean) return { correct: true, score: 1 };
      continue;
    }
    const offeredWords = contentWords(response);
    if (offeredWords.length === 0) {
      if (cleaned === optionClean) return { correct: true, score: 1 };
      continue;
    }
    const offered = new Set(offeredWords);
    const hits = wanted.filter((word) => offered.has(word)).length;
    const score = hits / wanted.length;

    if (score > best) best = score;
    if (numbersMatch(option, response) && score >= (wanted.length <= 2 ? 1 : 0.6)) {
      return { correct: true, score: Math.max(score, 0.6), method: "units" };
    }
  }

  return { correct: false, score: best, method: "none" };
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
 * Pulls the answer term out of a language card whose back is a sentence rather
 * than a bare word. Vocabulary cards often say "The Spanish word for 'my' is
 * 'mi'."; the student should be marked against "mi", not against every word in
 * that sentence. Quoted terms are preferred, with a short unquoted phrase after
 * "is"/"means" as a fallback.
 */
export function vocabularyAnswerCandidates(
  front: string,
  back: string,
): string[] {
  const frontWords = new Set(normalizeAnswer(front).split(" "));
  const candidates: string[] = [];
  const seen = new Set<string>();

  const add = (raw: string) => {
    const clean = raw.replace(/\s+/g, " ").trim().replace(/^[.,;:]+|[.,;:]+$/g, "");
    const normalized = normalizeAnswer(clean);
    const words = contentWords(clean);
    if (
      !normalized ||
      words.length === 0 ||
      words.length > 6 ||
      frontWords.has(normalized) ||
      seen.has(normalized)
    ) {
      return;
    }
    seen.add(normalized);
    candidates.push(clean);
  };

  // Grade the answer in the card's opening sentence. Later sentences are
  // often examples ("mi hermano"), and accepting those as the answer would let
  // a longer example substitute for the actual vocabulary item.
  const source = back.split(/[.!?;]/)[0]?.trim() || back;
  for (const match of source.matchAll(/['"“”‘’`]([^'"“”‘’`]{1,80})['"“”‘’`]/g)) {
    add(match[1] ?? "");
  }

  for (const match of source.matchAll(
    /\b(?:is|means|translates as|translation is)\s+(?:the\s+)?([^.!?;]{1,60})/gi,
  )) {
    const phrase = (match[1] ?? "").split(/[,(]/)[0] ?? "";
    add(phrase.replace(/^['"“”‘’`]+|['"“”‘’`]+$/g, ""));
  }

  return candidates;
}

/** Marks a language card against the term extracted from its answer. */
export function gradeVocabularyRecall(
  front: string,
  back: string,
  response: string,
): ShortAnswerGrade {
  const candidates = vocabularyAnswerCandidates(front, back);
  let best: ShortAnswerGrade = { correct: false, score: 0, method: "none" };
  for (const candidate of candidates) {
    const grade = gradeVocabularyAnswer(candidate, response);
    if (grade.correct) {
      return {
        ...grade,
        coveredUnits: [candidate],
        missedUnits: [],
        method: "exact",
      };
    }
    if (grade.score > best.score) best = grade;
  }
  return best;
}

/** The concept units a card answer requires, de-duplicated and stemmed. */
export function deriveRecallUnits(answer: string): string[] {
  const seen = new Set<string>();
  const units: string[] = [];
  for (const word of contentWords(answer)) {
    const stem = word.length > 6 ? word.slice(0, 6) : word;
    if (seen.has(stem)) continue;
    seen.add(stem);
    units.push(word);
  }
  return units;
}

function unitsCovered(
  required: readonly string[],
  response: string,
): { covered: string[]; missed: string[] } {
  const offered = new Set(
    contentWords(response).map((word) => (word.length > 6 ? word.slice(0, 6) : word)),
  );
  const covered: string[] = [];
  const missed: string[] = [];
  for (const unit of required) {
    const stem = unit.length > 6 ? unit.slice(0, 6) : unit;
    if (offered.has(stem)) covered.push(unit);
    else missed.push(unit);
  }
  return { covered, missed };
}

/**
 * Marks a spoken card answer.
 *
 * The score is the share of the model answer's required concept units the
 * student supplied. Two words taken from a long model answer therefore score
 * two units out of eighteen, not 100%. The threshold is stored on the card at
 * generation time (0.75 by default), so a longer answer is not automatically
 * easier to pass. The minimum word floor stops a one- or two-word answer from
 * passing a sentence-length card even when those words happen to be exact.
 */
export function gradeRecall(
  expected: string,
  response: string,
  options?: {
    threshold?: number;
    units?: readonly string[];
  },
): ShortAnswerGrade {
  const threshold = Math.max(0.1, Math.min(1, options?.threshold ?? 0.75));
  const required =
    options?.units && options.units.length > 0
      ? [...options.units]
      : deriveRecallUnits(expected);
  const cleaned = normalizeAnswer(response);
  if (cleaned.length === 0 || required.length === 0) {
    const exact = cleaned.length > 0 && cleaned === normalizeAnswer(expected);
    return {
      correct: exact,
      score: exact ? 1 : 0,
      coveredUnits: exact ? required : [],
      missedUnits: exact ? [] : required,
      method: exact ? "exact" : "none",
    };
  }

  if (numericEquivalent(expected, response)) {
    return {
      correct: true,
      score: 1,
      coveredUnits: required,
      missedUnits: [],
      method: "numeric",
    };
  }

  const { covered, missed } = unitsCovered(required, response);
  const score = covered.length / required.length;
  const minWords = Math.max(2, Math.ceil(contentWords(expected).length * 0.25));
  const enough = contentWords(response).length >= minWords;
  // Below the minimum content floor no unit is credited. This is what makes a
  // two-word answer against a sentence card report zero credited units instead
  // of two lucky words.
  return {
    correct: enough && score >= threshold,
    score,
    coveredUnits: enough ? covered : [],
    missedUnits: enough ? missed : required,
    method: "units",
  };
}
