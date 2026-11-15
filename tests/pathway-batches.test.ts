import { describe, expect, test } from "bun:test";

import { StudySetShortfallError } from "../src/convex/lib/buildFailure";
import { runPathwayBatches } from "../src/convex/lib/pathwayBatches";
import { pathwayQuizScopes } from "../src/convex/lib/quizScopes";

const PATHWAY = [
  "Course: AQA GCSE Spanish",
  "Exam board: AQA",
  "Syllabus scope for this set:",
  ...Array.from(
    { length: 29 },
    (_, index) => `Section ${index + 1}: Topic ${index + 1}\nUnit: Unit ${index + 1}\nTopic content ${index + 1}.`,
  ),
].join("\n");

const scopes = pathwayQuizScopes(PATHWAY, 100);

describe("pathway section runner", () => {
  test("a 100-question build survives short batches and a missing section", async () => {
    const missing = scopes[7]!.label;
    const progress: number[] = [];
    const run = await runPathwayBatches<string>({
      scopes,
      concurrency: 3,
      progressTarget: 100,
      generate: async (scope) => {
        if (scope.label === missing) throw new Error("section timed out");
        // Every completed section returns four when its share was five: a
        // deliberately short batch, as the live model often does.
        return Array.from(
          { length: 4 },
          (_, index) => `${scope.label} question ${index + 1}`,
        );
      },
      onProgress: (completed) => {
        progress.push(completed);
      },
    });

    expect(scopes).toHaveLength(29);
    expect(scopes.reduce((sum, scope) => sum + scope.target, 0)).toBeGreaterThanOrEqual(
      100,
    );
    expect(run.failures.map((failure) => failure.label)).toEqual([missing]);
    expect(run.completedSections).toBe(28);
    expect(run.items).toHaveLength(28 * 4);
    expect(run.items.slice(0, 100)).toHaveLength(100);
    expect(progress.every((value) => value >= 0 && value <= 100)).toBe(true);
    expect(progress.at(-1)).toBe(100);
  });

  test("short batches and a missing section become an explicit 100-question shortfall", async () => {
    const missing = scopes[3]!.label;
    const run = await runPathwayBatches<string>({
      scopes,
      concurrency: 3,
      progressTarget: 100,
      generate: async (scope) => {
        if (scope.label === missing) throw new Error("no response");
        return Array.from(
          { length: 2 },
          (_, index) => `${scope.label} question ${index + 1}`,
        );
      },
    });

    expect(run.items).toHaveLength(28 * 2);
    expect(run.items.length).toBeLessThan(100);
    const error = new StudySetShortfallError("quiz", run.items.length, 100, {
      cards: 43,
      quiz: run.items.length,
      exams: 1,
    });
    expect(error.message).toContain("56 of 100 quiz questions");
    expect(error.message).toContain("not marked ready");
    expect(error.message).toContain("43 flashcards are saved");
  });

  test("a section that fails does not discard the sections that succeeded", async () => {
    const missing = scopes[0]!.label;
    const run = await runPathwayBatches<string>({
      scopes: scopes.slice(0, 3),
      concurrency: 2,
      progressTarget: 15,
      generate: async (scope) => {
        if (scope.label === missing) throw new Error("provider error");
        return [`${scope.label} only question`];
      },
    });

    expect(run.failures).toHaveLength(1);
    expect(run.items).toHaveLength(2);
    expect(run.items).not.toContain(`${missing} only question`);
  });
});
