import { describe, expect, test } from "bun:test";

import { deriveRecallUnits, gradeRecall } from "../src/convex/lib/recall";

const AMYLASE = "Amylase is produced in the salivary glands and the pancreas.";
const PEPSIN = "Pepsin works best at about pH 2.";

/**
 * The live failure: every content word of the model answer appeared in the
 * response, so the bag-of-words marker scored it 1.0 and told the student they
 * matched the card. The answer says the opposite of the card.
 */
describe("recall polarity", () => {
  test("a negated answer is marked wrong and flagged as a contradiction", () => {
    const grade = gradeRecall(
      AMYLASE,
      "Amylase is not produced in the salivary glands or the pancreas",
      { threshold: 0.75 },
    );
    expect(grade.correct).toBe(false);
    expect(grade.contradicts).toBe(true);
    expect(grade.score).toBe(0);
    expect(grade.coveredUnits).toEqual([]);
  });

  test("the affirmative answer still passes", () => {
    const grade = gradeRecall(AMYLASE, AMYLASE, { threshold: 0.75 });
    expect(grade.correct).toBe(true);
    expect(grade.contradicts).toBe(false);
  });

  test("a shorter correct answer still passes", () => {
    const grade = gradeRecall(PEPSIN, "Pepsin works best at about pH 2", {
      threshold: 0.75,
    });
    expect(grade.correct).toBe(true);
    expect(grade.contradicts).toBe(false);
  });

  test("a partly negated answer does not credit the negated unit", () => {
    const grade = gradeRecall(
      AMYLASE,
      "Amylase is produced in the salivary glands, not the pancreas",
      { threshold: 0.9 },
    );
    expect(grade.coveredUnits).toContain("salivary");
    expect(grade.coveredUnits).not.toContain("pancreas");
    expect(grade.score).toBeLessThan(1);
    expect(grade.correct).toBe(false);
    expect(grade.contradicts).toBe(true);
  });

  test("a negated number is not an accepted closed answer", () => {
    const grade = gradeRecall("The optimum pH is 7.", "It is not 7", {
      threshold: 0.75,
    });
    expect(grade.correct).toBe(false);
  });

  test("function words and bare verbs are not concept units", () => {
    const units = deriveRecallUnits(
      "It breaks down starch into their sugars and gives energy",
    );
    expect(units).toEqual(["starch", "sugars", "energy"]);
    expect(units).not.toContain("breaks");
    expect(units).not.toContain("down");
    expect(units).not.toContain("into");
    expect(units).not.toContain("their");
  });

  test("a response made only of function words cannot pass", () => {
    const grade = gradeRecall(AMYLASE, "it is in the and of their", {
      threshold: 0.5,
    });
    expect(grade.correct).toBe(false);
  });
});
