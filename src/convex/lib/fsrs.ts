/**
 * FSRS (Free Spaced Repetition Scheduler) for Bluprint cards.
 *
 * FSRS models memory with two numbers per card:
 *   - stability: how many days until recall probability falls to 90%.
 *   - difficulty: how much this item resists being remembered (1–10).
 *
 * Every review has an elapsed time, so the probability the student still
 * remembers the card can be worked out before scheduling. Four ratings are
 * used, the same scale Anki and RemNote expose:
 *   1 Again · 2 Hard · 3 Good · 4 Easy
 *
 * The weights below are the FSRS-4.5 defaults. They are deliberately not
 * "optimised" from one person's review history: a small shared app has far too
 * little data for personal optimisation to beat the defaults.
 *
 * The scheduler is pure: it reads a card's memory state and returns the next
 * one. Nothing here touches the database, so it can be reasoned about and
 * tested on its own.
 */

export type Rating = 1 | 2 | 3 | 4;

export type CardState = "new" | "learning" | "review" | "relearning";

export type MemoryCard = {
  /** Missing on cards built before FSRS scheduling existed. */
  state?: CardState;
  stability?: number;
  difficulty?: number;
  lastReviewedAt?: number;
  lapses?: number;
  reps?: number;
};

export type ScheduledCard = {
  state: CardState;
  stability: number;
  difficulty: number;
  dueAt: number;
  intervalDays: number;
  lapses: number;
  reps: number;
  /** Recall probability just before this review. 0 for a first sighting. */
  retrievability: number;
};

export const DAY_MS = 86_400_000;

/** A failed card returns inside the same session, not tomorrow. */
export const RELEARN_DELAY_MS = 10 * 60 * 1000;

const MIN_STABILITY = 0.1;
const MAX_INTERVAL_DAYS = 3650;

/** FSRS-4.5 default weights. */
const W = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616, 0.1544,
  1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466,
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampDifficulty(value: number): number {
  return clamp(value, 1, 10);
}

/**
 * Probability the card is still remembered after `elapsed` days. R = 0 for a
 * card that has never been reviewed, which is what makes a fresh deck read as
 * "not yet learned" rather than "already forgotten".
 */
export function retrievability(
  stability: number | undefined,
  lastReviewedAt: number | undefined,
  at: number,
): number {
  if (!stability || stability <= 0 || !lastReviewedAt) return 0;
  const elapsedDays = Math.max(0, (at - lastReviewedAt) / DAY_MS);
  return Math.pow(1 + elapsedDays / (9 * stability), -1);
}

function initialDifficulty(rating: Rating): number {
  return clampDifficulty(W[4] - (rating - 3) * W[5]);
}

function nextDifficulty(difficulty: number, rating: Rating): number {
  const changed = difficulty - W[6] * (rating - 3);
  // Difficulty drifts back towards the "Good" baseline over time; without this
  // a card that was hard once stays marked hard forever.
  return clampDifficulty(W[7] * initialDifficulty(3) + (1 - W[7]) * changed);
}

/** Stability after a successful recall. Hard earns less, Easy earns more. */
function stabilityAfterRecall(
  stability: number,
  difficulty: number,
  recall: number,
  rating: Rating,
): number {
  const hardPenalty = rating === 2 ? W[15] : 1;
  const easyBonus = rating === 4 ? W[16] : 1;
  const growth =
    1 +
    Math.exp(W[8]) *
      (11 - difficulty) *
      Math.pow(stability, -W[9]) *
      (Math.exp(W[10] * (1 - recall)) - 1) *
      hardPenalty *
      easyBonus;
  return clamp(stability * growth, MIN_STABILITY, MAX_INTERVAL_DAYS);
}

/** Stability after a lapse: the memory is weaker than it was, but not gone. */
function stabilityAfterLapse(
  stability: number,
  difficulty: number,
  recall: number,
): number {
  return clamp(
    W[11] *
      Math.pow(difficulty, -W[12]) *
      (Math.pow(stability + 1, W[13]) - 1) *
      Math.exp(W[14] * (1 - recall)),
    MIN_STABILITY,
    MAX_INTERVAL_DAYS,
  );
}

/**
 * Applies one review. A first sighting uses the FSRS starting values for the
 * chosen rating; later reviews grow (or shrink) stability from the memory
 * state and the time that has actually passed.
 */
export function schedule(
  card: MemoryCard,
  rating: Rating,
  now = Date.now(),
): ScheduledCard {
  const reps = (card.reps ?? 0) + 1;
  const lapses = card.lapses ?? 0;
  const state: CardState =
    card.state ?? (card.lastReviewedAt !== undefined ? "review" : "new");

  // --- First sighting ---------------------------------------------------
  if (state === "new" || !card.stability || !card.difficulty) {
    const stability = Math.max(MIN_STABILITY, W[rating - 1]);
    const difficulty = initialDifficulty(rating);

    if (rating <= 2) {
      // Again and Hard are not yet a memory worth scheduling in days.
      return {
        state: "learning",
        stability,
        difficulty,
        dueAt: now + RELEARN_DELAY_MS,
        intervalDays: 0,
        lapses,
        reps,
        retrievability: 0,
      };
    }

    const intervalDays = clamp(Math.round(stability), 1, MAX_INTERVAL_DAYS);
    return {
      state: "review",
      stability,
      difficulty,
      dueAt: now + intervalDays * DAY_MS,
      intervalDays,
      lapses,
      reps,
      retrievability: 0,
    };
  }

  // --- Later review -----------------------------------------------------
  const recall = retrievability(card.stability, card.lastReviewedAt, now);

  if (rating === 1) {
    return {
      state: "relearning",
      stability: stabilityAfterLapse(card.stability, card.difficulty, recall),
      difficulty: nextDifficulty(card.difficulty, rating),
      dueAt: now + RELEARN_DELAY_MS,
      intervalDays: 0,
      lapses: lapses + 1,
      reps,
      retrievability: recall,
    };
  }

  const stability = stabilityAfterRecall(
    card.stability,
    card.difficulty,
    recall,
    rating,
  );
  const difficulty = nextDifficulty(card.difficulty, rating);

  // A card that was just failed (or just introduced) gets one short step first.
  // Without this a lapsed card with months of stability would be sent forward
  // by its old stability after a single ten-minute re-look.
  if (state === "learning" || state === "relearning") {
    return {
      state: "review",
      stability,
      difficulty,
      dueAt: now + DAY_MS,
      intervalDays: 1,
      lapses,
      reps,
      retrievability: recall,
    };
  }

  const intervalDays = clamp(Math.round(stability), 1, MAX_INTERVAL_DAYS);

  return {
    state: "review",
    stability,
    difficulty,
    dueAt: now + intervalDays * DAY_MS,
    intervalDays,
    lapses,
    reps,
    // A relearning card reviewed minutes later should not look like a fresh
    // memory just because almost no time has passed.
    retrievability: recall,
  };
}

/** Human label for the four ratings, used by the review screen. */
export const RATING_LABELS: Record<Rating, string> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy",
};
