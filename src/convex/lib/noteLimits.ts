/**
 * How long a note may be.
 *
 * The paste dialog advertises "0 / 20,000", so 20,000 is the number the whole
 * product has to enforce: the counter, the textarea, the client submit and the
 * server mutation all read it from here. It used to be advertised in the UI but
 * only checked at 60,000 on the server, so a 30,800-character paste was accepted
 * and started a full AI build.
 *
 * This module is dependency-free so the browser and the Convex runtime can both
 * import it.
 */

/** The character limit for anything a student types or pastes. */
export const MAX_NOTE_CHARS = 20_000;

/** The same number as the UI writes it, so the counter and the copy agree. */
export const MAX_NOTE_CHARS_LABEL = MAX_NOTE_CHARS.toLocaleString("en-US");

/** The one message every path uses when input is longer than the limit. */
export function noteLimitMessage(length = MAX_NOTE_CHARS): string {
  const over = Math.max(0, Math.round(length) - MAX_NOTE_CHARS);
  const trimmed = over.toLocaleString("en-US");
  return (
    `That's a lot of notes. Bluprint builds from up to ${MAX_NOTE_CHARS_LABEL} characters at a time` +
    (over > 0 ? `, and this is ${trimmed} over.` : ".") +
    " Trim it down and try again — nothing has been built yet."
  );
}

/** Whether a note is within the limit. */
export function withinNoteLimit(value: string): boolean {
  return value.length <= MAX_NOTE_CHARS;
}

/** Clips a note to the limit, for text the student did not type (OCR output). */
export function clipNote(value: string): string {
  return value.length <= MAX_NOTE_CHARS ? value : value.slice(0, MAX_NOTE_CHARS);
}
