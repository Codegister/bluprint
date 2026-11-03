import { describe, expect, test } from "bun:test";

import {
  PAPER_CHECKLIST,
  PAPER_CHECKLIST_AQA_LIT,
  PAPER_FORMAT_GUIDELINE,
  PAPER_GENERATOR_PROMPT,
  PAPER_GENERATOR_SYSTEM_MESSAGE,
} from "../src/convex/lib/paperGenerator";

type Table = {
  header: string[];
  rows: Array<Record<string, string>>;
};

function parseTable(text: string): Table {
  const lines = text.split("\n").filter((line) => line.startsWith("|"));
  const header = lines[0]!.split("|").slice(1, -1).map((cell) => cell.trim());
  const rows = lines
    .slice(2)
    .filter((line) => /^\| R\d+ \|/.test(line))
    .map((line) => {
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      return Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""]));
    });
  return { header, rows };
}

const general = parseTable(PAPER_CHECKLIST);
const aqa = parseTable(PAPER_CHECKLIST_AQA_LIT);
const row = (id: string) => {
  const found = general.rows.find((candidate) => candidate.checklist_id === id);
  if (!found) throw new Error(`Missing checklist row ${id}`);
  return found;
};

describe("paper checklist schema", () => {
  test("keeps every general row at the declared 35-column width", () => {
    expect(general.header).toHaveLength(35);
    expect(general.rows).toHaveLength(45);
    for (const entry of general.rows) {
      expect(Object.values(entry)).toHaveLength(35);
    }
  });

  test("keeps the detailed AQA Literature row at 57 cells with no escaped pipes", () => {
    expect(aqa.header).toHaveLength(57);
    expect(aqa.rows).toHaveLength(1);
    expect(Object.values(aqa.rows[0]!)).toHaveLength(57);
    expect(PAPER_CHECKLIST_AQA_LIT).not.toContain("\\|");
  });

  test("has the routing fields the v3 prompt needs on the AQA row", () => {
    const entry = aqa.rows[0]!;
    expect(entry.component_type).toBe("written");
    expect(entry.medium).toBe("text");
    expect(entry.marks_status).toBe("SPEC_CHECKED");
    expect(entry.subject_aliases).toContain("English Literature");
    expect(entry.lookup_key).not.toContain("|");
    expect(entry.tier).toBe("untiered");
  });
});

describe("cross-board specification snapshots", () => {
  test("AQA English Language uses the current reading tariffs", () => {
    expect(row("R08").tariffs).toBe("4; 8; 8; 20; 40");
    expect(row("R09").tariffs).toBe("4; 8; 12; 16; 40");
  });

  test("Eduqas Component 2 has six reading questions and two writing tasks", () => {
    expect(row("R19").structure).toContain("six reading questions");
    expect(row("R19").structure).toContain("two 20-mark transactional writing tasks");
  });

  test("Cambridge 0580 has two papers per tier with the correct economy", () => {
    expect(row("R20")).toMatchObject({ duration_min: "90", total_marks: "80" });
    expect(row("R21")).toMatchObject({ duration_min: "120", total_marks: "100" });
    expect(row("R44")).toMatchObject({ duration_min: "90", total_marks: "80" });
    expect(row("R45")).toMatchObject({ duration_min: "120", total_marks: "100" });
  });

  test("Edexcel GCSE History uses the summer 2025 timings and weightings", () => {
    expect(row("R27")).toMatchObject({ duration_min: "80", weight_pct: "30.95" });
    expect(row("R28")).toMatchObject({ duration_min: "110", weight_pct: "38.10" });
    expect(row("R29")).toMatchObject({ duration_min: "90", weight_pct: "30.95" });
  });

  test("AQA GCSE Spanish splits Foundation and Higher listening", () => {
    expect(row("R30")).toMatchObject({ duration_min: "35", total_marks: "40" });
    expect(row("R43")).toMatchObject({ duration_min: "45", total_marks: "50" });
  });

  test("AQA A-level History and Spanish have the correct tariffs and weightings", () => {
    expect(row("R33").tariffs).toBe("30; 25; 25");
    expect(row("R41").weight_pct).toBe("50");
  });

  test("AQA A-level English Literature is open book only in Section C", () => {
    expect(row("R37").materials).toContain("open book in Section C only");
  });

  test("OCR A-level Computer Science and GCSE Maths have the correct rules", () => {
    expect(row("R40").weight_pct).toBe("40");
    expect(row("R42").component).toContain("(calculator)");
    expect(row("R42").materials).toBe("calculator permitted");
  });

  test("AQA Literature row has the current tariff, stimulus and command words", () => {
    const entry = aqa.rows[0]!;
    expect(entry.tariff_ladder).toBe("30 + 4 SPaG; 30");
    expect(entry.stimulus_length).toContain("300-400");
    expect(entry.stimulus_length).not.toContain("350-450");
    expect(entry.command_words).not.toContain("Compare");
  });
});

describe("guideline and prompt corrections", () => {
  test("uses the current Edexcel History timing and AQA science structure", () => {
    expect(PAPER_FORMAT_GUIDELINE).toContain("52 marks in 80 minutes");
    expect(PAPER_FORMAT_GUIDELINE).toContain("Combined Science: Trilogy has six papers");
    expect(PAPER_FORMAT_GUIDELINE).toContain("75 marks in\n    180 minutes");
  });

  test("documents both checklist shapes and their tick sets", () => {
    expect(PAPER_GENERATOR_PROMPT).toContain("0. CHECKLIST SCHEMAS");
    expect(PAPER_GENERATOR_PROMPT).toContain("Shape A - 35 columns");
    expect(PAPER_GENERATOR_PROMPT).toContain("Shape B - 57 columns");
    expect(PAPER_GENERATOR_PROMPT).toContain("Shape A has 14 ticks");
    expect(PAPER_GENERATOR_SYSTEM_MESSAGE).toContain("row's authenticity checks");
    expect(PAPER_GENERATOR_SYSTEM_MESSAGE).not.toContain("sixteen authenticity checks");
  });
});
