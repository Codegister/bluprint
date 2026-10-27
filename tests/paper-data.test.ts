import { describe, expect, test } from "bun:test";

import {
  alignDataReference,
  hasData,
  isSelfContained,
  referencesData,
} from "../src/convex/lib/paperData";

const TABLE_QUESTION =
  "The table shows the percentage cover of three plant species in two different grassland plots. Describe one conclusion you can draw from the data.";

const TABLE = {
  title: "Percentage cover of three species in two plots",
  columns: ["Species", "Plot A (%)", "Plot B (%)"],
  rows: [
    ["Dandelion", "12", "38"],
    ["Plantain", "41", "9"],
  ],
};

describe("self-contained paper questions", () => {
  test("a plain question needs no data", () => {
    expect(referencesData("Describe how temperature affects enzyme activity.")).toBe(
      false,
    );
    expect(isSelfContained({ question: "Name the two products of photosynthesis." })).toBe(
      true,
    );
  });

  test("the reported question is recognised as pointing at a table", () => {
    expect(referencesData(TABLE_QUESTION)).toBe(true);
  });

  test("a question that points at a table it did not supply is rejected", () => {
    expect(isSelfContained({ question: TABLE_QUESTION })).toBe(false);
    expect(
      isSelfContained({ question: "Use Figure 2 to describe the trend." }),
    ).toBe(false);
    expect(
      isSelfContained({ question: "Using the data below, calculate the rate." }),
    ).toBe(false);
  });

  test("the same question with its table is accepted", () => {
    expect(hasData(TABLE)).toBe(true);
    expect(isSelfContained({ question: TABLE_QUESTION, data: TABLE })).toBe(true);
  });

  test("a figure reference is renamed to the table that is actually rendered", () => {
    const aligned = alignDataReference({
      question: "Use Figure 2 and the graph to describe the trend.",
      data: TABLE,
    });
    expect(aligned.question).toBe("Use Table 2 and the table to describe the trend.");
    expect(isSelfContained(aligned)).toBe(true);
  });

  test("without data the wording is left alone so the question is still rejected", () => {
    const question = "Use Figure 2 to describe the trend.";
    expect(alignDataReference({ question }).question).toBe(question);
    expect(isSelfContained({ question })).toBe(false);
  });

  test("an empty or one-column table does not count as data", () => {
    expect(hasData({ columns: ["Species"], rows: [["Dandelion"]] })).toBe(false);
    expect(hasData({ columns: ["Species", "Cover"], rows: [] })).toBe(false);
    expect(isSelfContained({ question: TABLE_QUESTION, data: { columns: [], rows: [] } })).toBe(
      false,
    );
  });
});
