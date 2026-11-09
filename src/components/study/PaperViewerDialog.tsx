import {
  PdfViewer,
  type PdfViewerHandle,
} from "@/components/study/PdfViewer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { CONVEX_SITE_URL } from "@/lib/convexSite";
import { readableError } from "@/lib/errors";
import { safeExternalUrl } from "@/lib/safeExternalUrl";
import { cn } from "@/lib/utils";
import { useAction } from "convex/react";
import {
  ExternalLink,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Printer,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type ViewedPaper = {
  url: string;
  title: string;
  /** "Question paper", "Mark scheme", … */
  kind: string;
};

/**
 * Shows a publisher's paper inside Bluprint.
 *
 * The first open downloads the file into Convex storage, and later opens reuse
 * that copy. The viewer therefore does not depend on the publisher's CORS
 * policy or on its PDF viewer, and the same file works for every account.
 */
export function PaperViewerDialog({
  paper,
  onClose,
}: {
  paper: ViewedPaper | null;
  onClose: () => void;
}) {
  const cachePaper = useAction(api.paperFiles.cachePaper);
  const viewerRef = useRef<PdfViewerHandle>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [storedUrl, setStoredUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!paper) {
      setStoredUrl(null);
      setError(null);
      setLoading(false);
      setFullscreen(false);
      return;
    }

    let cancelled = false;
    setStoredUrl(null);
    setError(null);
    setLoading(true);

    void cachePaper({ url: paper.url })
      .then(({ storageId }) => {
        if (cancelled) return;
        setStoredUrl(
          `${CONVEX_SITE_URL}/paper-file?id=${encodeURIComponent(storageId)}`,
        );
      })
      .catch((cause) => {
        if (cancelled) return;
        setError(
          readableError(
            cause,
            "This paper could not be stored. Open the original instead.",
          ),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [paper, cachePaper]);

  const busy = Boolean(paper) && (loading || (!storedUrl && !error));

  return (
    <Dialog
      open={paper !== null}
      onOpenChange={(open) => {
        if (!open) {
          setFullscreen(false);
          onClose();
        }
      }}
    >
      <DialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          fullscreen
            ? "inset-0 top-0 left-0 h-[100dvh] max-h-none w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 sm:max-w-none"
            : "h-[90vh] max-h-[90vh] w-[calc(100%-1rem)] max-w-5xl rounded-3xl sm:w-[calc(100%-2rem)] sm:max-w-5xl",
        )}
      >
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-24 text-left">
          <DialogTitle className="flex items-center gap-2 font-display text-[1rem] font-bold text-brand-ink">
            <FileText className="size-4 shrink-0 text-[#B7791F]" aria-hidden />
            <span className="truncate">{paper?.title}</span>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem]">
            <span>{paper?.kind} from the exam board.</span>
            {paper && (
              <a
                href={safeExternalUrl(paper.url) ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-brand-ink underline decoration-chrome-4 underline-offset-2 hover:text-[#8A5A12]"
              >
                Open original
                <ExternalLink className="size-3" aria-hidden />
              </a>
            )}
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => setFullscreen((current) => !current)}
          aria-label={fullscreen ? "Exit full screen" : "View paper full screen"}
          title={fullscreen ? "Exit full screen" : "Full screen"}
          className="absolute top-4 right-14 z-10 grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-brand-panel hover:text-brand-ink focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/30 [&_svg]:size-4"
        >
          {fullscreen ? (
            <Minimize2 aria-hidden />
          ) : (
            <Maximize2 aria-hidden />
          )}
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white">
          {paper && busy && <ViewerLoading />}
          {paper && !busy && error && (
            <ViewerError message={error} url={paper.url} />
          )}
          {paper && !busy && !error && storedUrl && (
            <PdfViewer
              ref={viewerRef}
              key={storedUrl}
              url={storedUrl}
              title={`${paper.title} — ${paper.kind}`}
            />
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-brand-panel px-5 py-2.5">
          <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
            A stored copy is served from Bluprint so this paper opens reliably.
            Rights remain with the publisher; Open original opens their copy.
          </p>
          <button
            type="button"
            onClick={() => viewerRef.current?.print()}
            disabled={!storedUrl || busy}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-[0.74rem] font-semibold text-brand-ink shadow-none transition-colors hover:bg-brand-panel disabled:opacity-50"
          >
            <Printer className="size-3" aria-hidden />
            Print
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ViewerLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="space-y-4 p-5 pb-8"
    >
      <div className="mx-auto flex max-w-[720px] items-center gap-2 rounded-xl border border-border bg-brand-panel px-3 py-2 text-[0.78rem] font-semibold text-brand-ink">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Downloading this paper into Bluprint…
      </div>
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
  );
}

function ViewerError({ message, url }: { message: string; url: string }) {
  return (
    <div className="mx-auto mt-6 max-w-md rounded-2xl bg-[#FFF6E5] px-4 py-4 text-center">
      <TriangleAlert className="mx-auto size-5 text-[#8A5D00]" aria-hidden />
      <p className="mt-2 text-[0.84rem] font-semibold text-[#8A5D00]">
        This paper could not be shown here
      </p>
      <p className="mt-1 text-[0.78rem] leading-relaxed text-[#8A5D00]">
        {message}
      </p>
      <a
        href={safeExternalUrl(url) ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 font-semibold text-[#8A5D00] underline decoration-[#D9B36C] underline-offset-2 hover:text-brand-ink"
      >
        Open the original
        <ExternalLink className="size-3" aria-hidden />
      </a>
    </div>
  );
}
