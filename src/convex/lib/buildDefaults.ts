/**
 * One build size for the whole product.
 *
 * The marketing pages, the upload dialog, the pathway sets and the edit dialog
 * all quote the same numbers, and the generator falls back to the same numbers
 * for a set saved before the sliders existed. Keeping them here is what stops
 * the app from promising ten cards on one screen and twenty on another.
 *
 * This module is deliberately dependency-free so both the browser and the
 * Convex runtime can import it.
 */

/** What a new set builds unless the student asks for something else. */
export const BUILD_DEFAULTS = {
  cards: 10,
  quiz: 5,
  exam: 3,
} as const;

/** The sliders allow this many of each; the generator then caps by material. */
export const BUILD_MIN = 1;
export const BUILD_MAX = 100;

/**
 * The one sentence used wherever fewer items were built than were asked for.
 * It states both numbers and the count the notes actually supported, and never
 * claims the maximum was reached when the counts disagree.
 */
export function shortfallSentence(built: number, requested: number): string {
  return `Built ${built} of ${requested}. Your notes supported ${built}.`;
}

/**
 * Rewrites a stored note written before this wording existed, so an older set
 * shows the same rule as a new one instead of the old "because the notes only
 * support" sentence.
 */
export function normaliseCapacityNote(note: string): string {
  return note
    .replace(
      /Built (\d+) of (\d+) because the notes only support \1\./g,
      "Built $1 of $2. Your notes supported $1.",
    )
    .replace(/\s+/g, " ")
    .trim();
}
