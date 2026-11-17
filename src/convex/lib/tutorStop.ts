/**
 * The stop path, as pure state changes.
 *
 * A stopped reply keeps whatever had already streamed and any sets the build
 * saved. The Convex mutations apply exactly these helpers and the chat renders
 * from them, so the behaviour can be tested without a deployment.
 */

export type TutorReplyRow = {
  content: string;
  streaming?: boolean;
  stopped?: boolean;
  builtSetId?: string;
  builtSetIds?: string[];
};

/** Fields written when the student presses Stop; null once the reply finished. */
export function stopReplyFields(
  row: { streaming?: boolean },
): { streaming: false; stopped: true } | null {
  return row.streaming === true ? { streaming: false, stopped: true } : null;
}

/** The patch that saves a reply's sets, keeping the first for older readers. */
export function builtSetsFields<TId extends string>(builtSetIds: TId[]): {
  builtSetIds: TId[];
  builtSetId?: TId;
} {
  return {
    builtSetIds,
    ...(builtSetIds[0] ? { builtSetId: builtSetIds[0] } : {}),
  };
}

/** Every set a reply links; older rows only carry their single `builtSetId`. */
export function replySetIds<TId extends string>(row: {
  builtSetId?: TId;
  builtSetIds?: TId[];
}): TId[] {
  if (row.builtSetIds && row.builtSetIds.length > 0) return row.builtSetIds;
  return row.builtSetId ? [row.builtSetId] : [];
}

/**
 * Whether the next question's context replays this reply. A stopped answer is
 * half a turn: showing it on screen is useful, sending it back to the model as
 * something it said is not.
 */
export function isReplayableReply(row: { streaming?: boolean; stopped?: boolean }): boolean {
  return row.streaming !== true && row.stopped !== true;
}

/** True when the chat should show the "Stopped." placeholder instead of text. */
export function stoppedReplyIsEmpty(row: TutorReplyRow): boolean {
  return row.stopped === true && row.content.trim().length === 0;
}

/** The caption shown under a stopped reply that had already streamed text. */
export function stoppedReplyCaption(row: TutorReplyRow): string | null {
  return row.stopped === true && row.content.trim().length > 0
    ? "You stopped this answer. Sets already built are linked below."
    : null;
}
