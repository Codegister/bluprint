/**
 * Splits a tutor answer into prose and its diagram fences.
 *
 * Only complete ```svg and ```mermaid fences become diagrams. An unfinished
 * fence (common while a reply is still streaming) and every other code fence
 * stay in the plain-text stream, so a bad or partial diagram is always
 * readable rather than disappearing.
 */

export type TutorDiagramFormat = "svg" | "mermaid";

export type TutorSegment =
  | { type: "text"; text: string }
  | { type: "diagram"; format: TutorDiagramFormat; source: string };

const DIAGRAM_FENCE = /```(svg|mermaid)[ \t]*\r?\n([\s\S]*?)```/gi;

/** Active content that must never be handed to an SVG renderer. */
const UNSAFE_DIAGRAM_MARKUP = [
  /<\s*(?:script|foreignObject|iframe|object|embed|image|style|a|animate|animateMotion|animateTransform|set)\b/i,
  /<![ \t]*(?:doctype|entity)\b/i,
  /\bon[a-z]+\s*=/i,
  /\b(?:href|xlink:href|src|formaction)\s*=/i,
  /\bstyle\s*=/i,
  /javascript\s*:/i,
];

/**
 * False means the diagram source is plain shapes, text or Mermaid syntax.
 * True means the renderer should fall back to the source instead of trying to
 * remove active content. This check runs before Mermaid or SVG sees the text.
 */
export function diagramSourceIsUnsafe(source: string): boolean {
  return UNSAFE_DIAGRAM_MARKUP.some((pattern) => pattern.test(source));
}

export function parseTutorContent(content: string): TutorSegment[] {
  const segments: TutorSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(DIAGRAM_FENCE)) {
    const index = match.index ?? 0;
    const source = (match[2] ?? "").trim();
    // An empty fence is not a diagram; leave it in the prose so the student
    // still sees exactly what the model wrote.
    if (!source) continue;

    const before = content.slice(lastIndex, index);
    if (before) segments.push({ type: "text", text: before });
    segments.push({
      type: "diagram",
      format: (match[1] ?? "").toLowerCase() === "svg" ? "svg" : "mermaid",
      source,
    });
    lastIndex = index + match[0].length;
  }

  const after = content.slice(lastIndex);
  if (after) segments.push({ type: "text", text: after });
  return segments;
}
