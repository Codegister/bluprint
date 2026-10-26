import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ChevronDown,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

/**
 * The real past papers published for a course.
 *
 * Cognito publishes each course's board papers sorted by exam series, and the
 * same archive's questions sorted by specification topic. This section lists
 * both so the actual papers are one tap away, and opens each one at the source
 * rather than re-hosting it: the papers and mark schemes are the exam boards'
 * copyright, so the app links to them where Cognito publishes them.
 *
 * The index is read once per course and shared, so the list is the same every
 * time and Cognito is only visited when something new may have been released.
 */
export function CognitoPaperLibrary({ courseId }: { courseId: Id<"courses"> }) {
  const index = useQuery(api.cognitoPapers.getForCourse, { courseId });
  const ensure = useMutation(api.cognitoPapers.ensureForCourse);
  const [view, setView] = useState<"year" | "topic">("year");
  const [retrying, setRetrying] = useState(false);
  const requested = useRef<string | null>(null);

  useEffect(() => {
    // Nothing to ask for until the course itself is ready, and once the read is
    // queued or done there is nothing more to do on this visit.
    if (index === undefined) return;
    if (index && index.status !== "error" && !index.processingStale) return;
    if (requested.current === courseId) return;
    requested.current = courseId;
    void ensure({ courseId }).catch(() => {
      requested.current = null;
    });
  }, [courseId, index, ensure]);

  // Nothing to show yet: either the query is still in flight, or no read has
  // been queued for this course (its pathway is not ready), in which case the
  // course page is showing that build instead.
  if (index === undefined || index === null) return null;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await ensure({ courseId, force: true });
      toast.success("Looking for the latest papers.");
    } catch (error) {
      toast.error(readableError(error, "Could not read the past papers."));
    } finally {
      setRetrying(false);
    }
  };

  const busy = index.status === "queued" || index.status === "processing";
  const hasPapers = index.byYear.length > 0;
  const hasTopics = index.byTopic.length > 0;

  // A course Cognito publishes nothing for should not leave an empty section
  // behind.
  if (index.status === "ready" && !hasPapers && !hasTopics) return null;

  const yearGroups = groupBy(index.byYear, (paper) => ({
    key: `${paper.specification ?? ""}|${paper.year ?? ""}`,
    title: paper.year ?? "Papers",
    subtitle: paper.specification,
  }));
  const topicGroups = groupBy(index.byTopic, (paper) => ({
    key: paper.unit ?? "Topics",
    title: paper.unit ?? "Topics",
  }));

  const views: Array<{ value: "year" | "topic"; label: string }> = [
    {
      value: "year",
      label: `By year${hasPapers ? ` · ${index.byYear.length}` : ""}`,
    },
    {
      value: "topic",
      label: `By topic${hasTopics ? ` · ${index.byTopic.length}` : ""}`,
    },
  ];

  return (
    <section className="mt-4 rounded-[2rem] border border-border bg-white p-5 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#5B3DF5]">
            Official papers
          </p>
          <h2 className="mt-1 font-display text-[1.1rem] font-bold text-brand-ink">
            Real past papers for this course
          </h2>
          <p className="mt-1 max-w-2xl text-[0.84rem] leading-relaxed text-muted-foreground">
            {index.description ??
              "The board's own papers and official mark schemes, exactly as published."}
          </p>
        </div>
        {index.status === "error" && (
          <Button
            type="button"
            onClick={() => void handleRetry()}
            disabled={retrying}
            className="h-9 shrink-0 rounded-full bg-[#191B27] px-4 text-[0.8rem] font-semibold text-white hover:bg-[#2A2D3E]"
          >
            {retrying ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden />
            )}
            Try again
          </Button>
        )}
      </div>

      {index.status === "error" ? (
        <p className="mt-4 rounded-2xl bg-[#FFF7F9] px-3.5 py-2.5 text-[0.8rem] leading-relaxed text-[#C23B49]">
          {index.errorMessage ??
            "These papers could not be read from Cognito just now."}
        </p>
      ) : busy && !hasPapers ? (
        <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-brand-panel/40 px-4 py-8">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
          <p className="text-[0.82rem] text-muted-foreground">
            Finding this course's papers…
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 inline-flex rounded-full border border-border bg-brand-panel/60 p-1">
            {views.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setView(option.value)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[0.76rem] font-semibold transition-colors",
                  view === option.value
                    ? "bg-white text-brand-ink shadow-[0_2px_8px_-4px_rgba(22,24,31,0.35)]"
                    : "text-muted-foreground hover:text-brand-ink",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {view === "year" ? (
            hasPapers ? (
              <div className="mt-4 space-y-2">
                {yearGroups.map((group) => (
                  <details
                    key={group.key}
                    open={yearGroups.length <= 3}
                    className="group overflow-hidden rounded-2xl border border-border"
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-3 bg-white px-4 py-3 hover:bg-brand-panel/40">
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.88rem] font-semibold text-brand-ink">
                          {group.title}
                        </span>
                        {group.subtitle && (
                          <span className="block text-[0.72rem] text-muted-foreground">
                            {group.subtitle}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-[0.7rem] font-semibold text-muted-foreground">
                        {group.items.length} paper
                        {group.items.length === 1 ? "" : "s"}
                      </span>
                    </summary>
                    <ul className="divide-y divide-border border-t border-border">
                      {group.items.map((paper) => (
                        <li
                          key={`${paper.label}-${paper.questionPaperUrl}`}
                          className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <p className="min-w-0 flex-1 text-[0.84rem] font-semibold text-brand-ink">
                            {paper.label}
                          </p>
                          <PaperLinks
                            questionPaperUrl={paper.questionPaperUrl}
                            markSchemeUrl={paper.markSchemeUrl}
                          />
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            ) : (
              <EmptyNote>Cognito lists no papers by year for this course.</EmptyNote>
            )
          ) : hasTopics ? (
            <div className="mt-4 space-y-2">
              {topicGroups.map((group) => (
                <details
                  key={group.key}
                  className="group overflow-hidden rounded-2xl border border-border"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 bg-white px-4 py-3 hover:bg-brand-panel/40">
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    <span className="min-w-0 flex-1 text-[0.88rem] font-semibold text-brand-ink">
                      {group.title}
                    </span>
                    <span className="shrink-0 text-[0.7rem] font-semibold text-muted-foreground">
                      {group.items.length}
                    </span>
                  </summary>
                  <ul className="divide-y divide-border border-t border-border">
                    {group.items.map((paper) => (
                      <li
                        key={`${paper.topic}-${paper.questionPaperUrl}`}
                        className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <p className="min-w-0 flex-1 text-[0.84rem] font-semibold text-brand-ink">
                          {paper.topic}
                        </p>
                        <PaperLinks
                          questionPaperUrl={paper.questionPaperUrl}
                          markSchemeUrl={paper.markSchemeUrl}
                        />
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          ) : (
            <EmptyNote>
              Cognito groups no past-paper questions by topic for this course.
            </EmptyNote>
          )}

          <p className="mt-4 flex flex-wrap items-center gap-1.5 text-[0.7rem] leading-relaxed text-muted-foreground">
            <FileText className="size-3.5 shrink-0" aria-hidden />
            Papers and mark schemes are published by the exam boards and hosted
            by Cognito. They open on Cognito's site in a new tab.
            {index.sourceUrl && (
              <a
                href={index.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 font-semibold text-[#5B3DF5] hover:underline"
              >
                Browse the source
                <ExternalLink className="size-3" aria-hidden />
              </a>
            )}
          </p>
        </>
      )}
    </section>
  );
}

/** Paper / Mark scheme, grouped the way Cognito presents a download pair. */
function PaperLinks({
  questionPaperUrl,
  markSchemeUrl,
}: {
  questionPaperUrl: string;
  markSchemeUrl?: string;
}) {
  const linkClass =
    "px-3 py-1.5 text-[0.74rem] font-semibold text-brand-ink transition-colors hover:bg-brand-panel";
  return (
    <div className="flex shrink-0 items-center divide-x divide-border overflow-hidden rounded-lg border border-border bg-white">
      <a
        href={questionPaperUrl}
        target="_blank"
        rel="noreferrer noopener"
        className={linkClass}
      >
        Paper
      </a>
      {markSchemeUrl && (
        <a
          href={markSchemeUrl}
          target="_blank"
          rel="noreferrer noopener"
          className={linkClass}
        >
          Mark scheme
        </a>
      )}
    </div>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 rounded-2xl border border-dashed border-border bg-brand-panel/40 px-4 py-6 text-center text-[0.8rem] text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * Groups consecutive items that share a key. Cognito returns papers in the order
 * it lists them (newest first), so consecutive grouping preserves that order
 * without inventing a sort.
 */
function groupBy<T>(
  items: T[],
  keyOf: (item: T) => { key: string; title: string; subtitle?: string },
): Array<{ key: string; title: string; subtitle?: string; items: T[] }> {
  const groups: Array<{
    key: string;
    title: string;
    subtitle?: string;
    items: T[];
  }> = [];
  for (const item of items) {
    const { key, title, subtitle } = keyOf(item);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
      continue;
    }
    groups.push({ key, title, subtitle, items: [item] });
  }
  return groups;
}
