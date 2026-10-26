import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cognitoPaperProxyUrl } from "@/lib/convexSite";
import { readableError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useAction, useQuery } from "convex/react";
import { ExternalLink, FileText, Loader2, RotateCcw } from "lucide-react";
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
    <section className="mt-4 rounded-[2rem] border border-border bg-white p-5 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#6B4EE6]">
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
        <span className="rounded-full bg-[#F1F0FB] px-3 py-1.5 text-[0.7rem] font-semibold text-[#5B3DF5]">
          {papers.length > 0
            ? `${papers.length} paper${papers.length === 1 ? "" : "s"}`
            : "Cognito"}
        </span>
      </div>

      {(busy || cached === undefined) && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-brand-panel px-4 py-3 text-[0.8rem] text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Reading Cognito&apos;s past-paper list for this course…
        </p>
      )}

      {error && (
        <div className="mt-4 rounded-2xl bg-[#FFF6E5] px-4 py-3">
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
        </div>
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
              <ul className="mt-1.5 grid gap-2">
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
                              title: `${year} ${paper.label} — question paper`,
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
                                title: `${year} ${paper.label} — mark scheme`,
                                url: paper.markSchemeUrl!,
                              })
                            }
                            className="h-8 rounded-full border-[#CFEBDD] bg-[#F1FBF6] px-3 text-[0.74rem] font-semibold text-[#128A4C] shadow-none hover:bg-[#E6F9F6]"
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
        Cognito, shown here as reference material. For practice written for
        Bluprint, use the paper builder above.
      </p>

      <Dialog
        open={viewing !== null}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      >
        <DialogContent className={cn("max-w-5xl rounded-3xl p-0")}>
          <DialogHeader className="px-5 pb-2 pt-5">
            <DialogTitle className="font-display text-[1rem] text-brand-ink">
              {viewing?.title ?? "Past paper"}
            </DialogTitle>
            <DialogDescription className="text-[0.76rem] text-muted-foreground">
              Read inside Bluprint. The file is the board&apos;s published paper,
              served through this app.
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 pb-5">
            {viewing && (
              <iframe
                key={viewing.url}
                src={cognitoPaperProxyUrl(viewing.url)}
                title={viewing.title}
                className="h-[70vh] w-full rounded-2xl border border-border bg-white"
              />
            )}
            <p className="mt-2 flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
              <ExternalLink className="size-3" aria-hidden />
              If the viewer stays blank, open this file
              {" "}
              <a
                href={cognitoPaperProxyUrl(viewing?.url ?? "")}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#5B3DF5] underline underline-offset-2"
              >
                in a new tab
              </a>
              .
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
