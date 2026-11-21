import { describe, expect, test } from "bun:test";

import { SYLLABUS_SCOPE_HEADER } from "../src/convex/lib/syllabusOutline";
import {
  formatOption,
  optionLabel,
  prepareQuiz,
  reletterQuizItem,
  spreadCorrectPositions,
} from "../src/convex/lib/studySetQuality";

const OUTLINE = `${SYLLABUS_SCOPE_HEADER}\nTopic: Enzymes`;

describe("quiz option letters", () => {
  test("a printed label is removed and never left at the front of an option", () => {
    expect(formatOption("  B. Lipases produced in the pancreas. ")).toBe(
      "Lipases produced in the pancreas",
    );
    expect(formatOption("(c) Protease")).toBe("Protease");
    expect(formatOption("D: Maltase")).toBe("Maltase");
    expect(formatOption("A - Amylase")).toBe("Amylase");
    // A subject term beginning with A is not a label.
    expect(formatOption("A-level biology")).toBe("A-level biology");
    expect(optionLabel("B. Lipase")).toBe("B");
    expect(optionLabel("Lipase")).toBeNull();
  });

  test("the correct option keeps its position when its label is stripped", () => {
    const item = {
      question: "Which enzyme breaks down lipids?",
      options: ["C. Protease", "A. Amylase", "B. Lipase", "D. Maltase"],
      correctIndex: 2,
      explanation:
        "Lipase breaks down lipids into fatty acids, while option A is not correct.",
      type: "mcq" as const,
    };
    const result = reletterQuizItem(item);
    expect(result.options).toEqual(["Protease", "Amylase", "Lipase", "Maltase"]);
    expect(result.correctIndex).toBe(2);
    expect(result.options[result.correctIndex]).toBe("Lipase");
    // The explanation named the model's printed letter A, which is position B.
    expect(result.explanation).toContain("option B is not correct");
  });

  test("a displayed letter selects the option it names after rotation", () => {
    const item = {
      question: "Which enzyme breaks down lipids?",
      options: ["Protease", "Amylase", "Lipase", "Maltase"],
      correctIndex: 2,
      explanation: "Option A is wrong: protease does not break down lipids.",
      type: "mcq" as const,
    };
    const [rotated] = spreadCorrectPositions([item]);
    expect(rotated!.options[rotated!.correctIndex]).toBe("Lipase");
    // The explanation was about position A (protease). It moved to position B.
    const at = rotated!.options.indexOf("Protease");
    expect(rotated!.explanation).toContain(
      `Option ${String.fromCharCode(65 + at)}`,
    );
  });

  test("a stored quiz option never begins with a letter label", () => {
    const items = [
      {
        question: "Which enzyme breaks down starch?",
        options: ["B. Amylase", "C. Protease", "D. Lipase", "A. Maltase"],
        correctIndex: 0,
        explanation:
          "Amylase breaks down starch into maltose, while protease is not correct.",
        type: "mcq" as const,
      },
      {
        question: "Where is pepsin produced?",
        options: ["A. Stomach", "B. Pancreas", "C. Liver", "D. Mouth"],
        correctIndex: 0,
        explanation:
          "Pepsin is produced in the stomach, while the pancreas is not correct.",
        type: "mcq" as const,
      },
    ];
    const { items: prepared } = prepareQuiz(items, [], OUTLINE);
    expect(prepared.length).toBeGreaterThan(0);
    for (const item of prepared) {
      for (const option of item.options) {
        expect(optionLabel(option)).toBeNull();
        expect(option).not.toMatch(/^[A-D]\s*[).:\-–—]/);
      }
    }
    for (const item of prepared) {
      expect(item.options[item.correctIndex]).toBeTruthy();
    }
  });
});
