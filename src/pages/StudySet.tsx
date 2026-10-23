import { AppShell } from "@/components/AppShell";
import { Pip } from "@/components/Pip";
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
  CheckCircle2,
  Clock,
  FileText,
  KeyRound,
  Layers,
  ListChecks,
  Loader2,
  PenLine,
  RotateCcw,
  Sparkles,
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

function LoadingCard() {
  return (
    <div className="flex min-h-[280px] items-center justify-center rounded-[26px] border border-brand-ink/10 bg-card">
      <div className="text-center">
        <Loader2 className="mx-auto size-6 animate-spin text-brand-ink/35" />
        <p className="mt-3 text-[12px] font-medium text-brand-ink/45">Opening your set…</p>
      </div>
    </div>
  );
}

function MissingCard() {
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-[26px] border border-brand-ink/12 bg-card p-8 text-center">
      <div className="mx-auto grid size-24 place-items-center rounded-[26px] border-2 border-brand-ink bg-brand-peach">
        <Pip size={80} mood="sleepy" />
      </div>
      <h1 className="mt-4 font-display text-2xl font-bold">This set isn't here.</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-brand-ink/55">
        It may have been deleted, or it belongs to a different account.
      </p>
      <Button
        asChild
        className="mt-5 h-10 rounded-xl border-2 border-brand-ink bg-brand-ink px-5 font-bold text-brand-cream hover:bg-brand-pink hover:text-brand-ink"
      >
        <Link to="/dashboard">Back to my sets</Link>
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
  return (
    <div className="relative mt-6 overflow-hidden rounded-[28px] border border-brand-ink/12 bg-card p-6 sm:p-10">
      <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-brand-mint/50 blur-3xl" />
      <div className="relative flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
        <div className="relative grid size-32 shrink-0 place-items-center rounded-[32px] border-2 border-brand-ink bg-brand-lime">
          <Pip size={104} className="animate-pip-float" cap />
          <span className="absolute -bottom-2 -right-2 flex items-center gap-1 rounded-full border-2 border-brand-ink bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-wide">
            <Loader2 className="size-2.5 animate-spin" /> Working
          </span>
        </div>

        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-ink/40">
            {set.status === "queued" ? "Queued" : "Building your set"}
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold">
            Pip is reading, writing and checking.
          </h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-brand-ink/55">
            {set.progress || "Getting started…"} This usually takes 20–60 seconds. You can
            leave this page — generation continues in the background.
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-1.5 sm:justify-start">
            {["Read material", "Summary", "Flashcards", "Quiz", "Exam"].map((label) => (
              <span
                key={label}
                className="rounded-full border border-brand-ink/10 bg-brand-cream px-2.5 py-1 text-[10px] font-semibold text-brand-ink/45"
              >
                {label}
              </span>
            ))}
          </div>

          {stale && (
            <div className="mt-4 flex flex-col items-start gap-2 rounded-xl bg-brand-lime/50 p-3 text-left">
              <p className="text-[11.5px] font-semibold text-brand-ink/70">
                This is taking longer than expected. NVIDIA may be slow or the run was
                interrupted.
              </p>
              <Button
                onClick={onRetry}
                disabled={retrying}
                variant="outline"
                className="h-8 rounded-lg border-brand-ink/20 bg-white text-xs font-bold"
              >
                {retrying ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                Retry generation
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
    <div className="mt-6 rounded-[28px] border border-brand-ink/12 bg-card p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-brand-ink/10 bg-brand-peach">
          <AlertTriangle className="size-6 text-brand-ink" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-ink/40">
            Generation stopped
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold">Pip hit a snag.</h2>
          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-brand-ink/60">
            {set.errorMessage ??
              "NVIDIA could not finish this set. Your uploaded notes are still saved — retry when you're ready."}
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={onRetry}
              disabled={retrying}
              className="h-10 rounded-xl border-2 border-brand-ink bg-brand-ink font-bold text-brand-cream hover:bg-brand-pink hover:text-brand-ink"
            >
              {retrying ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}
              Retry generation
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-10 rounded-xl border-brand-ink/15 font-semibold"
            >
              <Link to="/setup">
                <KeyRound className="size-4" />
                Check AI setup
              </Link>
            </Button>
          </div>

          <p className="mt-3 text-[11px] text-brand-ink/40">
            If NVIDIA is rate-limiting, wait about a minute before retrying. Nothing you
            uploaded has been lost.
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
      <div className="rounded-2xl border border-dashed border-brand-ink/15 bg-card p-10 text-center text-sm text-brand-ink/55">
        The summary is still being written.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <section className="rounded-[26px] border border-brand-ink/12 bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-brand-mint">
              <BookOpen className="size-3.5 text-brand-ink" />
            </span>
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.1em] text-brand-ink/60">
              The short version
            </h2>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-brand-ink/75">
            {summary.overview}
          </p>
        </section>

        <section className="rounded-[26px] border border-brand-ink/12 bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-brand-pink/40">
              <Sparkles className="size-3.5 text-brand-ink" />
            </span>
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.1em] text-brand-ink/60">
              Points worth remembering
            </h2>
          </div>
          <ol className="mt-4 space-y-3">
            {summary.keyPoints.map((point, index) => (
              <li key={point} className="flex items-start gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full border border-brand-ink/10 bg-brand-cream font-display text-[10px] font-bold text-brand-ink/60">
                  {index + 1}
                </span>
                <p className="pt-0.5 text-[13px] leading-relaxed text-brand-ink/70">
                  {point}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded-[26px] border border-brand-ink/12 bg-brand-lime/45 p-5">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg border border-brand-ink/10 bg-white/70">
              <Target className="size-3.5 text-brand-ink" />
            </span>
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.1em] text-brand-ink/60">
              Exam focus
            </h2>
          </div>
          <ul className="mt-3 space-y-2.5">
            {summary.examFocus.map((point) => (
              <li
                key={point}
                className="flex items-start gap-2 text-[12.5px] leading-relaxed text-brand-ink/70"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-ink/50" />
                {point}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[26px] border border-brand-ink/12 bg-card p-5">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-brand-sky/70">
              <FileText className="size-3.5 text-brand-ink" />
            </span>
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.1em] text-brand-ink/60">
              Original material
            </h2>
          </div>

          {sourceImages.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {sourceImages.map((image) => (
                <a
                  key={image.id}
                  href={image.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square overflow-hidden rounded-lg border border-brand-ink/10 bg-brand-cream transition hover:border-brand-ink/30"
                >
                  <img
                    src={image.url}
                    alt="Uploaded study material"
                    className="size-full object-cover"
                  />
                </a>
              ))}
            </div>
          )}

          <details className="group mt-3">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-brand-ink/10 bg-brand-cream/60 px-3 py-2 text-[11px] font-bold text-brand-ink/60">
              View extracted notes
              <span className="text-[10px] font-semibold text-brand-ink/35">
                {set.notes.length.toLocaleString()} chars
              </span>
            </summary>
            <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-brand-ink/10 bg-brand-cream/40 p-3">
              <p className="whitespace-pre-wrap text-[11.5px] leading-relaxed text-brand-ink/60">
                {set.notes || "No text could be extracted from this upload."}
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
  // Guard the Convex arg validator so a hand-typed bad URL shows the friendly
  // "not found" panel instead of a query error.
  const validId = Boolean(setId && /^[a-z0-9]{20,40}$/i.test(setId));
  const details = useQuery(
    api.studySets.getDetails,
    validId ? { setId: setId as Id<"studySets"> } : "skip",
  );
  const processSet = useAction(api.ai.processStudySet);
  const [tab, setTab] = useState<Tab>("summary");
  const [retrying, setRetrying] = useState(false);
  const triggered = useRef<string | null>(null);

  // A set is created in the "queued" state. Opening it starts generation once;
  // generation continues on the server even if the tab is closed.
  useEffect(() => {
    if (!details || details.set.status !== "queued") return;
    const id = details.set._id;
    if (triggered.current === id) return;
    triggered.current = id;
    processSet({ setId: id }).catch((error) => {
      toast.error(
        readableError(error, "Pip could not finish this set. Open it again to retry."),
      );
    });
  }, [details, processSet]);

  const retry = async () => {
    if (!details) return;
    setRetrying(true);
    try {
      await processSet({ setId: details.set._id });
    } catch (error) {
      toast.error(readableError(error, "Pip could not finish this set."));
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
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-ink/45 transition-colors hover:text-brand-ink"
        >
          <ArrowLeft className="size-3.5" />
          All study sets
        </Link>

        <header className="mt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-ink/10 bg-white px-2.5 py-1 text-[10px] font-bold text-brand-ink/55">
              <SourceIcon className="size-3" />
              {set.sourceType === "text"
                ? "Pasted notes"
                : set.sourceLabel || sourceLabel(set.sourceType)}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-brand-ink/10 px-2.5 py-1 text-[10px] font-bold",
                set.status === "ready"
                  ? "bg-brand-mint text-brand-ink"
                  : set.status === "error"
                    ? "bg-brand-peach text-brand-ink"
                    : "bg-brand-lime text-brand-ink",
              )}
            >
              {set.status === "ready" ? (
                <CheckCircle2 className="size-3" />
              ) : set.status === "error" ? (
                <AlertTriangle className="size-3" />
              ) : (
                <Loader2 className="size-3 animate-spin" />
              )}
              {set.status === "ready"
                ? "Ready"
                : set.status === "error"
                  ? "Needs retry"
                  : set.status === "processing"
                    ? "Building"
                    : "Queued"}
            </span>
            {set.lastStudiedAt && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-ink/35">
                <Clock className="size-3" />
                Studied {relativeDate(set.lastStudiedAt)}
              </span>
            )}
            {set.lastQuizTotal ? (
              <span className="rounded-full bg-brand-cream px-2.5 py-1 text-[10px] font-bold text-brand-ink/50">
                Last quiz {set.lastQuizScore}/{set.lastQuizTotal}
              </span>
            ) : null}
          </div>

          <h1 className="display-tight mt-2 max-w-3xl text-[2rem] font-bold leading-tight sm:text-[2.6rem]">
            {set.title}
          </h1>
          <p className="mt-2 text-[12px] text-brand-ink/45">
            {set.cardCount} flashcards · {set.quizCount} quiz questions · {set.examCount} exam
            questions · updated {relativeDate(set.updatedAt)}
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
            <TabsList className="grid h-auto w-full grid-cols-4 gap-1 rounded-2xl border border-brand-ink/10 bg-white p-1.5 sm:inline-flex sm:w-auto">
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
                    className="h-9 gap-1.5 rounded-xl px-2 text-[11px] font-bold data-[state=active]:bg-brand-ink data-[state=active]:text-brand-cream data-[state=active]:shadow-none sm:px-3.5 sm:text-[12px]"
                  >
                    <Icon className="size-3.5" />
                    {item.label}
                    {count !== null && (
                      <span className="hidden rounded-full bg-brand-cream/20 px-1.5 text-[9px] font-bold sm:inline">
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
              <FlashcardReview
                cards={details.cards}
                onTakeQuiz={() => setTab("quiz")}
              />
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
