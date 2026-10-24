import { AppShell } from "@/components/AppShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { percent, relativeDate } from "@/lib/format";
import { courseSubtitle, subjectMeta } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleDot,
  Clock,
  FileQuestion,
  Info,
  Layers,
  Loader2,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
  Wand2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { toast } from "sonner";

function LoadingCard() {
  return (
    <div className="flex min-h-[280px] items-center justify-center rounded-[2rem] border border-border bg-card">
      <div className="text-center">
        <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
        <p className="mt-3 text-[0.82rem] text-muted-foreground">
          Loading your pathway…
        </p>
      </div>
    </div>
  );
}

function MissingCard() {
  return (
    <div className="mx-auto mt-6 max-w-lg rounded-[2rem] border border-border bg-card p-8 text-center">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-brand-peach">
        Course not found
      </p>
      <h1 className="mt-2 font-display text-[1.5rem] font-bold text-brand-ink">
        This pathway isn't available
      </h1>
      <p className="mt-2 text-[0.9rem] leading-relaxed text-muted-foreground">
        It may have been removed, or it belongs to a different account.
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
  course,
  stale,
  onRetry,
  retrying,
}: {
  course: Doc<"courses">;
  stale: boolean;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-[2rem] border border-border bg-white p-6 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#F3ECFF] text-[#5B3DF5]">
          <Wand2 className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[#7C5CFF]">
            Building pathway
          </p>
          <h2 className="mt-1 font-display text-[1.3rem] font-bold text-brand-ink">
            Mapping {course.subject}
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-[0.84rem] text-muted-foreground">
            <Clock className="size-3.5" />
            {course.progress || "Waiting to start"}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-2.5">
        {[
          "Reading the current specification",
          "Laying out units in teaching order",
          "Tagging topics with exam skills",
        ].map((step, index) => (
          <div
            key={step}
            className={cn(
              "flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-[0.82rem]",
              index === 0
                ? "border-[#D8CCFF] bg-[#FAF8FF] text-[#5B3DF5]"
                : "border-border text-muted-foreground",
            )}
          >
            {index === 0 ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CircleDot className="size-3.5" />
            )}
            {step}
          </div>
        ))}
      </div>

      <p className="mt-5 text-[0.78rem] leading-relaxed text-muted-foreground">
        This usually takes under a minute. You can leave this page — the pathway
        keeps building in the background.
      </p>

      {stale && (
        <div className="mt-4 rounded-2xl bg-[#FFF6E5] px-4 py-3">
          <p className="text-[0.8rem] leading-relaxed text-[#8A5D00]">
            This build has been running for a while. Retry it to start fresh.
          </p>
          <Button
            onClick={onRetry}
            disabled={retrying}
            className="mt-2 h-9 rounded-full bg-[#8A5D00] px-4 text-[0.8rem] font-semibold text-white hover:bg-[#704B00]"
          >
            {retrying ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Retry build
          </Button>
        </div>
      )}
    </section>
  );
}

function ErrorPanel({
  course,
  onRetry,
  retrying,
}: {
  course: Doc<"courses">;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <section className="mt-6 rounded-[2rem] border border-[#F6C9CE] bg-[#FFF7F7] p-6 sm:p-7">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[#C23B49]">
        Pathway needs a retry
      </p>
      <h2 className="mt-1 font-display text-[1.25rem] font-bold text-brand-ink">
        Bluprint couldn't finish this map
      </h2>
      <p className="mt-2 max-w-2xl text-[0.86rem] leading-relaxed text-[#8C3A44]">
        {course.errorMessage ||
          "The pathway model didn't return a complete course map. Retry to try another free model."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={onRetry}
          disabled={retrying}
          className="h-10 rounded-full bg-[#191B27] px-5 font-semibold text-white hover:bg-[#2A2D3E]"
        >
          {retrying ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RotateCcw className="size-4" />
          )}
          Retry pathway
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-10 rounded-full border-border bg-white px-5 font-semibold text-brand-ink hover:bg-brand-panel"
        >
          <Link to="/dashboard">Back to home</Link>
        </Button>
      </div>
    </section>
  );
}

export default function Course() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const validId = Boolean(courseId && /^[a-z0-9]{20,40}$/i.test(courseId));
  const details = useQuery(
    api.courses.getDetails,
    validId ? { courseId: courseId as Id<"courses"> } : "skip",
  );
  const createTopicSet = useMutation(api.courses.createTopicSet);
  const setTopicDone = useMutation(api.courses.setTopicDone);
  const removeCourse = useMutation(api.courses.remove);
  const rebuild = useAction(api.ai.rebuildCoursePathway);

  const [retrying, setRetrying] = useState(false);
  const [busyTopic, setBusyTopic] = useState<string | null>(null);
  const [tickingTopic, setTickingTopic] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const setsByTopic = useMemo(() => {
    const map = new Map<string, NonNullable<typeof details>["sets"][number]>();
    for (const set of details?.sets ?? []) {
      if (set.topicId) map.set(set.topicId, set);
    }
    return map;
  }, [details]);

  const nextTopic = useMemo(() => {
    if (!details?.course.pathway) return null;
    const done = new Set(details.course.completedTopics);
    for (const [unitIndex, unit] of details.course.pathway.units.entries()) {
      for (const topic of unit.topics) {
        if (!done.has(topic.id)) return { unit, topic, unitIndex };
      }
    }
    return null;
  }, [details]);

  const handleRetry = async () => {
    if (!validId) return;
    setRetrying(true);
    try {
      await rebuild({ courseId: courseId as Id<"courses"> });
      toast.success("Rebuilding the pathway in the background.");
    } catch (error) {
      toast.error(readableError(error, "Could not rebuild this pathway."));
    } finally {
      setRetrying(false);
    }
  };

  const handleTopic = async (topicId: string) => {
    if (!validId) return;
    const existing = setsByTopic.get(topicId);
    if (existing) {
      navigate(`/sets/${existing._id}`);
      return;
    }
    setBusyTopic(topicId);
    try {
      const result = await createTopicSet({
        courseId: courseId as Id<"courses">,
        topicId,
      });
      navigate(`/sets/${result.setId}`);
    } catch (error) {
      toast.error(readableError(error, "Could not build material for that topic."));
    } finally {
      setBusyTopic(null);
    }
  };

  const toggleTopic = async (topicId: string, done: boolean) => {
    if (!validId) return;
    setTickingTopic(topicId);
    try {
      await setTopicDone({
        courseId: courseId as Id<"courses">,
        topicId,
        done,
      });
    } catch (error) {
      toast.error(readableError(error, "Could not update that topic."));
    } finally {
      setTickingTopic(null);
    }
  };

  const handleDelete = async () => {
    if (!validId) return;
    setDeleting(true);
    try {
      await removeCourse({ courseId: courseId as Id<"courses"> });
      toast.success("Course removed. Your study sets are still in the library.");
      navigate("/dashboard");
    } catch (error) {
      toast.error(readableError(error, "Could not remove that course."));
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const body = (() => {
    if (!validId) return <MissingCard />;
    if (details === undefined) return <LoadingCard />;
    if (details === null) return <MissingCard />;

    const { course, sets } = details;
    const meta = subjectMeta(course.subject);
    const Icon = meta.icon;
    const pathway = course.pathway;
    const mastery = percent(details.completedCount, details.topicCount);
    const cards = sets.reduce((sum, set) => sum + set.cardCount, 0);
    const known = sets.reduce((sum, set) => sum + set.knownCount, 0);
    const done = new Set(course.completedTopics);

    return (
      <>
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            aria-label="Back to home"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-white text-brand-ink/70 transition-colors hover:bg-brand-panel hover:text-brand-ink"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              className={cn(
                "hidden size-12 shrink-0 place-items-center rounded-2xl sm:grid",
                meta.tint,
              )}
              style={{ color: meta.color }}
            >
              <Icon className="size-6" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-display text-[1.55rem] font-bold leading-tight text-brand-ink sm:text-[1.9rem]">
                {course.subject}
              </h1>
              <p className="mt-0.5 text-[0.8rem] text-muted-foreground">
                {courseSubtitle(course)}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Course options"
                className="size-9 shrink-0 rounded-full text-muted-foreground hover:bg-brand-panel hover:text-brand-ink"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-2xl">
              <DropdownMenuItem
                disabled={retrying}
                onSelect={() => void handleRetry()}
                className="cursor-pointer gap-2 text-[0.82rem]"
              >
                <RotateCcw className="size-4" />
                Rebuild pathway
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setConfirmingDelete(true)}
                className="cursor-pointer gap-2 text-[0.82rem] text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" />
                Remove course
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {course.status === "error" ? (
          <ErrorPanel course={course} onRetry={handleRetry} retrying={retrying} />
        ) : course.status !== "ready" || !pathway ? (
          <BuildingPanel
            course={course}
            stale={details.processingStale}
            onRetry={handleRetry}
            retrying={retrying}
          />
        ) : (
          <>
            <section className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-border bg-card px-4 py-4">
                <p className="text-[0.72rem] font-medium text-muted-foreground">
                  Topics revised
                </p>
                <p className="mt-0.5 font-display text-[1.5rem] font-bold leading-tight text-brand-ink">
                  {details.completedCount}
                  <span className="text-[0.95rem] font-semibold text-muted-foreground">
                    {" "}
                    / {details.topicCount}
                  </span>
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-panel">
                  <div
                    className="h-full rounded-full bg-[#7C5CFF] transition-[width] duration-500"
                    style={{ width: `${mastery}%` }}
                  />
                </div>
              </div>
              <div className="rounded-3xl border border-border bg-card px-4 py-4">
                <p className="text-[0.72rem] font-medium text-muted-foreground">
                  Study sets built
                </p>
                <p className="mt-0.5 font-display text-[1.5rem] font-bold leading-tight text-brand-ink">
                  {sets.length}
                </p>
                <p className="mt-1 text-[0.72rem] text-muted-foreground">
                  {sets.length === 0
                    ? "Open a topic to make the first one"
                    : `${cards} cards across this course`}
                </p>
              </div>
              <div className="rounded-3xl border border-border bg-card px-4 py-4">
                <p className="text-[0.72rem] font-medium text-muted-foreground">
                  Cards known
                </p>
                <p className="mt-0.5 font-display text-[1.5rem] font-bold leading-tight text-brand-ink">
                  {cards > 0 ? `${percent(known, cards)}%` : "—"}
                </p>
                <p className="mt-1 text-[0.72rem] text-muted-foreground">
                  {cards > 0 ? `${known} of ${cards} cards` : "Build material to track this"}
                </p>
              </div>
            </section>

            <section className="mt-4 rounded-[2rem] border border-border bg-white p-5 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#F3ECFF] text-[#5B3DF5]">
                    <BookOpen className="size-5" />
                  </span>
                  <div>
                    <h2 className="font-display text-[1.1rem] font-bold text-brand-ink">
                      How this course is assessed
                    </h2>
                    <p className="mt-1 max-w-2xl text-[0.84rem] leading-relaxed text-muted-foreground">
                      {pathway.examFormat}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-[#EAFBF0] px-3 py-1.5 text-[0.72rem] font-semibold text-[#128A4C]">
                  {details.topicCount} topics · {pathway.units.length} units
                </span>
              </div>
              <p className="mt-4 max-w-3xl text-[0.88rem] leading-relaxed text-brand-ink/75">
                {pathway.overview}
              </p>
              <p className="mt-3 flex items-start gap-1.5 text-[0.72rem] leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                AI-built from the published specification. Always check your exam
                board's current specification before relying on a topic list.
              </p>
            </section>

            {nextTopic && (
              <section className="mt-4 flex flex-col gap-4 rounded-[2rem] border border-[#D8CCFF] bg-[#FAF8FF] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#7C5CFF] text-white">
                    <Target className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-[#6B4EE6]">
                      Next up · {nextTopic.unit.title}
                    </p>
                    <h2 className="mt-1 font-display text-[1.1rem] font-bold text-brand-ink">
                      {nextTopic.topic.title}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-[0.82rem] leading-relaxed text-muted-foreground">
                      {nextTopic.topic.summary}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => void handleTopic(nextTopic.topic.id)}
                  disabled={busyTopic !== null}
                  className="h-10 shrink-0 rounded-full bg-[#191B27] px-5 font-semibold text-white hover:bg-[#2A2D3E]"
                >
                  {busyTopic === nextTopic.topic.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : setsByTopic.has(nextTopic.topic.id) ? (
                    <ArrowRight className="size-4" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {setsByTopic.has(nextTopic.topic.id) ? "Open study set" : "Build study set"}
                </Button>
              </section>
            )}

            <section className="mt-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-[1.2rem] font-bold text-brand-ink">
                    Revision pathway
                  </h2>
                  <p className="mt-0.5 text-[0.78rem] text-muted-foreground">
                    Work through each unit in order, or jump to a topic you need.
                  </p>
                </div>
                {sets.length > 0 && (
                  <Link
                    to="/dashboard#sets"
                    className="hidden items-center gap-1 text-[0.8rem] font-semibold text-brand-ink/60 hover:text-brand-ink sm:flex"
                  >
                    <Layers className="size-3.5" />
                    All study sets
                  </Link>
                )}
              </div>

              <div className="mt-3 space-y-3">
                {pathway.units.map((unit, unitIndex) => {
                  const completedInUnit = unit.topics.filter((topic) =>
                    done.has(topic.id),
                  ).length;
                  const unitComplete = completedInUnit === unit.topics.length;
                  return (
                    <details
                      key={`${unit.title}-${unitIndex}`}
                      open={unitIndex === (nextTopic?.unitIndex ?? 0)}
                      className="group overflow-hidden rounded-3xl border border-border bg-white"
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 transition-colors hover:bg-brand-panel/50 sm:px-5 [&::-webkit-details-marker]:hidden">
                        <span
                          className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-xl text-[0.8rem] font-bold",
                            unitComplete
                              ? "bg-[#EAFBF0] text-[#128A4C]"
                              : "bg-brand-panel text-brand-ink/60",
                          )}
                        >
                          {unitComplete ? <Check className="size-4" /> : unitIndex + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-display text-[0.98rem] font-bold text-brand-ink">
                            {unit.title}
                          </h3>
                          <p className="mt-0.5 text-[0.74rem] text-muted-foreground">
                            {completedInUnit} of {unit.topics.length} topics revised
                          </p>
                        </div>
                        <span className="hidden max-w-[280px] truncate text-[0.76rem] text-muted-foreground md:block">
                          {unit.summary}
                        </span>
                        <ChevronDown className="size-4 shrink-0 text-brand-ink/40 transition-transform group-open:rotate-180" />
                      </summary>

                      <div className="border-t border-border">
                        {unit.topics.map((topic) => {
                          const isDone = done.has(topic.id);
                          const set = setsByTopic.get(topic.id);
                          return (
                            <div
                              key={topic.id}
                              className="flex flex-col gap-3 border-b border-border/70 px-4 py-4 last:border-b-0 sm:flex-row sm:items-start sm:px-5"
                            >
                              <button
                                type="button"
                                aria-label={
                                  isDone
                                    ? `Mark ${topic.title} as not revised`
                                    : `Mark ${topic.title} as revised`
                                }
                                aria-pressed={isDone}
                                disabled={tickingTopic === topic.id}
                                onClick={() => void toggleTopic(topic.id, !isDone)}
                                className={cn(
                                  "grid size-6 shrink-0 place-items-center rounded-full border transition-colors",
                                  isDone
                                    ? "border-[#22A06B] bg-[#22A06B] text-white"
                                    : "border-border bg-white text-transparent hover:border-[#22A06B] hover:text-[#22A06B]",
                                )}
                              >
                                {tickingTopic === topic.id ? (
                                  <Loader2 className="size-3 animate-spin text-muted-foreground" />
                                ) : (
                                  <Check className="size-3.5" />
                                )}
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4
                                    className={cn(
                                      "text-[0.9rem] font-semibold",
                                      isDone
                                        ? "text-brand-ink/50 line-through"
                                        : "text-brand-ink",
                                    )}
                                  >
                                    {topic.title}
                                  </h4>
                                  {topic.specReference && (
                                    <span className="rounded-full bg-brand-panel px-2 py-0.5 text-[0.62rem] font-semibold text-brand-ink/60">
                                      {topic.specReference}
                                    </span>
                                  )}
                                </div>
                                {topic.summary && (
                                  <p className="mt-1 text-[0.8rem] leading-relaxed text-muted-foreground">
                                    {topic.summary}
                                  </p>
                                )}
                                {topic.keyPoints.length > 0 && (
                                  <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                                    {topic.keyPoints.slice(0, 4).map((point) => (
                                      <li
                                        key={point}
                                        className="flex items-start gap-1.5 text-[0.75rem] leading-relaxed text-brand-ink/60"
                                      >
                                        <CircleDot className="mt-0.5 size-2.5 shrink-0 text-[#7C5CFF]" />
                                        {point}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {topic.examSkill && (
                                  <p className="mt-2 flex items-start gap-1.5 text-[0.72rem] leading-relaxed text-[#6B4EE6]">
                                    <FileQuestion className="mt-0.5 size-3 shrink-0" />
                                    {topic.examSkill}
                                  </p>
                                )}
                              </div>

                              <div className="flex shrink-0 items-center gap-2 pl-9 sm:pl-0">
                                {set && (
                                  <span
                                    className={cn(
                                      "hidden rounded-full px-2.5 py-1 text-[0.68rem] font-semibold sm:inline-flex",
                                      set.status === "ready"
                                        ? "bg-[#EAFBF0] text-[#128A4C]"
                                        : set.status === "error"
                                          ? "bg-[#FFEEF0] text-[#C23B49]"
                                          : "bg-[#FFF6E5] text-[#96650A]",
                                    )}
                                  >
                                    {set.status === "ready"
                                      ? `${set.cardCount} cards`
                                      : set.status === "error"
                                        ? "Needs retry"
                                        : "Building"}
                                  </span>
                                )}
                                <Button
                                  type="button"
                                  onClick={() => void handleTopic(topic.id)}
                                  disabled={busyTopic !== null}
                                  variant="outline"
                                  className={cn(
                                    "h-8 rounded-full border-border bg-white px-3 text-[0.76rem] font-semibold text-brand-ink hover:bg-brand-panel",
                                    !set && "border-[#D8CCFF] bg-[#FAF8FF] text-[#5B3DF5]",
                                  )}
                                >
                                  {busyTopic === topic.id ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : set ? (
                                    <ArrowRight className="size-3.5" />
                                  ) : (
                                    <Sparkles className="size-3.5" />
                                  )}
                                  {set ? "Open set" : "Study this topic"}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>

            <p className="mt-4 flex items-center gap-1.5 text-[0.72rem] text-muted-foreground">
              <Pencil className="size-3.5" />
              Progress updated {relativeDate(course.updatedAt)} · last studied{" "}
              {course.lastStudiedAt ? relativeDate(course.lastStudiedAt) : "not yet"}
            </p>
          </>
        )}

        <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display">
                Remove {course.subject}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                This deletes the pathway and its tick-off progress. Any study sets
                you built from it stay in your library.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting} className="rounded-full">
                Keep course
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting}
                onClick={(event) => {
                  event.preventDefault();
                  void handleDelete();
                }}
                className="rounded-full bg-destructive text-white hover:bg-destructive/90"
              >
                {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
                Remove course
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  })();

  return <AppShell>{body}</AppShell>;
}
