/**
 * Where a study run stopped.
 *
 * The runners (cards, quiz, exam questions) keep their place in component
 * state, which is thrown away whenever the student switches section or leaves
 * the page — so a half-done run used to start again from the first card. What
 * only the browser knows is written here: the position in the queue, the
 * answers already given and the session counts.
 *
 * Server state stays authoritative. FSRS ratings, submitted quizzes and graded
 * exam answers are already saved on the account; this only replays what the
 * browser would otherwise forget, and it expires so a run cannot be resumed
 * weeks later against a set that has since been rebuilt.
 */

const PREFIX = "bluprint:run:";
/** A run older than this is stale: the set has probably moved on. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type Scope = "cards" | "quiz" | "exam";

type Envelope = { savedAt: number; state: unknown };

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    // Private mode and blocked storage both throw on access.
    return window.localStorage;
  } catch {
    return null;
  }
}

function readState(scope: Scope, id: string): Record<string, unknown> | null {
  const store = storage();
  if (!store || !id) return null;
  try {
    const raw = store.getItem(`${PREFIX}${scope}:${id}`);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as Envelope;
    if (typeof envelope?.savedAt !== "number") return null;
    if (Date.now() - envelope.savedAt > MAX_AGE_MS) return null;
    const state = envelope.state;
    if (!state || typeof state !== "object") return null;
    return state as Record<string, unknown>;
  } catch {
    return null;
  }
}

function writeState(scope: Scope, id: string, state: unknown): void {
  const store = storage();
  if (!store || !id) return;
  try {
    store.setItem(
      `${PREFIX}${scope}:${id}`,
      JSON.stringify({ savedAt: Date.now(), state } satisfies Envelope),
    );
  } catch {
    // A full or blocked store only costs the resume, never the run.
  }
}

function clearState(scope: Scope, id: string): void {
  const store = storage();
  if (!store || !id) return;
  try {
    store.removeItem(`${PREFIX}${scope}:${id}`);
  } catch {
    // Nothing to do: the next save overwrites it anyway.
  }
}

/* -------------------------------------------------------------------------- */
/* Cards                                                                      */
/* -------------------------------------------------------------------------- */

type Rating = 1 | 2 | 3 | 4;
type RatingCounts = Record<Rating, number>;

export type CardRunState = {
  /** The queue as it was built at the start of the run. */
  queueIds: string[];
  index: number;
  counts: RatingCounts;
  finished: boolean;
};

function readCounts(value: unknown): RatingCounts | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const counts: RatingCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const rating of [1, 2, 3, 4] as const) {
    const count = record[String(rating)];
    if (typeof count !== "number" || count < 0 || !Number.isFinite(count)) return null;
    counts[rating] = count;
  }
  return counts;
}

/**
 * Reads a card run, dropping cards that are no longer in the live list.
 *
 * Ratings are saved as they are made, so the cards already reviewed leave the
 * due list. Keeping their ids in the restored queue is what makes the queue
 * progress survive that shrink: the position is remapped onto the cards that
 * are still there instead of the run being thrown away.
 */
export function readCardRun(id: string, cardIds: string[]): CardRunState | null {
  const state = readState("cards", id);
  if (!state) return null;
  const storedIds = state.queueIds;
  if (!Array.isArray(storedIds) || storedIds.length === 0) return null;
  if (!storedIds.every((value) => typeof value === "string")) return null;
  if (typeof state.index !== "number" || !Number.isInteger(state.index)) return null;
  const counts = readCounts(state.counts);
  if (!counts) return null;

  const known = new Set(cardIds);
  const queueIds = (storedIds as string[]).filter((cardId) => known.has(cardId));
  if (queueIds.length === 0) return null;
  const doneBefore = (storedIds as string[])
    .slice(0, Math.max(0, state.index))
    .filter((cardId) => known.has(cardId)).length;
  const index = Math.min(doneBefore, queueIds.length - 1);
  return {
    queueIds,
    index,
    counts,
    finished: state.finished === true && index === queueIds.length - 1,
  };
}

export function saveCardRun(id: string, state: CardRunState): void {
  writeState("cards", id, state);
}

export function clearCardRun(id: string): void {
  clearState("cards", id);
}

