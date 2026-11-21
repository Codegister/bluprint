import { describe, expect, test } from "bun:test";

import {
  SUMMARY_FIELDS,
  parseSummary,
  summaryCopiesScope,
  summaryMaterialScope,
  summaryValidator,
  toSummaryArgs,
} from "../src/convex/lib/summary";
import { SYLLABUS_SCOPE_HEADER } from "../src/convex/lib/syllabusOutline";

/**
 * A captured response from the summary call, including the `title` field whose
 * absence from the mutation validator broke every build with
 * "Object contains extra field `title` … Path: .summary".
 */
const FIXTURE = `{
  "title": "Osmosis and Active Transport",
  "overview": "Osmosis is the diffusion of water across a partially permeable membrane, from a dilute solution to a concentrated one. It is passive, so no energy is used. Cells rely on it to move water in and out.",
  "keyPoints": [
    "Water moves down a water potential gradient",
    "The membrane is partially permeable",
    "Osmosis is passive and needs no ATP",
    "Animal cells can burst in pure water"
  ],
  "examFocus": [
    "Explain why a plant cell does not burst",
    "Compare osmosis with active transport"
  ],
  "sources": "this key is not part of the schema"
}`;

describe("summary generation → validation", () => {
  test("the fixture is parsed into the exact validator shape", () => {
    const summary = parseSummary(FIXTURE, "Biology");
    const args = toSummaryArgs(summary);

    // The validator's own field list and the parsed object must be identical.
    // This is the drift check: adding a field to the parser without adding it
    // to the validator (or the other way round) fails here.
    const validatorFields = Object.keys(
      (summaryValidator as unknown as { fields: Record<string, unknown> }).fields,
    );
    expect(validatorFields).toEqual(SUMMARY_FIELDS);
    expect(Object.keys(args)).toEqual(SUMMARY_FIELDS);

    expect(args.title).toBe("Osmosis and Active Transport");
    expect(args.keyPoints.length).toBeGreaterThanOrEqual(2);
    expect(typeof args.title).toBe("string");
    expect(typeof args.overview).toBe("string");
    expect(Array.isArray(args.keyPoints)).toBe(true);
    expect(Array.isArray(args.examFocus)).toBe(true);

    // Unknown keys the model invents are dropped before validation.
    expect(Object.keys(args)).not.toContain("sources");
  });

  test("a fenced response with chatter still parses", () => {
    const fenced = `Here is the JSON:\n\`\`\`json\n${FIXTURE}\n\`\`\``;
    const summary = parseSummary(fenced, "Biology");
    expect(summary.title).toBe("Osmosis and Active Transport");
    expect(toSummaryArgs(summary)).toEqual(summary);
  });

  test("a sentence is never used as a title", () => {
    const sentenceTitle = FIXTURE.replace(
      "Osmosis and Active Transport",
      "Osmosis Is the Diffusion of Water Across Membranes",
    );
    const summary = parseSummary(sentenceTitle, "Biology");
    // Five words, no dangling join word, no copula: the sentence is rejected
    // and the clean subject label is used instead.
    expect(summary.title).toBe("Biology");
  });

  test("a missing title falls back to a clean label", () => {
    const noTitle = FIXTURE.replace(/\s*"title":\s*"[^"]*",/, "");
    expect(parseSummary(noTitle, "Cell Biology").title).toBe("Cell Biology");
  });
});

describe("a summary that copies the scope", () => {
  const brief = [
    "Course: GCSE English Literature",
    "Exam board: AQA",
    "Course options: Shakespeare: Macbeth · Modern text: An Inspector Calls",
    "",
    SYLLABUS_SCOPE_HEADER,
    "",
    "Section 1: Macbeth",
    "Unit: Shakespeare",
    "Covers Macbeth: Overview, Plot Summary, Themes and the rest of this topic.",
    "Covers:",
    "- Macbeth: Overview",
  ].join("\n");
  const copied = {
    title: "Macbeth and An Inspector Calls",
    overview:
      "Course: GCSE English Literature. Syllabus scope for this set: Section 1: Macbeth, Unit: Shakespeare, covers Macbeth: Overview, Plot Summary and Themes.",
    keyPoints: ["Macbeth: Overview", "Macbeth: Plot Summary"],
    examFocus: [],
  };
  const taught = {
    title: "Macbeth and An Inspector Calls",
    overview:
      "Macbeth is a Scottish general whose ambition drives him to murder King Duncan after the witches hail him as future king. Lady Macbeth pushes him towards the killing, then guilt and paranoia destroy them both.",
    keyPoints: [
      "The witches greet Macbeth as thane of Cawdor and king hereafter.",
      "Lady Macbeth calls on the spirits to unsex her before Duncan's murder.",
      "Macduff kills Macbeth after Birnam Wood appears to move.",
    ],
    examFocus: ["How ambition and guilt are presented in Macbeth"],
  };

  test("the copied scope is caught and rejected", () => {
    expect(summaryCopiesScope(brief, copied)).toBe(true);
  });

  test("a real revision summary is kept", () => {
    expect(summaryCopiesScope(brief, taught)).toBe(false);
  });

  test("ordinary notes are never judged this way", () => {
    // An upload may legitimately quote its own material, including a line that
    // happens to read "Unit:".
    expect(summaryCopiesScope("Unit: 3. Cells\nCells are the unit of life.", taught)).toBe(
      false,
    );
  });
});

describe("summary scope material", () => {
  // The brief a set built from every chemistry topic carries: one section per
  // topic, longer than the model input once the whole selection is included.
  const EVERY_TOPIC = Array.from(
    { length: 24 },
    (_, index) =>
      `Section ${index + 1}: Topic ${index + 1}\nUnit: Unit ${index + 1}\n${(
        "Detail about this topic. "
      ).repeat(20)}Covers:\n- point ${index + 1}`,
  ).join("\n");

  test("every topic stays in the summary input when the brief is too long", () => {
    const scope = summaryMaterialScope(EVERY_TOPIC, 1_200);
    expect(scope.sections).toBe(24);
    expect(scope.shortened).toBe(true);
    expect(scope.material.length).toBeLessThanOrEqual(1_200);
    // The bug this covers: head-clipping kept the first topics and dropped the
    // rest, so a whole-subject set was summarised from its opening topic.
    for (let index = 1; index <= 24; index += 1) {
      expect(scope.material).toContain(`Section ${index}: Topic ${index}`);
    }
  });

  test("a brief that already fits is passed through untouched", () => {
    const notes = "Topic: Osmosis\nUnit: Transport\nWater crosses membranes.";
    expect(summaryMaterialScope(notes, 12_000)).toEqual({
      material: notes,
      sections: 1,
      shortened: false,
    });
  });

  test("a short multi-topic brief is not shortened", () => {
    const notes =
      "Section 1: Atoms\nUnit: Atomic structure\nAtoms have protons.\nSection 2: Bonds\nUnit: Bonding\nIons attract.";
    expect(summaryMaterialScope(notes, 12_000)).toEqual({
      material: notes,
      sections: 2,
      shortened: false,
    });
  });
});
