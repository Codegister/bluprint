import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

import { duplicatesExistingCard } from "../src/convex/lib/studySetQuality";

/**
 * The live fixture: one set held "Word equation for photosynthesis" and
 * "Word equation for photosynthesis state". The retry only saw the saved deck
 * as prompt text, so the model's repeat was stored.
 */
describe("duplicate cards against the saved deck", () => {
  test("the photosynthesis word-equation pair is a duplicate", () => {
    const saved = [
      {
        front: "Word equation for photosynthesis",
        back: "carbon dioxide + water → glucose + oxygen",
      },
    ];
    expect(
      duplicatesExistingCard(
        {
          front: "Word equation for photosynthesis state",
          back: "carbon dioxide + water → glucose + oxygen",
        },
        saved,
      ),
    ).toBe(true);
  });

  test("a genuinely different equation is not a duplicate", () => {
    const saved = [
      {
        front: "Word equation for photosynthesis",
        back: "carbon dioxide + water → glucose + oxygen",
      },
    ];
    expect(
      duplicatesExistingCard(
        {
          front: "Balanced symbol equation for photosynthesis",
          back: "6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂",
        },
        saved,
      ),
    ).toBe(false);
  });

  test("the retry checks the saved deck as data, not only as prompt text", () => {
    const source = readFileSync("src/convex/ai.ts", "utf8");
    const start = source.indexOf("async function generateCards(");
    const end = source.indexOf("async function generatePathwayCards(", start);
    const body = source.slice(start, end > start ? end : start + 12000);
    expect(body).toContain("existingCards");
    expect(body).toContain("duplicatesExistingCard");
    // The continuation passes the saved deck as the structured argument, next
    // to the prompt digest.
    const continuation = source.slice(
      source.indexOf("continueStudySetCardsForUser"),
      source.indexOf("continueStudySetCardsForUser") + 20000,
    );
    expect(continuation).toContain("reuseCardDigest(snapshot.cards)");
    expect(continuation).toMatch(/snapshot\.cards,\s*\n\s*\)/);
  });
});
