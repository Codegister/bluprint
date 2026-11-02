import { describe, expect, test } from "bun:test";

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
  });
});
