/**
 * Turning the browser speech engine's stream into one stable transcript.
 *
 * Browsers deliver results in `event.results`, indexed by position, and tell
 * you which entries changed with `resultIndex`. Chrome does not always honour
 * that: after a pause, or when a session restarts inside the same recogniser,
 * it can re-deliver results that were already written out. Appending whatever
 * arrives therefore repeats words — "controls cell functions" became
 * "controls controls controls cell controls functions cell".
 *
 * So the transcript is never appended blind. Each result owns a slot keyed by
 * its index, and a re-delivery overwrites the same slot instead of adding a
 * new copy. A phrase already at the end of the sentence is not added again,
 * which covers an engine that re-sends a finished phrase under the next index.
 */

export type TranscriptResult =
  | { transcript?: string; isFinal?: boolean }
  | undefined;

export type TranscriptEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: TranscriptResult;
  };
};

export type TranscriptState = {
  /** Words already settled: the typed baseline plus any earlier session. */
  settled: string;
  /** Final results, by their slot in the current session. */
  finals: Record<number, string>;
  /** Results still being spoken, by their slot. */
  interims: Record<number, string>;
};

/** A fresh state with `settled` as the text dictation starts from. */
export function emptyTranscript(settled = ""): TranscriptState {
  return { settled: settled.trim(), finals: {}, interims: {} };
}

function normalizeWords(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, " ")
    .trim();
}

/** Adds a spoken segment unless the sentence already ends with it. */
function appendSegment(base: string, segment: string): string {
  const next = segment.trim();
  if (!next) return base;
  if (!base) return next;
  const spoken = normalizeWords(base);
  const addition = normalizeWords(next);
  if (addition && (spoken === addition || spoken.endsWith(` ${addition}`))) {
    return base;
  }
  return `${base} ${next}`;
}

function ordered(slots: Record<number, string>): string[] {
  return Object.keys(slots)
    .map(Number)
    .sort((a, b) => a - b)
    .map((index) => slots[index])
    .filter((text): text is string => Boolean(text));
}

/**
 * Applies one recognition event and returns the new state plus the full text
 * to put in the box (baseline included).
 */
export function applyTranscript(
  state: TranscriptState,
  event: TranscriptEvent,
): { state: TranscriptState; text: string } {
  const finals = { ...state.finals };
  const interims = { ...state.interims };
  const length = event.results?.length ?? 0;
  const start = Math.max(0, Math.min(event.resultIndex ?? 0, length));

  for (let index = start; index < length; index += 1) {
    const result = event.results[index];
    const transcript = (result?.transcript ?? "").trim();
    if (result?.isFinal) {
      // The final replaces whatever interim sat in this slot.
      if (transcript) finals[index] = transcript;
      delete interims[index];
    } else if (transcript) {
      interims[index] = transcript;
    }
  }

  // An interim older than a final has already been resolved; keeping it would
  // print the same phrase twice, once on each side of the final.
  const lastFinal = Object.keys(finals)
    .map(Number)
    .reduce((highest, index) => Math.max(highest, index), -1);
  for (const key of Object.keys(interims)) {
    if (Number(key) <= lastFinal) delete interims[Number(key)];
  }

  let text = state.settled;
  for (const segment of [...ordered(finals), ...ordered(interims)]) {
    text = appendSegment(text, segment);
  }

  return { state: { settled: state.settled, finals, interims }, text };
}

/**
 * Marks the current session finished (the engine ended and is about to
 * restart): the words so far become the settled text and the slots reset,
 * because the next session numbers its results from zero again.
 */
export function commitTranscript(
  state: TranscriptState,
  text: string,
): TranscriptState {
  return emptyTranscript(text || state.settled);
}
