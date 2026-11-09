/**
 * Deterministic study-set quality checks.
 *
 * These functions run at generation and save time. They are pure so the same
 * rules can be exercised without a Convex deployment: every quiz item must
 * point at a card that contains its answer, every key point must point at a
 * specification statement, and a skipped quiz item is not option A.
 */

import {
  deriveRecallUnits,
  gradeRecall,
  gradeShortAnswer,
  normalizeAnswer,
} from "./recall";
import { findOffSpecTerm } from "./register";
import { matchSpecPoint, type SpecPoint } from "./specMapping";
import { isSyllabusOutline } from "./syllabusOutline";

export type CardLike = {
  id?: string;
  _id?: string;
  front: string;
  back: string;
};

export type QuizLike = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  type?: "mcq" | "cloze" | "typed";
  answer?: string;
  acceptedAnswers?: string[];
  sourceCard?: number;
  sourceCardId?: string;
};

export type QuizResponseLike = {
  selectedIndex?: number | null;
  text?: string;
};

export type QuizGrade = {
  correct: boolean;
  expected: string;
  answered: boolean;
};

function idOf(card: CardLike): string | undefined {
  return card.id ?? card._id;
}

function coveredBy(answer: string, text: string): number {
  const units = deriveRecallUnits(answer);
  if (units.length === 0) {
    return normalizeAnswer(text).includes(normalizeAnswer(answer)) ? 1 : 0;
  }
  const offered = new Set(
    deriveRecallUnits(text).map((unit) => (unit.length > 6 ? unit.slice(0, 6) : unit)),
  );
  const matched = units.filter((unit) =>
    offered.has(unit.length > 6 ? unit.slice(0, 6) : unit),
  ).length;
  return matched / units.length;
}

/** Whether a card's own text carries the answer the question marks. */
export function cardContainsAnswer(card: CardLike, answer: string): boolean {
  const text = `${card.front} ${card.back}`;
  const units = deriveRecallUnits(answer);
  if (units.length === 0) return normalizeAnswer(text).includes(normalizeAnswer(answer));
  // A one- or two-word answer must be completely present; a longer phrase can
  // tolerate one paraphrase but still needs most of its terms.
  return coveredBy(answer, text) >= (units.length <= 2 ? 1 : 0.75);
}

/** The answer a quiz item actually marks. */
export function correctAnswerFor(item: QuizLike): string {
  if ((item.type ?? "mcq") === "mcq") {
    return item.options[item.correctIndex] ?? "";
  }
  return item.answer ?? "";
}

/** Words that describe the question rather than the subject it tests. */
const STUDY_STOP_WORDS = new Set([
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
  "what",
  "which",
  "who",
  "whom",
  "whose",
  "why",
  "how",
  "when",
  "where",
  "does",
  "do",
  "did",
  "can",
  "could",
  "should",
  "would",
  "will",
  "state",
  "name",
  "give",
  "describe",
  "explain",
  "define",
  "identify",
  "list",
  "compare",
  "calculate",
  "suggest",
]);

function studyStem(word: string): string {
  return /^\d+$/.test(word) || word.length <= 6 ? word : word.slice(0, 6);
}

function studyWords(text: string): string[] {
  return normalizeAnswer(text)
    .split(" ")
    .filter((word) => word.length > 0 && !STUDY_STOP_WORDS.has(word))
    .map(studyStem);
}

