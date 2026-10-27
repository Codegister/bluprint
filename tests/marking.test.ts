import { describe, expect, test } from "bun:test";

import {
  awardCriterion,
  criteriaFor,
  distinctiveCoverage,
  distinctiveTermsFor,
  guideFromCriteria,
  isSymbolicCriterion,
  meaningAward,
  toCriteria,
} from "../src/convex/lib/markingCriteria";

const TEMPERATURE_ONLY =
  "A higher temperature increases the rate of reaction because molecules have more kinetic energy and collide more often, until the enzyme denatures.";
const FULL_ANSWER =
  "A higher temperature increases the rate because molecules have more kinetic energy and collide more often, until the enzyme denatures. pH also affects enzyme activity: pH measures hydrogen ion concentration, each enzyme has an optimum pH, and moving away from it changes the shape of the active site so the substrate no longer fits.";

/** What the marker can award: the model's claim, capped by the answer's own words. */
function credit(
  criteria: Array<{ text: string; marks: number }>,
  answer: string,
): number[] {
  const terms = distinctiveTermsFor(criteria.map((criterion) => criterion.text));
  return criteria.map((criterion, index) =>
    // The model tries to award the whole criterion; the guard decides.
    awardCriterion(criterion.marks, criterion.marks, terms[index] ?? [], answer),
  );
}

const SIX_POINTS = [
  "1 mark: temperature increases kinetic energy",
  "1 mark: temperature increases collisions",
  "1 mark: high temperature denatures the enzyme",
  "1 mark: pH measures hydrogen ion concentration",
  "1 mark: each enzyme has an optimum pH",
  "1 mark: pH changes the shape of the active site",
];

describe("partial marks", () => {
  test("a six-mark single-string guide is expanded into discrete criteria", () => {
    const criteria = criteriaFor({
      markingGuide: ["6 marks: temperature and pH affect enzyme activity"],
      marks: 6,
    });

    expect(criteria.length).toBeGreaterThan(1);
    expect(criteria.reduce((sum, row) => sum + row.marks, 0)).toBe(6);
    expect(criteria.map((row) => row.text).join(" ")).toContain("temperature");
    expect(criteria.map((row) => row.text).join(" ")).toContain("pH");
  });

  test("a temperature-only answer scores exactly 3/6 and marks every pH point absent", () => {
    const criteria = criteriaFor({ markingGuide: SIX_POINTS, marks: 6 });
    expect(criteria.length).toBe(6);

    const credits = credit(criteria, TEMPERATURE_ONLY);
    expect(credits.reduce((sum, value) => sum + value, 0)).toBe(3);

    criteria.forEach((criterion, index) => {
      if (/ph/i.test(criterion.text)) expect(credits[index]).toBe(0);
    });
  });

  test("the full answer takes every mark", () => {
    const criteria = criteriaFor({ markingGuide: SIX_POINTS, marks: 6 });
    const credits = credit(criteria, FULL_ANSWER);

    expect(credits.reduce((sum, value) => sum + value, 0)).toBe(6);
  });

  test("a shared word cannot earn a criterion whose own idea is missing", () => {
    const guide = [
      "1 mark: high temperature denatures the enzyme",
      "1 mark: each enzyme has an optimum pH",
    ];
    const criteria = criteriaFor({ markingGuide: guide, marks: 2 });
    const credits = credit(criteria, TEMPERATURE_ONLY);

    expect(credits[0]).toBe(1);
    // "enzyme" appears in both rows, so it must not carry the pH mark.
    expect(credits[1]).toBe(0);
  });

  test("a single pH criterion is not credited by an enzyme answer", () => {
    const criteria = toCriteria(["1 mark: the optimum pH changes the active site"]);
    const terms = distinctiveTermsFor(criteria.map((criterion) => criterion.text));
    const coverage = distinctiveCoverage(terms[0] ?? [], TEMPERATURE_ONLY);

    expect(
      awardCriterion(criteria[0]!.marks, criteria[0]!.marks, terms[0] ?? [], TEMPERATURE_ONLY),
    ).toBe(0);
    expect(coverage).toBeLessThan(0.5);
  });

  test("re-marking the same answer twice gives the same per-criterion award", () => {
    const criteria = criteriaFor({ markingGuide: SIX_POINTS, marks: 6 });

    expect(credit(criteria, TEMPERATURE_ONLY)).toEqual(
      credit(criteria, TEMPERATURE_ONLY),
    );
    expect(credit(criteria, FULL_ANSWER)).toEqual(credit(criteria, FULL_ANSWER));
  });

  test("a ratio written in a different notation earns its mark", () => {
    const criterion = "1 mark: the ratio of carbon to oxygen atoms is 3:1";
    const terms = distinctiveTermsFor([criterion])[0] ?? [];
    const answer = "The ratio of carbon to oxygen atoms is 3 to 1.";
    expect(awardCriterion(1, 1, terms, answer)).toBe(1);
  });

  test("an equation stated in words is credited through the meaning pass", () => {
    const criterion = "1 mark: E = mc²";
    const terms = distinctiveTermsFor([criterion])[0] ?? [];
    const paraphrase = "Energy equals mass times the speed of light squared.";

    expect(isSymbolicCriterion(criterion)).toBe(true);
    expect(distinctiveCoverage(terms, paraphrase)).toBe(0);
    expect(meaningAward(1, 1, terms, paraphrase, criterion)).toBe(1);
  });

  test("a prose criterion with none of its own terms is still refused", () => {
    const criterion = "1 mark: each enzyme has an optimum pH";
    const terms = distinctiveTermsFor([criterion])[0] ?? [];
    const temperature =
      "A higher temperature increases the rate because molecules collide more often.";

    expect(isSymbolicCriterion(criterion)).toBe(false);
    expect(meaningAward(1, 1, terms, temperature, criterion)).toBe(0);
  });

  test("six one-mark criteria allow a literal sum, not all or nothing", () => {
    const criteria = criteriaFor({ markingGuide: SIX_POINTS, marks: 6 });
    expect(guideFromCriteria(criteria).every((line) => /^1 mark:/.test(line))).toBe(
      true,
    );

    const total = credit(criteria, TEMPERATURE_ONLY).reduce(
      (sum, value) => sum + value,
      0,
    );
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(6);
  });
});
