import { describe, expect, test } from "bun:test";
import {
  diagramSourceIsUnsafe,
  parseTutorContent,
} from "../src/lib/tutorDiagrams";

describe("tutor diagram parsing", () => {
  test("leaves ordinary prose as one text segment", () => {
    expect(parseTutorContent("Enzymes lower activation energy.")).toEqual([
      { type: "text", text: "Enzymes lower activation energy." },
    ]);
  });

  test("recognises a complete Mermaid fence", () => {
    const content = [
      "Here is the cycle:",
      "```mermaid",
      "flowchart LR",
      "  A[Substrate] --> B[Product]",
      "```",
      "The enzyme is unchanged.",
    ].join("\n");

    expect(parseTutorContent(content)).toEqual([
      { type: "text", text: "Here is the cycle:\n" },
      {
        type: "diagram",
        format: "mermaid",
        source: "flowchart LR\n  A[Substrate] --> B[Product]",
      },
      { type: "text", text: "\nThe enzyme is unchanged." },
    ]);
  });

  test("recognises a complete SVG fence", () => {
    const content =
      "```svg\n<svg viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4\" /></svg>\n```";

    expect(parseTutorContent(content)).toEqual([
      {
        type: "diagram",
        format: "svg",
        source: '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>',
      },
    ]);
  });

  test("keeps an unfinished fence as plain text while streaming", () => {
    const content = "A diagram follows:\n```mermaid\nflowchart LR\n  A --> B";
    expect(parseTutorContent(content)).toEqual([{ type: "text", text: content }]);
  });

  test("keeps unknown and empty fences as plain text", () => {
    const unknown = "```js\nconst x = 1;\n```";
    const empty = "```mermaid\n\n```";
    expect(parseTutorContent(unknown)).toEqual([{ type: "text", text: unknown }]);
    expect(parseTutorContent(empty)).toEqual([{ type: "text", text: empty }]);
  });

  test("handles more than one diagram in one answer", () => {
    const content =
      "First:\n```svg\n<svg><rect width=\"2\" height=\"2\" /></svg>\n```\nSecond:\n```mermaid\ngraph TD\nA-->B\n```";
    const segments = parseTutorContent(content);
    expect(segments.filter((segment) => segment.type === "diagram")).toHaveLength(2);
  });

  test("flags active markup but accepts simple shapes and Mermaid", () => {
    expect(
      diagramSourceIsUnsafe('<svg><script>alert(1)</script><rect /></svg>'),
    ).toBe(true);
    expect(
      diagramSourceIsUnsafe('<svg onload="alert(1)"><rect /></svg>'),
    ).toBe(true);
    expect(
      diagramSourceIsUnsafe('<svg><rect fill="#e8f3ec" width="2" height="2" /></svg>'),
    ).toBe(false);
    expect(diagramSourceIsUnsafe("flowchart LR\n  A --> B")).toBe(false);
  });
});