function wordOverlap(left: string, right: string): number {
  const a = new Set(studyWords(left));
  const b = new Set(studyWords(right));
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/**
 * True when a card or question is about the qualification rather than the
 * subject. A specification is a map of what may be examined, not knowledge to
 * memorise, so items about boards, papers, mark schemes, assessment objectives
 * and mark counts are removed by the same rule everywhere.
 */
export function isSpecificationItem(prompt: string, answer = ""): boolean {
  const text = `${prompt} ${answer}`.toLowerCase();
  return [
    /\b(?:according to|in|under|from)\s+(?:the\s+)?(?:[a-z]+\s+){0,2}(?:specification|syllabus)\b/,
    /\b(?:specification|syllabus)\s+(?:says?|states?|requires?|lists?|covers?|expects?|specifies|mentions?|includes?|rewards?)\b/,
    /\b(?:exam board|assessment objectives?|mark scheme|markscheme|paper structure|grade boundar(?:y|ies))\b/,
    /\bhow many (?:marks|papers|hours|minutes)\b/,
    /\bwhich (?:paper|board|specification|syllabus|assessment objective)\b/,
    /\bwhat (?:must|should|do|does) (?:students|candidates|pupils) (?:know|learn|revise)\b/,
    /\b(?:is|are) (?:this|these|it) (?:on|in) the (?:spec|specification|syllabus)\b/,
  ].some((pattern) => pattern.test(text));
}

export type StudyItemText = { prompt: string; answer?: string };

/**
 * Two items are duplicates when their prompts say the same thing, or when one
 * is a thin reword of the other and marks the same answer. Rewording a card or
 * question is not a new retrieval, so it must not appear twice in a deck.
 */
export function isNearDuplicateStudyItem(
  left: StudyItemText,
  right: StudyItemText,
): boolean {
  const leftPrompt = normalizeAnswer(left.prompt);
  const rightPrompt = normalizeAnswer(right.prompt);
  if (!leftPrompt || !rightPrompt) return false;
  if (leftPrompt === rightPrompt) return true;

  const promptOverlap = wordOverlap(left.prompt, right.prompt);
  const answerOverlap = wordOverlap(left.answer ?? "", right.answer ?? "");
  return (
    promptOverlap >= 0.75 ||
    (answerOverlap >= 0.8 && promptOverlap >= 0.25)
  );
}

/**
 * Keeps the first copy of each content item. Items that ask about the
 * specification are rejected before the duplicate check, so a meta question
 * can never displace a real content question that happened to be later.
 */
export function dedupeStudyItems<T>(
  items: readonly T[],
  promptOf: (item: T) => string,
  answerOf: (item: T) => string = () => "",
  options: { reject?: (item: T) => boolean } = {},
): { items: T[]; dropped: number } {
  const kept: T[] = [];
  let dropped = 0;

  for (const item of items) {
    const prompt = promptOf(item);
    const candidate = { prompt, answer: answerOf(item) };
    if (
      options.reject?.(item) ||
      isSpecificationItem(prompt, candidate.answer) ||
      kept.some((previous) =>
        isNearDuplicateStudyItem(
          { prompt: promptOf(previous), answer: answerOf(previous) },
          candidate,
        ),
      )
    ) {
      dropped += 1;
      continue;
    }
    kept.push(item);
  }

  return { items: kept, dropped };
}

/**
 * A negative-discrimination item asks which taught difference is absent while
 * making the taught differences the distractors. It teaches the opposite of
 * the deck, so it is dropped rather than rewritten.
 */
export function isNegativeDiscrimination(
  item: QuizLike,
  keyPoints: readonly string[] = [],
): boolean {
  const stem = item.question.toLowerCase();
  if (!/\b(absent|not present|not found|except|not a difference)\b/.test(stem)) {
    return false;
  }
  const answer = normalizeAnswer(correctAnswerFor(item));
  if (!answer) return false;
  return keyPoints.some((point) => normalizeAnswer(point).includes(answer));
}

export type AlignedQuiz<T extends QuizLike> = T & {
  sourceCardId: string;
  sourceCardIndex: number;
};

/**
 * Drops any item that has no card containing its answer, and links the rest to
 * that card. A model-supplied index is only a hint: if it points at a card that
 * does not carry the answer, another card is searched and the item is dropped
 * when none fits.
 */
export function alignQuizToCards<T extends QuizLike>(
  items: readonly T[],
  cards: readonly CardLike[],
  keyPoints: readonly string[] = [],
  options: { level?: string; subject?: string } = {},
): { items: Array<AlignedQuiz<T>>; dropped: number } {
  const aligned: Array<AlignedQuiz<T>> = [];
  for (const item of items) {
    if (isNegativeDiscrimination(item, keyPoints)) continue;
    const answer = correctAnswerFor(item);
    if (!answer || isSpecificationItem(item.question, answer)) continue;
    // A card can mention an off-spec term, but the quiz may not test it.
    if (findOffSpecTerm(answer, options.level, options.subject)) continue;

    const hinted =
      item.sourceCard !== undefined ? cards[item.sourceCard] : undefined;
    const order = hinted
      ? [hinted, ...cards.filter((card) => card !== hinted)]
      : [...cards];
    const card = order.find((candidate) => cardContainsAnswer(candidate, answer));
    const cardId = card ? idOf(card) : undefined;
    if (!card || !cardId) continue;
    if (
      aligned.some((previous) =>
        isNearDuplicateStudyItem(
          { prompt: previous.question, answer: correctAnswerFor(previous) },
          { prompt: item.question, answer },
        ),
      )
    ) {
      continue;
    }

    aligned.push({
      ...item,
      sourceCardId: cardId,
      sourceCardIndex: cards.indexOf(card),
    });
  }
  return { items: aligned, dropped: items.length - aligned.length };
}

export type KeyPointLink = { text: string; specRef: string };

/**
 * Links key points to specification statements one-to-one. Each specification
 * statement gets at most one key point; extra key points are left out rather
 * than being counted against an unrelated statement. Missing statements are
 * returned so the coverage panel can name them.
 */
export function linkKeyPointsToSpecs(
  keyPoints: readonly string[],
  specPoints: readonly SpecPoint[],
): { links: KeyPointLink[]; missing: SpecPoint[] } {
  if (specPoints.length === 0) return { links: [], missing: [] };
  const unused = new Set(keyPoints.map((_, index) => index));
  const links: KeyPointLink[] = [];
  const missing: SpecPoint[] = [];

  for (const point of specPoints) {
    let bestIndex = -1;
    let bestScore = 0;
    for (const index of unused) {
      const keyPoint = keyPoints[index]!;
      const match = matchSpecPoint(keyPoint, [point]);
      const score = match.id ? match.score : coveredBy(keyPoint, point.text);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    if (bestIndex < 0 || bestScore < 0.2) {
      missing.push(point);
      continue;
    }
    unused.delete(bestIndex);
    links.push({ text: keyPoints[bestIndex]!, specRef: point.id });
  }

  return { links, missing };
}

/** Coverage from the key-point links, never from an item count elsewhere. */
export function keyPointCoverage(
  specPoints: readonly SpecPoint[],
  links: readonly KeyPointLink[],
): {
  total: number;
  covered: SpecPoint[];
  uncovered: SpecPoint[];
  percent: number;
} {
  const ids = new Set(links.map((link) => link.specRef));
  const covered = specPoints.filter((point) => ids.has(point.id));
  const uncovered = specPoints.filter((point) => !ids.has(point.id));
  return {
    total: specPoints.length,
    covered,
    uncovered,
    percent:
      specPoints.length > 0
        ? Math.round((covered.length / specPoints.length) * 100)
        : 0,
  };
}

/**
 * Grades one saved response. A missing selection is unanswered, not option A;
 * an out-of-range index is also unanswered. The score can therefore be zero
 * when every item is skipped, whatever the option order.
 */
export function gradeQuizResponse(
  question: QuizLike,
  response: QuizResponseLike,
): QuizGrade {
  const type = question.type ?? "mcq";
  if (type === "mcq") {
    const index = response.selectedIndex;
    const answered =
      typeof index === "number" &&
      Number.isInteger(index) &&
      index >= 0 &&
      index < question.options.length;
    return {
      correct: answered && index === question.correctIndex,
      expected: question.options[question.correctIndex] ?? "",
      answered,
    };
  }

  const text = response.text?.trim() ?? "";
  const expected = question.answer ?? "";
  return {
    correct:
      text.length > 0
        ? gradeShortAnswer(expected, question.acceptedAnswers, text).correct
        : false,
    expected,
    answered: text.length > 0,
  };
}

/** A full-answer check used by the acceptance tests and the card screen. */
export function recallGradeForCard(
  card: { back: string; recallThreshold?: number; recallUnits?: string[] },
  response: string,
) {
  return gradeRecall(card.back, response, {
    threshold: card.recallThreshold ?? 0.75,
    units: card.recallUnits,
  });
}

// ---------------------------------------------------------------------------
// Card and quiz content pipeline
// ---------------------------------------------------------------------------

/** A card back longer than this is a note, not a flashcard answer. */
export const MAX_CARD_BACK_CHARS = 400;
export const MAX_CARD_FRONT_CHARS = 240;
export const MAX_KEY_POINT_CHARS = 260;

const CONTENT_STOP_WORDS = new Set([
  ...STUDY_STOP_WORDS,
  "about",
  "above",
  "after",
  "again",
  "against",
  "also",
  "because",
  "before",
  "being",
  "between",
  "both",
  "each",
  "into",
  "more",
  "most",
  "much",
  "other",
  "over",
  "same",
  "some",
  "such",
  "than",
  "then",
  "there",
  "these",
  "they",
  "through",
  "under",
  "very",
  "while",
  "with",
  "would",
  "your",
]);

function contentWords(text: string): string[] {
  return normalizeAnswer(text)
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !CONTENT_STOP_WORDS.has(word));
}

function contentStem(word: string): string {
  return word.length > 7 ? word.slice(0, 7) : word;
}

function contentStems(text: string): string[] {
  return [...new Set(contentWords(text).map(contentStem))];
}

/**
 * How much of a claim's own subject vocabulary appears in the notes. Function
 * words are ignored, so a paraphrase can still match while an invented noun or
 * figure cannot hide behind fluent wording.
 */
export function noteSupportScore(notes: string, claim: string): number {
  const wanted = contentStems(claim);
  if (wanted.length === 0) return 0;
  const available = new Set(contentStems(notes));
  return wanted.filter((word) => available.has(word)).length / wanted.length;
}

/** Whether a card back is a fact the source notes actually state. */
export function isClaimSupportedByNotes(notes: string, claim: string): boolean {
  const clean = normalizeAnswer(claim);
  if (!clean) return false;
  if (normalizeAnswer(notes).includes(clean)) return true;
  const wanted = contentStems(claim);
  if (wanted.length === 0) return false;
  const score = noteSupportScore(notes, claim);
  // A short answer can tolerate one paraphrase. A longer claim has to be
  // mostly present as written; otherwise an invented adjective such as
  // "target value" can hide behind the other words.
  return wanted.length <= 2 ? score >= 0.6 : score >= 0.8;
}

/** The subject terms a card front is asking about, not its command words. */
function frontSubjectTerms(front: string): string[] {
  const questionWords = new Set([
    "what",
    "which",
    "who",
    "whom",
    "whose",
    "why",
    "how",
    "when",
    "where",
    "name",
    "state",
    "define",
    "describe",
    "explain",
    "identify",
    "give",
    "list",
    "suggest",
    "calculate",
    "does",
    "do",
    "did",
    "can",
    "could",
    "should",
    "would",
    "will",
    "is",
    "are",
    "was",
    "were",
  ]);
  return contentWords(front).filter((word) => !questionWords.has(word) && word.length >= 5);
}

/**
 * A card is grounded when its answer is in the notes and the thing its front
 * asks about is also in the notes. The front check is deliberately one-term:
 * a synonym in the question should not cost a card whose answer is supported.
 */
export function isCardGroundedInNotes(
  notes: string,
  card: Pick<CardLike, "front" | "back">,
): boolean {
  if (!isClaimSupportedByNotes(notes, card.back)) return false;
  const asked = frontSubjectTerms(card.front);
  if (asked.length === 0) return true;
  const available = new Set(contentStems(notes));
  return asked.some((word) => available.has(contentStem(word)));
}

function isDanglingTail(text: string): boolean {
  const tail = normalizeAnswer(text).split(/\s+/).pop() ?? "";
  return (
    /^(?:a|an|the|of|to|in|on|at|for|and|or|but|so|as|by|with|from|that|this|it|its|is|are|was|were|be|been|being|does|do|did|has|have|had|he|she|they|we|you|i|than|then|when|where|which|who)$/.test(
      tail,
    ) || /[A-Za-z]-$/.test(text)
  );
}

/**
 * Cuts an overlong answer at a sentence boundary. A truncated sentence is
 * worse than a short one: it reads as if the fact itself stops mid-thought, so
 * the tail is dropped back to the last complete clause instead.
 */
export function repairCardAnswer(text: string, max = MAX_CARD_BACK_CHARS): string {
  let clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max && !isDanglingTail(clean)) {
    return /[.!?]$/.test(clean) ? clean : `${clean}.`;
  }

  if (clean.length > max) {
    const window = clean.slice(0, max);
    const sentenceEnd = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("! "),
      window.lastIndexOf("? "),
    );
    if (sentenceEnd >= Math.max(80, max * 0.45)) {
      clean = window.slice(0, sentenceEnd + 1).trim();
    } else {
      const clauseEnd = Math.max(
        window.lastIndexOf("; "),
        window.lastIndexOf(", "),
        window.lastIndexOf(" and "),
        window.lastIndexOf(" because "),
      );
      clean =
        clauseEnd >= Math.max(80, max * 0.45)
          ? window.slice(0, clauseEnd).trim()
          : `${window.slice(0, window.lastIndexOf(" ")).trim()}.`;
    }
  }

  if (isDanglingTail(clean)) {
    const sentenceEnd = Math.max(
      clean.lastIndexOf(". "),
      clean.lastIndexOf("! "),
      clean.lastIndexOf("? "),
    );
    if (sentenceEnd > 0) clean = clean.slice(0, sentenceEnd + 1).trim();
    else clean = `${clean.replace(/\s+\S*$/, "").trim()}.`;
  }

  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

