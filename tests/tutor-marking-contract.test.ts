import { describe, expect, test } from "bun:test";

import {
  looksLikeStudentAnswer,
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
  });
});
