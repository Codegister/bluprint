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
    expect(slots).toHaveLength(13);
    expect(blueprint.questionCount).toBe(13);
    expect(blueprint.candidateAnswers).toBe(2);
    expect(slots.every((slot) => slot.marks === 30)).toBe(true);
    expect(slots.every((slot) => slot.extract === true)).toBe(true);
    expect(slots.slice(0, 6).every((slot) => slot.ask.includes("Macbeth"))).toBe(true);
    expect(slots.slice(6).every((slot) => slot.ask.includes("A Christmas Carol"))).toBe(true);
    expect(slots[0]!.ask).toContain("Starting with this speech");
    expect(slots[0]!.ask).toContain("Write about:");
    expect(slots[0]!.ask).not.toContain("how does");
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

describe("Edexcel RS paper split", () => {
  const routeA = {
    subject: "Religious Studies",
    level: "GCSE",
    examBoard: "Pearson Edexcel",
    rsRoute: "Edexcel Religious Studies A",
    rsReligion: "Catholic Christianity",
    rsReligion2: "Judaism",
  };

  test("Paper 1 contains only the first religion", () => {
    const whole = buildPaperBlueprint(routeA);
    const paper1 = buildPaperBlueprint(routeA, "Paper 1");
    const slots = flattenPaperBlueprint(paper1);

    expect(whole.sections).toHaveLength(2);
    expect(paper1.sections).toHaveLength(1);
    expect(paper1.sections[0]!.title).toContain("Catholic Christianity");
    expect(paper1.sections[0]!.title).not.toContain("Judaism");
    expect(slots).toHaveLength(4);
    expect(slots.map((slot) => slot.marks)).toEqual([3, 4, 5, 12]);
    expect(paper1.id).toBe("rs-edexcel-a-p1");
    expect(paper1.id).not.toBe(whole.id);
  });

  test("Paper 2 contains only the second religion", () => {
    const paper2 = buildPaperBlueprint(routeA, "Paper 2");
    expect(paper2.sections).toHaveLength(1);
    expect(paper2.sections[0]!.title).toContain("Judaism");
    expect(paper2.sections[0]!.title).not.toContain("Catholic Christianity");
    expect(flattenPaperBlueprint(paper2)).toHaveLength(4);
  });

  test("Route B keeps each paper on its own Area of Study and religion", () => {
    const routeB = {
      ...routeA,
      rsRoute: "Edexcel Religious Studies B",
      rsSpec: "Religion and Ethics",
      rsSpec2: "Religion, Peace and Conflict",
    };
    const paper1 = buildPaperBlueprint(routeB, "Paper 1");
    const paper2 = buildPaperBlueprint(routeB, "Paper 2");

    expect(paper1.id).toBe("rs-edexcel-b-p1");
    expect(paper1.sections[0]!.title).toContain("Religion and Ethics");
    expect(paper1.sections[0]!.title).toContain("Catholic Christianity");
    expect(paper1.sections[0]!.title).not.toContain("Judaism");
    expect(paper2.sections[0]!.title).toContain("Religion, Peace and Conflict");
    expect(paper2.sections[0]!.title).toContain("Judaism");
  });
});
