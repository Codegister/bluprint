import { AppShell } from "@/components/AppShell";
import { Mascot } from "@/components/Mascot";
import { SkeletonStudySetPage } from "@/components/Skeletons";
import { enter } from "@/components/motion/Motion";
import { ExamPractice } from "@/components/study/ExamPractice";
import { FlashcardReview } from "@/components/study/FlashcardReview";
import { QuizRunner } from "@/components/study/QuizRunner";
import { ReadinessPanel } from "@/components/study/ReadinessPanel";
import { SetSettingsDialog } from "@/components/study/SetSettingsDialog";
import { WeakSpots } from "@/components/study/WeakSpots";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { qualificationLabel } from "@/lib/examBoards";
import { percent, relativeDate, sourceLabel } from "@/lib/format";
import { useAction, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Layers3,
  Loader2,
  PenLine,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

/** One screen per study mode. The overview is the set's summary. */
type SetSection = "summary" | "cards" | "quiz" | "exam" | "weak";

const SECTION_LABEL: Record<SetSection, string> = {
  summary: "Summary",
  cards: "Flashcards",
  quiz: "Quiz",
  exam: "Exam practice",
  weak: "Weak spots",
};

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
        <Link to="/dashboard">Back to my sets</Link>
      </Button>
    </div>
  );
}

/**
 * The pipeline's real stages. The server writes one of these percentages each
 * time it moves on, and writes a batch percentage inside flashcards, quiz and
 * exam questions. `seconds` is only used to guess how far the current stage
 * has got between those writes.
 */
type BuildStage = { at: number; label: string; seconds: number };

const BUILD_STAGES: readonly BuildStage[] = [
  { at: 2, label: "Reading your material", seconds: 20 },
  { at: 14, label: "Writing your summary", seconds: 18 },
  { at: 24, label: "Building flashcards", seconds: 45 },
  { at: 58, label: "Writing the quiz", seconds: 25 },
  { at: 80, label: "Drafting exam questions", seconds: 22 },
  { at: 97, label: "Saving your set", seconds: 4 },
];

