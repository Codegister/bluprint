import { describe, expect, test } from "bun:test";

import {
  gradeShortAnswer,
  gradeVocabularyAnswer,
  gradeVocabularyRecall,
  isLanguageCourse,
  isShortAnswer,
  vocabularyAnswerCandidates,
} from "../src/convex/lib/recall";

describe("language vocabulary marking", () => {
  test("a language course is recognised from its course name", () => {
    expect(isLanguageCourse("Spanish")).toBe(true);
    expect(isLanguageCourse("AQA GCSE French")).toBe(true);
    expect(isLanguageCourse("English Literature")).toBe(false);
    expect(isLanguageCourse(undefined)).toBe(false);
  });

  test("short terms are separated from sentence answers", () => {
    expect(isShortAnswer("la casa")).toBe(true);
    expect(isShortAnswer("el fin de semana")).toBe(false);
    expect(isShortAnswer("Explain why the rate falls above the optimum")).toBe(
      false,
    );
  });

  test("a different Spanish word is not a correct answer", () => {
    expect(gradeVocabularyAnswer("la casa", "el perro").correct).toBe(false);
    expect(gradeVocabularyAnswer("la casa", "el perro").score).toBe(0);
  });

  test("a missing or different article does not change the word", () => {
    expect(gradeVocabularyAnswer("la casa", "casa").correct).toBe(true);
    expect(gradeVocabularyAnswer("el perro", "perro").correct).toBe(true);
    expect(gradeVocabularyAnswer("the house", "house").correct).toBe(true);
  });

  test("the strict vocabulary path still accepts the exact answer", () => {
    expect(gradeVocabularyAnswer("la casa", "la casa").correct).toBe(true);
    expect(gradeVocabularyAnswer("la casa", "la casa").score).toBe(1);
  });

  test("the existing short-answer grader refuses a wholly different term", () => {
    expect(gradeShortAnswer("la casa", [], "el perro").correct).toBe(false);
  });

  test("extracts the target term from a sentence-length vocabulary card", () => {
    const front =
      "What is the Spanish word for 'my' when referring to a masculine singular noun?";
    const back =
      "The Spanish word for 'my' with a masculine singular noun is 'mi'. It does not change for gender or number, only the possessed noun does. Example: 'mi hermano' (my brother).";
    expect(vocabularyAnswerCandidates(front, back)).toContain("mi");
    expect(vocabularyAnswerCandidates(front, back)).not.toContain("my");
    expect(vocabularyAnswerCandidates(front, back)).not.toContain("mi hermano");
    expect(gradeVocabularyRecall(front, back, "mi")).toMatchObject({
      correct: true,
      score: 1,
    });
    expect(gradeVocabularyRecall(front, back, "my").correct).toBe(false);
  });
});
