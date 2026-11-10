/**
 * The card fields `completeGeneration` accepts.
 *
 * The generator also returns `keyPoint` so it writes one revision-ready claim
 * per card, but the mutation derives the stored key points from the prepared
 * deck itself. Passing the generator's field through the argument validator is
 * what produced "Object contains extra field `keyPoint`" and failed every
 * build, so the boundary drops it instead of widening the validator.
 */

export type CardArgs = {
  front: string;
  back: string;
  beyondNotes?: boolean;
};

export function toCardArgs<
  T extends { front: string; back: string; beyondNotes?: boolean },
>(cards: readonly T[]): CardArgs[] {
  return cards.map((card) => {
    const shaped: CardArgs = { front: card.front, back: card.back };
    if (card.beyondNotes !== undefined) shaped.beyondNotes = card.beyondNotes;
    return shaped;
  });
}
