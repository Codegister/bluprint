/**
 * The card fields `completeGeneration` accepts.
 *
 * The generator writes one revision-ready `keyPoint` beside every card, and
 * that claim is the one the summary shows. It used to be dropped here, which
 * forced the stored key points to be rebuilt from the card fronts and produced
 * fragments such as "Happens to the rate of". The validator now carries the
 * field, so the generated claim survives storage.
 */

export type CardArgs = {
  front: string;
  back: string;
  keyPoint?: string;
  beyondNotes?: boolean;
};

export function toCardArgs<
  T extends {
    front: string;
    back: string;
    keyPoint?: string;
    beyondNotes?: boolean;
  },
>(cards: readonly T[]): CardArgs[] {
  return cards.map((card) => {
    const shaped: CardArgs = { front: card.front, back: card.back };
    if (card.keyPoint) shaped.keyPoint = card.keyPoint;
    if (card.beyondNotes !== undefined) shaped.beyondNotes = card.beyondNotes;
    return shaped;
  });
}
