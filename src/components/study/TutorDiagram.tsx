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
        theme: "base",
        htmlLabels: false,
        suppressErrorRendering: true,
        fontFamily:
          '"IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        themeVariables: {
          fontFamily:
            '"IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          fontSize: "14px",
          primaryColor: "#ffffff",
          primaryTextColor: "#1b2430",
          primaryBorderColor: "#27313d",
          lineColor: "#697482",
          textColor: "#1b2430",
          mainBkg: "#ffffff",
          nodeBorder: "#27313d",
          clusterBkg: "#f8f5ee",
          clusterBorder: "#d2cabd",
          edgeLabelBackground: "#fdfcf8",
          actorBkg: "#fbfaf6",
          actorBorder: "#27313d",
          actorTextColor: "#1b2430",
          signalColor: "#697482",
          signalTextColor: "#1b2430",
          labelBoxBkgColor: "#f5f1e8",
          labelBoxBorderColor: "#cbc4b8",
        },
        flowchart: {
          useMaxWidth: true,
          curve: "basis",
          padding: 14,
          nodeSpacing: 38,
          rankSpacing: 48,
          diagramPadding: 6,
        },
        sequence: {
          useMaxWidth: true,
          mirrorActors: false,
          actorMargin: 48,
          messageMargin: 36,
          diagramMarginX: 18,
          diagramMarginY: 12,
          boxMargin: 8,
          actorFontSize: 13,
          actorFontWeight: 600,
          messageFontSize: 13,
          messageFontWeight: 500,
        },
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
 * strips. This fixed stylesheet is ours, not the model's: it turns Mermaid's
 * default output into a restrained textbook figure with soft paper panels,
 * crisp ink edges and a single accent for decisions. No value here comes from
 * the answer.
 */
const DIAGRAM_STYLE = `<style>
  svg { background: transparent; }
  text, .label, .nodeLabel, .edgeLabel, .cluster-label, .messageText, text.actor {
    font-family: "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .node rect, .node polygon, .node circle, .node ellipse, rect.actor, .labelBox {
    stroke: #27313d;
    stroke-width: 1.5px;
  }
  .node rect {
    fill: #ffffff;
    rx: 7px;
    ry: 7px;
  }
  .node polygon {
    fill: #fff4ec;
    stroke: #b84a22;
  }
  .node circle, .node ellipse {
    fill: #f5f1e8;
  }
  .node rect.background, .node .label rect, .label rect {
    fill: transparent;
    stroke: none;
  }
  .nodeLabel, .node .label, .node text, .labelText, .messageText,
  text.actor, text.actor > tspan, .cluster-label text, .cluster span, .edgeLabel text {
    fill: #1b2430;
    color: #1b2430;
    text-anchor: middle;
    font-family: "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 13px;
    font-weight: 500;
  }
  .cluster-label text, .cluster span {
    fill: #6f6658;
    color: #6f6658;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .cluster rect {
    fill: #f8f5ee;
    stroke: #d2cabd;
    stroke-width: 1px;
    stroke-dasharray: 4 4;
    rx: 10px;
    ry: 10px;
  }
  .edgePaths path, .flowchart-link, .messageLine0, .messageLine1 {
    fill: none;
    stroke: #697482;
    stroke-width: 1.6px;
  }
  .arrowMarkerPath, .arrowheadPath, #arrowhead path {
    fill: #697482;
    stroke: #697482;
  }
  .edgeLabel rect {
    fill: #fdfcf8;
    opacity: 0.96;
  }
  .edgeLabel text {
    fill: #4f5b68;
    font-size: 11px;
  }
  rect.actor {
    fill: #ffffff;
    filter: none !important;
  }
  .actor-line {
    stroke: #cbc4b8;
    stroke-width: 1px;
  }
  .labelBox {
    fill: #f5f1e8;
    stroke: #cbc4b8;
  }
  .sequenceNumber {
    fill: #8a6a55;
    font-size: 11px;
  }
</style>`;

/**
 * Mermaid renders at width=100%, which either shrinks a wide figure until its
 * labels are unreadable or stretches a compact sequence until they are huge.
 * Pin the SVG to its viewBox size: narrow figures still scale down to fit, while
 * genuinely wide ones scroll inside the card.
 */
const WIDE_DIAGRAM_PX = 900;
const DIAGRAM_FRAME =
  "my-4 overflow-hidden rounded-2xl border border-brand-ink/10 bg-[#fdfcf8] shadow-[0_18px_45px_-38px_rgba(17,21,31,0.6)]";
const DIAGRAM_CAPTION =
  "flex items-center gap-2 border-b border-[#e7e0d4] px-4 py-2.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[#7a7164]";

function sizeDiagramSvg(svg: string): { svg: string; wide: boolean } {
  const viewBox = svg.match(/\bviewBox="([^"]+)"/i)?.[1]?.trim().split(/[\s,]+/);
  const width = Number(viewBox?.[2]);
  const height = Number(viewBox?.[3]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { svg, wide: false };
  }
  return {
    wide: width > WIDE_DIAGRAM_PX,
    svg: svg.replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
      const cleaned = attrs.replace(/\s(?:width|height)="[^"]*"/gi, "");
      return `<svg${cleaned} width="${Math.ceil(width)}" height="${Math.ceil(height)}">${DIAGRAM_STYLE}`;
    }),
  };
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
  | { status: "ready"; svg: string; wide: boolean }
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
          const sized = sizeDiagramSvg(svg);
          setState({ status: "ready", svg: sized.svg, wide: sized.wide });
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

  if (state.status === "loading") {
    return (
      <figure className={DIAGRAM_FRAME}>
        <figcaption className={DIAGRAM_CAPTION}>
          <span className="size-1.5 rounded-full bg-[#c25a31]" aria-hidden />
          Diagram
        </figcaption>
        <div
          role="status"
          className="flex min-h-[148px] items-center justify-center gap-2.5 bg-[#fbfaf6] px-4 py-8 text-[0.76rem] text-[#7a7164]"
        >
          <span className="size-3.5 animate-spin rounded-full border-2 border-[#c9c1b4] border-t-[#c25a31]" />
          Preparing diagram…
        </div>
      </figure>
    );
  }

  if (state.status === "ready") {
    return (
      <figure className={DIAGRAM_FRAME}>
        <figcaption className={DIAGRAM_CAPTION}>
          <span className="size-1.5 rounded-full bg-[#c25a31]" aria-hidden />
          Diagram
        </figcaption>
        <div className="bg-[#fbfaf6] p-2">
          <div
            role="img"
            aria-label="Tutor diagram"
            className={`mx-auto overflow-auto [&_svg]:mx-auto [&_svg]:h-auto ${
              state.wide ? "[&_svg]:max-w-none" : "[&_svg]:max-w-full"
            }`}
            dangerouslySetInnerHTML={{ __html: state.svg }}
          />
        </div>
      </figure>
    );
  }

  return (
    <figure className="my-4 overflow-hidden rounded-2xl border border-border bg-brand-panel/60">
      <figcaption className="border-b border-border px-4 py-2.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Diagram unavailable · showing source
      </figcaption>
      <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap break-words px-4 py-3 text-[0.72rem] leading-relaxed text-brand-ink/75">
        {source}
      </pre>
    </figure>
  );
}
