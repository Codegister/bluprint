import { describe, expect, test } from "bun:test";

import {
  applyAlternativeCredits,
  awardCriterion,
  creditTermsFor,
  type MarkCheck,
} from "../src/convex/lib/markingCriteria";

/**
 * The live six-mark question: amylase, protease and lipase. The student wrote
 * only about amylase, and the old alternative pass filled the protease and
 * lipase rows by position with the amylase facts.
 */
const ENZYME_CRITERIA = [
  "1 mark: amylase is produced in the salivary glands",
  "1 mark: amylase breaks down starch into maltose",
  "1 mark: protease is produced in the stomach",
  "1 mark: protease breaks down protein into amino acids",
  "1 mark: lipase is produced in the pancreas",
  "1 mark: lipase breaks down lipids into fatty acids and glycerol",
];

const AMYLASE_ONLY =
  "Amylase is produced in the salivary glands and the pancreas. It breaks down starch into maltose.";

function criteriaRows(guide: string[]) {
  return guide.map((text, index) => ({ id: `c${index + 1}`, text }));
}

/** The production word guard, as the marker applies it. */
function markRows(guide: string[], answer: string): MarkCheck[] {
  // The production word guard is creditTermsFor + awardCriterion: a term can
  // only be borrowed from another row when the answer names that row's subject.
  const terms = creditTermsFor(guide, answer);
  return guide.map((point, index) => ({
    criterionId: `c${index + 1}`,
    point,
    marks: 1,
    awarded: awardCriterion(1, 1, terms[index] ?? [], answer),
    evidence: "absent",
  }));
}

describe("alternative credits are structural", () => {
  test("an amylase-only answer scores 2/6 and no alternative crosses over", () => {
    const criteria = criteriaRows(ENZYME_CRITERIA);
    let checks = markRows(ENZYME_CRITERIA, AMYLASE_ONLY);
    expect(checks.filter((check) => check.awarded > 0)).toHaveLength(2);
    expect(checks.reduce((sum, check) => sum + check.awarded, 0)).toBe(2);

    // What the model returned on the live answer: the same amylase evidence,
    // offered for the protease and lipase rows.
    const alternatives = [
      {
        criterionId: "c3",
        point: "amylase breaks down starch into maltose",
        evidence: "It breaks down starch into maltose",
      },
      {
        criterionId: "c5",
        point: "amylase is produced in the salivary glands",
        evidence: "Amylase is produced in the salivary glands",
      },
      {
        criterionId: "c4",
        point: "amylase is produced in the pancreas",
        evidence: "produced in the salivary glands and the pancreas",
      },
    ];

    checks = applyAlternativeCredits(checks, alternatives, criteria);
    expect(checks.reduce((sum, check) => sum + check.awarded, 0)).toBe(2);
    expect(checks[2]!.awarded).toBe(0);
    expect(checks[3]!.awarded).toBe(0);
    expect(checks[4]!.awarded).toBe(0);
  });

  test("an alternative offered for an already-awarded row adds nothing", () => {
    const criteria = criteriaRows(ENZYME_CRITERIA);
    const checks = markRows(ENZYME_CRITERIA, AMYLASE_ONLY);
    const result = applyAlternativeCredits(
      checks,
      [
        {
          criterionId: "c1", // already awarded
          point: "protease is produced in the stomach",
          evidence: "protease is produced in the stomach",
        },
      ],
      criteria,
    );
    expect(result.reduce((sum, check) => sum + check.awarded, 0)).toBe(2);
  });

  test("a genuinely unlisted correct point still earns its row", () => {
    const guide = [
      "1 mark: God is omnipotent",
      "1 mark: God is omniscient",
      "1 mark: God is eternal",
    ];
    const criteria = criteriaRows(guide);
    const checks = markRows(guide, "God is omnipotent and God is omniscient.");
    expect(checks[2]!.awarded).toBe(0);

    const result = applyAlternativeCredits(
      checks,
      [
        {
          criterionId: "c3",
          point: "God is benevolent",
          evidence: "God is benevolent",
        },
      ],
      criteria,
    );
    expect(result[2]!.awarded).toBe(1);
    expect(result[2]!.point).toContain("accepted alternative: God is benevolent");
  });

  test("one alternative cannot fill two rows", () => {
    const guide = ["1 mark: states one belief", "1 mark: states a second belief"];
    const criteria = criteriaRows(guide);
    const checks: MarkCheck[] = [
      { criterionId: "c1", point: guide[0]!, marks: 1, awarded: 0, evidence: "absent" },
      { criterionId: "c2", point: guide[1]!, marks: 1, awarded: 0, evidence: "absent" },
    ];
    const result = applyAlternativeCredits(
      checks,
      [
        {
          criterionId: "c1",
          point: "God is benevolent",
          evidence: "God is benevolent",
        },
      ],
      criteria,
    );
    expect(result.reduce((sum, check) => sum + check.awarded, 0)).toBe(1);
  });

  test("no alternative can be applied to a criterion it does not name", () => {
    const guide = [
      "1 mark: protease breaks down protein into amino acids",
      "1 mark: lipase breaks down lipids into fatty acids",
    ];
    const criteria = criteriaRows(guide);
    const checks: MarkCheck[] = guide.map((point, index) => ({
      criterionId: `c${index + 1}`,
      point,
      marks: 1,
      awarded: 0,
      evidence: "absent",
    }));
    // The point clearly belongs to the lipase row, but the model offers it for
    // the protease row. Position is not evidence.
    const result = applyAlternativeCredits(
      checks,
      [
        {
          criterionId: "c1",
          point: "lipase breaks down lipids into fatty acids",
          evidence: "lipase breaks down lipids",
        },
      ],
      criteria,
    );
    expect(result[0]!.awarded).toBe(0);
  });
});
