import { structuredAnswerMatch } from "./recall";

/**
 * Marking criteria.
 *
 * A mark scheme is a list of discrete creditable points, each carrying its own
 * marks. Generation produces bullet strings ("1 mark: …"), so this module turns
 * them into criteria without inventing marks to make a guide add up. A guide
 * that does not match the question's tariff is rejected and regenerated; it is
 * never silently divided into equal shares.
 *
 * Levels-of-response questions are kept as bands with mark ranges. They are
 * marked by best fit, not as additive criteria, so converting a band into two
 * or three equal marks would change the board's scheme into a different one.
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

export type MarkingBand = {
  level: number;
  minMarks: number;
  maxMarks: number;
  descriptor: string;
};

export type MarkingScheme =
  | { kind: "points"; points: MarkingCriterion[] }
  | { kind: "levels"; bands: MarkingBand[]; indicative: string[] };

export type MarkingValidation =
  | { ok: true; scheme: MarkingScheme }
  | { ok: false; reason: string };

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
 * Whether a criterion is a closed answer such as `2.8.1` or `Na`, rather than
 * prose. A closed answer must match completely; keyword overlap must not turn
 * `2.8.8.1` into the right electron configuration.
 */
export function structuredCriterionMatch(
  point: string,
  answer: string,
): boolean | null {
  return structuredAnswerMatch(criterionText(point), answer, {
    maxExactWords: 1,
  });
}

/**
 * A guide bullet is one criterion. This deliberately does not split on " and ":
 * "temperature and pH" is one required idea in a board's wording, not two.
 * Splitting there used to manufacture criteria and then scale their marks.
 */
