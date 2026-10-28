/**
 * Exam-readiness and pacing maths.
 *
 * "Known" was never a useful mastery number: a card marked known last month
 * may already be forgotten, and a multiple-choice score says nothing about the
 * written paper. Exam readiness weighs three things that actually predict a
 * grade:
 *   - recall of the cards right now, from their FSRS stability;
 *   - the last quiz accuracy;
 *   - marks earned on the written exam-style questions.
 *
 * Readiness is also projected forward to the exam date by asking what each
 * card's recall will be then. That projection is what makes the pace plan
 * honest: a comfortable score today decays if nothing is revised.
 */

import { DAY_MS, retrievability } from "./fsrs";

export type ReadinessCard = {
  stability?: number;
  lastReviewedAt?: number;
  dueAt?: number;
  reps?: number;
  status?: string;
};

export type Readiness = {
  score: number;
  band: "early" | "building" | "on-track" | "exam-ready";
  parts: {
    /** 0–100 average recall across the deck. */
    recall: number;
    /** 0–100 last quiz score, or null when no quiz has been taken. */
    quiz: number | null;
    /** 0–100 earned exam marks, or null when nothing has been marked. */
    exam: number | null;
  };
  /** The raw counts the percentage is built from. */
  inputs: {
    cardsSettled: number;
    cardsTotal: number;
    quizCorrect: number;
    quizTotal: number;
    examEarned: number;
    examTotal: number;
  };
  /** The weighting applied to each part, as whole percentages of 100. */
  weights: { recall: number; quiz: number; exam: number };
};

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function bandFor(score: number): Readiness["band"] {
  if (score >= 85) return "exam-ready";
  if (score >= 65) return "on-track";
  if (score >= 40) return "building";
  return "early";
}

/**
 * Scores the set as it is expected to be remembered at `at`. Pass the exam
 * timestamp to project forward; pass now for the current picture.
 */
export function examReadiness(input: {
  cards: ReadinessCard[];
  quiz?: { score: number; total: number } | null;
  exam?: { earned: number; total: number } | null;
  at: number;
}): Readiness {
  const { cards, quiz, exam, at } = input;

  const recall =
    cards.length === 0
      ? 0
      : (cards.reduce((sum, card) => {
          const probability = retrievability(
            card.stability,
            card.lastReviewedAt,
            at,
          );
          // Cards from before FSRS have no stability. Their legacy status is
          // the only signal available, so it counts for a little.
          if (probability > 0) return sum + probability;
          return sum + (card.status === "known" ? 0.35 : 0);
        }, 0) /
          cards.length) *
        100;

  const quizPart =
    quiz && quiz.total > 0 ? (quiz.score / quiz.total) * 100 : null;
  const examPart =
    exam && exam.total > 0 ? (exam.earned / exam.total) * 100 : null;

  // The deck carries most of the weight because most revision is cards. A set
  // without a quiz or written questions is scored on what exists.
  const parts: Array<{ value: number; weight: number }> = [
    { value: recall, weight: 0.6 },
  ];
  if (quizPart !== null) parts.push({ value: quizPart, weight: 0.25 });
  if (examPart !== null) parts.push({ value: examPart, weight: 0.15 });

  const totalWeight = parts.reduce((sum, part) => sum + part.weight, 0);
  const score = clampPercent(
    parts.reduce((sum, part) => sum + part.value * part.weight, 0) / totalWeight,
  );

  // The weighting actually applied, as whole percentages that add to 100. A
  // set without a quiz or written questions redistributes their share rather
  // than scoring them as zero, and the panel shows that it did.
  const share = (weight: number) => Math.round((weight / totalWeight) * 100);
  const quizShare = quizPart === null ? 0 : share(0.25);
  const examShare = examPart === null ? 0 : share(0.15);
  const recallShare = 100 - quizShare - examShare;

  return {
    score,
    band: bandFor(score),
    parts: {
      recall: clampPercent(recall),
      quiz: quizPart === null ? null : clampPercent(quizPart),
      exam: examPart === null ? null : clampPercent(examPart),
    },
    // Everything the percentage is built from, so it can be audited rather
    // than taken on trust.
    inputs: {
      cardsSettled: cards.filter((card) => card.status === "known").length,
      cardsTotal: cards.length,
      quizCorrect: quiz?.score ?? 0,
      quizTotal: quiz?.total ?? 0,
      examEarned: exam?.earned ?? 0,
      examTotal: exam?.total ?? 0,
    },
    weights: { recall: recallShare, quiz: quizShare, exam: examShare },
  };
}

