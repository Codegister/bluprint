import { describe, expect, test } from "bun:test";

import {
  looksLikeStudentAnswer,
  shouldMarkAnswer,
  tutorMarkingRules,
} from "../src/convex/lib/tutorMarking";

describe("tutor marking contract", () => {
  test("requires a mark out of N and names missing points", () => {
    const rules = tutorMarkingRules();
    expect(rules).toContain("Mark: X/N");
    expect(rules).toContain("missing mark point");
    expect(rules).toContain("Full marks");
  });

  test("names the killed-by-heat misconception explicitly", () => {
    const rules = tutorMarkingRules();
    expect(rules).toContain("not 'killed' by heat");
    expect(rules).toContain("denatured");
    expect(rules).toContain("Not credited:");
  });

  test("a short answer is treated as an answer, but a question is not", () => {
    expect(looksLikeStudentAnswer("The enzyme gets killed by the heat")).toBe(true);
    expect(looksLikeStudentAnswer("Explain how enzymes denature")).toBe(false);
    expect(looksLikeStudentAnswer("Are you sure those are all the topics?")).toBe(
      false,
    );
  });
});

describe("when a turn is marked", () => {
  test("marks an answer to a question the tutor just asked", () => {
    expect(
      shouldMarkAnswer(
        "Explain why the active site is specific. What happens to an enzyme above its optimum temperature?",
        "It is denatured because the shape of the active site changes",
      ),
    ).toBe(true);
  });

  test("does not mark a question back after an answer that had no question", () => {
    expect(
      shouldMarkAnswer(
        "Here are the 10 sets, one for each of your courses. Let me know if you would like me to proceed with creating these sets.",
        "Are you sure those are all the topics?",
      ),
    ).toBe(false);
  });

  test("does not mark a question asked after the tutor's own question", () => {
    expect(shouldMarkAnswer("What is osmosis?", "Are you sure?")).toBe(false);
  });

  test("marks when the student asks for a mark outright", () => {
    expect(
      shouldMarkAnswer(undefined, "Mark my answer: the enzyme gets killed by the heat"),
    ).toBe(true);
  });
});
