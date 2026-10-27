/**
 * Marking criteria.
 *
 * A mark scheme is a list of discrete creditable points, each carrying its own
 * marks. Generation still produces bullet strings ("1 mark: …"), so this module
 * turns them into criteria and, where a model collapsed several points into one
 * bullet, splits that bullet into separable criteria. Without the split, a
 * six-mark question whose guide was one string was graded all-or-nothing: a
 * temperature-only answer to "temperature and pH" could take all six marks.
 *
 * It also holds the deterministic evidence guard. The model proposes marks; a
 * criterion is only credited when its own key terms occur in the student's
 * answer, and a criterion with several required ideas can only take the share
 * of its marks that the answer actually covers. That is what makes 3/6
 * reachable and full marks impossible while something required is missing.
 */

export type MarkingCriterion = {
  id: string;
  marks: number;
  text: string;
};

/** "1 mark:", "2 marks -", "(3 marks)" — the prefix a board prints. */
const MARK_PREFIX = /^\s*\(?(\d{1,2})\s*(?:marks?|mks?)\)?\s*[:.–—-]?\s*/i;

/** Words that describe the marking, not the answer. */
const INSTRUCTION_WORDS = new Set([
  "mark",
  "marks",
  "award",
  "awarded",
  "accept",
  "allow",
  "credit",
  "credited",
  "states",
  "state",
  "explains",
  "explain",
  "describes",
  "describe",
  "identifies",
  "identify",
  "gives",
  "give",
  "names",
  "name",
  "answer",
  "candidate",
  "correct",
  "correctly",
  "point",
  "point.",
  "e.g",
  "eg",
  "also",
  "must",
  "should",
  "could",
  "may",
]);

/** Function words carry no evidence. */
const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "at",
  "for",
  "from",
  "with",
  "by",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "that",
  "this",
  "these",
  "those",
  "it",
  "its",
  "their",
  "there",
  "which",
  "who",
  "when",
  "where",
  "how",
  "than",
  "then",
  "so",
  "such",
  "not",
  "no",
  "if",
  "but",
  "both",
  "each",
  "more",
  "most",
  "less",
  "least",
  "very",
  "into",
  "over",
  "under",
  "between",
  "within",
  "without",
  "about",
  "because",
  "does",
  "do",
  "did",
  "has",
  "have",
  "had",
  "can",
  "will",
  "would",
]);

function normalise(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The words of a criterion that a student's answer must contain. */
export function criterionKeywords(text: string): string[] {
  const words = normalise(text).split(" ").filter(Boolean);
  const kept: string[] = [];
  for (const word of words) {
    // Two-letter subject terms matter (pH), while the two-letter function
    // words are already in the stop list.
    if (word.length < 2) continue;
    if (STOP_WORDS.has(word) || INSTRUCTION_WORDS.has(word)) continue;
    if (/^\d+$/.test(word)) {
      kept.push(word);
      continue;
    }
    // A crude stemmer: the first six characters match plural and tense forms
    // ("denatures", "denatured", "denaturation").
    const stem = word.length > 6 ? word.slice(0, 6) : word;
    if (!kept.includes(stem)) kept.push(stem);
  }
  return kept;
}

/** The criterion text without its "N marks:" prefix. */
export function criterionText(point: string): string {
  return point.replace(MARK_PREFIX, "").trim() || point.trim();
}

/**
 * Splits a single guide bullet into separable points. Bullets that carry one
 * mark are never split; multi-mark bullets are split on semicolons, sentence
 * boundaries and — when nothing else separates them — on " and ", because
 * "temperature and pH" is two creditable ideas.
 */
export function splitCriteria(text: string, marks: number): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  if (marks <= 1) return [cleaned];

  const parts: string[] = [];
  for (const sentence of cleaned.split(/(?<=[.!?])\s+|;\s*|\n+/)) {
    const trimmed = sentence.trim().replace(/^[-•·]\s*/, "");
    if (trimmed.length > 0) parts.push(trimmed);
  }

  const expanded: string[] = [];
  for (const part of parts) {
    if (
      marks > 1 &&
      /\s+and\s+/i.test(part) &&
      part.split(/\s+and\s+/i).every((piece) => piece.trim().length >= 4)
    ) {
      expanded.push(...part.split(/\s+and\s+/i).map((piece) => piece.trim()));
    } else {
      expanded.push(part);
    }
  }

  return expanded.filter(Boolean).slice(0, Math.max(marks, 1));
}

