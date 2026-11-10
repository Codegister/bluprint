import { describe, expect, test } from "bun:test";

import { courseQuestionsFor } from "../src/lib/courseQuestions";

describe("course setup questions", () => {
  test("GCSE Religious Studies reaches its route, religion and paper step", () => {
    expect(
      courseQuestionsFor("GCSE", "Religious Studies", "Pearson Edexcel"),
    ).toEqual(["board", "rs"]);
  });

  test("Religious Studies does not get a tier question it cannot answer", () => {
    expect(
      courseQuestionsFor("GCSE", "Religious Studies", "AQA"),
    ).not.toContain("tier");
  });

  test("tiered GCSE subjects still ask for a tier", () => {
    expect(courseQuestionsFor("GCSE", "Biology", "AQA")).toEqual([
      "board",
      "tier",
    ]);
  });

  test("GCSE English Literature still asks for its set texts", () => {
    expect(courseQuestionsFor("GCSE", "English Literature", "AQA")).toEqual([
      "board",
      "lit",
    ]);
  });
});
