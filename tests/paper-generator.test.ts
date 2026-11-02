import { describe, expect, test } from "bun:test";

import {
  buildPaperBlueprint,
  flattenPaperBlueprint,
} from "../src/convex/lib/paperBlueprint";

import {
  PAPER_CHECKLIST,
  PAPER_FORMAT_GUIDELINE,
  PAPER_GENERATOR_PROMPT,
  PAPER_GENERATOR_SYSTEM_MESSAGE,
} from "../src/convex/lib/paperGenerator";

describe("paper generator context", () => {
  test("includes the supplied prompt, guideline and every checklist row", () => {
    expect(PAPER_GENERATOR_PROMPT).toContain("END OF SYSTEM PROMPT");
    expect(PAPER_FORMAT_GUIDELINE).toContain("END OF GUIDELINE");
    const rows = PAPER_CHECKLIST.split("\n").filter((line) =>
      /^\| R\d+ \|/.test(line),
    );
    expect(rows).toHaveLength(42);
    for (const row of rows) {
      expect(row.split("|").length - 2).toBe(35);
    }
  });

  test("uses the supplied documents and keeps the paper grid authoritative", () => {
    expect(PAPER_GENERATOR_SYSTEM_MESSAGE).toContain(
      "paper_format_guideline.txt",
    );
    expect(PAPER_GENERATOR_SYSTEM_MESSAGE).toContain("paper_checklist.csv");
    expect(PAPER_GENERATOR_SYSTEM_MESSAGE).toContain(
      "BLUPRINT INTEGRATION CONTRACT",
    );
    expect(PAPER_GENERATOR_SYSTEM_MESSAGE).toContain(
      "do not expand it to the full qualification duration",
    );
    expect(PAPER_GENERATOR_SYSTEM_MESSAGE).not.toContain("reference_paper");
    expect(PAPER_GENERATOR_PROMPT).not.toContain('"paper_economy":');
    expect(PAPER_GENERATOR_PROMPT).toContain("top-level \"questions\" array");
  });
});

describe("AQA English Literature paper format", () => {
  test("prints an extract for both 30-mark essays and names the set texts", () => {
    const blueprint = buildPaperBlueprint({
      subject: "English Literature",
      level: "GCSE",
      examBoard: "AQA",
      tier: "Higher",
      poetryTheme: "Love & Relationships",
      // Older courses have no set-text fields; the pathway still names them.
      pathway: {
        units: [
          { title: "Shakespeare", topics: [{ title: "Macbeth" }] },
          { title: "The 19th Century Novel", topics: [{ title: "A Christmas Carol" }] },
        ],
      },
    });
    const slots = flattenPaperBlueprint(blueprint);

    expect(blueprint.id).toBe("english-literature-aqa-extract");
    expect(slots).toHaveLength(2);
    expect(slots.every((slot) => slot.marks === 30)).toBe(true);
    expect(slots.every((slot) => slot.extract === true)).toBe(true);
    expect(slots[0]!.ask).toContain("Starting with this extract");
    expect(slots[0]!.ask).toContain("Macbeth");
    expect(slots[0]!.ask).toContain("whole play");
    expect(slots[1]!.ask).toContain("A Christmas Carol");
    expect(slots[1]!.ask).toContain("whole novel");
    expect(blueprint.rules.join(" ")).toContain("150-250 words");
    expect(blueprint.rules.join(" ")).not.toContain("Do not reproduce an extract");
  });
});