/** Midnight at the end of an exam date, in UTC. */
export function examTimestamp(examDate: string): number | null {
  const parsed = Date.parse(`${examDate}T23:59:59Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

export type PaceStatus = "on-track" | "tight" | "behind" | "done" | "past";

export type PacePlan = {
  examDate: string;
  daysLeft: number;
  /** Cards not yet at a stable 21-day memory. */
  remaining: number;
  /** Cards to touch each day between now and the exam. */
  perDay: number;
  /** Quiz questions per week to finish the set's quiz by the exam. */
  quizPerWeek: number;
  status: PaceStatus;
  /** Readiness expected on exam day if the current plan is kept up. */
  projected: number;
  target: number;
};

/**
 * Turns the exam date into a day-by-day workload.
 *
 * A card counts as "in hand" once its stability reaches 21 days: at that point
 * it survives a fortnight of neglect and only needs occasional review. Anything
 * below that is still being built, so it belongs in the remaining load.
 */
export function buildPacePlan(input: {
  examDate?: string;
  cards: ReadinessCard[];
  quizCount: number;
  at: number;
  projected: number;
  target?: number;
}): PacePlan | null {
  const { examDate, cards, quizCount, at, projected } = input;
  if (!examDate) return null;
  const examAt = examTimestamp(examDate);
  if (examAt === null) return null;

  const daysLeft = Math.max(0, Math.ceil((examAt - at) / DAY_MS));
  const remaining = cards.filter((card) => {
    if ((card.reps ?? 0) === 0) return true;
    if ((card.stability ?? 0) < 21) return true;
    return (card.dueAt ?? 0) <= at;
  }).length;

  const perDay = daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining;
  const quizPerWeek =
    daysLeft > 0 ? Math.ceil((quizCount / Math.max(1, daysLeft)) * 7) : quizCount;

  let status: PaceStatus;
  if (daysLeft === 0 && remaining === 0) status = "done";
  else if (daysLeft === 0) status = "past";
  else if (perDay > 80) status = "behind";
  else if (perDay > 40) status = "tight";
  else status = "on-track";

  return {
    examDate,
    daysLeft,
    remaining,
    perDay,
    quizPerWeek,
    status,
    projected: clampPercent(projected),
    target: input.target ?? 85,
  };
}

export const PACE_LABELS: Record<PaceStatus, string> = {
  "on-track": "On track",
  tight: "Tight",
  behind: "Behind",
  done: "Ready",
  past: "Exam passed",
};

/**
 * The daily question goal, derived from the nearest exam rather than a fixed
 * number. `remaining` is every card still being built plus the quiz questions
 * not yet attempted; a student two weeks from a real paper should be answering
 * more than one three months out.
 */
export function goalFromExam(
  remaining: number,
  daysLeft: number | null,
): { goal: number; reason: string } {
  const DEFAULT_GOAL = 20;
  if (daysLeft === null || !Number.isFinite(daysLeft)) {
    return {
      goal: DEFAULT_GOAL,
      reason: "Add an exam date to a set and the goal follows it.",
    };
  }
  if (daysLeft <= 0) {
    return { goal: DEFAULT_GOAL, reason: "This exam date has passed." };
  }
  if (remaining <= 0) {
    return { goal: 10, reason: "Everything is in hand. Keep it warm." };
  }
  const perDay = Math.ceil(remaining / daysLeft);
  const goal = Math.max(10, Math.min(80, perDay));
  return {
    goal,
    reason: `${remaining} questions left across ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
  };
}