const TRIVIAL_ANSWER = /^(?:yes|no|true|false|none|maybe|it depends)\.?$/i;
const YES_NO_QUESTION =
  /^(?:is|are|was|were|do|does|did|can|could|will|would|should|has|have|had)\b/i;

/**
 * Cards that ask for no retrieval: a yes/no question, or a question that
 * already prints its own short answer. The generator is told not to produce
 * these, but the check runs on the saved deck as well so a prompt miss cannot
 * lower the quality of every future review.
 */
export function lowValueCardReason(
  card: Pick<CardLike, "front" | "back">,
): string | null {
  const front = card.front.trim();
  const back = card.back.trim();
  if (!front || !back) return "empty card";
  if (TRIVIAL_ANSWER.test(back)) return "answer is yes/no";
  if (YES_NO_QUESTION.test(front)) return "yes/no question";

  const answer = normalizeAnswer(back);
  const answerWords = answer.split(" ").filter(Boolean);
  if (
    answer.length > 0 &&
    answer.length <= 40 &&
    answerWords.length <= 3
  ) {
    const questionWords = new Set(normalizeAnswer(front).split(" "));
    if (answerWords.every((word) => questionWords.has(word))) {
      return "answer is in the question";
    }
  }
  return null;
}

/** A saved card that should be repaired or regenerated. */
export function cardNeedsRepair(
  card: Pick<CardLike, "front" | "back">,
): boolean {
  return (
    card.back.length > MAX_CARD_BACK_CHARS ||
    card.front.length > MAX_CARD_FRONT_CHARS ||
    isDanglingTail(card.back) ||
    /[A-Za-z]-$/.test(card.back)
  );
}

