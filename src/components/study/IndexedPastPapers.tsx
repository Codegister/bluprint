import { EASE } from "@/components/motion/Motion";
import {
  PaperViewerDialog,
  type ViewedPaper,
} from "@/components/study/PaperViewerDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { useAction, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Eye, FileText, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * The real past papers a publisher's course listing indexes for a course.
 *
 * Each row opens the exam board's paper or mark scheme inside Bluprint. The
 * first open downloads the file into Bluprint's storage; later opens reuse
 * that copy. The original link is always available in the viewer.
 */
export function IndexedPastPapers({ courseId }: { courseId: Id<"courses"> }) {
  const cached = useQuery(api.cognitoLibrary.getPastPapers, { courseId });
  const load = useAction(api.cognitoLibrary.loadPastPapers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ViewedPaper | null>(null);
  const started = useRef(false);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await load({ courseId });
    } catch (cause) {
      setError(
        readableError(
          cause,
          "The past-paper index could not be read just now.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    // Load once when the section first appears; the cached list is reactive.
    if (started.current || cached === undefined || cached !== null) return;
    started.current = true;
    void run();
  });

  const papers = cached?.papers ?? [];
  const years = [...new Set(papers.map((paper) => paper.year))];

  return (
    <section className="indexed-papers mt-4 rounded-[2rem] border border-border bg-white p-5 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-chrome-7">
            Real past papers
          </p>
          <h2 className="mt-1 font-display text-[1.1rem] font-bold text-brand-ink">
            The actual board papers
          </h2>
          <p className="mt-1 max-w-2xl text-[0.84rem] leading-relaxed text-muted-foreground">
            Indexed from the publisher&apos;s course listing. Open the exam
            board&apos;s question paper and mark scheme here, without leaving
            Bluprint.
          </p>
        </div>
        <span className="rounded-full bg-brand-panel px-3 py-1.5 text-[0.7rem] font-semibold text-chrome-7">
          {papers.length > 0
            ? `${papers.length} paper${papers.length === 1 ? "" : "s"}`
            : "Paper index"}
        </span>
      </div>

      {(busy || cached === undefined) && (
        <div role="status" aria-busy="true" className="mt-4 space-y-2">
          <span className="sr-only">
            Reading the past-paper list for this course
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
          No matching past-paper list was found for this qualification, or it
          has no papers yet. Build a practice paper above to work in this
          subject&apos;s real format instead.
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
                      key={paper.questionUrl}
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
                        <button
                          type="button"
                          onClick={() =>
                            setViewing({
                              url: paper.questionUrl,
                              title: `${year} · ${paper.label}`,
                              kind: "Question paper",
                            })
                          }
                          aria-label={`Open ${year} ${paper.label} question paper inside Bluprint`}
                          className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-white px-3 text-[0.74rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
                        >
                          Question paper
                          <Eye className="size-3" aria-hidden />
                        </button>
                        {paper.markSchemeUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setViewing({
                                url: paper.markSchemeUrl!,
                                title: `${year} · ${paper.label}`,
                                kind: "Mark scheme",
                              })
                            }
                            aria-label={`Open ${year} ${paper.label} mark scheme inside Bluprint`}
                            className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-white px-3 text-[0.74rem] font-semibold text-[#0B6B45] shadow-none hover:bg-brand-panel"
                          >
                            Mark scheme
                            <Eye className="size-3" aria-hidden />
                          </button>
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
        Papers and mark schemes are published by the exam boards; the list is
        read from the publisher&apos;s paper index. Bluprint stores a cached copy
        the first time a file is opened, so the viewer does not depend on the
        publisher&apos;s site. All rights remain with the publisher. For practice
        written for Bluprint, use the paper builder above. Rights holders can
        request that a link be removed through the{" "}
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

      <PaperViewerDialog
        paper={viewing}
        onClose={() => setViewing(null)}
      />
    </section>
  );
}
