/**
 * The second opinion on a generated flashcard batch.
 *
 * Grounding heuristics can only tell that a card's words appear in the notes.
 * They cannot tell that the card invents a scene the text never contains: in an
 * English literature deck built from *A Christmas Carol*, "What does Scrooge
 * say to the Ghost of Christmas Present when asked about his family?" answered
 * "Scrooge asks whether Tiny Tim will live" reuses names from the extract, so
 * it passes every word-overlap check while asserting something that never
 * happens. A separate model reading the material and the card together is the
 * only check that catches that class of error.
 *
 * This module holds the prompt and the reply parsing, with no AI call, so the
 * decision to drop a card is testable without a provider.
 */
import { MAX_NOTES_CHARS } from "./nvidiaConfig";

export type CardUnderReview = {
  front: string;
  back: string;
  beyondNotes?: boolean;
};

export type CardVerdict = {
  /** Zero-based position of the card in the batch sent for review. */
  index: number;
  verdict: "keep" | "wrong";
  reason: string;
};

export const CARD_REVIEW_SYSTEM_PROMPT =
  "You are Bluprint's flashcard fact-checker. You decide whether a card is safe to revise from, " +
  "using the study material and the card itself. Answer with strict JSON and no markdown fences, " +
  "commentary or extra keys. Do not rewrite the cards, do not suggest improvements, and do not " +
  "narrate your reasoning.";

const REVIEW_RULES =
  'Mark a card "wrong" when: the material contradicts the answer; the answer describes a scene, ' +
  "quotation, event, character relationship, cause, date or figure that the material does not " +
  "contain; the answer does not answer the question the front asks, or answers a different " +
  "question; or the front names the wrong character, text, period, place, formula or term for the " +
  "fact in the answer. " +
  'Mark a card "keep" when the answer is stated in the material, follows from it in a single ' +
  "obvious step, or restates it in different words. A plain, short or easy card is still keep: " +
  "being unambitious is not being wrong, and small details are still facts. " +
  "A card marked beyondNotes was written from outside the material; judge whether its claim is " +
  "actually true for this text or subject, and keep it when it is.";

const SYLLABUS_REVIEW_RULES =
  "MATERIAL TYPE - syllabus outline only. The material names the scope of a qualification; it does " +
  "not teach it, and the cards are supposed to supply the subject content themselves. So do not " +
  'mark a card wrong merely because the outline does not state its answer. Mark it "wrong" when ' +
  "the claim itself is false or misattributed for this qualification: a wrong character, " +
  "quotation, event, date, formula, definition or cause, an answer that belongs to a different " +
  'term, or a front and back that do not match. Mark an accurate subject fact "keep", even when ' +
  "the outline never mentions it.";

const OUTPUT_RULE =
  "Return JSON exactly like: " +
  '{"verdicts":[{"card":1,"verdict":"keep","reason":""},' +
  '{"card":2,"verdict":"wrong","reason":"The material says X; the card says Y."}]} ' +
  "Write one verdict per card, numbered as above, and keep each reason to at most 25 words. " +
  "A reason must point at the material, the text or the subject fact, never at style.";

/**
 * The user message for the review call. The material is the same block the
 * writer saw, and the cards keep their batch order so a verdict's number maps
 * back to an index.
 */
export function cardReviewPrompt({
  material,
  cards,
  syllabus = false,
}: {
  material: string;
  cards: readonly CardUnderReview[];
  syllabus?: boolean;
}): string {
  const clipped = material.slice(0, MAX_NOTES_CHARS);
  const list = cards
    .map((card, index) => {
      const marker = card.beyondNotes
        ? "\n   (Marked beyondNotes: written from outside the material.)"
        : "";
      return `${index + 1}. Q: ${card.front}\n   A: ${card.back}${marker}`;
    })
    .join("\n");

  return (
    `<study_material>\n${clipped}\n</study_material>` +
    (material.length > MAX_NOTES_CHARS
      ? "\n(The material was shortened to fit; judge the cards against what is here.)"
      : "") +
    `\n\n<candidate_flashcards>\n${list}\n</candidate_flashcards>\n\n` +
    `${syllabus ? SYLLABUS_REVIEW_RULES : REVIEW_RULES}\n\n` +
    OUTPUT_RULE
  );
}

/** Reads the reviewer's JSON, tolerating fences and a leading explanation. */
function reviewObject(raw: string): Record<string, unknown> | null {
  const text = raw.replace(/```(?:json)?/gi, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    return parsed !== null && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const WRONG_VERDICT =
  /^(?:wrong|incorrect|false|invalid|unsupported|not[ -]supported|mismatch(?:ed)?|misattributed|hallucinated)\b/;
const KEEP_VERDICT = /^(?:keep|ok|okay|correct|supported|true|valid)\b/;

/**
 * Turns the reviewer's reply into verdicts for the cards that were sent.
 *
 * Silence is not a conviction: a card with no verdict, an unreadable reply, an
 * unknown label or an out-of-range number is kept. Only an explicit "wrong"
 * drops a card, so a reviewer that fails or rambles cannot empty a deck.
 */
export function parseCardReview(raw: string, count: number): CardVerdict[] {
  const parsed = reviewObject(raw);
  const rows = Array.isArray(parsed?.verdicts)
    ? parsed.verdicts
    : Array.isArray(parsed?.cards)
      ? parsed.cards
      : [];
  const seen = new Set<number>();
  const verdicts: CardVerdict[] = [];

  rows.forEach((row, position) => {
    if (row === null || typeof row !== "object") return;
    const record = row as Record<string, unknown>;
    const numbered = Number(record.card);
    const index =
      Number.isInteger(numbered) && numbered >= 1 ? numbered - 1 : position;
    if (index < 0 || index >= count || seen.has(index)) return;

    const label =
      typeof record.verdict === "string"
        ? record.verdict.trim().toLowerCase()
        : "";
    const wrong = WRONG_VERDICT.test(label);
    if (!wrong && !KEEP_VERDICT.test(label)) return;

    seen.add(index);
    verdicts.push({
      index,
      verdict: wrong ? "wrong" : "keep",
      reason:
        typeof record.reason === "string"
          ? record.reason.trim().slice(0, 200)
          : "",
    });
  });

  return verdicts;
}

/** Drops the cards the reviewer explicitly called wrong, keeping the rest. */
export function applyCardReview<T extends CardUnderReview>(
  cards: readonly T[],
  verdicts: readonly CardVerdict[],
): { cards: T[]; dropped: number } {
  const wrong = new Set(
    verdicts
      .filter((verdict) => verdict.verdict === "wrong")
      .map((verdict) => verdict.index),
  );
  const kept = cards.filter((_, index) => !wrong.has(index));
  return { cards: kept, dropped: cards.length - kept.length };
}
