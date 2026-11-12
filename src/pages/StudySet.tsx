import { AppShell } from "@/components/AppShell";
import { Brand } from "@/components/Brand";
import { Mascot } from "@/components/Mascot";
import { NextStep } from "@/components/NextStep";
import { SkeletonStudySetPage } from "@/components/Skeletons";
import { enter } from "@/components/motion/Motion";
import { ExamPractice } from "@/components/study/ExamPractice";
import { FlashcardReview } from "@/components/study/FlashcardReview";
import { QuizRunner } from "@/components/study/QuizRunner";
import { ReadinessPanel } from "@/components/study/ReadinessPanel";
import { SetSettingsDialog } from "@/components/study/SetSettingsDialog";
import { SetExportButtons } from "@/components/study/SetExportButtons";
import { WeakSpots } from "@/components/study/WeakSpots";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { normaliseCapacityNote } from "@/convex/lib/buildDefaults";
import { AI_NOT_CONFIGURED_MESSAGE } from "@/lib/aiAvailability";
import { guestKeepWorkHref } from "@/lib/authRedirect";
import { buildErrorMessage, notifyError } from "@/lib/errors";
import { retryTransient } from "@/lib/retry";
import { useAiAvailability } from "@/lib/useAiAvailability";
import { qualificationLabel } from "@/lib/examBoards";
import { percent, plural, relativeDate, sourceLabel, timeUntil } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Layers3,
  Loader2,
  Pencil,
  PenLine,
  RotateCcw,
  Timer,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

/**
 * The set's name, editable in place. Clicking it opens an input; Enter or
 * leaving the field saves. A typed name is never replaced by a generated one.
 */
function SetTitle({ setId, title }: { setId: Id<"studySets">; title: string }) {
  const updateDetails = useMutation(api.studySets.updateDetails);
  const [value, setValue] = useState(title);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setValue(title);
  }, [title, editing]);

  const save = async () => {
    const next = value.trim();
    setEditing(false);
    if (next.length < 2 || next === title) {
      setValue(title);
      return;
    }
    setSaving(true);
    try {
      await retryTransient(() => updateDetails({ setId, title: next }), {
        attempts: 2,
        delayMs: 400,
      });
    } catch (error) {
      setValue(title);
      notifyError(error, "Could not rename that set.");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        maxLength={80}
        aria-label="Set name"
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === "Enter") void save();
          if (event.key === "Escape") {
            setValue(title);
            setEditing(false);
          }
        }}
        className="set-title-input w-full rounded-xl border border-chrome-5 bg-white px-2 py-1 font-display text-[1.6rem] font-bold leading-tight tracking-[-0.03em] text-brand-ink outline-none focus-visible:border-chrome-6 focus-visible:ring-2 focus-visible:ring-chrome-6/20 sm:text-[2rem]"
      />
    );
  }

  return (
    <motion.h1
      className="set-title min-w-0"
      {...enter(0.04)}
    >
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Rename this set"
        className="group flex max-w-full items-center gap-2 text-left"
      >
        <span className="set-title-text truncate font-display text-[1.6rem] font-bold leading-tight tracking-[-0.03em] text-brand-ink transition-colors group-hover:text-chrome-7 sm:text-[2rem]">
          {title}
        </span>
        <Pencil
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        />
        <span className="sr-only">{saving ? "Saving name" : "Rename this set"}</span>
      </button>
    </motion.h1>
  );
}

/** One screen per study mode. The overview is the set's summary. */
type SetSection = "summary" | "cards" | "quiz" | "exam" | "weak";

