import { describe, expect, test } from "bun:test";

import {
  applyReferencePaper,
  buildPaperBlueprint,
  flattenPaperBlueprint,
} from "../src/convex/lib/paperBlueprint";
import { parseReferencePaperFormat } from "../src/convex/lib/referencePaper";

const course = {
  subject: "Biology",
  level: "GCSE",
  examBoard: "AQA",
};

const paperText = `GCSE BIOLOGY
Higher Tier
0 1 . 1 Which disease is non-communicable?
[1 mark]
0 1 . 2 Give one non-communicable disease.
[2 marks]
0 2 . 1 Explain how obesity affects health.
[6 marks]
`;

describe("reference paper format", () => {
  test("reads question labels and marks without keeping the wording", () => {
    const format = parseReferencePaperFormat(paperText);
    expect(format).not.toBeNull();
    expect(format!.questions.map((question) => question.label)).toEqual([
      "0 1 . 1",
      "0 1 . 2",
      "0 2 . 1",
    ]);
    expect(format!.questions.map((question) => question.marks)).toEqual([
      1, 2, 6,
    ]);
    expect(format!.totalMarks).toBe(9);
  });

  test("ignores mark totals and a file that is not a question paper", () => {
    const withTotals = `${paperText}
(Total for Question 1 = 3 marks)
`;
    expect(
      parseReferencePaperFormat(withTotals)!.questions.map(
        (question) => question.marks,
      ),
    ).toEqual([1, 2, 6]);
    expect(parseReferencePaperFormat("A short document")).toBeNull();
  });

  test("reshapes the subject blueprint to the reference structure", () => {
    const format = parseReferencePaperFormat(paperText)!;
    const base = buildPaperBlueprint(course);
    const aligned = applyReferencePaper(course, base, format);
    expect(aligned.questionCount).toBe(3);
    expect(aligned.totalMarks).toBe(9);
    expect(
      flattenPaperBlueprint(aligned).map((slot) => [slot.label, slot.marks]),
    ).toEqual([
      ["0 1 . 1", 1],
      ["0 1 . 2", 2],
      ["0 2 . 1", 6],
    ]);
  });
});
