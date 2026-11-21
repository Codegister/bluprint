import { describe, expect, test } from "bun:test";

import {
  BUILD_DEFAULTS,
  BUILD_MAX,
  BUILD_MIN,
  clampBuildCount,
} from "../src/convex/lib/buildDefaults";
import { materialLimits } from "../src/convex/lib/buildCapacity";
import {
  buildCountLimits,
  initialBuildCounts,
} from "../src/lib/buildCounts";

describe("build count requests", () => {
  test("uses the fallback when a caller omits a count", () => {
    expect(clampBuildCount(undefined, BUILD_DEFAULTS.cards)).toBe(
      BUILD_DEFAULTS.cards,
    );
  });

  test("keeps explicit totals inside the published range", () => {
    expect(clampBuildCount(0, 10)).toBe(BUILD_MIN);
    expect(clampBuildCount(-4, 10)).toBe(BUILD_MIN);
    expect(clampBuildCount(BUILD_MAX + 1, 10)).toBe(BUILD_MAX);
  });

  test("rounds a decimal request and falls back for a non-number", () => {
    expect(clampBuildCount(7.6, 10)).toBe(8);
    expect(clampBuildCount(Number.NaN, 10)).toBe(10);
  });
});

describe("edit-set build counts", () => {
  const pathwaySet = {
    courseId: "course:1",
    notes: "Section 1: Atomic structure\nCovers:\n- Relative atomic mass",
    targetCardCount: 100,
    targetQuizCount: 100,
    targetExamCount: 100,
  };

  test("a pathway set runs to the account maximum, not its outline's length", () => {
    // The tutor asks for the account maximum, and a course set is generated
    // from the pathway rather than the scope text. Capping it at
    // materialLimits stored 41 and pinned the slider at the end.
    expect(buildCountLimits(pathwaySet)).toEqual({
      cards: BUILD_MAX,
      quiz: BUILD_MAX,
      exam: BUILD_MAX,
    });
    expect(initialBuildCounts(pathwaySet)).toEqual({
      cards: 100,
      quiz: 100,
      exam: 100,
    });
  });

  test("a pathway set keeps whatever targets it already has", () => {
    expect(
      initialBuildCounts({
        ...pathwaySet,
        targetCardCount: 10,
        targetQuizCount: 5,
        targetExamCount: 2,
      }),
    ).toEqual({ cards: 10, quiz: 5, exam: 2 });
  });

  test("a notes-built set still stops at what the material supports", () => {
    const notes = "Cells contain organelles. The nucleus stores genetic material.";
    const limits = materialLimits(notes);
    const asked = { courseId: undefined, notes, targetCardCount: 100, targetQuizCount: 100, targetExamCount: 100 };

    expect(buildCountLimits(asked)).toEqual(limits);
    expect(initialBuildCounts(asked)).toEqual({
      cards: limits.cards,
      quiz: limits.quiz,
      exam: limits.exam,
    });
  });

  test("undeclared targets start at the defaults inside the ceiling", () => {
    const notes = "Cells contain organelles.";
    const limits = materialLimits(notes);

    expect(initialBuildCounts({ notes })).toEqual({
      cards: Math.min(BUILD_DEFAULTS.cards, limits.cards),
      quiz: Math.min(BUILD_DEFAULTS.quiz, limits.quiz),
      exam: Math.min(BUILD_DEFAULTS.exam, limits.exam),
    });
  });
});
