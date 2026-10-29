import { EASE, reveal } from "@/components/motion/Motion";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { useAction, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ExternalLink, FileText, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * The real past papers Cognito publishes for a course.
 *
 * Each row links to the board paper and its mark scheme on Cognito's own site,
 * opened in a new tab. Bluprint does not copy, proxy or redistribute the PDFs:
 * no licence to do so exists, and the publisher remains the host. The files
 * belong to the exam boards and Cognito, not to Bluprint.
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
            Published by Cognito for this course. Each paper opens on
            Cognito&apos;s own site in a new tab, where you can read the question
            paper and check your answers against the board&apos;s mark scheme.
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
                        <a
                          href={paper.questionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${year} ${paper.label} question paper on Cognito`}
                          className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-white px-3 text-[0.74rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
                        >
                          Question paper
                          <ExternalLink className="size-3" aria-hidden />
                        </a>
                        {paper.markSchemeUrl && (
                          <a
                            href={paper.markSchemeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${year} ${paper.label} mark scheme on Cognito`}
                            className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-white px-3 text-[0.74rem] font-semibold text-[#0B6B45] shadow-none hover:bg-brand-panel"
                          >
                            Mark scheme
                            <ExternalLink className="size-3" aria-hidden />
                          </a>
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
        Cognito. These links open Cognito&apos;s own site; Bluprint does not host
        or redistribute the files, and all rights remain with the publisher. For
        practice written for Bluprint, use the paper builder above. Rights
        holders can request that a link be removed through the{" "}
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

    </motion.section>
  );
}