const SECTION_LABEL: Record<SetSection, string> = {
  summary: "Summary",
  cards: "Flashcards",
  quiz: "Quiz",
  exam: "Exam practice",
  // Named for what it is: the cards and questions this set keeps losing marks
  // on. "Needs work" read like a comment on the student.
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
        <Link to="/tutor">Back to my sets</Link>
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-panel px-2.5 py-1 text-[0.72rem] font-semibold text-brand-ink/70">
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
              <span className="ml-2 font-medium text-brand-ink/65 tabular-nums">
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
            <div className="mt-4 flex flex-col items-start gap-2 rounded-2xl bg-brand-panel p-4">
              <p className="text-[0.85rem] leading-relaxed text-brand-ink/80">
                This run is taking longer than expected. The AI may be slow, or the
                run was interrupted.
              </p>
              <Button
                onClick={onRetry}
                disabled={retrying}
                variant="outline"
                className="h-9 rounded-full border-border bg-card text-[0.82rem] font-semibold text-brand-ink hover:bg-brand-panel"
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

          {/* A run that was interrupted after saving a stage still has work the
              student can open, even before the stale timeout offers a retry. */}
          <FinishedSections set={set} />
        </div>
      </div>
    </div>
  );
}

/** The sections a stopped build already saved, linked so they can be opened. */
function FinishedSections({ set }: { set: Doc<"studySets"> }) {
  if (set.cardCount + set.quizCount + set.examCount === 0) return null;
  return (
    <div className="mt-4 rounded-2xl border border-border bg-brand-panel/50 p-4">
      <p className="text-[0.8rem] font-semibold text-brand-ink">Open what finished</p>
      <p className="mt-0.5 text-[0.76rem] text-muted-foreground">
        These sections are saved and work now; only the failed stage is missing.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {set.cardCount > 0 && (
          <Link to={`/sets/${set._id}/cards`} className="rounded-full bg-white px-3 py-1.5 text-[0.76rem] font-semibold text-brand-ink ring-1 ring-border hover:bg-brand-panel">
            {plural(set.cardCount, "flashcard")}
          </Link>
        )}
        {set.quizCount > 0 && (
          <Link to={`/sets/${set._id}/quiz`} className="rounded-full bg-white px-3 py-1.5 text-[0.76rem] font-semibold text-brand-ink ring-1 ring-border hover:bg-brand-panel">
            {plural(set.quizCount, "quiz question")}
          </Link>
        )}
        {set.examCount > 0 && (
          <Link to={`/sets/${set._id}/exam`} className="rounded-full bg-white px-3 py-1.5 text-[0.76rem] font-semibold text-brand-ink ring-1 ring-border hover:bg-brand-panel">
            {plural(set.examCount, "exam question")}
          </Link>
        )}
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
  const failure = buildErrorMessage(set.errorMessage);
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
          {failure.message}
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

        <FinishedSections set={set} />

        <p className="mt-3 text-[0.78rem] text-muted-foreground">
          Your upload is saved. A failed run is not charged, and any cards or
          questions it did finish are kept. You can rebuild now.
        </p>
      </div>
    </div>
  );
}

/**
 * A set built from the student's own uploads has no specification to list, so
 * its overview is the points the build wrote — one per card — and the material
 * they were drawn from. Coverage cannot be ticked here: every key point has a
 * card behind it by construction, and there is no syllabus to fall short of.
 */
