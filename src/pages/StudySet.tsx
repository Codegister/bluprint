import { AppShell } from "@/components/AppShell";
import { BlueprintGlyph } from "@/components/BlueprintMark";
import { ExamPractice } from "@/components/study/ExamPractice";
import { FlashcardReview } from "@/components/study/FlashcardReview";
import { QuizRunner } from "@/components/study/QuizRunner";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { relativeDate, sourceLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAction, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  KeyRound,
  Layers,
  ListChecks,
  Loader2,
  PenLine,
  RotateCcw,
  Target,
  Video,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

type Tab = "summary" | "cards" | "quiz" | "exam";

const sourceIcons = {
  text: FileText,
  photos: Camera,
  video: Video,
} satisfies Record<Doc<"studySets">["sourceType"], typeof FileText>;

const tabItems: Array<{ value: Tab; label: string; icon: typeof BookOpen }> = [
  { value: "summary", label: "Summary", icon: BookOpen },
  { value: "cards", label: "Cards", icon: Layers },
  { value: "quiz", label: "Quiz", icon: ListChecks },
  { value: "exam", label: "Exam", icon: PenLine },
];

const pipelineStages = ["EXTRACT", "SUMMARY", "CARDS", "QUIZ", "EXAM"] as const;

function currentStage(progress?: string): number {
  const value = (progress ?? "").toLowerCase();
  if (value.includes("exam")) return 4;
  if (value.includes("quiz")) return 3;
  if (value.includes("flash")) return 2;
  if (value.includes("summar")) return 1;
  return 0;
}

function LoadingCard() {
  return (
    <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-border bg-card">
      <div className="text-center">
        <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
        <p className="mt-3 font-mono text-[9.5px] tracking-wide text-muted-foreground">
          LOADING SET…
        </p>
      </div>
    </div>
  );
}

function MissingCard() {
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-xl border border-border bg-card p-8 text-center">
      <div className="mx-auto grid size-24 place-items-center rounded-lg border border-border bg-brand-panel">
        <BlueprintGlyph size={84} className="opacity-70" />
      </div>
      <p className="mt-4 mono-label text-brand-peach">404 / SET NOT FOUND</p>
      <h1 className="mt-2 font-display text-2xl font-semibold">
        This set isn't available.
      </h1>
      <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
        It may have been deleted, or it belongs to a different account.
      </p>
      <Button
        asChild
        className="mt-5 h-9 rounded-md bg-brand-pink px-4 font-mono text-[10.5px] font-medium tracking-wide text-brand-void hover:bg-brand-pink-deep"
      >
        <Link to="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}

function BuildingPanel({
  set,
  stale,
  onRetry,
  retrying,
}: {
  set: Doc<"studySets">;
  stale: boolean;
  onRetry: () => void;
  retrying: boolean;
}) {
  const activeStage = currentStage(set.progress);

  return (
    <div className="relative mt-6 overflow-hidden rounded-xl border border-border bg-card">
      <div className="pointer-events-none absolute inset-0 blueprint-grid opacity-20" />
      <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:p-7">
        <div className="grid size-16 shrink-0 place-items-center rounded-lg border border-brand-pink/25 bg-brand-pink/[0.06]">
          <Loader2 className="size-6 animate-spin text-brand-pink" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="mono-label text-brand-pink">COMPILING SET</p>
            <span className="rounded border border-brand-lime/25 bg-brand-lime/10 px-1.5 py-0.5 font-mono text-[9px] tracking-wide text-brand-lime">
              RUNNING
            </span>
          </div>
          <h2 className="mt-2 font-display text-2xl font-semibold">
            {set.status === "queued" ? "Queued for compilation." : "Building the revision set."}
          </h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
            {set.progress || "Starting the pipeline…"} This usually takes 20–60 seconds. You
            can leave this page; the run continues on the server.
          </p>

          <div className="mt-4 grid gap-1.5 sm:grid-cols-5">
            {pipelineStages.map((stage, index) => {
              const complete = index < activeStage;
              const active = index === activeStage;
              return (
                <div
                  key={stage}
                  className={cn(
                    "flex items-center gap-1.5 rounded border px-2 py-1.5 font-mono text-[9px] tracking-wide",
                    complete && "border-brand-mint/20 bg-brand-mint/[0.06] text-brand-mint",
                    active && "border-brand-pink/30 bg-brand-pink/10 text-brand-pink",
                    !complete && !active && "border-border bg-brand-panel text-muted-foreground/60",
                  )}
                >
                  {complete ? (
                    <Check className="size-2.5" />
                  ) : active ? (
                    <Loader2 className="size-2.5 animate-spin" />
                  ) : (
                    <span className="size-1 rounded-full bg-current opacity-40" />
                  )}
                  {stage}
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-md border border-border bg-background px-3 py-2 font-mono text-[10px] leading-5 text-muted-foreground">
            <span className="text-brand-pink">&gt;</span> {set.progress || "pipeline initialising"}
            <span className="animate-caret ml-1 inline-block h-2.5 w-[5px] bg-brand-pink align-middle" />
          </div>

          {stale && (
            <div className="mt-4 flex flex-col items-start gap-2 rounded-md border border-brand-lime/25 bg-brand-lime/[0.06] p-3">
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                This run is taking longer than expected. NVIDIA may be slow, or the run was
                interrupted.
              </p>
              <Button
                onClick={onRetry}
                disabled={retrying}
                variant="outline"
                className="h-8 rounded-md border-border bg-transparent font-mono text-[9.5px] tracking-wide"
              >
                {retrying ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RotateCcw className="size-3" />
                )}
                Retry build
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorPanel({
  set,
  onRetry,
  retrying,
}: {
  set: Doc<"studySets">;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="grid size-11 shrink-0 place-items-center rounded-md border border-brand-peach/25 bg-brand-peach/10">
          <AlertTriangle className="size-5 text-brand-peach" />
        </div>
        <div className="flex-1">
          <p className="mono-label text-brand-peach">BUILD FAILED</p>
          <h2 className="mt-1.5 font-display text-2xl font-semibold">
            The pipeline stopped.
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted-foreground">
            {set.errorMessage ??
              "NVIDIA could not finish this set. Your source is still saved; retry when you're ready."}
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={onRetry}
              disabled={retrying}
              className="h-9 rounded-md bg-brand-pink px-4 font-mono text-[10.5px] font-medium tracking-wide text-brand-void hover:bg-brand-pink-deep"
            >
              {retrying ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RotateCcw className="size-3.5" />
              )}
              Retry build
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-9 rounded-md border-border bg-transparent font-mono text-[10.5px] tracking-wide"
            >
              <Link to="/setup">
                <KeyRound className="size-3.5" />
                Check API access
              </Link>
            </Button>
          </div>

          <p className="mt-3 font-mono text-[9px] leading-relaxed tracking-wide text-muted-foreground/70">
            IF NVIDIA IS RATE-LIMITING, WAIT A MINUTE BEFORE RETRYING. YOUR UPLOAD IS SAVED.
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryTab({
  set,
  sourceImages,
}: {
  set: Doc<"studySets">;
  sourceImages: Array<{ id: Id<"_storage">; url: string }>;
}) {
  const summary = set.summary;
  if (!summary) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-[12px] text-muted-foreground">
        The summary has not been generated yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded border border-brand-pink/25 bg-brand-pink/10 text-brand-pink">
              <BookOpen className="size-3.5" />
            </span>
            <h2 className="mono-label text-muted-foreground">OVERVIEW</h2>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-brand-ink/80">
            {summary.overview}
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded border border-brand-mint/25 bg-brand-mint/10 text-brand-mint">
              <CheckCircle2 className="size-3.5" />
            </span>
            <h2 className="mono-label text-muted-foreground">KEY POINTS</h2>
          </div>
          <ol className="mt-4 space-y-3">
            {summary.keyPoints.map((point, index) => (
              <li key={point} className="flex items-start gap-3">
                <span className="grid size-5 shrink-0 place-items-center rounded border border-border bg-brand-panel font-mono text-[9px] text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="pt-0.5 text-[12.5px] leading-relaxed text-brand-ink/75">
                  {point}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded-xl border border-border bg-brand-lime/[0.04] p-5">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded border border-brand-lime/25 bg-brand-lime/10 text-brand-lime">
              <Target className="size-3.5" />
            </span>
            <h2 className="mono-label text-muted-foreground">EXAM FOCUS</h2>
          </div>
          <ul className="mt-3 space-y-2.5">
            {summary.examFocus.map((point) => (
              <li
                key={point}
                className="flex items-start gap-2 text-[12px] leading-relaxed text-brand-ink/70"
              >
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand-lime/70" />
                {point}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded border border-brand-sky/25 bg-brand-sky/10 text-brand-sky">
              <FileText className="size-3.5" />
            </span>
            <h2 className="mono-label text-muted-foreground">SOURCE</h2>
          </div>

          {sourceImages.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {sourceImages.map((image) => (
                <a
                  key={image.id}
                  href={image.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square overflow-hidden rounded border border-border bg-brand-panel transition-colors hover:border-brand-sky/40"
                >
                  <img
                    src={image.url}
                    alt="Uploaded source material"
                    className="size-full object-cover"
                  />
                </a>
              ))}
            </div>
          )}

          <details className="group mt-3">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded border border-border bg-brand-panel px-2.5 py-2 font-mono text-[9.5px] tracking-wide text-muted-foreground">
              VIEW EXTRACTED TEXT
              <span className="text-[9px] text-muted-foreground/60">
                {set.notes.length.toLocaleString()} CHARS
              </span>
            </summary>
            <div className="mt-2 max-h-72 overflow-y-auto rounded border border-border bg-background p-3">
              <p className="whitespace-pre-wrap font-mono text-[10.5px] leading-relaxed text-muted-foreground">
                {set.notes || "No text could be extracted from this source."}
              </p>
            </div>
          </details>
        </section>
      </aside>
    </div>
  );
}

export default function StudySet() {
  const { setId } = useParams<{ setId: string }>();
  const validId = Boolean(setId && /^[a-z0-9]{20,40}$/i.test(setId));
  const details = useQuery(
    api.studySets.getDetails,
    validId ? { setId: setId as Id<"studySets"> } : "skip",
  );
  const processSet = useAction(api.ai.processStudySet);
  const [tab, setTab] = useState<Tab>("summary");
  const [retrying, setRetrying] = useState(false);
  const triggered = useRef<string | null>(null);

  useEffect(() => {
    if (!details || details.set.status !== "queued") return;
    const id = details.set._id;
    if (triggered.current === id) return;
    triggered.current = id;
    processSet({ setId: id }).catch((error) => {
      toast.error(
        readableError(error, "The build stopped. Open the set to retry."),
      );
    });
  }, [details, processSet]);

  const retry = async () => {
    if (!details) return;
    setRetrying(true);
    try {
      await processSet({ setId: details.set._id });
    } catch (error) {
      toast.error(readableError(error, "The build could not be restarted."));
    } finally {
      setRetrying(false);
    }
  };

  const body = (() => {
    if (!validId) return <MissingCard />;
    if (details === undefined) return <LoadingCard />;
    if (details === null) return <MissingCard />;

    const set = details.set;
    const SourceIcon = sourceIcons[set.sourceType];

    return (
      <>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 font-mono text-[9.5px] tracking-wide text-muted-foreground transition-colors hover:text-brand-ink"
        >
          <ArrowLeft className="size-3" />
          DASHBOARD / SET
        </Link>

        <header className="mt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded border border-border bg-brand-panel px-2 py-1 font-mono text-[9px] tracking-wide text-muted-foreground">
              <SourceIcon className="size-3" />
              {set.sourceType === "text"
                ? "PASTED NOTES"
                : (set.sourceLabel || sourceLabel(set.sourceType)).toUpperCase()}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[9px] tracking-wide",
                set.status === "ready"
                  ? "border-brand-mint/20 bg-brand-mint/[0.06] text-brand-mint"
                  : set.status === "error"
                    ? "border-brand-peach/25 bg-brand-peach/10 text-brand-peach"
                    : "border-brand-lime/25 bg-brand-lime/10 text-brand-lime",
              )}
            >
              {set.status === "ready" ? (
                <span className="size-1.5 rounded-full bg-brand-mint" />
              ) : set.status === "error" ? (
                <AlertTriangle className="size-2.5" />
              ) : (
                <Loader2 className="size-2.5 animate-spin" />
              )}
              {set.status === "ready"
                ? "READY"
                : set.status === "error"
                  ? "FAILED"
                  : set.status === "processing"
                    ? "COMPILING"
                    : "QUEUED"}
            </span>
            {set.lastStudiedAt && (
              <span className="inline-flex items-center gap-1 font-mono text-[9px] tracking-wide text-muted-foreground">
                <Clock className="size-2.5" />
                STUDIED {relativeDate(set.lastStudiedAt).toUpperCase()}
              </span>
            )}
            {set.lastQuizTotal ? (
              <span className="rounded border border-border bg-brand-panel px-2 py-1 font-mono text-[9px] tracking-wide text-muted-foreground">
                LAST QUIZ {set.lastQuizScore}/{set.lastQuizTotal}
              </span>
            ) : null}
          </div>

          <h1 className="display-tight mt-2 max-w-3xl text-[1.9rem] font-semibold leading-tight sm:text-[2.4rem]">
            {set.title}
          </h1>
          <p className="mt-2 font-mono text-[9.5px] tracking-wide text-muted-foreground">
            {set.cardCount} CARDS / {set.quizCount} QUIZ / {set.examCount} EXAM / UPDATED{" "}
            {relativeDate(set.updatedAt).toUpperCase()}
          </p>
        </header>

        {set.status === "error" ? (
          <ErrorPanel set={set} onRetry={retry} retrying={retrying} />
        ) : set.status !== "ready" ? (
          <BuildingPanel
            set={set}
            stale={details.processingStale}
            onRetry={retry}
            retrying={retrying}
          />
        ) : (
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as Tab)}
            className="mt-6 gap-4"
          >
            <TabsList className="grid h-auto w-full grid-cols-4 gap-1 rounded-md border border-border bg-card p-1 sm:inline-flex sm:w-auto">
              {tabItems.map((item) => {
                const Icon = item.icon;
                const count =
                  item.value === "cards"
                    ? set.cardCount
                    : item.value === "quiz"
                      ? set.quizCount
                      : item.value === "exam"
                        ? set.examCount
                        : null;
                return (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className="h-8 gap-1.5 rounded font-mono text-[10px] tracking-wide text-muted-foreground data-[state=active]:border data-[state=active]:border-brand-pink/25 data-[state=active]:bg-brand-pink/10 data-[state=active]:text-brand-pink data-[state=active]:shadow-none sm:px-3"
                  >
                    <Icon className="size-3.5" />
                    {item.label.toUpperCase()}
                    {count !== null && (
                      <span className="hidden rounded bg-background px-1 text-[8px] text-muted-foreground sm:inline">
                        {count}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="summary" className="mt-1">
              <SummaryTab set={set} sourceImages={details.sourceImages} />
            </TabsContent>
            <TabsContent value="cards" className="mt-1">
              <FlashcardReview cards={details.cards} onTakeQuiz={() => setTab("quiz")} />
            </TabsContent>
            <TabsContent value="quiz" className="mt-1">
              <QuizRunner
                quiz={details.quiz}
                setId={set._id}
                onReviewCards={() => setTab("cards")}
              />
            </TabsContent>
            <TabsContent value="exam" className="mt-1">
              <ExamPractice exams={details.exams} />
            </TabsContent>
          </Tabs>
        )}
      </>
    );
  })();

  return <AppShell>{body}</AppShell>;
}
