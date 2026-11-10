import { describe, expect, test } from "bun:test";
import { toCardArgs } from "../src/convex/lib/cardArgs";

describe("toCardArgs", () => {
  test("drops the generator-only keyPoint field before storage", () => {
    const args = toCardArgs([
      { front: "What is active transport?", back: "Movement against a gradient using ATP.", keyPoint: "Active transport uses ATP." },
    ]);

    expect(args).toEqual([
      { front: "What is active transport?", back: "Movement against a gradient using ATP." },
    ]);
    expect("keyPoint" in args[0]!).toBe(false);
  });

  test("keeps beyondNotes when the card has it", () => {
    const args = toCardArgs([
      { front: "Q", back: "A", keyPoint: "claim", beyondNotes: true },
    ]);

    expect(args).toEqual([{ front: "Q", back: "A", beyondNotes: true }]);
  });

  test("does not add an undefined beyondNotes field", () => {
    const args = toCardArgs([{ front: "Q", back: "A", keyPoint: "claim" }]);

    expect("beyondNotes" in args[0]!).toBe(false);
  });
});
