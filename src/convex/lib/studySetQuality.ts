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
