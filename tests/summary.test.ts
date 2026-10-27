import { describe, expect, test } from "bun:test";

import {
  SUMMARY_FIELDS,
  parseSummary,
  summaryValidator,
  toSummaryArgs,
} from "../src/convex/lib/summary";

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