/** Distributes `total` marks across `parts` criteria, remainder to the first. */
export function distributeMarks(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const each = Math.floor(total / parts);
  const remainder = total % parts;
  return Array.from({ length: parts }, (_, index) =>
    Math.max(0, each + (index < remainder ? 1 : 0)),
  );
}

/** One criterion per guide bullet, split where a bullet holds several ideas. */
export function toCriteria(guide: string[]): MarkingCriterion[] {
  const criteria: MarkingCriterion[] = [];
  for (const raw of guide) {
    const text = raw.trim();
    const match = MARK_PREFIX.exec(text);
    const declared = match ? Number(match[1]) : 1;
    const marks = Math.max(1, Math.min(60, Number.isFinite(declared) ? declared : 1));
    const body = match ? text.slice(match[0].length).trim() : text;
    for (const part of splitCriteria(body || text, marks)) {
      criteria.push({
        id: `c${criteria.length + 1}`,
        marks: 1,
        text: part,
      });
    }
  }
  return criteria;
}

/**
 * Scales criteria marks so they add up to the marks the question is worth.
 * "6 marks" split into two ideas becomes 3 + 3, not 1 + 1; the score is then
 * the literal sum of credited marks out of the question's total.
 */
export function alignCriteria(
  criteria: MarkingCriterion[],
  marksAvailable: number,
): MarkingCriterion[] {
  if (criteria.length === 0) return criteria;
  const marks = Math.max(1, Math.round(marksAvailable));
  const shares = distributeMarks(marks, criteria.length);
  return criteria.map((criterion, index) => ({
    ...criterion,
    id: `c${index + 1}`,
    marks: shares[index] ?? 1,
  }));
}

/**
 * The criteria for a question: stored structured rows when they are genuinely
 * granular, otherwise the same rows derived from the guide and scaled to the
 * question's marks. A single stored row for a six-mark question is re-derived,
 * because one row cannot express partial credit.
 */
export function criteriaFor(question: {
  criteria?: MarkingCriterion[];
  markingGuide: string[];
  marks?: number;
}): MarkingCriterion[] {
  const stored = question.criteria ?? [];
  const marks = question.marks ?? 0;
  const granular = stored.length > 1 || marks <= 1;
  const base = granular && stored.length > 0
    ? stored
    : toCriteria(question.markingGuide);
  return marks > 0 ? alignCriteria(base, marks) : base;
}

/** The guide strings the examiner prompt and checklist consume. */
export function guideFromCriteria(criteria: MarkingCriterion[]): string[] {
  return criteria.map(
    (criterion) =>
      `${criterion.marks} mark${criterion.marks === 1 ? "" : "s"}: ${criterion.text}`,
  );
}

/**
 * Numbers written as words, so "six" and "6" are the same answer. Marking by
 * wording used to fail an answer that spelled a value out, which is exactly
 * what dictation produces.
 */
const NUMBER_WORDS: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  twenty: "20",
  thirty: "30",
  fifty: "50",
  hundred: "100",
  thousand: "1000",
};

/** The answer's words, with number words and symbols flattened to one form. */
function answerTokens(answer: string): string[] {
  return normalise(answer)
    .split(" ")
    .map((word) => NUMBER_WORDS[word] ?? word)
    .filter(Boolean);
}

/**
 * Whether a short term is the initials of consecutive words in the answer:
 * "ma" for "mass acceleration", which is how a mark scheme writes a formula
 * and how a student writes it out.
 */
function initialsMatch(term: string, tokens: string[]): boolean {
  if (!/^[a-z]{2,4}$/.test(term)) return false;
  for (let start = 0; start < tokens.length; start += 1) {
    let acc = "";
    for (let index = start; index < tokens.length; index += 1) {
      acc += tokens[index]![0] ?? "";
      if (acc === term) return true;
      if (acc.length >= term.length) break;
    }
  }
  return false;
}

/**
 * Whether a term is carried by the answer.
 *
 * Three ways count, because a mark scheme and a student rarely write the same
 * thing the same way: the word itself (with the plural/tense stem), the spelled
 * form of a number ("six" for "6"), and the initials of a written-out formula
 * ("ma" for "mass acceleration"). Ratios and equations survive normalisation
 * because their digits become plain words on both sides — "3:1" and "3 to 1"
 * both leave "3 1" — so "answers a ratio question in a different notation" no
 * longer scores zero.
 */
