import { Loader2, TriangleAlert } from "lucide-react";
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEffect, useRef, useState } from "react";

// The PDF is parsed in a worker so scrolling stays smooth on a long paper.
GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Renders a PDF page by page.
 *
 * The browser's built-in PDF plugin was used here before, inside an `<iframe>`.
 * It behaves differently in every browser and, with a proxied file, commonly
 * stopped at the cover page, so the paper is drawn here instead: each page
 * becomes a canvas, all of them stacked in one scroll area. Every page of the
 * file is therefore reachable, whatever browser the student uses.
 *
 * Pages are only drawn when they come near the viewport — a 30-page paper
 * would otherwise allocate tens of megabytes of canvas up front.
 */
export function PdfViewer({ url, title }: { url: string; title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(720);

  // Load the file once per address. `disableRange` keeps the request a plain
  // cross-origin GET, which the paper route answers with CORS headers.
  useEffect(() => {
    let cancelled = false;
    setPdf(null);
    setError(null);
    const task = getDocument({ url, disableRange: true, disableStream: true });
    void (async () => {
      try {
        const loaded = await task.promise;
        if (!cancelled) setPdf(loaded);
      } catch (cause) {
        if (cancelled) return;
        setError(
          cause instanceof Error && cause.message
            ? cause.message
            : "This paper could not be opened.",
        );
      }
    })();
    return () => {
      cancelled = true;
      // Stops the worker and aborts the download; closing the paper should not
      // leave it loading in the background.
      void task.destroy();
    };
  }, [url]);

  // Draw at the width actually available, so the paper is readable without
  // horizontal scrolling on a laptop and still fits on a phone.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const measure = () => {
      const next = Math.max(280, Math.min(1000, node.clientWidth - 2));
      setWidth((current) => (Math.abs(current - next) < 8 ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const pageCount = pdf?.numPages ?? 0;

  return (
    <div ref={containerRef} className="w-full">
      {error ? (
        <div className="mx-auto mt-6 max-w-md rounded-2xl bg-[#FFF6E5] px-4 py-4 text-center">
          <TriangleAlert className="mx-auto size-5 text-[#8A5D00]" aria-hidden />
          <p className="mt-2 text-[0.84rem] font-semibold text-[#8A5D00]">
            This paper could not be shown here
          </p>
          <p className="mt-1 text-[0.78rem] leading-relaxed text-[#8A5D00]">
            {error}
          </p>
        </div>
      ) : !pdf ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <p className="flex items-center gap-2 text-[0.82rem] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Opening the paper…
          </p>
        </div>
      ) : (
        <div className="space-y-4 pb-8">
          {Array.from({ length: pageCount }, (_, index) => (
            <PdfPage
              key={index + 1}
              pdf={pdf}
              pageNumber={index + 1}
              pageCount={pageCount}
              width={width}
              title={title}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PdfPage({
  pdf,
  pageNumber,
  pageCount,
  width,
  title,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  pageCount: number;
  width: number;
  title: string;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(pageNumber <= 2);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const node = holderRef.current;
    if (!node || near) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    setDrawing(true);

    void (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const scale = Math.max(0.4, width / base.width);
        const viewport = page.getViewport({ scale });
        // Cap the pixel density: above 2x a paper page costs more memory than
        // it adds legibility.
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        task = page.render({
          canvas,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        await task.promise;
      } catch {
        // A cancelled render rejects; a page that genuinely fails to draw just
        // keeps its white placeholder rather than breaking the whole paper.
      } finally {
        if (!cancelled) setDrawing(false);
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNumber, width, near]);

  return (
    <figure className="mx-auto w-fit max-w-full">
      <div
        ref={holderRef}
        className="relative flex min-h-[160px] justify-center overflow-hidden rounded-xl border border-[#E3E4EC] bg-white shadow-[0_10px_30px_-24px_rgba(22,24,31,0.5)]"
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`${title}, page ${pageNumber}`}
          className="block max-w-full"
        />
        {drawing && (
          <span className="absolute inset-0 grid place-items-center bg-white/70">
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
          </span>
        )}
      </div>
      <figcaption className="mt-1.5 text-center text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Page {pageNumber} of {pageCount}
      </figcaption>
    </figure>
  );
}
