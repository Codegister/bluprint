import { describe, expect, test } from "bun:test";

import {
  gradeShortAnswer,
  gradeVocabularyAnswer,
  isLanguageCourse,
  isShortAnswer,
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
});
