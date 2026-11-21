import { describe, expect, test } from "bun:test";
import { toCardArgs } from "../src/convex/lib/cardArgs";

describe("toCardArgs", () => {
  test("keeps the generated keyPoint so the summary can use it", () => {
    const args = toCardArgs([
      { front: "What is active transport?", back: "Movement against a gradient using ATP.", keyPoint: "Active transport uses ATP." },
    ]);

    expect(args).toEqual([
      {
        front: "What is active transport?",
        back: "Movement against a gradient using ATP.",
        keyPoint: "Active transport uses ATP.",
      },
    ]);
  });

  test("keeps beyondNotes when the card has it", () => {
    const args = toCardArgs([
      { front: "Q", back: "A", keyPoint: "claim", beyondNotes: true },
    ]);

    expect(args).toEqual([
      { front: "Q", back: "A", keyPoint: "claim", beyondNotes: true },
    ]);
  });

  test("does not add an undefined keyPoint or beyondNotes field", () => {
    const args = toCardArgs([{ front: "Q", back: "A" }]);

    expect("keyPoint" in args[0]!).toBe(false);
    expect("beyondNotes" in args[0]!).toBe(false);
  });
});