export function splitCriteria(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  return [cleaned];
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

/** One criterion per guide bullet, with the marks the bullet declares. */
export function toCriteria(guide: string[]): MarkingCriterion[] {
  const criteria: MarkingCriterion[] = [];
  for (const raw of guide) {
    const text = raw.trim();
    if (!text) continue;
    const match = MARK_PREFIX.exec(text);
    const declared = match ? Number(match[1]) : 1;
    const marks = Math.max(1, Math.min(60, Number.isFinite(declared) ? declared : 1));
    const body = match ? text.slice(match[0].length).trim() : text;
    criteria.push({
      id: `c${criteria.length + 1}`,
      marks,
      text: body || text,
    });
  }
  return criteria;
}

/**
 * Post-processes stored criteria without changing what the board awarded. The
 * old implementation rescaled every mark to the question total; that is exactly
 * the re-marking this module now refuses to do.
 */
export function alignCriteria(criteria: MarkingCriterion[]): MarkingCriterion[] {
  return criteria.map((criterion, index) => ({
    ...criterion,
    id: `c${index + 1}`,
  }));
}

export function criteriaTotal(
  criteria: ReadonlyArray<{ marks: number }>,
): number {
  return criteria.reduce(
    (sum, criterion) => sum + Math.max(0, Math.round(criterion.marks)),
    0,
  );
}

/**
 * Whether a guide is a usable scheme for this tariff. A guide whose points add
 * up to fewer or more marks than the question offers cannot be met or cannot
 * be exhausted, so it is not a scheme the student can be marked against.
 */
export function markSchemeMatchesMarks(
  guide: string[],
  marksAvailable: number,
): boolean {
  const criteria = toCriteria(guide);
  return (
    criteria.length > 0 &&
    criteriaTotal(criteria) === Math.max(0, Math.round(marksAvailable))
  );
}

/**
 * The criteria for a point-marked question. Stored rows win; old rows without
 * criteria fall back to the guide. No mark is invented or rescaled.
 *
 * A stored scheme whose points do not add up to the question's marks is not
 * used at all. The live failure this prevents: a one-mark pH question stored
 * four one-mark criteria and could never award more than 0/1, because the
 * student had to meet four points for a single mark. An empty list means the
 * question is ungradeable and the callers say so instead of showing an
 * impossible scheme.
 */
export function criteriaFor(question: {
  criteria?: MarkingCriterion[];
  markingGuide: string[];
  marks?: number;
  marking?: "points" | "levels";
}): MarkingCriterion[] {
  if (question.marking === "levels") return [];
  const marks = question.marks;
  const matches = (criteria: MarkingCriterion[]) =>
    marks === undefined || criteriaTotal(criteria) === Math.max(0, Math.round(marks));

  if (question.criteria && question.criteria.length > 0) {
    const stored = alignCriteria(question.criteria);
    if (matches(stored)) return stored;
  }
  const guide = toCriteria(question.markingGuide);
  return matches(guide) ? guide : [];
}

/**
 * Parses the bands of a levels-of-response guide. The range is the board's own
 * mark range; descriptors remain separate from any per-criterion marks.
 */
export function parseLevelsGuide(
  guide: string[],
  marksAvailable: number,
): MarkingBand[] {
  const bands: MarkingBand[] = [];
  const pattern =
    /^\s*(?:level\s*(\d+)\s*)?\(?\s*(\d{1,2})\s*(?:[-–—]|to)\s*(\d{1,2})\s*marks?\s*\)?\s*:?\s*(.*)$/i;
  for (const raw of guide) {
    const text = raw.trim();
    const match = pattern.exec(text);
    if (!match) continue;
    const level = match[1] ? Number(match[1]) : 0;
    const minMarks = Number(match[2]);
    const maxMarks = Number(match[3]);
    const descriptor = (match[4] ?? "").trim();
    if (!Number.isFinite(minMarks) || !Number.isFinite(maxMarks)) continue;
    if (minMarks < 0 || maxMarks < minMarks || maxMarks > marksAvailable) continue;
    bands.push({ level, minMarks, maxMarks, descriptor });
  }
  return bands.sort((a, b) => b.maxMarks - a.maxMarks);
}

/**
 * Checks a guide against the board's shape. Point-marked guides need one
 * one-mark point per mark; levels guides need contiguous bands covering 0 to
 * the available mark. A bad guide is rejected before it can be stored.
 */
export function validateMarkingGuide(
  marking: "points" | "levels",
  guide: string[],
  marksAvailable: number,
): MarkingValidation {
  const marks = Math.max(0, Math.round(marksAvailable));
  if (marking === "levels") {
    const bands = parseLevelsGuide(guide, marks);
    const scored = bands.filter((band) => band.maxMarks > 0);
    if (scored.length < 2) {
      return { ok: false, reason: "The levels guide needs at least two bands with mark ranges." };
    }
    if (bands[0]!.maxMarks !== marks) {
      return { ok: false, reason: `The top band must reach ${marks} marks.` };
    }
    const sorted = [...bands].sort((a, b) => a.minMarks - b.minMarks);
    // Most boards print 1-2, 3-4, 5-6 with zero implicit; some print an
    // explicit 0 band. Both forms cover every mark.
    let expected = sorted[0]!.minMarks === 1 ? 1 : 0;
    for (const band of sorted) {
      if (band.minMarks !== expected) {
        return { ok: false, reason: "The bands must cover every mark without gaps." };
      }
      expected = band.maxMarks + 1;
    }
    if (expected !== marks + 1) {
      return { ok: false, reason: "The bands must cover the available mark." };
    }
    return {
      ok: true,
      scheme: {
        kind: "levels",
        bands,
        indicative: guide.filter((line) => !patternTest(line)),
      },
    };
  }

  const points = toCriteria(guide);
  if (points.length === 0) {
    return { ok: false, reason: "The marking guide is empty." };
  }
  if (points.length !== marks || points.some((point) => point.marks !== 1)) {
    return {
      ok: false,
      reason: `A ${marks}-mark point question needs exactly ${marks} one-mark points; this guide has ${points.length} points totalling ${points.reduce((sum, point) => sum + point.marks, 0)} marks.`,
    };
  }
  return { ok: true, scheme: { kind: "points", points } };
}

function patternTest(line: string): boolean {
  return /^\s*(?:level\s*\d+\s*)?\(?\s*\d{1,2}\s*(?:[-–—]|to)\s*\d{1,2}\s*marks?\s*\)?/i.test(
    line,
  );
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
  allowInitials = true,
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
  return allowInitials && initialsMatch(keyword, tokens);
}

/**
 * Whether the answer names a term as a word. The initials rule is deliberately
 * off: in a subject check, "particles have" must not read as "pH".
 */
function mentionsWord(keyword: string, answer: string): boolean {
  const tokens = answerTokens(answer);
  return termAppears(keyword, new Set(tokens), tokens, false);
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
 * A whole guide repeats words — "enzyme" appears in most rows of an enzyme
 * question, so matching it says nothing about which point the student made. A
 * temperature answer that mentions "the optimum temperature" could otherwise
 * take the "above the optimum the enzyme denatures" mark on the strength of
 * "optimum" and "enzyme" alone, which is how a half answer once scored full
 * marks. A word used by more than one row is therefore treated as part of the
 * question's shared vocabulary and dropped, leaving the terms that carry each
 * criterion's own idea.
 */
export function distinctiveTermsFor(texts: readonly string[]): string[][] {
  const all = texts.map((text) => criterionKeywords(criterionText(text)));
  if (all.length <= 1) return all;
  const shared = new Set(
    all.flat().filter(
      (term) => all.filter((terms) => terms.includes(term)).length > 1,
    ),
  );
  return all.map((terms) => {
    const kept = terms.filter((term) => !shared.has(term));
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
 * Whether a criterion itself asks for a named example, so naming one is the
 * credited answer. "a named example of an insulating material, e.g. fibreglass"
 * is met by "fibreglass" even when the row's framing words ("named",
 * "example") never appear in the answer.
 */
function acceptsNamedExample(text: string): boolean {
  return /\bnamed\b[^.]*\bexamples?\b|\bfor example\b|\be\.g\.|\bsuch as\b/i.test(
    text,
  );
}

/**
 * Per-row terms that may earn a mark.
 *
 * Distinctive terms alone let an amylase answer take the lipase row through
 * "pancreas". The guard here is narrow: a row earns nothing when its own
 * subject is absent from the answer but another row's subject is present. The
 * answer is then evidently about the other criterion; the shared or incidental
 * term cannot carry this one.
 *
 * A row whose subject is absent because the whole guide shares one subject
 * (temperature, pH, "God") keeps its terms, so a correct paraphrase is never
 * refused. An example row is also exempt: the answer is allowed to name the
 * example instead of repeating the row's framing, and its own distinctive terms
 * still have to be covered before a mark is awarded. A subject is the first
 * word the row shares with another row, falling back to its first keyword.
 */
export function creditTermsFor(
  points: readonly string[],
  answer: string,
): string[][] {
  const distinctive = distinctiveTermsFor(points);
  const keywords = points.map((point) => criterionKeywords(criterionText(point)));
  const subjects = keywords.map((row, index) =>
    row.find((term) =>
      keywords.some((other, otherIndex) => otherIndex !== index && other.includes(term)),
    ) ??
    row[0] ??
    "",
  );
  return distinctive.map((terms, index) => {
    const subject = subjects[index]!;
    if (
      !subject ||
      acceptsNamedExample(points[index]!) ||
      mentionsWord(subject, answer)
    ) {
      return terms;
    }
    const aboutAnother = subjects.some(
      (other, otherIndex) =>
        otherIndex !== index &&
        other !== "" &&
        other !== subject &&
        mentionsWord(other, answer),
    );
    // Keep only the subject the answer does not contain, so the row scores
    // zero without changing the shape of the evidence guard.
    return aboutAnother ? [subject] : terms;
  });
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
 * still carry the criterion's own vocabulary: "It controls what enters and
 * leaves the cell" shares `controls` and `cell` with "Controls the movement of
 * substances into and out of the cell" and passes, while a sentence that
 * borrows only one incidental word — "the optimum temperature" for a criterion
 * about denaturation — takes nothing. `share` is 1 for a clear statement and 0.5
 * for a partial one.
 */
export function meaningAward(
  marks: number,
  share: number,
  terms: string[],
  quote: string,
  criterion = "",
): number {
  if (!(share > 0)) return 0;
  // A correct answer to an equation or a ratio can share none of the
  // criterion's words: "energy equals mass times the speed of light squared"
  // is E = mc², and "3 to 1" is 3:1. For those criteria the examiner's
  // meaning verdict is the evidence, because the quote itself is already
  // checked against the answer and the criterion is not prose to paraphrase.
  // Prose criteria still need at least one of their own terms, which is what
  // stops a temperature answer taking a pH mark.
  // One borrowed word is not evidence; two, or a criterion short enough that
  // one word is most of it, is.
  const matched = terms.filter((term) => distinctiveCoverage([term], quote) > 0).length;
  const needed = Math.min(2, terms.length);
  const shared = needed > 0 && matched >= needed;
  if (!shared && !isSymbolicCriterion(criterion)) return 0;
  return Math.min(marks, Math.max(1, Math.ceil(marks * share)));
}

/**
 * Whether a criterion is a formula, a ratio or a short numerical answer rather
 * than prose. These are the cases where a correct answer is expected to use
 * none of the criterion's vocabulary.
 */
export function isSymbolicCriterion(criterion: string): boolean {
  const text = criterionText(criterion);
  if (text.trim().length === 0) return false;
  if (/[=<>≤≥→⇌]/.test(text)) return true;
  if (/\d+\s*[:/]\s*\d+/.test(text)) return true;
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= 6 && /\d/.test(text);
}

/**
 * The mark for one answer, from two independent passes.
 *
 * A single pass is never trusted on its own: the same answer must score the
 * same way whichever reply arrives first, and a disagreement is the honest
 * signal that the answer sits on a boundary. Per criterion the lower award wins
 * (a lucky pass cannot inflate a mark), the total is the sum of those awards,
 * and the result is flagged when the two totals differ so the UI can say so.
 */
export function reconcilePasses(
  first: number[],
  second: number[],
): {
  awards: number[];
  passes: [number, number];
  lowConfidence: boolean;
  total: number;
} {
  const length = Math.max(first.length, second.length);
  const awards = Array.from({ length }, (_, index) =>
    Math.min(first[index] ?? 0, second[index] ?? 0),
  );
  const passes: [number, number] = [
    first.reduce((sum, value) => sum + value, 0),
    second.reduce((sum, value) => sum + value, 0),
  ];
  return {
    awards,
    passes,
    lowConfidence: passes[0] !== passes[1],
    total: awards.reduce((sum, value) => sum + value, 0),
  };
}

/** Shown when a question's stored scheme cannot match its own marks. */
export const MARK_SCHEME_MISMATCH_MESSAGE =
  "This question's mark scheme does not add up to the marks on offer, so it cannot be marked fairly. Rebuild the set to replace the question.";

export type AlternativeCredit = {
  /**
   * The criterion this alternative is offered for. An alternative can only be
   * credited to the criterion it names; position is not evidence.
   */
  criterionId: string;
  /** The correct point the answer made but the guide did not list. */
  point: string;
  /** The student's own words, checked against the answer before use. */
  evidence: string;
};

/**
 * One marking-guide bullet: the marks it carries, the marks earned and the
 * student's own words that earned them ("absent" when it earned nothing).
 */
export type MarkCheck = {
  /** The stored criterion id this row belongs to, when known. */
  criterionId?: string;
  point: string;
  marks: number;
  awarded: number;
  evidence: string;
};

/**
 * Whether an alternative point may be credited to this criterion.
 *
 * The old rule filled unearned rows with alternatives by position, so an answer
 * about amylase took the protease and lipase rows: the alternative was never
 * checked against the criterion it was assigned to. Two structural tests now
 * apply. The alternative must be offered for this criterion id, and its own
 * vocabulary must not fit a different criterion better. A point that shares no
 * criterion's distinctive terms is genuinely unlisted ("God is benevolent" in
 * an outline of beliefs), so it may fill the row it names; a point that names
 * another criterion's idea cannot cross over.
 */
export function alternativeFitsCriterion(
  criterionId: string,
  point: string,
  criteria: ReadonlyArray<{ id: string; text: string }>,
): boolean {
  if (criteria.length === 0) return false;
  if (!criteria.some((criterion) => criterion.id === criterionId)) return false;
  const shared = criteria.map(({ id }) => id);
  if (new Set(shared).size !== shared.length) return false;

  const terms = distinctiveTermsFor(criteria.map((criterion) => criterion.text));
  let target = 0;
  let best = 0;
  let bestId = "";
  criteria.forEach((criterion, index) => {
    const coverage = distinctiveCoverage(terms[index] ?? [], point);
    if (criterion.id === criterionId) target = coverage;
    if (coverage > best) {
      best = coverage;
      bestId = criterion.id;
    }
  });

  // It clearly belongs to another row: never let it cross.
  if (best >= 0.5 && bestId !== criterionId) return false;
  // It clearly belongs here.
  if (target >= 0.5) return true;
  // It names no criterion's vocabulary, so it is a genuinely new point.
  return best < 0.5;
}

/**
 * Fills unearned one-mark criteria with correct alternatives the guide omitted.
 *
 * A mark scheme is illustrative in open questions such as "outline three
 * beliefs"; a student who gives a different correct belief should not lose a
 * mark because the model answer happened to list another one. The alternative
 * still has to be quoted from the answer, must name the criterion it is offered
 * for, and can only take that unearned row, so this can add credit but cannot
 * invent it, cross a criterion or exceed the paper total.
 */
export function applyAlternativeCredits(
  checks: MarkCheck[],
  alternatives: AlternativeCredit[],
  criteria: ReadonlyArray<{ id: string; text: string }> = [],
): MarkCheck[] {
  if (alternatives.length === 0) return checks;
  const used = new Set<number>();
  return checks.map((check) => {
    if (check.awarded > 0 || check.marks !== 1 || !check.criterionId) {
      return check;
    }
    const index = alternatives.findIndex(
      (alternative, position) =>
        !used.has(position) &&
        alternative.criterionId === check.criterionId &&
        alternativeFitsCriterion(check.criterionId!, alternative.point, criteria),
    );
    if (index < 0) return check;
    used.add(index);
    const alternative = alternatives[index]!;
    return {
      ...check,
      point: `${check.point} — accepted alternative: ${alternative.point}`,
      awarded: 1,
      evidence: alternative.evidence,
    };
  });
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
