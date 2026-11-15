import { describe, expect, test } from "bun:test";

import {
  pathwayQuizScopes,
  pathwaySectionScopes,
} from "../src/convex/lib/quizScopes";

const PATHWAY = `Course: AQA GCSE Spanish
Exam board: AQA

Syllabus scope: the whole specification.

Section 1: Identity and family
Family members, descriptions and relationships.

Section 2: School
Subjects, opinions and the school day.

Section 3: Free time
Sports, music and weekend activities.`;

describe("pathway quiz scopes", () => {
  test("a long pathway is split into topic batches with enough spare questions", () => {
    const scopes = pathwayQuizScopes(PATHWAY, 100);
    expect(scopes).toHaveLength(3);
    expect(scopes.every((scope) => scope.target >= 1)).toBe(true);
    expect(scopes.reduce((sum, scope) => sum + scope.target, 0)).toBeGreaterThanOrEqual(
      100,
    );
    expect(scopes[0]!.notes).toContain("Section 1: Identity and family");
    expect(scopes[1]!.notes).toContain("Section 2: School");
    expect(scopes[0]!.notes).toContain("Course: AQA GCSE Spanish");
    expect(scopes[0]!.notes).not.toContain("Section 2: School");
  });

  test("a small request uses one section per question instead of every section", () => {
    const scopes = pathwayQuizScopes(PATHWAY, 2);
    expect(scopes).toHaveLength(2);
    expect(scopes.map((scope) => scope.target)).toEqual([1, 1]);
    expect(scopes[0]!.label).toBe("Identity and family");
    expect(scopes[1]!.label).toBe("School");
  });

  test("exams use the same section boundaries as quizzes", () => {
    expect(pathwaySectionScopes(PATHWAY, 87)).toEqual(
      pathwayQuizScopes(PATHWAY, 87),
    );
  });

  test("notes without section headings stay as one scope", () => {
    const notes = "La familia es importante. Mi madre se llama Ana.";
    expect(pathwayQuizScopes(notes, 5)).toEqual([
      { label: "the pathway", notes, target: 5 },
    ]);
  });

  test("an empty note or zero target produces no work", () => {
    expect(pathwayQuizScopes("   ", 10)).toEqual([]);
    expect(pathwayQuizScopes(PATHWAY, 0)).toEqual([]);
  });
});
