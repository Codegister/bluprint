import { describe, expect, test } from "bun:test";

import {
  applyCardReview,
  cardReviewPrompt,
  parseCardReview,
} from "../src/convex/lib/cardReview";
import { MAX_NOTES_CHARS } from "../src/convex/lib/nvidiaConfig";

const MATERIAL =
  "A Christmas Carol by Charles Dickens. Scrooge is a miser who refuses to spend money on " +
  "Christmas. His clerk Bob Cratchit works in a cold office. The Ghost of Christmas Present " +
  "shows Scrooge the Cratchit family, and Scrooge asks whether Tiny Tim will live. At the end " +
  "Scrooge sends the Cratchits a turkey.";

const CARDS = [
  {
    front: "What is Scrooge's clerk called?",
    back: "Bob Cratchit.",
  },
  {
    // The reported failure: the names are in the extract, the conversation is
    // not, so a word-overlap check cannot reject it.
    front:
      "What does Scrooge say to the Ghost of Christmas Present when asked about his family?",
    back: "Scrooge asks whether Tiny Tim will live.",
  },
  {
    front: "What does Scrooge send the Cratchits at the end?",
    back: "A large turkey.",
  },
];

describe("the flashcard fact-check prompt", () => {
  test("carries the material and numbers every card in batch order", () => {
    const prompt = cardReviewPrompt({ material: MATERIAL, cards: CARDS });

    expect(prompt).toContain(MATERIAL);
    expect(prompt).toContain("1. Q: What is Scrooge's clerk called?");
    expect(prompt).toContain(
      "2. Q: What does Scrooge say to the Ghost of Christmas Present when asked about his family?",
    );
    expect(prompt).toContain(
      "3. Q: What does Scrooge send the Cratchits at the end?",
    );
    expect(prompt).toContain('"verdicts"');
  });

  test("draws the line at invented scenes, not at plain or easy cards", () => {
    const prompt = cardReviewPrompt({ material: MATERIAL, cards: CARDS });

    expect(prompt).toContain(
      "the answer describes a scene, quotation, event, character relationship",
    );
    expect(prompt).toContain("does not answer the question the front asks");
    expect(prompt).toContain("A plain, short or easy card is still keep");
  });

  test("tells the reviewer an outline may not state the fact the card teaches", () => {
    const prompt = cardReviewPrompt({
      material: "AQA GCSE English Literature: A Christmas Carol",
      cards: CARDS,
      syllabus: true,
    });

    expect(prompt).toContain("syllabus outline only");
    expect(prompt).toContain(
      "do not mark a card wrong merely because the outline",
    );
    expect(prompt).not.toContain(
      "the answer describes a scene, quotation, event, character relationship",
    );
  });

  test("marks a beyondNotes card and asks about the claim itself", () => {
    const prompt = cardReviewPrompt({
      material: MATERIAL,
      cards: [{ ...CARDS[0], beyondNotes: true }],
    });

    expect(prompt).toContain("Marked beyondNotes");
    expect(prompt).toContain("judge whether its claim is actually true");
  });

  test("clips material the writer also had clipped", () => {
    const prompt = cardReviewPrompt({
      material: "A".repeat(MAX_NOTES_CHARS) + "TAIL_MARKER",
      cards: CARDS,
    });

    expect(prompt).not.toContain("TAIL_MARKER");
    expect(prompt).toContain("shortened to fit");
  });
});

describe("reading the reviewer's verdicts", () => {
  test("maps a fenced JSON reply back onto card positions", () => {
    const raw =
      "```json\n" +
      JSON.stringify({
        verdicts: [
          { card: 1, verdict: "keep", reason: "" },
          {
            card: 2,
            verdict: "wrong",
            reason:
              "The extract says Scrooge asks about Tiny Tim, not about his family.",
          },
          { card: 3, verdict: "keep", reason: "" },
        ],
      }) +
      "\n```";

    expect(parseCardReview(raw, 3)).toEqual([
      { index: 0, verdict: "keep", reason: "" },
      {
        index: 1,
        verdict: "wrong",
        reason:
          "The extract says Scrooge asks about Tiny Tim, not about his family.",
      },
      { index: 2, verdict: "keep", reason: "" },
    ]);
  });

  test("drops only the card the reviewer called wrong", () => {
    const raw = JSON.stringify({
      verdicts: [
        { card: 1, verdict: "keep", reason: "" },
        { card: 2, verdict: "wrong", reason: "Not in the extract." },
        { card: 3, verdict: "keep", reason: "" },
      ],
    });

    const { cards, dropped } = applyCardReview(
      CARDS,
      parseCardReview(raw, CARDS.length),
    );

    expect(dropped).toBe(1);
    expect(cards.map((card) => card.front)).toEqual([
      CARDS[0].front,
      CARDS[2].front,
    ]);
  });

  test("keeps every card when the reply is unreadable or the verdict is unknown", () => {
    const unreadable = "I could not check these cards.";
    expect(parseCardReview(unreadable, 3)).toEqual([]);
    expect(applyCardReview(CARDS, parseCardReview(unreadable, 3))).toEqual({
      cards: CARDS,
      dropped: 0,
    });

    const unknown = JSON.stringify({
      verdicts: CARDS.map((_, index) => ({
        card: index + 1,
        verdict: "maybe",
      })),
    });
    expect(applyCardReview(CARDS, parseCardReview(unknown, 3)).dropped).toBe(0);
  });

  test("ignores a verdict for a card that was not in the batch", () => {
    const raw = JSON.stringify({
      verdicts: [{ card: 9, verdict: "wrong", reason: "x" }],
    });

    expect(applyCardReview(CARDS, parseCardReview(raw, 3)).dropped).toBe(0);
  });

  test("falls back to reply order when the reviewer omits card numbers", () => {
    const raw = JSON.stringify({
      verdicts: [
        { verdict: "keep" },
        { verdict: "incorrect" },
        { verdict: "keep" },
      ],
    });

    expect(parseCardReview(raw, 3)).toEqual([
      { index: 0, verdict: "keep", reason: "" },
      { index: 1, verdict: "wrong", reason: "" },
      { index: 2, verdict: "keep", reason: "" },
    ]);
  });
});
