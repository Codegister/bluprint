import { describe, expect, test } from "bun:test";

import {
  buildPaperBlueprint,
  flattenPaperBlueprint,
} from "../src/convex/lib/paperBlueprint";

import { knownLiteratureExtract } from "../src/convex/lib/literatureExtracts";

import {
  PAPER_CHECKLIST,
  PAPER_FORMAT_GUIDELINE,
  PAPER_GENERATOR_PROMPT,
  paperGeneratorSystemMessage,
} from "../src/convex/lib/paperGenerator";

const SYSTEM_MESSAGE = paperGeneratorSystemMessage(PAPER_CHECKLIST);

describe("paper generator context", () => {
  test("includes the supplied prompt, guideline and every checklist row", () => {
    expect(PAPER_GENERATOR_PROMPT).toContain("BLUPRINT PRACTICE PAPER GENERATOR (v3)");
    expect(PAPER_GENERATOR_PROMPT).toContain("Accuracy of format beats richness");
    expect(PAPER_FORMAT_GUIDELINE).toContain("END OF GUIDELINE");
    const rows = PAPER_CHECKLIST.split("\n").filter((line) =>
      /^\| R\d+ \|/.test(line),
    );
    expect(rows).toHaveLength(45);
    for (const row of rows) {
      expect(row.split("|").length - 2).toBe(35);
    }
  });

  test("uses the supplied documents and keeps the paper grid authoritative", () => {
    expect(SYSTEM_MESSAGE).toContain(
      "paper_format_guideline.txt",
    );
    expect(SYSTEM_MESSAGE).toContain("paper_checklist.csv");
    expect(SYSTEM_MESSAGE).toContain(
      "BLUPRINT INTEGRATION CONTRACT",
    );
    expect(SYSTEM_MESSAGE).toContain(
      "not expand a paper beyond that grid",
    );
    expect(SYSTEM_MESSAGE).not.toContain("reference_paper");
    expect(PAPER_GENERATOR_PROMPT).not.toContain('"paper_economy":');
    expect(SYSTEM_MESSAGE).toContain('{"questions"');
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
    expect(blueprint.totalMarks).toBe(64);
    expect(blueprint.spagMarks).toBe(4);
    expect(blueprint.durationMinutes).toBe(105);
    expect(slots).toHaveLength(2);
    expect(slots.every((slot) => slot.marks === 30)).toBe(true);
    expect(slots.every((slot) => slot.extract === true)).toBe(true);
    expect(slots[0]!.ask).toContain("Starting with this extract");
    expect(slots[0]!.ask).toContain("Macbeth");
    expect(slots[0]!.ask).toContain("whole play");
    expect(slots[1]!.ask).toContain("A Christmas Carol");
    expect(slots[1]!.ask).toContain("whole novel");
    expect(blueprint.rules.join(" ")).toContain("300-400 words");
    expect(blueprint.rules.join(" ")).not.toContain("Do not reproduce an extract");
  });

  test("uses exact, long, non-repeating extracts for the known set texts", () => {
    const christmas = knownLiteratureExtract("A Christmas Carol");
    const macbeth = knownLiteratureExtract("Macbeth");
    expect(christmas).not.toBeNull();
    expect(macbeth).not.toBeNull();

    const christmasText = christmas!.text;
    expect(christmasText).toContain("tight-fisted hand at the grind-stone");
    expect(christmasText).toContain("But what did Scrooge care!");
    expect(christmasText).not.toContain("The misery with which");
    expect(christmasText.trim().split(/\s+/).length).toBeGreaterThanOrEqual(300);
    expect(macbeth!.text).toContain("Vaulting ambition");
    expect(macbeth!.text.trim().split(/\s+/).length).toBeGreaterThanOrEqual(200);

    for (const text of [christmasText, macbeth!.text]) {
      const sentences = text.match(/[^.!?]+[.!?]+(?:["'”’)\]]+)?/g) ?? [];
      const keys = sentences
        .map((sentence) =>
          sentence
            .toLowerCase()
            .replace(/[^a-z0-9 ]+/g, " ")
            .replace(/\s+/g, " ")
            .trim(),
        )
        .filter((key) => key.length >= 40);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});