/* -------------------------------------------------------------------------- */
/* Quiz                                                                       */
/* -------------------------------------------------------------------------- */

export type QuizResponseState = {
  questionId: string;
  selectedIndex?: number;
  text?: string;
};

export type QuizFeedbackState = { correct: boolean; expected: string };

export type QuizResultState = {
  score: number;
  total: number;
  results?: Array<{
    questionId: string;
    correct: boolean;
    expected: string;
    answered: boolean;
  }>;
};

export type QuizRunState = {
  index: number;
  /** Sparse: a hole means that question has not been answered yet. */
  responses: Array<QuizResponseState | null>;
  selected: number | null;
  typed: string;
  checked: boolean;
  feedback: QuizFeedbackState | null;
  result: QuizResultState | null;
};

function readResponses(
  value: unknown,
  questionIds: string[],
): Array<QuizResponseState | null> | null {
  if (!Array.isArray(value)) return null;
  const responses: Array<QuizResponseState | null> = [];
  for (let position = 0; position < value.length; position += 1) {
    const entry = value[position];
    if (entry === null || entry === undefined) {
      responses.push(null);
      continue;
    }
    if (typeof entry !== "object") return null;
    const record = entry as Record<string, unknown>;
    if (record.questionId !== questionIds[position]) return null;
    responses.push({
      questionId: record.questionId as string,
      ...(typeof record.selectedIndex === "number"
        ? { selectedIndex: record.selectedIndex }
        : {}),
      ...(typeof record.text === "string" ? { text: record.text } : {}),
    });
  }
  return responses;
}

/** Reads a quiz run, discarding it if the questions are not the same ones. */
export function readQuizRun(id: string, questionIds: string[]): QuizRunState | null {
  const state = readState("quiz", id);
  if (!state || questionIds.length === 0) return null;
  if (typeof state.index !== "number" || !Number.isInteger(state.index)) return null;
  if (state.index < 0 || state.index >= questionIds.length) return null;

  const responses = readResponses(state.responses, questionIds);
  if (!responses) return null;
  if (typeof state.typed !== "string" || typeof state.checked !== "boolean") return null;
  const selected =
    state.selected === null || state.selected === undefined
      ? null
      : typeof state.selected === "number"
        ? state.selected
        : null;
  const feedback =
    state.feedback && typeof state.feedback === "object"
      ? (state.feedback as Record<string, unknown>)
      : null;
  if (
    feedback &&
    (typeof feedback.correct !== "boolean" || typeof feedback.expected !== "string")
  ) {
    return null;
  }

  let result: QuizResultState | null = null;
  const rawResult = state.result;
  if (rawResult && typeof rawResult === "object") {
    const record = rawResult as Record<string, unknown>;
    if (typeof record.score !== "number" || typeof record.total !== "number") return null;
    // A result from a different quiz would show marks for questions the
    // student never saw, so only a matching total is resumed.
    if (record.total !== questionIds.length) return null;
    result = rawResult as QuizResultState;
  }

  return {
    index: state.index,
    responses,
    selected,
    typed: state.typed,
    checked: state.checked,
    feedback: feedback as QuizFeedbackState | null,
    result,
  };
}

export function saveQuizRun(id: string, state: QuizRunState): void {
  writeState("quiz", id, state);
}

export function clearQuizRun(id: string): void {
  clearState("quiz", id);
}

/* -------------------------------------------------------------------------- */
/* Exam questions                                                             */
/* -------------------------------------------------------------------------- */

export type ExamRunState = { answers: Record<string, string> };

/** Reads the typed exam answers, ignoring any that belong to other questions. */
export function readExamRun(id: string, examIds: string[]): ExamRunState | null {
  const state = readState("exam", id);
  if (!state) return null;
  const raw = state.answers;
  if (!raw || typeof raw !== "object") return null;
  const known = new Set(examIds);
  const answers: Record<string, string> = {};
  for (const [examId, value] of Object.entries(raw)) {
    if (!known.has(examId) || typeof value !== "string") continue;
    answers[examId] = value;
  }
  if (Object.keys(answers).length === 0) return null;
  return { answers };
}

export function saveExamRun(id: string, state: ExamRunState): void {
  writeState("exam", id, state);
}

export function clearExamRun(id: string): void {
  clearState("exam", id);
}
