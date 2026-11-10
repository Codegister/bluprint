import { describe, expect, test } from "bun:test";
import { toExamArgs } from "../src/convex/lib/examArgs";

describe("toExamArgs", () => {
  test("drops past-paper-only fields before storage", () => {
    const args = toExamArgs([
      {
        question: "Explain why the man is not moving.",
        marks: 4,
        modelAnswer: "The pushing force is balanced by friction.",
        markingGuide: ["1 mark: forces are balanced"],
        beyondNotes: true,
        label: "1 (a)",
        section: "A",
        sectionInstruction: "Answer all questions.",
        commandWord: "Explain",
        specReference: "4.5.1",
        extract: { text: "A man pushes a wall." },
        data: { columns: ["Force", "Direction"], rows: [["Push", "Left"]] },
      },
    ]);

    expect(args).toEqual([
      {
        question: "Explain why the man is not moving.",
        marks: 4,
        modelAnswer: "The pushing force is balanced by friction.",
        markingGuide: ["1 mark: forces are balanced"],
        beyondNotes: true,
      },
    ]);
    expect("label" in args[0]!).toBe(false);
    expect("extract" in args[0]!).toBe(false);
  });

  test("keeps criteria for the repair path", () => {
    const criteria = [{ id: "c1", marks: 1, text: "forces are balanced" }];
    const args = toExamArgs([
      {
        question: "Q",
        marks: 1,
        modelAnswer: "A",
        markingGuide: ["1 mark: A"],
        criteria,
      },
    ]);

    expect(args).toEqual([
      {
        question: "Q",
        marks: 1,
        modelAnswer: "A",
        markingGuide: ["1 mark: A"],
        criteria,
      },
    ]);
  });
});
