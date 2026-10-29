import { describe, expect, test } from "bun:test";
import { materialLimits, noteFacts } from "../src/convex/lib/buildCapacity";
import { shortfallFor } from "../src/convex/lib/buildDefaults";
import {
  filterGuideToNotes,
  isSupportedByNotes,
} from "../src/convex/lib/noteSupport";

const FIVE_FACTS =
  "Enzymes are biological catalysts. They speed up reactions by lowering activation energy. " +
  "The active site is specific to its substrate. Temperature affects the rate of reaction. " +
  "Above the optimum temperature, the enzyme denatures and the active site changes shape.";

describe("material capacity", () => {
  test("finds the distinct statements in a short note", () => {
    expect(noteFacts(FIVE_FACTS).length).toBe(5);
  });

  test("five facts support at least three quiz and two exam questions", () => {
    const limits = materialLimits(FIVE_FACTS);
    expect(limits.quiz).toBeGreaterThanOrEqual(3);
    expect(limits.exam).toBeGreaterThanOrEqual(2);
    expect(limits.cards).toBeGreaterThanOrEqual(5);
  });

  test("a thin note still supports one of each rather than zero", () => {
    const limits = materialLimits("Osmosis is the movement of water across a membrane.");
    expect(limits).toEqual({ cards: 1, quiz: 1, exam: 1 });
  });

  test("the cap never exceeds the requested maximum", () => {
    const limits = materialLimits(FIVE_FACTS, 2);
    expect(limits.cards).toBeLessThanOrEqual(2);
    expect(limits.quiz).toBeLessThanOrEqual(2);
    expect(limits.exam).toBeLessThanOrEqual(2);
  });
});

describe("shortfall copy", () => {
  test("quiz and exam shortfalls say what Bluprint can build", () => {
    expect(shortfallFor("quiz", 1, 5)).toContain(
      "Bluprint can build 1 quiz question from this note",
    );
    expect(shortfallFor("exam", 2, 3)).toContain(
      "Bluprint can build 2 exam questions from this note",
    );
  });

  test("card shortfalls keep the established wording", () => {
    expect(shortfallFor("cards", 4, 10)).toBe(
      "Built 4 of 10. Your notes supported 4.",
    );
  });
});

describe("marking guides stay inside the notes", () => {
  test("a supported bullet is kept", () => {
    expect(
      isSupportedByNotes(
        FIVE_FACTS,
        "1 mark: states that enzymes speed up reactions",
      ),
    ).toBe(true);
  });

  test("an invented requirement is dropped", () => {
    expect(
      isSupportedByNotes(
        FIVE_FACTS,
        "1 mark: states that enzymes speed up reactions without being consumed",
      ),
    ).toBe(false);
  });

  test("the filtered guide keeps only supportable bullets", () => {
    expect(
      filterGuideToNotes(FIVE_FACTS, [
        "1 mark: states that enzymes speed up reactions",
        "1 mark: states that enzymes are not consumed in the reaction",
      ]),
    ).toEqual(["1 mark: states that enzymes speed up reactions"]);
  });
});
