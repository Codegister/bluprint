import { EASE, reveal } from "@/components/motion/Motion";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PdfViewer } from "@/components/study/PdfViewer";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cognitoPaperProxyUrl } from "@/lib/convexSite";
import { readableError } from "@/lib/errors";
import { useAction, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { FileText, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * The real past papers Cognito publishes for a course, shown inside Bluprint.
 *
 * Each row is one board paper with its mark scheme. The PDFs are read through
 * the app's own proxy so they can be viewed here; nothing links out to the
 * Cognito site. The files belong to the exam boards and Cognito, so they are
 * presented as published reference material, not as Bluprint's own questions.
 */
export function CognitoRealPapers({
  courseId,
  enabled,
}: {
  courseId: Id<"courses">;
  /** False for a course with no published Cognito page to read. */
  enabled: boolean;
}) {
  const cached = useQuery(api.cognitoLibrary.getPastPapers, { courseId });
  const load = useAction(api.cognitoLibrary.loadPastPapers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{
    title: string;
    url: string;
  } | null>(null);
  const started = useRef(false);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await load({ courseId });
    } catch (cause) {
      setError(
        readableError(cause, "Cognito's past papers could not be read just now."),
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    // Load once when the section first appears; the cached list is reactive.
    if (!enabled || started.current || cached === undefined || cached !== null) {
      return;
    }
    started.current = true;
    void run();
  });

  if (!enabled) return null;

  const papers = cached?.papers ?? [];
  const years = [...new Set(papers.map((paper) => paper.year))];

  return (
    <motion.section
      className="mt-4 rounded-[2rem] border border-border bg-white p-5 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-6"
      {...reveal()}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-chrome-7">
            Real past papers
          </p>
          <h2 className="mt-1 font-display text-[1.1rem] font-bold text-brand-ink">
            The actual board papers
          </h2>
          <p className="mt-1 max-w-2xl text-[0.84rem] leading-relaxed text-muted-foreground">
            Published by Cognito for this course, opened in the app. Read the
            question paper here, then check your answers against the board&apos;s
            own mark scheme.
          </p>
        </div>
        <span className="rounded-full bg-brand-panel px-3 py-1.5 text-[0.7rem] font-semibold text-chrome-7">
          {papers.length > 0
            ? `${papers.length} paper${papers.length === 1 ? "" : "s"}`
            : "Cognito"}
        </span>
      </div>

      {(busy || cached === undefined) && (
        <div role="status" aria-busy="true" className="mt-4 space-y-2">
          <span className="sr-only">
            Reading Cognito&apos;s past-paper list for this course
          </span>
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              aria-hidden="true"
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-[#FCFCFD] px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Skeleton className="size-4 shrink-0 rounded" />
                <Skeleton className="h-3 w-2/5" />
              </div>
              <Skeleton className="h-7 w-28 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <motion.div
          key={error}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="mt-4 rounded-2xl bg-[#FFF6E5] px-4 py-3"
        >
          <p className="text-[0.8rem] leading-relaxed text-[#8A5D00]">{error}</p>
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[0.72rem] font-semibold text-[#8A5D00]"
          >
            <RotateCcw className="size-3" aria-hidden />
            Try again
          </button>
        </motion.div>
      )}

      {!busy && !error && cached && papers.length === 0 && (
        <p className="mt-4 rounded-2xl border border-dashed border-border bg-brand-panel px-4 py-4 text-[0.8rem] leading-relaxed text-muted-foreground">
          Cognito does not list published papers for this course yet. Build a
          practice paper above to work in this subject&apos;s real format
          instead.
        </p>
      )}

      {!busy && papers.length > 0 && (
        <div className="mt-4 space-y-4">
          {years.map((year) => (
            <div key={year}>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {year}
              </p>
              <ul className="rise-stagger mt-1.5 grid gap-2">
                {papers
                  .filter((paper) => paper.year === year)
                  .map((paper) => (
                    <li
                      key={`${year}-${paper.label}`}
                      className="flex flex-col gap-2 rounded-2xl border border-border bg-[#FCFCFD] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText
                          className="size-4 shrink-0 text-[#B7791F]"
                          aria-hidden
                        />
                        <p className="text-[0.86rem] font-semibold text-brand-ink">
                          {year} · {paper.label}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setViewing({
                              title: `${year} ${paper.label} question paper`,
                              url: paper.questionUrl,
                            })
                          }
                          className="h-8 rounded-full border-border bg-white px-3 text-[0.74rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
                        >
                          Question paper
                        </Button>
                        {paper.markSchemeUrl && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              setViewing({
                                title: `${year} ${paper.label} mark scheme`,
                                url: paper.markSchemeUrl!,
                              })
                            }
                            className="h-8 rounded-full border-border bg-white px-3 text-[0.74rem] font-semibold text-[#0B6B45] shadow-none hover:bg-brand-panel"
                          >
                            Mark scheme
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-[0.7rem] leading-relaxed text-muted-foreground">
        Papers and mark schemes are published by the exam boards and hosted by
        Cognito, shown here as reference material; all rights remain with the
        publisher. For practice written for Bluprint, use the paper builder
        above. Rights holders can request removal through the{" "}
        <a
          href="https://github.com/Codegister/bluprint/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline decoration-chrome-4 underline-offset-2 hover:text-brand-ink"
        >
          project issue tracker
        </a>
        .
      </p>

      <Dialog
        open={viewing !== null}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      >
        {/*
          The paper opens full screen: a paper needs the whole viewport to show
          a page at a readable size, and the pages themselves are drawn by
          `PdfViewer` rather than by the browser's PDF plugin.
        */}
        <DialogContent
          showCloseButton={false}
          className="h-[100dvh] max-h-[100dvh] w-screen max-w-none gap-0 rounded-none border-0 bg-[#F4F4F7] p-0 sm:max-w-none"
          // A header row plus a scrolling viewer that takes every other pixel.
          style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)" }}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-white px-4 py-2.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="size-4 shrink-0 text-[#B7791F]" aria-hidden />
              <DialogTitle className="truncate font-display text-[0.9rem] font-bold leading-tight text-brand-ink">
                {viewing?.title ?? "Past paper"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                The board&apos;s published paper, served through Bluprint.
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                aria-label="Close the paper"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-panel text-brand-ink/70 transition-colors hover:bg-[#E7E7EE] hover:text-brand-ink"
              >
                <X className="size-4" aria-hidden />
              </button>
            </DialogClose>
          </header>

          <div className="min-h-0 overflow-y-auto px-3 py-4 sm:px-5">
            {viewing && (
              <PdfViewer
                key={viewing.url}
                url={cognitoPaperProxyUrl(viewing.url)}
                title={viewing.title}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.section>
  );
}
