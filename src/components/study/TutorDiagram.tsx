import DOMPurify, { type Config } from "dompurify";
import { useEffect, useId, useRef, useState } from "react";
import {
  diagramSourceIsUnsafe,
  type TutorDiagramFormat,
} from "@/lib/tutorDiagrams";

/**
 * SVG is rendered as SVG only after DOMPurify has removed active content,
 * external references and styling. The SVG profile still keeps shapes, text
 * and paths; scripts, foreignObject, images, links, event handlers and style
 * tags or attributes do not survive.
 */
const PURIFY_OPTIONS: Config = {
  USE_PROFILES: { svg: true, svgFilters: false },
  FORBID_TAGS: [
    "script",
    "style",
    "foreignObject",
    "foreignobject",
    "iframe",
    "object",
    "embed",
    "image",
    "a",
    "animate",
    "animateMotion",
    "animateTransform",
    "set",
  ],
  FORBID_ATTR: [
    "href",
    "xlink:href",
    "src",
    "style",
    "target",
    "formaction",
  ],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: true,
};

type MermaidApi = Awaited<typeof import("mermaid")>["default"];
let mermaidLoader: Promise<MermaidApi> | null = null;

function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidLoader) {
    mermaidLoader = import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "neutral",
        htmlLabels: false,
        suppressErrorRendering: true,
      });
      return mermaid;
    });
  }
  return mermaidLoader;
}

function sanitizeSvg(raw: string): string {
  const cleaned = DOMPurify.sanitize(raw, PURIFY_OPTIONS);
  return /<svg[\s>]/i.test(cleaned) ? cleaned : "";
}

/**
 * Mermaid normally carries its palette in a style tag, which the sanitiser
 * strips. This fixed stylesheet is ours, not the model's, and only restores
 * readable node fills, text and edges. No value here comes from the answer.
 */
const MERMAID_STYLE = `<style>
  .node rect, .node polygon, .node circle, .node ellipse, .cluster rect { fill: #eef6f1; stroke: #2f6b4f; stroke-width: 1.5; }
  .node .label rect, .node rect.background, .label rect { fill: transparent; stroke: none; }
  .node text, .edgeLabel, .edgeLabel text, .label text { fill: #1d2b24; color: #1d2b24; }
  .edgePaths path, .flowchart-link { fill: none; stroke: #4a5568; stroke-width: 1.5; }
  .arrowMarkerPath { fill: #4a5568; stroke: #4a5568; }
</style>`;

function styleMermaidSvg(svg: string): string {
  return svg.replace(/<svg\b([^>]*)>/i, `<svg$1>${MERMAID_STYLE}`);
}

/** A complete SVG with at least one drawable shape, not an empty or broken root. */
function svgSourceIsRenderable(source: string): boolean {
  const text = source
    .trim()
    .replace(/^<\?xml[\s\S]*?\?>\s*/i, "")
    .replace(/^<!--[\s\S]*?-->\s*/, "");
  if (!/^<svg\b[\s\S]*<\/svg>\s*$/i.test(text)) return false;

  const parsed = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = parsed.documentElement;
  if (
    !root ||
    root.tagName.toLowerCase() !== "svg" ||
    parsed.querySelector("parsererror")
  ) {
    return false;
  }
  return Boolean(
    root.querySelector("path, rect, circle, ellipse, line, polyline, polygon, text"),
  );
}

type RenderState =
  | { status: "loading" }
  | { status: "ready"; svg: string }
  | { status: "fallback" };

/**
 * One tutor diagram. SVG is sanitised directly; Mermaid is rendered with its
 * strict security level and then passes through the same sanitiser. Anything
 * that cannot be parsed or rendered remains visible as the model's original
 * diagram source.
 */
export function TutorDiagram({
  format,
  source,
}: {
  format: TutorDiagramFormat;
  source: string;
}) {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const renderCount = useRef(0);
  const [state, setState] = useState<RenderState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    const render = async () => {
      try {
        // Unsafe source is never parsed as a diagram: the student sees the
        // model's original text instead of a partly sanitised picture.
        if (diagramSourceIsUnsafe(source)) throw new Error("Unsafe diagram source.");
        if (format === "svg" && !svgSourceIsRenderable(source)) {
          throw new Error("Broken SVG source.");
        }

        const id = `tutor-diagram-${reactId}-${renderCount.current++}`;
        const raw =
          format === "mermaid"
            ? (await (await loadMermaid()).render(id, source)).svg
            : source;
        const svg = sanitizeSvg(raw);
        if (!svg) throw new Error("The diagram did not contain safe SVG.");
        if (!cancelled) {
          setState({
            status: "ready",
            svg: format === "mermaid" ? styleMermaidSvg(svg) : svg,
          });
        }
      } catch {
        if (!cancelled) setState({ status: "fallback" });
      }
    };

    void render();
    return () => {
      cancelled = true;
    };
  }, [format, reactId, source]);

  if (state.status === "ready") {
    return (
      <figure className="my-3 overflow-hidden rounded-xl border border-brand-sky/20 bg-white p-3">
        <div
          role="img"
          aria-label="Tutor diagram"
          className="mx-auto max-h-[360px] overflow-auto [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: state.svg }}
        />
      </figure>
    );
  }

  return (
    <figure className="my-3 overflow-hidden rounded-xl border border-border bg-brand-panel/60">
      <figcaption className="border-b border-border px-3 py-2 text-[0.68rem] font-semibold text-muted-foreground">
        {state.status === "loading"
          ? "Rendering diagram…"
          : "Diagram could not be rendered. Showing the source."}
      </figcaption>
      <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap break-words px-3 py-2.5 text-[0.72rem] leading-relaxed text-brand-ink/75">
        {source}
      </pre>
    </figure>
  );
}