function stageFor(percent: number) {
  let stage: BuildStage = BUILD_STAGES[0];
  for (const candidate of BUILD_STAGES) {
    if (percent >= candidate.at) stage = candidate;
  }
  return stage;
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
  // Queued runs have not written a percentage yet. Never show 100 here: the
  // completed panel takes over as soon as the set is ready.
  const serverPercent = Math.max(
    2,
    Math.min(99, Math.round(set.progressPercent ?? (set.status === "queued" ? 3 : 8))),
  );
  const buildKey = `${set._id}:${set.processingStartedAt ?? 0}`;

  // Percentages arrive in bursts (one per stage, then one per batch). The bar is
  // driven from those values and only interpolates the wait *between* them, so
  // it always moves without claiming work the server has not reached.
  const confirmed = useRef(serverPercent);
  const confirmedAt = useRef(Date.now());
  // A queued set has not started yet, so its bar waits at the reported value.
  const running = useRef(set.status !== "queued");
  const [displayPercent, setDisplayPercent] = useState(serverPercent);

  useEffect(() => {
    running.current = set.status !== "queued";
  }, [set.status]);

  // A rebuild restarts the run from 2%.
  useEffect(() => {
    confirmed.current = serverPercent;
    confirmedAt.current = Date.now();
    setDisplayPercent(serverPercent);
    // Only reset when the run changes, not on every progress write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildKey]);

  useEffect(() => {
    if (serverPercent > confirmed.current) {
      confirmed.current = serverPercent;
      confirmedAt.current = Date.now();
    }
  }, [serverPercent]);

  useEffect(() => {
    const timer = setInterval(() => {
      setDisplayPercent((shown) => {
        const reported = confirmed.current;
        if (!running.current || shown >= 99) return shown;
        // While the run is alive the bar never goes backwards, and it always
        // catches up quickly once a new server value lands.
        if (shown < reported) {
          return Math.min(reported, shown + Math.max(0.35, (reported - shown) * 0.18));
        }

        const stage = stageFor(reported);
        const nextBoundary =
          BUILD_STAGES.find((candidate) => candidate.at > reported)?.at ?? 99;
        const elapsed = (Date.now() - confirmedAt.current) / 1000;
        // Fraction of this stage we expect to have used up by now. Capped below
        // 1 so the bar coasts into the boundary instead of parking on it.
        const used = Math.min(0.92, elapsed / Math.max(stage.seconds, 1));
        const guess = reported + (nextBoundary - reported) * used;
        const ceiling = Math.max(reported, Math.min(nextBoundary - 0.5, guess));
        return shown >= ceiling
          ? shown
          : Math.min(ceiling, shown + Math.max(0.08, (ceiling - shown) * 0.1));
      });
    }, 300);
    return () => clearInterval(timer);
  }, []);

  // The label follows what the server has actually reached, so it never names a
  // stage the build is not on yet.
  const stage = stageFor(confirmed.current);
  const shownPercent = Math.floor(displayPercent);

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
            seconds. You can leave this page. The run continues on the server.
          </p>

          <div className="mt-4 flex items-baseline justify-between gap-3">
            <p className="text-[0.72rem] font-semibold text-brand-ink/70">
              {stage.label}
              <span className="ml-2 font-medium text-brand-ink/35 tabular-nums">
                Step {BUILD_STAGES.indexOf(stage) + 1} of {BUILD_STAGES.length}
              </span>
            </p>
            <p className="font-display text-[0.95rem] font-bold tabular-nums text-brand-ink">
              {shownPercent}%
            </p>
          </div>
          <div
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-panel"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={shownPercent}
            aria-label="Study set build progress"
          >
            {/* scaleX rather than width: the build can tick every 300ms without
                forcing a layout pass each time. */}
            <div
              className="progress-live h-full w-full origin-left rounded-full transition-transform duration-300 ease-linear"
              style={{ transform: `scaleX(${Math.max(0, Math.min(1, displayPercent / 100))})` }}
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
  );
}

/** The summary and its source material, which is the set overview's focus. */
function SummaryView({
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

/** Three destinations, each a whole screen of its own. */
function StudyActions({ setId, set }: { setId: string; set: Doc<"studySets"> }) {
  const mastery = percent(set.knownCount, set.cardCount);
  const items = [
    {
      to: `/sets/${setId}/cards`,
      label: "Flashcards",
      count: set.cardCount,
      note: `${mastery}% known · spaced review`,
      icon: Layers3,
      tint: "bg-brand-panel text-chrome-7",
    },
    {
      to: `/sets/${setId}/quiz`,
      label: "Quiz",
      count: set.quizCount,
      note: set.lastQuizTotal
        ? `Last score ${set.lastQuizScore}/${set.lastQuizTotal}`
        : "Multiple choice, with explanations",
      icon: CheckCircle2,
      tint: "bg-[#E6F7EF] text-[#128A4C]",
    },
    {
      to: `/sets/${setId}/exam`,
      label: "Exam practice",
      count: set.examCount,
      note: "Written answers, marked with feedback",
      icon: PenLine,
      tint: "bg-[#FFF1DE] text-[#B4720E]",
    },
  ] as const;

  return (
    <section className="grid gap-2.5 sm:grid-cols-3">
      {items.map((item) => (
        <Link
          key={item.label}
          to={item.to}
          className="group flex items-center gap-3 rounded-2xl border border-border bg-white p-4 transition-colors hover:border-chrome-4 hover:bg-[#FBF9FF]"
        >
          <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${item.tint}`}>
            <item.icon className="size-[18px]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-1.5">
              <span className="font-display text-[0.95rem] font-bold text-brand-ink">
                {item.label}
              </span>
              <span className="text-[0.72rem] font-semibold tabular-nums text-muted-foreground">
                {item.count}
              </span>
            </span>
            <span className="mt-0.5 block truncate text-[0.72rem] text-muted-foreground">
              {item.note}
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-brand-ink/30 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ))}
    </section>
  );
}

export default function StudySet() {
  const { setId, section } = useParams<{ setId: string; section?: string }>();
  const navigate = useNavigate();
  const validId = Boolean(setId && /^[a-z0-9]{20,40}$/i.test(setId));
  const details = useQuery(
    api.studySets.getDetails,
    validId ? { setId: setId as Id<"studySets"> } : "skip",
  );
  const processSet = useAction(api.ai.processStudySet);
  // Older links used `?tab=exam`; keep them working while every new link points
  // at the mode's own screen.
  const [searchParams] = useSearchParams();
  const legacyTab = searchParams.get("tab");
  const activeSection: SetSection =
    section === "cards" ||
    section === "quiz" ||
    section === "exam" ||
    section === "weak"
      ? section
      : legacyTab === "cards" || legacyTab === "quiz" || legacyTab === "exam"
        ? legacyTab
        : "summary";
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

  const openTutor = () => {
    if (!validId) return;
    navigate(`/tutor?set=${setId}`);
  };

  const body = (() => {
    if (!validId) return <MissingCard />;
    if (details === undefined) return <SkeletonStudySetPage />;
    if (details === null) return <MissingCard />;

    const set = details.set;
    const qualification = qualificationLabel(set);
    // A build can stop at the material's practical ceiling; say so rather than
    // leaving a shorter deck looking like the requested one.
    const shortfall = (
      [
        ["flashcards", set.targetCardCount, set.cardCount],
        ["quiz questions", set.targetQuizCount, set.quizCount],
        ["exam-style questions", set.targetExamCount, set.examCount],
      ] as Array<[string, number | undefined, number]>
    ).filter(([, asked, built]) => asked !== undefined && asked > built);
    const backTo = set.courseId ? `/courses/${set.courseId}` : "/dashboard";
    const backLabel = set.courseId ? "Back to course" : "Back to my sets";
    const isMode = activeSection !== "summary";

    return (
      <>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={isMode ? `/sets/${set._id}` : backTo}
            className="inline-flex items-center gap-1.5 text-[0.8rem] font-semibold text-muted-foreground hover:text-brand-ink"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            {isMode ? "Back to set" : backLabel}
          </Link>
          {!isMode && (
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={openTutor}
                className="h-8 shrink-0 rounded-full border-border bg-white px-3 text-[0.74rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
              >
                <Sparkles className="size-3.5 text-chrome-7" aria-hidden />
                Ask the tutor
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSettingsOpen(true)}
                className="h-8 shrink-0 rounded-full border-border bg-white px-3 text-[0.74rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
              >
                Set settings
              </Button>
            </div>
          )}
        </div>

        <div className="chrome-plate mt-2 min-w-0 rounded-[1.6rem] px-4 py-4">
          {isMode && (
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-chrome-7">
              {SECTION_LABEL[activeSection]}
            </p>
          )}
          <motion.h1
            className="truncate font-display text-[1.6rem] font-bold leading-tight tracking-[-0.03em] text-brand-ink sm:text-[2rem]"
            {...enter(0.04)}
          >
            {set.title}
          </motion.h1>
          <motion.p
            className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.78rem] text-muted-foreground"
            {...enter(0.1)}
          >
            <span>{set.sourceLabel || sourceLabel(set.sourceType)}</span>
            <span className="text-brand-ink/20">•</span>
            <span>{set.cardCount} cards</span>
            <span className="text-brand-ink/20">•</span>
            <span>{set.quizCount} quiz</span>
            <span className="text-brand-ink/20">•</span>
            <span>{set.examCount} exam</span>
            <span className="text-brand-ink/20">•</span>
            <span>Updated {relativeDate(set.updatedAt)}</span>
          </motion.p>
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
        ) : isMode ? (
          <div className="mt-6">
            {activeSection === "cards" && (
              <FlashcardReview
                key={set._id}
                cards={details.cards}
                onTakeQuiz={() => navigate(`/sets/${set._id}/quiz`)}
              />
            )}
            {activeSection === "quiz" && (
              <QuizRunner
                key={set._id}
                quiz={details.quiz}
                setId={set._id}
                qualification={qualification}
                onReviewCards={() => navigate(`/sets/${set._id}/cards`)}
              />
            )}
            {activeSection === "exam" && (
              <ExamPractice
                exams={details.exams}
                setId={set._id}
                qualification={qualification}
              />
            )}
            {activeSection === "weak" && (
              <WeakSpots key={set._id} setId={set._id} />
            )}
          </div>
        ) : (
          <>
            <motion.div
              className="mt-5 flex flex-wrap items-center gap-2"
              {...enter(0.12)}
            >
              {qualification && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-panel px-3 py-1.5 text-[0.75rem] font-semibold text-chrome-7">
                  {qualification}
                </span>
              )}
              <span className="rounded-full border border-border bg-white px-3 py-1.5 text-[0.75rem] font-medium text-muted-foreground">
                {details.readiness.score}% exam-ready
              </span>
              {details.pace && (
                <span className="rounded-full border border-border bg-white px-3 py-1.5 text-[0.75rem] font-medium text-muted-foreground">
                  {details.pace.daysLeft} day
                  {details.pace.daysLeft === 1 ? "" : "s"} to exam ·{" "}
                  {details.pace.perDay}/day
                </span>
              )}
              {set.lastStudiedAt && (
                <span className="rounded-full border border-border bg-white px-3 py-1.5 text-[0.75rem] font-medium text-muted-foreground">
                  Studied {relativeDate(set.lastStudiedAt)}
                </span>
              )}
            </motion.div>

            {(set.generationNote || shortfall.length > 0) && (
              <div className="mt-3 rounded-2xl border border-border bg-[#FFFBEC] px-4 py-3 text-[0.82rem] leading-relaxed text-[#7A5306]">
                {shortfall.length > 0 && (
                  <p>
                    You asked for{" "}
                    {shortfall
                      .map(([label, asked, built]) => `${asked} ${label} (built ${built})`)
                      .join(", ")}
                    . Bluprint built the maximum this material supports.
                  </p>
                )}
                {set.generationNote && (
                  <p className={shortfall.length > 0 ? "mt-1.5" : undefined}>
                    {set.generationNote}
                  </p>
                )}
              </div>
            )}

            <div className="mt-5">
              <StudyActions setId={set._id} set={set} />
            </div>

            <div className="mt-5">
              <ReadinessPanel
                setId={set._id}
                readiness={details.readiness}
                projected={details.projected}
                pace={details.pace}
                weakCardCount={details.weakCardCount}
                weakQuizCount={details.weakQuizCount}
                dueCount={details.dueCount}
              />
            </div>

            <div className="mt-6">
              <SummaryView set={set} sourceImages={details.sourceImages} />
            </div>
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