function termAppears(
  keyword: string,
  answerWords: Set<string>,
  tokens: string[],
): boolean {
  for (const word of answerWords) {
    const stem = word.length > 6 ? word.slice(0, 6) : word;
    if (
      word === keyword ||
      stem === keyword ||
      (keyword.length >= 5 &&
        (word.startsWith(keyword) ||
          keyword.startsWith(stem) ||
          (word.length >= 5 && word.slice(0, 5) === keyword.slice(0, 5))))
    ) {
      return true;
    }
  }
  return initialsMatch(keyword, tokens);
}

/** Share (0–1) of a set of terms that appear in the answer. */
function coverageOf(keywords: string[], answer: string): number {
  if (keywords.length === 0) return 1;
  const tokens = answerTokens(answer);
  const answerWords = new Set(tokens);
  let matched = 0;
  for (const keyword of keywords) {
    if (termAppears(keyword, answerWords, tokens)) matched += 1;
  }
  return matched / keywords.length;
}

/** Share (0–1) of a criterion's key terms that appear in the answer. */
export function evidenceCoverage(text: string, answer: string): number {
  return coverageOf(criterionKeywords(criterionText(text)), answer);
}

/**
 * The terms that tell one criterion apart from the rest of the guide.
 *
 * A whole guide repeats words — "enzyme" appears in every enzyme question, so
 * matching it says nothing about which point the student made. A temperature
 * answer to a temperature-and-pH question could use that shared word to take a
 * pH mark. Dropping the words every criterion shares leaves the vocabulary that
 * carries each criterion's own idea, including a topic word like "pH" that only
 * some rows use.
 */
export function distinctiveTermsFor(texts: string[]): string[][] {
  const all = texts.map((text) => criterionKeywords(criterionText(text)));
  if (all.length <= 1) return all;
  const universal = new Set(
    (all[0] ?? []).filter((term) => all.every((terms) => terms.includes(term))),
  );
  return all.map((terms) => {
    const kept = terms.filter((term) => !universal.has(term));
    // A guide where every row has only shared words still needs a guard, so
    // fall back to the full term list rather than allowing an automatic credit.
    return kept.length > 0 ? kept : terms;
  });
}

/** Share of a criterion's distinctive terms that the answer contains. */
export function distinctiveCoverage(
  terms: string[],
  answer: string,
): number {
  return coverageOf(terms, answer);
}

/**
 * The most a criterion can be credited for this answer. A criterion whose own
 * distinctive terms are absent scores zero however confident the model was;
 * one with several required ideas can only take the share it covers. This is
 * what makes 3/6 reachable, and full marks impossible while a required idea is
 * missing from the answer.
 */
export function capAwarded(
  marks: number,
  claimed: number,
  coverage: number,
): number {
  if (coverage < 0.5) return 0;
  const safeClaim = Math.max(0, Math.min(marks, Math.floor(claimed)));
  const ceiling = Math.max(1, Math.ceil(marks * coverage));
  return Math.min(safeClaim, ceiling);
}

/**
 * The marks a criterion keeps, given the model's claim and the answer's own
 * words. This is the one place the evidence guard is applied, so the marker and
 * its tests cannot disagree about how a row is credited.
 */
export function awardCriterion(
  marks: number,
  claimed: number,
  terms: string[],
  answer: string,
): number {
  return capAwarded(marks, claimed, distinctiveCoverage(terms, answer));
}

/**
 * The marks a criterion keeps when the answer was judged by meaning instead of
 * by its words.
 *
 * Used for a criterion the word guard could not confirm (coverage below half),
 * where the marker has read the answer and said the idea is there. The quote must
 * still touch the criterion's own vocabulary: "It controls what enters and
 * leaves the cell" shares enough with "Controls the movement of substances into
 * and out of the cell" to pass, while a temperature sentence shares nothing with
 * a pH criterion and takes nothing for it. `share` is 1 for a clear statement
 * and 0.5 for a partial one.
 */
export function meaningAward(
  marks: number,
  share: number,
  terms: string[],
  quote: string,
): number {
  if (!(share > 0)) return 0;
  if (distinctiveCoverage(terms, quote) <= 0) return 0;
  return Math.min(marks, Math.max(1, Math.ceil(marks * share)));
}

/**
 * The examiner feedback without the bullet-by-bullet list it used to embed.
 * The checklist renders those rows; keeping both repeated every mark twice.
 */
export function feedbackSummary(feedback: string): string {
  return feedback
    .split(/\n(?=Credited:|Not credited:)/)[0]!
    .replace(/\s+$/, "")
    .trim();
}
