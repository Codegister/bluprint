/**
 * Which tutor send owns the composer's state.
 *
 * Sending and stopping overlap: Stop ends a request locally straight away, but
 * the Convex action's promise settles later. Without an owner, that old
 * promise's `finally` clears the state of the question sent after it, leaving
 * the composer "idle" while a new answer is still streaming.
 *
 * Each send takes the next id. Only the current id may write sending, pending
 * or error state, and Stop takes the next id too, so the abandoned request is
 * immediately nobody's.
 */

/** Starts a request, superseding anything still in flight. */
export function beginTutorRequest(activeId: number): number {
  return activeId + 1;
}

/** Whether a request still owns the composer. */
export function isActiveTutorRequest(activeId: number, requestId: number): boolean {
  return activeId === requestId;
}

/** Stops the current request without waiting for its promise to settle. */
export function stopTutorRequest(activeId: number): number {
  return activeId + 1;
}