/** A short, revision-ready label from a question, used for a key point. */
function claimLabel(front: string): string {
  let text = front.replace(/\?+\s*$/, "").trim();
  text = text.replace(
    /^(?:what|which|who|whom|whose|why|how|when|where|name|state|define|describe|explain|identify|give|list|suggest|calculate)\s+(?:is|are|was|were|does|do|did|can|could|should|would|will|has|have|had)\s+/i,
    "",
  );
  text = text.replace(/^(?:what|which|who|why|how|when|where)\s+/i, "");
  text = text.replace(/^(?:the|a|an)\s+/i, "");
  text = text.replace(/\s+(?:do|does|did)$/i, "");
  const words = text
    .replace(/[^A-Za-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 5);
  if (words.length === 0) return "";
  const phrase = words.join(" ");
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/**
 * One key point per card, in card order. The label comes from the question and
 * the claim from the answer, so the summary is not a copy of a source sentence
 * and cannot drift out of sync with the deck.
 */
export function keyPointForCard(card: Pick<CardLike, "front" | "back">): string {
  const label = claimLabel(card.front);
  const answer = repairCardAnswer(card.back, 220);
  const point = label ? `${label}: ${answer}` : answer;
  return point.length <= MAX_KEY_POINT_CHARS
    ? point
    : repairCardAnswer(point, MAX_KEY_POINT_CHARS);
}

export function keyPointsForCards(
  cards: ReadonlyArray<Pick<CardLike, "front" | "back">>,
): string[] {
  return cards.map(keyPointForCard);
}

export type PreparedCard = {
  front: string;
  back: string;
  keyPoint: string;
  beyondNotes?: boolean;
};

/**
 * Grounds, shortens and deduplicates cards before either storage or a count is
 * reported. Returning `dropped` is important: the page must explain a shortfall,
 * not quietly pretend the request was met.
 */
export function prepareCards<T extends CardLike & { beyondNotes?: boolean }>(
  cards: readonly T[],
  notes: string,
): { cards: PreparedCard[]; dropped: number } {
  const kept: PreparedCard[] = [];
  // A course set is built from a syllabus outline, so its notes name the scope
  // rather than the facts. Grounding against them would drop every card the
  // model was asked to write; the deck-level checks still run.
  const ground = !isSyllabusOutline(notes);
  const units = sourceUnits(notes);
  // The sentence a claim came from. Two cards that paraphrase the same sentence
  // are one fact even when their wording barely overlaps.
  const sourceUnitFor = (text: string): number => {
    let best = -1;
    let bestScore = 0;
    units.forEach((unit, index) => {
      const score = noteSupportScore(text, unit.text);
      if (score > bestScore) {
        bestScore = score;
        best = index;
      }
    });
    return bestScore >= 0.5 ? best : -1;
  };
  let dropped = 0;

  for (const card of cards) {
    const front = card.front.replace(/\s+/g, " ").trim().slice(0, MAX_CARD_FRONT_CHARS);
    const back = repairCardAnswer(card.back, MAX_CARD_BACK_CHARS);
    if (
      !front ||
      !back ||
      isSpecificationItem(front, back) ||
      lowValueCardReason({ front, back })
    ) {
      dropped += 1;
      continue;
    }
    if (ground && !isCardGroundedInNotes(notes, { front, back })) {
      dropped += 1;
      continue;
    }
    const candidate = { prompt: front, answer: back };
    // The source-unit rule exists to stop one note sentence being carded twice.
    // A scope brief has no facts of its own, so mapping cards back to its lines
    // would make unrelated facts look like one source sentence.
    const unit = ground ? sourceUnitFor(back) : -1;
    if (
      kept.some(
        (previous) =>
          isNearDuplicateStudyItem(
            { prompt: previous.front, answer: previous.back },
            candidate,
          ) ||
          (unit >= 0 &&
            sourceUnitFor(previous.back) === unit &&
            (wordOverlap(previous.front, front) >= 0.2 ||
              wordOverlap(previous.back, back) >= 0.4)),
      )
    ) {
      dropped += 1;
      continue;
    }
    const keyPoint = keyPointForCard({ front, back });
    if (ground && !isClaimSupportedByNotes(notes, keyPoint)) {
      dropped += 1;
      continue;
    }
    kept.push({
      front,
      back,
      keyPoint,
      // "Beyond your notes" describes an upload that strayed outside its
      // source. A course card is supposed to add subject content the scope
      // never contained, so the warning would be untrue.
      beyondNotes: ground ? card.beyondNotes : undefined,
    });
  }

  return { cards: kept, dropped };
}

// ---------------------------------------------------------------------------
// Quiz integrity
// ---------------------------------------------------------------------------

export function isClozeQuestion(item: Pick<QuizLike, "question" | "type">): boolean {
  return item.type === "cloze" || /_{3,}/.test(item.question);
}

/**
 * Detects the unmarked form of cloze deletion: a source sentence with its
 * subject replaced by "What process…" or "What component…". The tail still
 * matches the note almost word for word, so the student only has to supply the
 * deleted noun rather than use or discriminate between ideas.
 */
export function isSubjectDeletionCloze(
  item: Pick<QuizLike, "question" | "type">,
  notes: string,
): boolean {
  if (isClozeQuestion(item)) return true;
  const stem = item.question.trim();
  const match = stem.match(
    /^(?:what|which)\s+(?:process|component|structure|mechanism|substance|organ|cell|tissue|molecule|part|stage|factor)\b/i,
  );
  if (!match) return false;
  const tail = stem.slice(match[0].length).replace(/\?+$/, "").trim();
  if (contentWords(tail).length < 3) return false;
  const sentences = notes
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 24);
  return sentences.some((sentence) => wordOverlap(tail, sentence) >= 0.7);
}

/** Options start with a capital and do not carry a stray full stop. */
export function formatOption(option: string): string {
  const clean = option.replace(/\s+/g, " ").trim().replace(/[.;]+$/, "");
  if (!clean) return "";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function optionClauses(option: string): number {
  return (
    option
      .split(/[,;:]|\b(?:because|while|whereas|although|so that)\b/i)
      .map((part) => part.trim())
      .filter(Boolean).length || 1
  );
}

function stemTerms(question: string): Set<string> {
  return new Set(
    contentWords(question)
      .filter((word) => word.length >= 6)
      .map(contentStem),
  );
}

/**
 * The four giveaway patterns that let a student answer without knowing the
 * subject. A question is rejected rather than stored with an obvious tell.
 */
export function mcqOptionIssue(item: QuizLike): string | null {
  if (item.options.length !== 4) return "needs four options";
  if (
    !Number.isInteger(item.correctIndex) ||
    item.correctIndex < 0 ||
    item.correctIndex >= item.options.length
  ) {
    return "has an invalid correct answer";
  }
  const options = item.options.map(formatOption);
  if (options.some((option) => !option)) return "has an empty option";

  const correct = options[item.correctIndex]!;
  const others = options.filter((_, index) => index !== item.correctIndex);
  const lengths = others.map((option) => option.length);
  const longestOther = Math.max(...lengths);
  const shortestOther = Math.min(...lengths);
  if (correct.length > longestOther * 1.2 + 2) return "correct option is longest";
  if (correct.length < shortestOther / 1.2 - 2) return "correct option is shortest";

  const otherClauses = Math.max(...others.map(optionClauses));
  if (optionClauses(correct) > otherClauses && optionClauses(correct) >= 2) {
    return "correct option is the only two-part one";
  }

  const terms = stemTerms(item.question);
  if (terms.size > 0) {
    const correctHas = [...terms].some((term) =>
      contentStems(correct).includes(term),
    );
    const otherHas = others.some((option) =>
      [...terms].some((term) => contentStems(option).includes(term)),
    );
    if (correctHas && !otherHas) return "correct option repeats the stem";
  }

  const article = item.question
    .trim()
    .match(/\b(a|an)\s+[A-Za-z][A-Za-z'-]*\s*\?*$/i)?.[1]
    ?.toLowerCase();
  if (article) {
    const vowel = /^[aeiou]/i;
    const fits = options.filter(
      (option) => vowel.test(option) === (article === "an"),
    );
    if (fits.length === 1 && fits[0] === correct) {
      return "correct option is the only grammatical fit";
    }
  }
  if (/\bhow (?:many|much)\b/i.test(item.question)) {
    const numeric = options.filter((option) => /\d/.test(option));
    if (numeric.length === 1 && numeric[0] === correct) {
      return "correct option is the only grammatical fit";
    }
  }

  return null;
}

/** Removes a source-narrating opener; returns empty when nothing is left. */
export function cleanExplanation(explanation: string): string {
  let clean = explanation.replace(/\s+/g, " ").trim();
  clean = clean.replace(
    /^(?:the|this)\s+(?:material|notes?|text|source|passage|extract)\s+(?:states?|says?|defines?|mentions?|explains?|shows?|describes?)\s+(?:that\s+)?/i,
    "",
  );
  clean = clean.replace(/^explicitly in the material,?\s*/i, "");
  clean = clean.replace(/^according to the (?:material|notes?|text|source),?\s*/i, "");
  if (
    /^(?:the|this)\s+(?:material|notes?|text|source|passage|extract)\b/i.test(clean) ||
    /\bexplicitly in the material\b/i.test(clean)
  ) {
    return "";
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/** Markers that a named option is being rejected, not merely mentioned. */
const WRONG_OPTION_MARKERS =
  /\b(?:not|never|isn't|aren't|doesn't|don't|cannot|can't|wrong|incorrect|unlike|rather than|instead of)\b/i;

/** Options that cannot be negated in a sentence without inverting its sense. */
const UNNAMEABLE_OPTION =
  /^(?:none of|neither\b|not sure|don'?t know|no idea)/i;

/** Markers that an explanation gives a reason, not just a label. */
const REASON_MARKERS =
  /\b(?:because|since|therefore|which|allows|causes|needs?|requires?|produce(?:s|d|ing)?|release(?:s|d|ing)?|absorb(?:s|ed|ing)?|control(?:s|led|ling)?|maintain(?:s|ed|ing)?|prevent(?:s|ed|ing)?|makes?|gives?|leads?|speeds?|balances?|process(?:es|ed|ing)?|pass(?:es|ed|ing)?|send(?:s|ing)?|sent|sailed|began|started|occurred|took|store(?:s|d|ing)?|form(?:s|ed|ing)?)\b/i;

function optionContentStems(option: string): string[] {
  return contentStems(option).filter((term) => term.length >= 4);
}

/**
 * Whether an explanation explicitly identifies at least one wrong option as
 * wrong. Merely mentioning the distractor is not enough: a negation or
 * contrast marker must occur near that option's own vocabulary.
 */
export function explanationNamesWrongOption(
  explanation: string,
  options: readonly string[],
  correctIndex: number,
): boolean {
  const text = normalizeAnswer(explanation);
  if (!text) return false;
  for (const [index, option] of options.entries()) {
    if (index === correctIndex) continue;
    for (const term of optionContentStems(option)) {
      let from = 0;
      while (true) {
        const at = text.indexOf(term, from);
        if (at < 0) break;
        const window = text.slice(Math.max(0, at - 100), at + term.length + 100);
        if (WRONG_OPTION_MARKERS.test(window)) return true;
        from = at + term.length;
      }
    }
  }
  return false;
}

/** The corrected answer must be present, with a reason, before the item ships. */
export function explanationJustifiesCorrect(
  explanation: string,
  item: Pick<QuizLike, "options" | "correctIndex" | "answer" | "type">,
): boolean {
  const answer = correctAnswerFor(item as QuizLike);
  if (!answer || contentWords(explanation).length < 5) return false;
  const text = normalizeAnswer(explanation);
  const answerText = normalizeAnswer(answer);
  const mentioned =
    text.includes(answerText) ||
    optionContentStems(answer).some((term) => text.includes(term));
  return mentioned && REASON_MARKERS.test(text);
}

export type TeachingQuizLike = QuizLike & Pick<QuizLike, "options" | "correctIndex">;

/** Full teaching check used before a question is stored. */
export function explanationTeaches(
  explanation: string,
  item: TeachingQuizLike,
): boolean {
  const clean = cleanExplanation(explanation);
  if (!clean) return false;
  // A numeric answer ("2", "1588") cannot be matched against prose: the
  // explanation may spell it out ("two atoms") and a numeric distractor has no
  // vocabulary of its own to name. Judge those items on having a real
  // explanation rather than dropping every numeric question.
  if (!/[a-z]/i.test(correctAnswerFor(item))) {
    return contentWords(clean).length >= 5;
  }
  if ((item.type ?? "mcq") !== "mcq") {
    return explanationJustifiesCorrect(clean, item);
  }
  return (
    explanationJustifiesCorrect(clean, item) &&
    explanationNamesWrongOption(clean, item.options, item.correctIndex)
  );
}

/**
 * Repairs the common case: the explanation justifies the correct answer but
 * forgets to say why a distractor is wrong. The name is taken from the actual
 * options, never invented.
 */
export function repairQuizExplanation(
  explanation: string,
  item: TeachingQuizLike,
): string {
  const clean = cleanExplanation(explanation);
  if (!clean) return "";
  if ((item.type ?? "mcq") !== "mcq") return clean;
  if (!explanationJustifiesCorrect(clean, item)) return clean;
  if (explanationNamesWrongOption(clean, item.options, item.correctIndex)) {
    return clean;
  }
  const wrong = item.options.find(
    (option, index) =>
      index !== item.correctIndex &&
      !UNNAMEABLE_OPTION.test(formatOption(option)) &&
      optionContentStems(option).length > 0,
  );
  if (!wrong) return clean;
  return `${clean.replace(/[.!?]+$/, "")}. ${formatOption(wrong)} is not correct.`;
}

/** Whether one explanation gives away another question's correct answer. */
export function explanationLeaksAnswer(
  item: Pick<QuizLike, "explanation">,
  other: QuizLike,
): boolean {
  const answer = normalizeAnswer(correctAnswerFor(other));
  if (answer.length < 3) return false;
  const explanation = normalizeAnswer(item.explanation);
  if (explanation.includes(answer)) return true;
  const words = contentStems(correctAnswerFor(other));
  if (words.length < 2) return false;
  const covered = words.filter((word) => contentStems(item.explanation).includes(word));
  return covered.length / words.length >= 0.8;
}

/** The same fact asked from both ends, e.g. "what does a receptor detect?" */
export function isInverseQuizPair(left: QuizLike, right: QuizLike): boolean {
  const leftPrompt = normalizeAnswer(left.question);
  const rightPrompt = normalizeAnswer(right.question);
  const leftAnswer = normalizeAnswer(correctAnswerFor(left));
  const rightAnswer = normalizeAnswer(correctAnswerFor(right));
  if (!leftAnswer || !rightAnswer) return false;
  const cross =
    (leftPrompt.includes(rightAnswer) && rightPrompt.includes(leftAnswer)) ||
    (rightPrompt.includes(leftAnswer) && leftPrompt.includes(rightAnswer));
  if (cross) return true;
  return (
    wordOverlap(left.question, right.question) >= 0.5 &&
    wordOverlap(correctAnswerFor(left), correctAnswerFor(right)) < 0.25 &&
    (leftPrompt.includes(rightAnswer) || rightPrompt.includes(leftAnswer))
  );
}

/**
 * A quiz fact must not already be on a card. The deck and the quiz are two
 * different retrieval opportunities, not the same answer asked twice.
 */
export function quizFactIsOnCard(item: QuizLike, cards: readonly CardLike[]): boolean {
  const answer = correctAnswerFor(item);
  if (!answer) return true;
  const answerKey = normalizeAnswer(answer);
  return cards.some((card) => {
    if (normalizeAnswer(card.back).includes(answerKey)) return true;
    if (
      isNearDuplicateStudyItem(
        { prompt: item.question, answer },
        { prompt: card.front, answer: card.back },
      )
    ) {
      return true;
    }
    const wanted = contentStems(answer);
    if (wanted.length < 2) return false;
    const carried = contentStems(`${card.front} ${card.back}`);
    const matched = wanted.filter((word) => carried.includes(word)).length;
    return matched / wanted.length >= 0.8 && wordOverlap(item.question, card.front) >= 0.2;
  });
}

export type PreparedQuiz<T extends QuizLike> = T & {
  sourceCardId?: string;
  sourceCardIndex?: number;
};

function seededNumber(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rotateCorrectAnswer<T extends QuizLike>(item: T, target: number): T {
  if (item.options.length !== 4) return item;
  const correct = item.options[item.correctIndex];
  if (correct === undefined) return item;
  const others = item.options.filter((_, index) => index !== item.correctIndex);
  const options: string[] = [];
  let cursor = 0;
  for (let index = 0; index < 4; index += 1) {
    options[index] = index === target ? correct : others[cursor++]!;
  }
  return { ...item, options, correctIndex: target };
}

/**
 * Spreads correct answers across A–D. A deterministic hash keeps builds
 * reproducible, and the 40% ceiling prevents a run from clustering on one
 * letter even when the hash happens to be unlucky.
 */
export function spreadCorrectPositions<T extends QuizLike>(items: readonly T[]): T[] {
  const mcq = items.filter((item) => (item.type ?? "mcq") === "mcq");
  const ceiling = Math.max(1, Math.ceil(mcq.length * 0.4));
  const counts = [0, 0, 0, 0];
  const targets: number[] = [];

  for (const item of mcq) {
    let target = seededNumber(item.question) % 4;
    if (counts[target]! >= ceiling) {
      target = counts.indexOf(Math.min(...counts));
    }
    counts[target] = (counts[target] ?? 0) + 1;
    targets.push(target);
  }

  let mcqIndex = 0;
  return items.map((item) => {
    if ((item.type ?? "mcq") !== "mcq") return item;
    const target = targets[mcqIndex++] ?? 0;
    return rotateCorrectAnswer(item, target);
  });
}

/**
 * Runs every quiz rule in one place. The generator uses it batch by batch, and
 * `completeGeneration` runs it again before writing, so a prompt cannot quietly
 * bypass the contract.
 */
export function prepareQuiz<T extends QuizLike>(
  items: readonly T[],
  cards: readonly CardLike[],
  notes: string,
  keyPoints: readonly string[] = [],
  options: { level?: string; subject?: string } = {},
): { items: Array<PreparedQuiz<T>>; dropped: number; reasons: string[] } {
  const reasons: string[] = [];
  // A syllabus outline cannot support the facts it asks for; see prepareCards.
  const ground = !isSyllabusOutline(notes);
  let kept: Array<PreparedQuiz<T>> = [];

  for (const item of items) {
    const answer = correctAnswerFor(item);
    const explanation = repairQuizExplanation(item.explanation, item);
    if (
      isClozeQuestion(item) ||
      (ground && isSubjectDeletionCloze(item, notes))
    ) {
      reasons.push("cloze deletion");
      continue;
    }
    if (!answer || !explanation) {
      reasons.push("missing answer or explanation");
      continue;
    }
    if (!explanationTeaches(explanation, item)) {
      reasons.push("explanation does not teach");
      continue;
    }
    if (isSpecificationItem(item.question, answer)) {
      reasons.push("specification meta");
      continue;
    }
    if (isNegativeDiscrimination(item, keyPoints)) {
      reasons.push("negative discrimination");
      continue;
    }
    if (ground && !isClaimSupportedByNotes(notes, answer)) {
      reasons.push("answer not in notes");
      continue;
    }
    if (findOffSpecTerm(answer, options.level, options.subject)) {
      reasons.push("off-spec term");
      continue;
    }
    if (quizFactIsOnCard(item, cards)) {
      reasons.push("already on a card");
      continue;
    }
    const normalised = {
      ...item,
      question: item.question.replace(/\s+/g, " ").trim(),
      options: item.options.map(formatOption),
      explanation,
      ...(ground ? {} : { beyondNotes: undefined }),
    };
    if ((normalised.type ?? "mcq") === "mcq") {
      const issue = mcqOptionIssue(normalised);
      if (issue) {
        reasons.push(issue);
        continue;
      }
    }
    if (
      kept.some(
        (previous) =>
          isNearDuplicateStudyItem(
            { prompt: previous.question, answer: correctAnswerFor(previous) },
            { prompt: normalised.question, answer },
          ) || isInverseQuizPair(previous, normalised),
      )
    ) {
      reasons.push("duplicate or inverse question");
      continue;
    }
    if (
      kept.some(
        (previous) =>
          normalizeAnswer(correctAnswerFor(previous)) === normalizeAnswer(answer),
      )
    ) {
      reasons.push("shared answer");
      continue;
    }
    if (kept.some((previous) => explanationLeaksAnswer(normalised, previous))) {
      reasons.push("explanation leaks another answer");
      continue;
    }
    kept.push(normalised);
  }

  // An earlier explanation can leak a later answer. Drop the leaking item
  // rather than accepting a question that teaches its neighbour's answer.
  let changed = true;
  while (changed) {
    changed = false;
    const next = kept.filter(
      (item, index) =>
        !kept.some(
          (other, otherIndex) =>
            index !== otherIndex && explanationLeaksAnswer(item, other),
        ),
    );
    if (next.length !== kept.length) {
      reasons.push("explanation leaks another answer");
      kept = next;
      changed = true;
    }
  }

  return {
    items: spreadCorrectPositions(kept),
    dropped: items.length - kept.length,
    reasons: [...new Set(reasons)],
  };
}

// ---------------------------------------------------------------------------
// Source coverage
// ---------------------------------------------------------------------------

type SourceUnit = { label: string; text: string };

function sourceUnits(notes: string): SourceUnit[] {
  const clean = notes.replace(/\r/g, "").trim();
  if (!clean) return [];
  const lines = clean
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const headings = lines.filter(
    (line) =>
      line.length >= 3 &&
      line.length <= 80 &&
      !/[.!?]$/.test(line) &&
      !/^(?:the|a|an|this|these|those|it|there|in|on|at|for|and|but|so|when|if|as|by|to|of|from)\b/i.test(
        line,
      ),
  );

  if (headings.length >= 2) {
    const units: SourceUnit[] = [];
    let current: SourceUnit | null = null;
    for (const line of lines) {
      const heading = headings.includes(line);
      if (heading) {
        if (current) units.push(current);
        current = { label: line.slice(0, 60), text: line };
      } else if (current) {
        current.text += ` ${line}`;
      }
    }
    if (current) units.push(current);
    return units;
  }

  return clean
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 24)
    .map((sentence) => ({
      label: sentence.split(/\s+/).slice(0, 7).join(" "),
      text: sentence,
    }));
}

/**
 * Names source sections that no card, quiz or exam item covers. The build may
 * legitimately build fewer cards than a long note contains, but it may not do
 * that silently.
 */
export function sourceCoverage(
  notes: string,
  items: readonly string[],
): { covered: string[]; omitted: string[]; note?: string } {
  const units = sourceUnits(notes);
  const covered: string[] = [];
  const omitted: string[] = [];
  for (const unit of units) {
    const supported = items.some((item) => {
      if (!item.trim()) return false;
      if (normalizeAnswer(item).includes(normalizeAnswer(unit.label))) return true;
      return noteSupportScore(item, unit.text) >= 0.35;
    });
    if (supported) covered.push(unit.label);
    else omitted.push(unit.label);
  }
  const note =
    omitted.length > 0
      ? `Not covered by this build: ${omitted.slice(0, 4).join("; ")}${
          omitted.length > 4 ? `; and ${omitted.length - 4} more` : ""
        }. Add those notes or rebuild to include them.`
      : undefined;
  return { covered, omitted, note };
}

/** Exact quiz percentage, with a perfect score always 100. */
export function quizScorePercent(score: number, total: number): number {
  if (total <= 0) return 0;
  if (score >= total) return 100;
  return Math.floor((score / total) * 100);
}
