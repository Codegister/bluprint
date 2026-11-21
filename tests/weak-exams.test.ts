import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

import { weakExamQuestions } from "../src/convex/lib/studyMetrics";

const EXAMS = [
  { _id: "low", marks: 6, awardedMarks: 2 },
  { _id: "full", marks: 4, awardedMarks: 4 },
  { _id: "near", marks: 6, awardedMarks: 5 },
  { _id: "ungraded", marks: 8 },
  { _id: "half", marks: 4, awardedMarks: 2 },
];

describe("written answers as weak spots", () => {
  test("answers below full marks are ranked by the size of the gap", () => {
    const weak = weakExamQuestions(EXAMS);
    expect(weak.map((exam) => exam._id)).toEqual(["low", "half", "near"]);
  });

  test("a full-mark or ungraded answer is not a weak spot", () => {
    const weak = weakExamQuestions(EXAMS);
    expect(weak.some((exam) => exam._id === "full")).toBe(false);
    expect(weak.some((exam) => exam._id === "ungraded")).toBe(false);
  });

  test("the weak-spot query reads exam questions and exposes a retry count", () => {
    const source = readFileSync("src/convex/studySets.ts", "utf8");
    const start = source.indexOf("export const weakSpots = query");
    const body = source.slice(start, start + 3000);
    expect(body).toContain('query("examQuestions")');
    expect(body).toContain("weakExamCount");
    expect(body).toContain("weakExamQuestions");
  });

  test("Today counts answers given today, not a sum of three definitions", () => {
    const source = readFileSync("src/pages/Today.tsx", "utf8");
    expect(source).toContain("answeredToday");
    expect(source).not.toContain("items.correct");
    const server = readFileSync("src/convex/studySets.ts", "utf8");
    expect(server).not.toContain("items.correct =");
  });
});