function UploadOverview({
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
        {set.coverageNote && (
          <div className="rounded-2xl border border-[#F3E2C8] bg-[#FFF7E8] px-4 py-3 text-[0.8rem] leading-relaxed text-[#8A5D00]">
            <span className="font-semibold">Source coverage.</span>{" "}
            {set.coverageNote}
          </div>
        )}
        <section className="rounded-[2rem] border border-border bg-card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-[1.05rem] font-bold text-brand-ink">
              Key points
            </h2>
            <span className="rounded-full bg-brand-panel px-2.5 py-0.5 text-[0.7rem] font-bold tabular-nums text-brand-ink/70">
              {plural(summary.keyPoints.length, "point")}
            </span>
          </div>
          <p className="mt-1 text-[0.78rem] leading-relaxed text-muted-foreground">
            This set was built from your own material, so there is no
            specification to tick off. These are the points it teaches, one per
            card.
          </p>
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

/**
 * The set's overview is the points it was built from: for a course set, the
 * specification statements, each marked with whether the set has cards or
 * questions behind it. A set built from a student's own material has no
 * specification, so it lists the key points the build wrote instead.
 */
function OverviewView({
  setId,
  set,
  sourceImages,
}: {
  setId: Id<"studySets">;
  set: Doc<"studySets">;
  sourceImages: Array<{ id: Id<"_storage">; url: string }>;
}) {
  const data = useQuery(api.coverage.forSet, { setId });

  if (data === undefined) {
    return (
      <div className="h-32 w-full animate-pulse rounded-[2rem] bg-brand-panel" />
    );
  }

  if (!data || data.unmapped) {
    return <UploadOverview set={set} sourceImages={sourceImages} />;
  }

  const coveredIds = new Set(data.coverage.covered.map((point) => point.id));

  return (
    <section className="rounded-[2rem] border border-border bg-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[1.05rem] font-bold text-brand-ink">
          Specification points
        </h2>
        <span className="rounded-full bg-brand-panel px-2.5 py-0.5 text-[0.7rem] font-bold tabular-nums text-brand-ink/70">
          {coveredIds.size} of {data.points.length} covered
        </span>
      </div>
      <p className="mt-1 text-[0.78rem] leading-relaxed text-muted-foreground">
        The statements this set was built from. Ticked points already have cards
        or questions behind them.
      </p>
      <ol className="mt-4 space-y-2">
        {data.points.map((point) => {
          const isCovered = coveredIds.has(point.id);
          return (
            <li
              key={point.id}
              className={cn(
                "flex items-start gap-2.5 rounded-xl px-3 py-2 text-[0.86rem] leading-relaxed",
                isCovered
                  ? "bg-[#F3FBF7] text-brand-ink/85"
                  : "bg-brand-panel/60 text-muted-foreground",
              )}
            >
              {isCovered ? (
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-[#0B6B45]"
                  aria-hidden
                />
              ) : (
                <CircleDashed className="mt-0.5 size-4 shrink-0" aria-hidden />
              )}
              <span>{point.text}</span>
              <span className="sr-only">
                {isCovered ? "Covered" : "Not covered"}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Three destinations, each a whole screen of its own. */
function StudyActions({
  setId,
  set,
  recommended,
  quizAnswered,
  quizTotal,
}: {
  setId: string;
  set: Doc<"studySets">;
  recommended: SetSection;
  /** Answered quiz questions, counted from the saved answers. */
  quizAnswered: number;
  quizTotal: number;
}) {
  const mastery = percent(set.knownCount, set.cardCount);
  const items = [
    {
      value: "cards",
      to: `/sets/${setId}/cards`,
      label: "Flashcards",
      count: set.cardCount,
      note: `${mastery}% known · spaced review`,
      icon: Layers3,
    },
    {
      value: "quiz",
      to: `/sets/${setId}/quiz`,
      label: "Quiz",
      count: set.quizCount,
      // Counted from the saved answers, so a half-finished quiz still reads as
      // progress rather than "not yet".
      note:
        quizAnswered > 0
          ? `${quizAnswered}/${quizTotal} answered`
          : "Mixed format, with explanations",
      icon: CheckCircle2,
    },
    {
      value: "exam",
      to: `/sets/${setId}/exam`,
      label: "Exam practice",
      count: set.examCount,
      note: "Written answers, marked with feedback",
      icon: PenLine,
    },
  ] as const;

  const ordered = [...items].sort(
    (a, b) =>
      Number(b.value === recommended) - Number(a.value === recommended),
  );

  return (
    <section className="set-actions" aria-label="Study modes">
      {ordered.map((item) => {
        const isRecommended = item.value === recommended;
        return (
          <Link
            key={item.label}
            to={item.to}
            className={cn("set-action", isRecommended && "is-recommended")}
          >
            <span className="set-action-icon">
              <item.icon className="size-[18px]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="set-action-title-row">
                <span className="set-action-title">{item.label}</span>
                <span className="set-action-count">{item.count}</span>
                {isRecommended && (
                  <span className="set-action-badge">Start here</span>
                )}
              </span>
              <span className="set-action-note">{item.note}</span>
            </span>
            <ArrowRight className="set-action-arrow size-4" aria-hidden />
          </Link>
        );
      })}
    </section>
  );
}

export default function StudySet() {
  const { user } = useAuth();
  const { setId, section } = useParams<{ setId: string; section?: string }>();
  const navigate = useNavigate();
  const validId = Boolean(setId && /^[a-z0-9]{20,40}$/i.test(setId));
  const details = useQuery(
    api.studySets.getDetails,
    validId ? { setId: setId as Id<"studySets"> } : "skip",
  );
  const processSet = useAction(api.ai.processStudySet);
  const regenerateSetCards = useAction(api.ai.regenerateCards);
  const { unavailable: aiUnavailable } = useAiAvailability();
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
  const [regenerating, setRegenerating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Kept by set id, so opening another set never inherits "review ahead".
  const [reviewAheadFor, setReviewAheadFor] = useState<string | null>(null);
  const triggered = useRef<string | null>(null);

  useEffect(() => {
    if (!details || details.set.status !== "queued") return;
    const id = details.set._id;
    if (triggered.current === id) return;
    triggered.current = id;
    retryTransient(() => processSet({ setId: id }), {
      attempts: 2,
      delayMs: 900,
    }).catch((error) => {
      notifyError(error, "The build stopped. Open the set to retry.");
    });
  }, [details, processSet]);

  const retry = async () => {
    if (!details) return;
    if (aiUnavailable) {
      toast.error(AI_NOT_CONFIGURED_MESSAGE);
      return;
    }
    setRetrying(true);
    try {
      await retryTransient(() => processSet({ setId: details.set._id }), {
        attempts: 2,
        delayMs: 900,
      });
    } catch (error) {
      notifyError(error, "The build could not be restarted.");
    } finally {
      setRetrying(false);
    }
  };

  const openTutor = () => {
    if (!validId) return;
    navigate(`/tutor?set=${setId}`);
  };

  const regenerateCards = async () => {
    if (!details || regenerating) return;
    if (aiUnavailable) {
      toast.error(AI_NOT_CONFIGURED_MESSAGE);
      return;
    }
    const approved = window.confirm(
      "Regenerate this set's cards? Cards are rebuilt from the notes, and review history for them is reset. The quiz is re-checked against the new deck.",
    );
    if (!approved) return;
    setRegenerating(true);
    try {
      await regenerateSetCards({ setId: details.set._id });
      toast.success("Regenerating grounded cards. This page will update when it finishes.");
    } catch (error) {
      notifyError(error, "Card regeneration could not start.");
    } finally {
      setRegenerating(false);
    }
  };

  const body = (() => {
    if (!validId) return <MissingCard />;
    if (details === undefined) return <SkeletonStudySetPage />;
    if (details === null) return <MissingCard />;

    const set = details.set;
    const qualification = qualificationLabel(set);
    // A frontend can reach the old backend for a few seconds during a deploy;
    // that server has no `asOf`. Fall back to the previous all-cards view there
    // rather than treating every card as not due and showing a false all-clear.
    const dueCards =
      details.asOf === undefined
        ? details.cards
        : details.cards.filter((card) => (card.dueAt ?? 0) <= details.asOf);
    const reviewAhead = reviewAheadFor === set._id;
    const backTo = set.courseId ? `/courses/${set.courseId}` : "/tutor#sets";
    const backLabel = set.courseId ? "Back to course" : "Back to my sets";
    const isMode = activeSection !== "summary";
    // A failed build may still have written a complete section. That section is
    // real work, so it stays reachable instead of being hidden behind the error
    // card. Only the stage that failed is unavailable.
    const completedSection =
      isMode &&
      ((activeSection === "cards" && set.cardCount > 0) ||
        (activeSection === "quiz" && set.quizCount > 0) ||
        (activeSection === "exam" && set.examCount > 0));
    const showSection = completedSection && set.status !== "queued";
    // The one sentence for a build that came in under the request, in the same
    // words the generator wrote it with.
    const shortfall = set.generationNote
      ? normaliseCapacityNote(set.generationNote)
      : "";
    // One build can fall short in more than one section; each sentence pair is
    // shown on its own line rather than run together into a paragraph.
    const shortfallLines = shortfall
      .split(/(?<=\.)\s+(?=Built )/)
      .map((line) => line.trim())
      .filter(Boolean);
    // One recommended way in: due cards first, then the quiz if it has never
    // been taken, otherwise flashcards.
    const recommendedSection: SetSection = details.dueCount > 0
      ? "cards"
      : details.quizAnswered === 0 && details.quizTotal > 0
        ? "quiz"
        : "cards";
    const recommendedLabel =
      recommendedSection === "quiz"
        ? "Start the quiz"
        : details.dueCount > 0
          ? "Review due cards"
          : "Open flashcards";

    return (
      <>
        <div className="set-stage">
          <div className="set-stage-bar">
            <Brand to="/tutor" />
            <div className="set-stage-links">
              <Link
                to={isMode ? `/sets/${set._id}` : backTo}
                className="set-back"
              >
                <ArrowLeft className="size-3.5" aria-hidden />
                {isMode ? "Back to set" : backLabel}
              </Link>
              <details className="set-menu">
                <summary aria-label="More set actions" className="set-menu-trigger">
                  ⋯
                </summary>
                <div className="set-menu-panel">
                  {[
                    { label: "Ask the tutor", onClick: openTutor },
                    { label: "Edit set", onClick: () => setSettingsOpen(true) },
                    ...(set.status === "ready"
                      ? [
                          {
                            label: regenerating
                              ? "Regenerating cards…"
                              : "Regenerate cards",
                            onClick: () => void regenerateCards(),
                          },
                        ]
                      : []),
                  ].map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={(event) => {
                        const menu = event.currentTarget.closest("details");
                        if (menu instanceof HTMLDetailsElement) menu.open = false;
                        action.onClick();
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </details>
            </div>
          </div>

          <div className="set-cover">
            <div className="set-cover-copy">
              <p className="set-eyebrow">
                {isMode ? SECTION_LABEL[activeSection] : "Study set"}
              </p>
              <SetTitle setId={set._id} title={set.title} />
              <p className="set-meta">
                <span>{set.sourceLabel || sourceLabel(set.sourceType)}</span>
                {qualification && <span>{qualification}</span>}
                <span>Updated {relativeDate(set.updatedAt)}</span>
              </p>
              {user?.isAnonymous && (
                <p className="set-guest">
                  Guest workspace · saved in this browser ·{" "}
                  <Link to={guestKeepWorkHref(`/sets/${set._id}`)}>
                    Keep my work
                  </Link>
                </p>
              )}
            </div>
            {!isMode && set.status === "ready" && (
              <Link
                to={`/sets/${set._id}/${recommendedSection}`}
                className="stage-button set-start"
              >
                {details.dueCount > 0 && (
                  <span className="set-start-count">{details.dueCount}</span>
                )}
                {recommendedLabel}
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            )}
          </div>

          <dl className="set-facts" aria-label="Set progress">
            {[
              { label: "Exam ready", value: `${details.readiness.score}%` },
              { label: "Cards due", value: String(details.dueCount) },
              { label: "Quiz", value: `${details.quizAnswered}/${details.quizTotal}` },
              {
                label: "Exam date",
                value: details.pace
                  ? `${details.pace.daysLeft} day${details.pace.daysLeft === 1 ? "" : "s"}`
                  : "Not set",
              },
            ].map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="set-desk">
          <div className="set-desk-inner">

        {set.status === "ready" && details.cardRepairNeeded && (
          <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-[#F3E2C8] bg-[#FFF7E8] px-4 py-3 text-[0.8rem] leading-relaxed text-[#8A5D00] sm:flex-row sm:items-center sm:justify-between">
            <p>
              <span className="font-semibold">Some cards need rebuilding.</span>{" "}
              Their answers are too long or end mid-sentence; the old set was
              likely cut off while saving.
            </p>
            <Button
              type="button"
              onClick={() => void regenerateCards()}
              disabled={regenerating}
              variant="outline"
              className="h-9 shrink-0 rounded-full border-[#E7C98B] bg-white px-4 text-[0.76rem] font-semibold text-[#8A5D00] shadow-none hover:bg-[#FFF1D8]"
            >
              {regenerating ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
              Regenerate cards
            </Button>
          </div>
        )}

        {(set.status === "ready" || showSection) && (
          <nav
            aria-label="Set sections"
            className="set-tabs no-scrollbar"
          >
            {(
              [
                ["summary", "Overview"],
                ["cards", "Flashcards"],
                ["quiz", "Quiz"],
                ["exam", "Exam practice"],
                ...(details.weakCardCount > 0 || details.weakQuizCount > 0
                  ? [["weak", SECTION_LABEL.weak]]
                  : []),
              ] as Array<[SetSection, string]>
            ).map(([value, label]) => {
              const active = value === activeSection;
              return (
                <Link
                  key={value}
                  to={value === "summary" ? `/sets/${set._id}` : `/sets/${set._id}/${value}`}
                  aria-current={active ? "page" : undefined}
                  className={cn("set-tab", active && "is-active")}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        )}

        {set.status === "error" && !showSection ? (
          <ErrorPanel set={set} onRetry={retry} retrying={retrying} />
        ) : set.status !== "ready" && !showSection ? (
          <BuildingPanel
            set={set}
            stale={details.processingStale}
            onRetry={retry}
            retrying={retrying}
          />
        ) : isMode ? (
          <div className="set-mode">
            {activeSection === "cards" &&
              (details.cards.length > 0 &&
              dueCards.length === 0 &&
              !reviewAhead ? (
                <div className="surface-card mx-auto w-full max-w-2xl p-7 text-center sm:p-9">
                  <Mascot size={92} float={false} className="mx-auto" />
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#E9FBF3] px-3 py-1 text-xs font-semibold text-[#0B6B45]">
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    All caught up
                  </p>
                  <h2 className="mt-3 font-display text-[1.35rem] font-bold text-brand-ink">
                    No cards are due
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-[0.86rem] leading-relaxed text-muted-foreground">
                    FSRS has scheduled all {plural(details.cards.length, "card")}
                    {details.nextDueAt
                      ? `; the next review is ${timeUntil(details.nextDueAt)}.`
                      : "."}
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-[0.76rem] leading-relaxed text-muted-foreground">
                    Reviewing ahead is extra practice. It changes the next
                    interval, so use it when you want more work, not instead of
                    the scheduled review.
                  </p>
                  <Button
                    type="button"
                    onClick={() => setReviewAheadFor(set._id)}
                    variant="outline"
                    className="mt-4 h-10 rounded-full border-border bg-white px-5 text-[0.82rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
                  >
                    Review all {plural(details.cards.length, "card")} anyway
                  </Button>
                </div>
              ) : (
                <FlashcardReview
                  key={`${set._id}-${reviewAhead ? "ahead" : "due"}`}
                  cards={reviewAhead ? details.cards : dueCards}
                  onTakeQuiz={() => navigate(`/sets/${set._id}/quiz`)}
                />
              ))}
            {activeSection === "quiz" && (
              <QuizRunner
                key={set._id}
                quiz={details.quiz}
                setId={set._id}
                qualification={qualification}
                readiness={details.readiness.score}
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
            <div className="set-overview-intro">
              <p className="set-kicker">Study modes</p>
              <h2 className="set-section-title">Open the part you need.</h2>
              <p className="set-lede">
                One set holds the summary, the cards and the questions. Start with
                the recommended mode, then close the gaps it finds.
              </p>
            </div>

            {/* One compact build summary. The denominators are what was actually
                built, not what was asked for: a bar that can never fill is worse
                than no bar. The shortfall sentence below explains any gap. */}
            {(() => {
              const examMarked = details.exams.filter(
                (exam) => exam.gradedAt !== undefined,
              ).length;
              const rows = [
                {
                  label: `${set.cardCount} card${set.cardCount === 1 ? "" : "s"}`,
                  title: "Flashcards built from these notes",
                },
                {
                  // The denominator is the built count, so a set that came in
                  // under the request never shows a bar or ratio that cannot
                  // reach its end.
                  label:
                    set.quizCount > 0
                      ? `Quiz ${details.quizAnswered}/${set.quizCount}`
                      : "No quiz questions",
                  title: "Quiz questions answered, out of the ones built",
                },
                {
                  label:
                    set.examCount > 0
                      ? `Exam ${examMarked}/${set.examCount}`
                      : "No exam questions",
                  title: "Written answers marked, out of the ones built",
                },
              ];
              return (
                <div className="set-build">
                  <div
                    className="set-build-chips"
                    aria-label="What this set was built with"
                  >
                    {rows.map((row) => (
                      <span
                        key={row.label}
                        title={row.title}
                        className="rounded-full border border-border bg-brand-panel px-3 py-1 text-[0.76rem] font-semibold tabular-nums text-brand-ink/75"
                      >
                        {row.label}
                      </span>
                    ))}
                  </div>
                  {shortfallLines.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {shortfallLines.map((line) => (
                        <li
                          key={line}
                          className="text-[0.74rem] leading-relaxed text-muted-foreground"
                        >
                          {line}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })()} 

            {/* One line that defines the percentage, right under the number. */}
            <p className="set-note">
              Exam ready % is the share of this set you can currently recall and
              answer correctly. It counts cards that are settled and not due,
              quiz questions you have answered right, and written answers you
              have had marked.
            </p>

            <div className="set-actions-wrap">
              <StudyActions
                setId={set._id}
                set={set}
                recommended={recommendedSection}
                quizAnswered={details.quizAnswered}
                quizTotal={details.quizTotal}
              />
            </div>

            {/* A phone-sized session CTA that stays in reach while the overview
                scrolls. The header button is hidden below sm for the same reason. */}
            <div className="set-sticky-start">
              <Link
                to={`/sets/${set._id}/${recommendedSection}`}
                className="stage-button"
              >
                {recommendedLabel}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>

            <div className="set-overview">
              <OverviewView
                setId={set._id}
                set={set}
                sourceImages={details.sourceImages}
              />
            </div>

            {/* Specification coverage, export and the timed mock: the three
                things a student needs when the set is done, not while building
                it. Each is one expansion away. */}
            <div className="set-tools">
              <SetExportButtons setId={set._id} />
              <Link
                to={`/sets/${set._id}/mock`}
                className="set-tool"
              >
                <span className="flex items-center gap-2">
                  <Timer className="size-4 text-chrome-7" aria-hidden />
                  Sit a timed mock
                </span>
                <span className="text-[0.72rem] font-medium text-muted-foreground">
                  One minute per mark
                </span>
              </Link>
            </div>

            {/* Pacing detail is useful, but it should not sit between the
                student and the set. It is one expansion away. */}
            <details className="set-readiness">
              <summary>
                How readiness and exam pace work
              </summary>
              <div className="mt-3">
                <ReadinessPanel
                  setId={set._id}
                  readiness={details.readiness}
                  projected={details.projected}
                  pace={details.pace}
                  weakCardCount={details.weakCardCount}
                  weakQuizCount={details.weakQuizCount}
                  dueCount={details.dueCount}
                  examBoard={set.examBoard}
                />
              </div>
            </details>
          </>
        )}

        {!isMode && set.status === "ready" && (
          <NextStep
            to="/today"
            title="Add these cards to today's session"
            hint="Due cards from every set, in one short sprint"
          />
        )}

        <SetSettingsDialog
          set={set}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
          </div>
        </div>
      </>
    );
  })();

  return (
    <AppShell focus>
      <div className="set-screen" data-section={activeSection}>{body}</div>
    </AppShell>
  );
}
