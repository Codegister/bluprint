import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

import {
  criteriaFor,
  criteriaTotal,
  markSchemeMatchesMarks,
  validateMarkingGuide,
} from "../src/convex/lib/markingCriteria";

/**
 * The live question: one mark on offer, four one-mark criteria stored. The
 * student had to meet all four to earn the single mark, and the screen then
 * showed a scheme that could never be met.
 */
const BAD_STORED = [
  { id: "c1", marks: 1, text: "pH is a measure of hydrogen ion concentration" },
  { id: "c2", marks: 1, text: "pH 7 is neutral" },
  { id: "c3", marks: 1, text: "below pH 7 is acidic" },
  { id: "c4", marks: 1, text: "above pH 7 is alkaline" },
];

describe("mark schemes match their marks", () => {
  test("a four-criterion scheme is not used for a one-mark question", () => {
    expect(criteriaTotal(BAD_STORED)).toBe(4);
    expect(
      criteriaFor({
        criteria: BAD_STORED,
        markingGuide: BAD_STORED.map((criterion) => `1 mark: ${criterion.text}`),
        marks: 1,
      }),
    ).toEqual([]);
  });

  test("a bad stored scheme falls back to the guide only when the guide fits", () => {
    const criteria = criteriaFor({
      criteria: BAD_STORED,
      markingGuide: ["1 mark: pH measures hydrogen ion concentration"],
      marks: 1,
    });
    expect(criteria).toHaveLength(1);
    expect(criteria[0]!.marks).toBe(1);
  });

  test("a matching stored scheme is kept as stored", () => {
    const criteria = criteriaFor({
      criteria: BAD_STORED,
      markingGuide: [],
      marks: 4,
    });
    expect(criteria).toHaveLength(4);
  });

  test("a one-mark question has exactly one criterion", () => {
    const validation = validateMarkingGuide(
      "points",
      ["1 mark: pH measures hydrogen ion concentration"],
      1,
    );
    expect(validation.ok).toBe(true);
    if (validation.ok && validation.scheme.kind === "points") {
      expect(validation.scheme.points).toHaveLength(1);
    }
  });

  test("the storage gate rejects a guide that totals more than its marks", () => {
    const guide = BAD_STORED.map((criterion) => `1 mark: ${criterion.text}`);
    expect(markSchemeMatchesMarks(guide, 1)).toBe(false);
    expect(markSchemeMatchesMarks(guide, 4)).toBe(true);
    expect(markSchemeMatchesMarks([], 1)).toBe(false);
  });

  test("a multi-bullet guide with a non-one mark is rejected for regeneration", () => {
    const validation = validateMarkingGuide(
      "points",
      ["2 marks: explains pH", "1 mark: states a value"],
      3,
    );
    expect(validation.ok).toBe(false);
  });

  test("grading refuses a stored scheme that cannot meet its marks", () => {
    const source = readFileSync("src/convex/ai.ts", "utf8");
    const start = source.indexOf("async function markExamAnswer");
    const body = source.slice(start, start + 3000);
    expect(body).toContain("if (criteria.length === 0)");
    expect(body).toContain("throw new Error(MARK_SCHEME_MISMATCH_MESSAGE)");
  });

  test("the marked screen lists criteria and always renders the model answer", () => {
    const source = readFileSync("src/components/study/ExamPractice.tsx", "utf8");
    expect(source).toContain("checklistRows.map(");
    expect(source).toContain("{exam.modelAnswer}");
    // The model answer is in the graded branch, with no checklist-length gate.
    const model = source.slice(source.lastIndexOf("Model answer"));
    expect(model.slice(0, 400)).toContain("{exam.modelAnswer}");
  });
});
