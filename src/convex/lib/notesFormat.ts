/**
 * Presentation rules shared by the Save My Exams parser and the notes reader.
 *
 * Extracted notes arrive as portable-text blocks. A list item must keep the
 * separator that says it is a list, and a table row must keep its cells apart;
 * flattening either into prose is what made "eukaryotic prokaryotic" and
 * "Cell membrane · Y · Y" unreadable.
 */

export type NotesBlock =
  | { kind: "bullet"; text: string }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "paragraph"; text: string };

/** A table row is written with pipes so its cell boundaries survive storage. */
export function tableRow(cells: string[]): string {
  return `| ${cells.map((cell) => cell.replace(/\|/g, "/").trim()).join(" | ")} |`;
}

export function parseTableRow(line: string): string[] | null {
  const text = line.trim();
  if (!text.startsWith("|") || !text.endsWith("|")) return null;
  const cells = text
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);
  return cells.length >= 2 ? cells : null;
}

/** Empty figure captions are not notes. They point at an image we do not show. */
export function isOrphanFigure(line: string): boolean {
  return /^figure\s*:/i.test(line.trim());
}

/**
 * Reads one stored line. Consecutive table rows are grouped by the caller, so
 * the first row becomes the header and the rest become body rows.
 */
export function readNotesBlock(line: string): NotesBlock | null {
  const text = line.replace(/\s+/g, " ").trim();
  if (!text || isOrphanFigure(text)) return null;

  const cells = parseTableRow(text);
  if (cells) return { kind: "table", header: cells, rows: [] };

  if (text.startsWith("•")) {
    const body = text.replace(/^•\s*/, "").trim();
    return body ? { kind: "bullet", text: body } : null;
  }
  return { kind: "paragraph", text };
}

/** Groups table rows so the reader can draw one table rather than N lines. */
export function groupNotesBlocks(lines: string[]): NotesBlock[] {
  const blocks: NotesBlock[] = [];
  for (const line of lines) {
    const block = readNotesBlock(line);
    if (!block) continue;
    if (block.kind === "table") {
      const previous = blocks[blocks.length - 1];
      if (previous?.kind === "table" && previous.rows.length === 0) {
        previous.rows.push(block.header);
        continue;
      }
      if (previous?.kind === "table") {
        // A new table starts only when the cell count changes; otherwise this
        // row belongs to the table already open.
        if (previous.header.length === block.header.length) {
          previous.rows.push(block.header);
          continue;
        }
      }
      blocks.push(block);
      continue;
    }
    blocks.push(block);
  }
  return blocks;
}
