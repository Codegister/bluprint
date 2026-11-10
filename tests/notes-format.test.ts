import { describe, expect, test } from "bun:test";

import {
  groupNotesBlocks,
  parseTableRow,
  readNotesBlock,
  tableRow,
} from "../src/convex/lib/notesFormat";

describe("notes presentation", () => {
  test("table cells keep their boundaries", () => {
    const line = tableRow(["Feature", "Animal cell", "Plant cell"]);
    expect(line).toBe("| Feature | Animal cell | Plant cell |");
    expect(parseTableRow(line)).toEqual(["Feature", "Animal cell", "Plant cell"]);
    expect(parseTableRow("Cell membrane · Y · Y")).toBeNull();
  });

  test("a table is grouped into a header and body rows", () => {
    const blocks = groupNotesBlocks([
      "| Feature | Plant cell |",
      "| Cell wall | Y |",
      "| Chloroplast | Y |",
      "Cells have a nucleus.",
    ]);
    expect(blocks[0]).toMatchObject({
      kind: "table",
      header: ["Feature", "Plant cell"],
      rows: [
        ["Cell wall", "Y"],
        ["Chloroplast", "Y"],
      ],
    });
    expect(blocks[1]).toEqual({
      kind: "paragraph",
      text: "Cells have a nucleus.",
    });
  });

  test("list items keep their separator and orphan figure captions are dropped", () => {
    expect(readNotesBlock("• eukaryotic cells")).toEqual({
      kind: "bullet",
      text: "eukaryotic cells",
    });
    expect(readNotesBlock("Figure: all cells have features in common")).toBeNull();
    expect(readNotesBlock("two distinct types: eukaryotic prokaryotic")).toEqual({
      kind: "paragraph",
      text: "two distinct types: eukaryotic prokaryotic",
    });
  });
});
