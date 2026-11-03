import { Skeleton } from "@/components/ui/skeleton";
import { readableError } from "@/lib/errors";
import { TriangleAlert } from "lucide-react";
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

// The PDF is parsed in a worker so scrolling stays smooth on a long paper.
GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfViewerHandle = {
  /** Renders every page, then opens the browser's print dialog. */
  print: () => void;
};

/**
 * Renders a PDF page by page.
 *
 * The browser's built-in PDF plugin was used here before, inside an `<iframe>`.
 * It behaves differently in every browser and, with a proxied file, commonly
 * stopped at the cover page, so the paper is drawn here instead: each page
 * becomes a canvas, all of them stacked in one scroll area. Every page of the
 * file is therefore reachable, whatever browser the student uses.
 *
 * Pages are only drawn when they come near the viewport. A 30-page paper
 * would otherwise allocate tens of megabytes of canvas up front.
 */
export const PdfViewer = forwardRef<
  PdfViewerHandle,
  { url: string; title: string }
>(function PdfViewer({ url, title }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(720);
  const [printAll, setPrintAll] = useState(false);
  const [readyPages, setReadyPages] = useState<Set<number>>(() => new Set());

  useImperativeHandle(
    ref,
    () => ({
      print: () => {
        // A new print run must wait for this run's canvases, not the canvases
        // from a previous print.
        setReadyPages(new Set());
        setPrintAll(true);
      },
    }),
    [],
  );

  const pageReady = useCallback((pageNumber: number) => {
    setReadyPages((current) => {
      if (current.has(pageNumber)) return current;
      const next = new Set(current);
      next.add(pageNumber);
      return next;
    });
  }, []);

  // Load the file once per address. `disableRange` keeps the request a plain
  // GET to Bluprint's cached-paper route rather than a ranged CDN request.
  useEffect(() => {
    let cancelled = false;
    setPdf(null);
    setError(null);
    setPrintAll(false);
    setReadyPages(new Set());
    const task = getDocument({ url, disableRange: true, disableStream: true });
    void (async () => {
      try {
        const loaded = await task.promise;
        if (!cancelled) setPdf(loaded);
      } catch (cause) {
        if (cancelled) return;
        // PDF.js reports its own parser errors ("Invalid PDF structure",
        // worker paths). They are logged and replaced with a sentence.
        setError(readableError(cause, "This paper could not be opened."));
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

  useEffect(() => {
    if (!printAll || !pdf || readyPages.size < pdf.numPages) return;
    const frame = window.requestAnimationFrame(() => {
      window.print();
      setPrintAll(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [printAll, pdf, readyPages]);

  return (
    <>
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
        <div
          role="status"
          aria-busy="true"
          aria-live="polite"
          className="space-y-4 pb-8"
        >
          <span className="sr-only">Opening the paper</span>
          {[0, 1].map((index) => (
            <div
              key={index}
              aria-hidden="true"
              className="mx-auto w-full max-w-[720px] space-y-3 rounded-xl border border-border bg-card p-6"
            >
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-2.5 w-full" />
              <Skeleton className="h-2.5 w-11/12" />
              <Skeleton className="h-2.5 w-4/5" />
              <Skeleton className="mt-4 h-24 w-full rounded-lg" />
            </div>
          ))}
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
      {printAll && pdf
        ? createPortal(
            <div className="pdf-print-root" aria-hidden="true">
              {Array.from({ length: pdf.numPages }, (_, index) => (
                <PdfPage
                  key={`print-${index + 1}`}
                  pdf={pdf}
                  pageNumber={index + 1}
                  pageCount={pdf.numPages}
                  width={width}
                  title={title}
                  forceRender
                  onReady={pageReady}
                />
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
});

function PdfPage({
  pdf,
  pageNumber,
  pageCount,
  width,
  title,
  forceRender = false,
  onReady,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  pageCount: number;
  width: number;
  title: string;
  forceRender?: boolean;
  onReady?: (pageNumber: number) => void;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(pageNumber <= 2);
  const [drawing, setDrawing] = useState(false);
  const shouldRender = near || forceRender;

  useEffect(() => {
    const node = holderRef.current;
    if (!node || shouldRender) return;
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
  }, [shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;
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
        if (!cancelled) {
          setDrawing(false);
          onReady?.(pageNumber);
        }
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNumber, width, shouldRender, onReady]);

  return (
    <figure className="mx-auto w-fit max-w-full">
      <div
        ref={holderRef}
        className="relative flex min-h-[160px] justify-center overflow-hidden rounded-xl border border-border bg-white"
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`${title}, page ${pageNumber}`}
          className="block max-w-full"
        />
        {drawing && (
          <span
            aria-busy="true"
            className="absolute inset-0 grid place-items-center bg-card/80"
          >
            <span className="sr-only">Drawing page {pageNumber}</span>
            <span aria-hidden="true" className="absolute inset-3 animate-pulse rounded-lg bg-brand-panel" />
          </span>
        )}
      </div>
      <figcaption className="mt-1.5 text-center text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Page {pageNumber} of {pageCount}
      </figcaption>
    </figure>
  );
}
