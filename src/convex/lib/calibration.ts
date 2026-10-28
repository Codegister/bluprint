/**
 * Confidence calibration.
 *
 * A card self-rating answers "did I know that?" at the moment of review; the
 * quiz answers "can I use it?" later. Where the first is much higher than the
 * second, the student thinks they are stronger than they are, which is the most
 * useful thing Bluprint can tell them. The comparison is per set, because a card
 * and a quiz question are different items and only the topic is shared.
 */

export type CalibrationCard = {
  lastRating?: number;
  reviewCount?: number;
};

export type CalibrationQuiz = {
  answered: number;
  correct: number;
};

export type CalibrationInput = {
  setId: string;
  title: string;
  cards: CalibrationCard[];
  quiz: CalibrationQuiz;
};

export type CalibrationRow = {
  setId: string;
  title: string;
  /** 0–100: share of reviewed cards rated Good or Easy. */
  confidence: number;
  /** 0–100 quiz accuracy across answered questions, or null with none. */
  accuracy: number | null;
  /** confidence − accuracy, or null without both sides. */
  gap: number | null;
  reviewedCards: number;
  quizAnswered: number;
  /** True when the gap is large enough to be worth saying out loud. */
  overstated: boolean;
};

/** A gap this size is a pattern, not noise from one lucky or unlucky answer. */
export const CALIBRATION_GAP = 25;
/** Below this much data the comparison is not shown at all. */
const MIN_REVIEWED = 5;
const MIN_QUIZ = 4;

export function calibrationFor(input: CalibrationInput): CalibrationRow | null {
  const reviewed = input.cards.filter((card) => (card.reviewCount ?? 0) > 0);
  if (reviewed.length < MIN_REVIEWED) return null;
  if (input.quiz.answered < MIN_QUIZ) return null;

  const strong = reviewed.filter((card) => (card.lastRating ?? 0) >= 3).length;
  const confidence = Math.round((strong / reviewed.length) * 100);
  const accuracy = Math.round((input.quiz.correct / input.quiz.answered) * 100);
  const gap = confidence - accuracy;

  return {
    setId: input.setId,
    title: input.title,
    confidence,
    accuracy,
    gap,
    reviewedCards: reviewed.length,
    quizAnswered: input.quiz.answered,
    overstated: gap >= CALIBRATION_GAP,
  };
}

/**
 * The one sentence the dashboard shows, taken from the worst overstatement. The
 * wording names the set, what the student thinks, and what the quiz says.
 */
export function calibrationSentence(rows: CalibrationRow[]): string | null {
  const worst = rows
    .filter((row) => row.overstated && row.accuracy !== null)
    .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))[0];
  if (!worst || worst.accuracy === null) return null;
  return `You rate ${worst.title} as strong; your quiz accuracy there is ${worst.accuracy}%.`;
}
