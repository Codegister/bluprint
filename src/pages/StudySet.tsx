import { AppShell } from "@/components/AppShell";
import { Mascot } from "@/components/Mascot";
import { ExamPractice } from "@/components/study/ExamPractice";
import { FlashcardReview } from "@/components/study/FlashcardReview";
import { QuizRunner } from "@/components/study/QuizRunner";
import { SetSettingsDialog } from "@/components/study/SetSettingsDialog";
import { TutorChat } from "@/components/study/TutorChat";
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
import { qualificationLabel } from "@/lib/examBoards";
import { percent, relativeDate, sourceLabel } from "@/lib/format";
import { useAction, useQuery } from "convex/react";
import { Loader2, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

type Tab = "summary" | "cards" | "quiz" | "exam" | "tutor";

const tabItems: Array<{ value: Tab; label: string }> = [
  { value: "summary", label: "Summary" },
  { value: "cards", label: "Flashcards" },
  { value: "quiz", label: "Quiz" },
  { value: "exam", label: "Exam" },
  { value: "tutor", label: "Tutor" },
];

function LoadingCard() {
  return (
    <div className="flex min-h-[280px] items-center justify-center rounded-[2rem] border border-border bg-card">
      <div className="text-center">
        <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
        <p className="mt-3 text-[0.82rem] text-muted-foreground">Loading your set…</p>
      </div>
    </div>
  );
}

function MissingCard() {
  return (
    <div className="mx-auto mt-6 max-w-lg rounded-[2rem] border border-border bg-card p-8 text-center">
      <Mascot size={120} float={false} className="mx-auto" />
      <p className="mt-4 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-brand-peach">
        Set not found
      </p>
      <h1 className="mt-2 font-display text-[1.5rem] font-bold text-brand-ink">
        This set isn't available
      </h1>
      <p className="mt-2 text-[0.9rem] leading-relaxed text-muted-foreground">
        It may have been deleted, or it belongs to a different account.
      </p>
      <Button
        asChild
        className="mt-5 h-10 rounded-full bg-[#191B27] px-5 font-semibold text-white hover:bg-[#2A2D3E]"
      >
        <Link to="/dashboard">Back to home</Link>
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
    <div className="mt-6 overflow-hidden rounded-[2rem] border border-border bg-card p-6 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Mascot size={104} className="shrink-0" />

        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF6E5] px-2.5 py-1 text-[0.72rem] font-semibold text-[#96650A]">
            <Loader2 className="size-3 animate-spin" />
            Building
          </span>
          <h2 className="mt-3 font-display text-[1.4rem] font-bold text-brand-ink">
            {set.status === "queued"
              ? "Queued and ready to start"
              : "Building your revision set"}
          </h2>
          <p className="mt-1.5 text-[0.9rem] leading-relaxed text-muted-foreground">
            {set.progress || "Starting the pipeline…"} This usually takes 30–90
            seconds. You can leave this page — the run continues on the server.
          </p>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-brand-panel">
            <div
              className="h-full w-1/3 animate-pulse rounded-full bg-[#7C5CFF]"
              aria-hidden
            />
          </div>

          {stale && (
            <div className="mt-4 flex flex-col items-start gap-2 rounded-2xl bg-[#FFF6E5] p-4">
              <p className="text-[0.85rem] leading-relaxed text-[#7A5306]">
                This run is taking longer than expected. NVIDIA may be slow, or the
                run was interrupted.
              </p>
              <Button
                onClick={onRetry}
                disabled={retrying}
                variant="outline"
                className="h-9 rounded-full border-[#EBD9B4] bg-white text-[0.82rem] font-semibold text-[#7A5306] hover:bg-[#FFFBF2]"
              >
                {retrying ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="size-3.5" />
                )}
                Rebuild set
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
    <div className="mt-6 rounded-[2rem] border border-border bg-card p-6 sm:p-7">
      <div>
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[#C23B49]">
            Build failed
          </p>
          <h2 className="mt-1.5 font-display text-[1.4rem] font-bold text-brand-ink">
            That run stopped early
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-[0.9rem] leading-relaxed text-muted-foreground">
            {set.errorMessage ??
              "NVIDIA could not finish this set. Your source is still saved, so you can rebuild it whenever you like."}
          </p>

          <Button
            onClick={onRetry}
            disabled={retrying}
            className="mt-4 h-10 rounded-full bg-[#191B27] px-5 font-semibold text-white hover:bg-[#2A2D3E]"
          >
            {retrying ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}
            Rebuild set
          </Button>

          <p className="mt-3 text-[0.78rem] text-muted-foreground">
            If NVIDIA is rate-limiting, wait a minute before rebuilding. Your upload
            is saved.
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
      <div className="rounded-[2rem] border border-dashed border-border bg-card p-10 text-center text-[0.88rem] text-muted-foreground">
        The summary has not been generated yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-3">
        <section className="rounded-[2rem] border border-border bg-card p-6">
          <h2 className="font-display text-[1.05rem] font-bold text-brand-ink">
            Overview
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-[0.94rem] leading-relaxed text-brand-ink/80">
            {summary.overview}
          </p>
        </section>

        <section className="rounded-[2rem] border border-border bg-card p-6">
          <h2 className="font-display text-[1.05rem] font-bold text-brand-ink">
            Key points
          </h2>
          <ol className="mt-4 space-y-3">
            {summary.keyPoints.map((point, index) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-panel text-[0.7rem] font-semibold text-brand-ink/60">
                  {index + 1}
                </span>
                <p className="text-[0.92rem] leading-relaxed text-brand-ink/80">{point}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <aside className="space-y-3">
        <section className="rounded-[2rem] border border-border bg-[#FFFBEC] p-6">
          <h2 className="font-display text-[1.05rem] font-bold text-brand-ink">
            Exam focus
          </h2>
          <ul className="mt-3 space-y-2.5">
            {summary.examFocus.map((point) => (
              <li
                key={point}
                className="flex items-start gap-2 text-[0.9rem] leading-relaxed text-brand-ink/75"
              >
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#E8A317]" />
                {point}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[2rem] border border-border bg-card p-6">
          <h2 className="font-display text-[1.05rem] font-bold text-brand-ink">
            Source material
          </h2>

          {sourceImages.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {sourceImages.map((image) => (
                <a
                  key={image.id}
                  href={image.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square overflow-hidden rounded-xl border border-border bg-brand-panel transition-opacity hover:opacity-80"
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
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl bg-brand-panel px-3 py-2 text-[0.82rem] font-medium text-brand-ink/70">
              Extracted text
              <span className="text-[0.72rem] text-muted-foreground">
                {set.notes.length.toLocaleString()} chars
              </span>
            </summary>
            <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-border bg-white p-3">
              <p className="whitespace-pre-wrap text-[0.82rem] leading-relaxed text-brand-ink/70">
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const triggered = useRef<string | null>(null);

  useEffect(() => {
    if (!details || details.set.status !== "queued") return;
    const id = details.set._id;
    if (triggered.current === id) return;
    triggered.current = id;
    processSet({ setId: id }).catch((error) => {
      toast.error(readableError(error, "The build stopped. Open the set to retry."));
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
    const mastery = percent(set.knownCount, set.cardCount);
    const qualification = qualificationLabel(set);

    return (
      <>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={set.courseId ? `/courses/${set.courseId}` : "/dashboard"}
            className="text-[0.8rem] font-semibold text-muted-foreground hover:text-brand-ink"
          >
            {set.courseId ? "Back to course" : "Back to home"}
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
            className="ml-auto h-8 shrink-0 rounded-full border-border bg-white px-3 text-[0.74rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
          >
            Set settings
          </Button>
        </div>
        <div className="mt-1 min-w-0">
          <h1 className="truncate font-display text-[1.5rem] font-bold leading-tight text-brand-ink sm:text-[1.8rem]">
            {set.title}
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.78rem] text-muted-foreground">
            <span>{set.sourceLabel || sourceLabel(set.sourceType)}</span>
            <span className="text-brand-ink/20">•</span>
            <span>{set.cardCount} cards</span>
            <span className="text-brand-ink/20">•</span>
            <span>{set.quizCount} quiz</span>
            <span className="text-brand-ink/20">•</span>
            <span>{set.examCount} exam</span>
            <span className="text-brand-ink/20">•</span>
            <span>Updated {relativeDate(set.updatedAt)}</span>
          </p>
        </div>

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
          <>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              {qualification && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3ECFF] px-3 py-1.5 text-[0.75rem] font-semibold text-[#5B3DF5]">
                  {qualification}
                </span>
              )}
              <span className="rounded-full border border-border bg-white px-3 py-1.5 text-[0.75rem] font-medium text-muted-foreground">
                {mastery}% of cards known
              </span>
              {set.lastStudiedAt && (
                <span className="rounded-full border border-border bg-white px-3 py-1.5 text-[0.75rem] font-medium text-muted-foreground">
                  Studied {relativeDate(set.lastStudiedAt)}
                </span>
              )}
              {set.lastQuizTotal ? (
                <span className="rounded-full border border-border bg-white px-3 py-1.5 text-[0.75rem] font-medium text-muted-foreground">
                  Last quiz {set.lastQuizScore}/{set.lastQuizTotal}
                </span>
              ) : null}
            </div>

            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value as Tab)}
              className="mt-5 gap-4"
            >
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1.5 bg-transparent p-0 sm:w-auto">
                {tabItems.map((item) => {
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
                      className="h-10 gap-2 rounded-full border border-border bg-white px-4 text-[0.85rem] font-semibold text-brand-ink/70 shadow-none transition-colors data-[state=active]:border-[#191B27] data-[state=active]:bg-[#191B27] data-[state=active]:text-white data-[state=active]:shadow-none"
                    >
                      {item.label}
                      {count !== null && (
                        <span className="rounded-full bg-brand-panel px-1.5 py-0.5 text-[0.65rem] font-semibold text-brand-ink/60">
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
                <ExamPractice exams={details.exams} qualification={qualification} />
              </TabsContent>
              <TabsContent value="tutor" className="mt-1">
                <TutorChat
                  setId={set._id}
                  title={set.title}
                  qualification={qualification}
                />
              </TabsContent>
            </Tabs>
          </>
        )}

        <SetSettingsDialog
          set={set}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      </>
    );
  })();

  return <AppShell>{body}</AppShell>;
}
