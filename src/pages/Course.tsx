import { AppShell } from "@/components/AppShell";
import { CognitoPaperLibrary } from "@/components/study/CognitoPaperLibrary";
import { CoursePastPapers } from "@/components/study/CoursePastPapers";
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
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { percent, relativeDate } from "@/lib/format";
import { courseSubtitle } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import { ChevronDown, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { toast } from "sonner";

/**
 * Faceted pathway nodes. Colours are raw hex rather than Tailwind classes
 * because the progress ring is painted with a conic gradient, and each unit
 * keeps one colour down the path.
 */
const PATH_COLORS = [
  { hex: "#128A4C", soft: "#E6F9F6", ring: "#B6E4DB" },
  { hex: "#4C5FD5", soft: "#EEF0FD", ring: "#C6CCF3" },
  { hex: "#B7791F", soft: "#FBF3E2", ring: "#EBD6AB" },
  { hex: "#C2466A", soft: "#FBECF1", ring: "#EDC4D2" },
  { hex: "#6B4DBE", soft: "#F2EDFC", ring: "#D6C8F0" },
  { hex: "#2B7FB8", soft: "#EAF5FB", ring: "#BFDDEF" },
];

/** Octagon, so each node reads as a cut gem rather than a plain circle. */
const NODE_SHAPE =
  "polygon(30% 3%, 70% 3%, 97% 30%, 97% 70%, 70% 97%, 30% 97%, 3% 70%, 3% 30%)";

function PathNode({
  percent,
  color,
  index,
  total,
}: {
  percent: number;
  color: (typeof PATH_COLORS)[number];
  index: number;
  total: number;
}) {
  return (
    <span className="relative z-10 grid size-[74px] shrink-0 place-items-center sm:size-[86px]">
      {/* Faint geometric echo under the node, like a stamped path marker. */}
      <span
        aria-hidden
        className="absolute -bottom-1.5 left-1/2 h-4 w-16 -translate-x-1/2 opacity-60 blur-[2px]"
        style={{ backgroundColor: color.soft }}
      />
      <span
        aria-hidden
        className="absolute inset-0 shadow-[0_10px_24px_-18px_rgba(22,24,31,0.6)]"
        style={{
          clipPath: NODE_SHAPE,
          background: `conic-gradient(${color.hex} ${percent}%, #E8E9EF 0)`,
        }}
      />
      <span
        aria-hidden
        className="absolute inset-[6px]"
        style={{ clipPath: NODE_SHAPE, backgroundColor: color.soft }}
      />
      <span
        aria-hidden
        className="absolute inset-[10px] bg-white"
        style={{ clipPath: NODE_SHAPE }}
      />
      <span className="relative text-center leading-none">
        <span
          className="block font-display text-[0.95rem] font-extrabold"
          style={{ color: color.hex }}
        >
          {percent}%
        </span>
        <span className="mt-1 block text-[0.5rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Part {index + 1}/{total}
        </span>
      </span>
    </span>
  );
}

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
}: {
  course: Doc<"courses">;
  stale: boolean;
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-[2rem] border border-border bg-white p-6 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-8">
      <div>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[#7C5CFF]">
          Building pathway
        </p>
        <h2 className="mt-1 font-display text-[1.3rem] font-bold text-brand-ink">
          Mapping {course.subject}
        </h2>
        <p className="mt-1 text-[0.84rem] text-muted-foreground">
          {course.progress || "Waiting to start"}
        </p>
      </div>

      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-brand-panel">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-[#7C5CFF]" />
      </div>

      <p className="mt-4 text-[0.78rem] leading-relaxed text-muted-foreground">
        This usually takes under a minute. You can leave this page — the pathway
        keeps building in the background.
      </p>

      {stale && (
        <p className="mt-4 rounded-2xl bg-[#FFF6E5] px-4 py-3 text-[0.8rem] leading-relaxed text-[#8A5D00]">
          This is taking longer than usual. Bluprint will restart it
          automatically — no action is needed.
        </p>
      )}
    </section>
  );
}

function RecoveringPanel({ course }: { course: Doc<"courses"> }) {
  return (
    <section className="mt-6 rounded-[2rem] border border-border bg-white p-6 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-8">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[#7C5CFF]">
        Preparing pathway
      </p>
      <h2 className="mt-1 font-display text-[1.3rem] font-bold text-brand-ink">
        Putting the finishing touches on {course.subject}
      </h2>
      <p className="mt-2 max-w-2xl text-[0.86rem] leading-relaxed text-muted-foreground">
        Bluprint is completing this map automatically. You can leave this page —
        it will be ready when you come back.
      </p>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-brand-panel">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-[#7C5CFF]" />
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
  const recoverCourses = useMutation(api.courses.recoverMine);
  const rebuild = useAction(api.ai.rebuildCoursePathway);

  const recoveryRequested = useRef(false);
  useEffect(() => {
    if (!details) return;
    if (details.course.status !== "error" && !details.processingStale) {
      recoveryRequested.current = false;
      return;
    }
    if (recoveryRequested.current) return;
    recoveryRequested.current = true;
    void recoverCourses().catch(() => {
      recoveryRequested.current = false;
    });
  }, [details, recoverCourses]);

  const [retrying, setRetrying] = useState(false);
  const [busyTopic, setBusyTopic] = useState<string | null>(null);
  const [tickingTopic, setTickingTopic] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // null means "follow the next unfinished unit"; -1 means every unit closed.
  const [openUnit, setOpenUnit] = useState<number | null>(null);
  const openTutor = (unitTitle?: string) => {
    if (!validId) return;
    const params = new URLSearchParams([["course", courseId as string]]);
    if (unitTitle) params.set("unit", unitTitle);
    navigate(`/tutor?${params.toString()}`);
  };
  const [removal, setRemoval] = useState<{
    kind: "unit" | "topic";
    unitIndex: number;
    topicId?: string;
    title: string;
  } | null>(null);
  const [removing, setRemoving] = useState(false);
  const removeTopic = useMutation(api.courses.removeTopic);
  const removeUnit = useMutation(api.courses.removeUnit);

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

  /** Deletes one unit or topic the student is not studying. */
  const handleRemove = async () => {
    if (!validId || !removal) return;
    setRemoving(true);
    try {
      if (removal.kind === "unit") {
        await removeUnit({ courseId: courseId as Id<"courses">, unitIndex: removal.unitIndex });
      } else {
        await removeTopic({
          courseId: courseId as Id<"courses">,
          topicId: removal.topicId!,
        });
      }
      toast.success(`Removed ${removal.title} from this pathway.`);
      setRemoval(null);
    } catch (error) {
      toast.error(readableError(error, "Could not remove that item."));
    } finally {
      setRemoving(false);
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
    const pathway = course.pathway;
    const mastery = percent(details.completedCount, details.topicCount);
    const cards = sets.reduce((sum, set) => sum + set.cardCount, 0);
    const known = sets.reduce((sum, set) => sum + set.knownCount, 0);
    const done = new Set(course.completedTopics);

    return (
      <>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/dashboard"
            className="text-[0.8rem] font-semibold text-muted-foreground hover:text-brand-ink"
          >
            Back to home
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[1.55rem] font-bold leading-tight text-brand-ink sm:text-[1.9rem]">
              {course.subject}
            </h1>
            <p className="mt-0.5 text-[0.8rem] text-muted-foreground">
              {courseSubtitle(course)}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {pathway && (
              <Button
                type="button"
                onClick={() => openTutor()}
                className="h-9 rounded-full bg-[#EDE8FF] px-4 text-[0.8rem] font-semibold text-[#5130D8] hover:bg-[#E2DBFF]"
              >
                <Sparkles className="size-3.5" aria-hidden />
                Ask the tutor
              </Button>
            )}
            {course.status === "ready" && (
              <Button
                variant="outline"
                onClick={() => void handleRetry()}
                disabled={retrying}
                className="h-9 rounded-full border-border bg-white px-4 text-[0.8rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
              >
                {retrying ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Rebuild pathway
              </Button>
            )}
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="px-2 text-[0.78rem] font-semibold text-destructive underline-offset-2 hover:underline"
            >
              Remove
            </button>
          </div>
        </div>

        {course.status === "error" ? (
          <RecoveringPanel course={course} />
        ) : course.status !== "ready" || !pathway ? (
          <BuildingPanel course={course} stale={details.processingStale} />
        ) : (
          <>
            <section className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-[#CFEBDD] bg-[#F1FBF6] px-4 py-4">
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
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#D7EFE2]">
                  <div
                    className="h-full rounded-full bg-[#128A4C] transition-[width] duration-500"
                    style={{ width: `${mastery}%` }}
                  />
                </div>
              </div>
              <div className="rounded-3xl border border-[#DDD4FB] bg-[#F3F0FF] px-4 py-4">
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
              <div className="rounded-3xl border border-[#F5E2C4] bg-[#FFF7EC] px-4 py-4">
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
                <div>
                  <h2 className="font-display text-[1.1rem] font-bold text-brand-ink">
                    How this course is assessed
                  </h2>
                  <p className="mt-1 max-w-2xl text-[0.84rem] leading-relaxed text-muted-foreground">
                    {pathway.examFormat}
                  </p>
                </div>
                <span className="rounded-full bg-[#EAFBF0] px-3 py-1.5 text-[0.72rem] font-semibold text-[#128A4C]">
                  {details.topicCount} topics · {pathway.units.length} units
                </span>
              </div>
              <p className="mt-4 max-w-3xl text-[0.88rem] leading-relaxed text-brand-ink/75">
                {pathway.overview}
              </p>
              <p className="mt-3 text-[0.72rem] leading-relaxed text-muted-foreground">
                AI-built from the published specification. Always check your exam
                board's current specification before relying on a topic list.
              </p>
            </section>

            {/* The real board papers first, then the AI practice papers. */}
            <CognitoPaperLibrary courseId={course._id} />

            <CoursePastPapers courseId={course._id} />

            {nextTopic && (
              <section className="mt-4 flex flex-col gap-4 rounded-[2rem] border border-[#D8CCFF] bg-[#FAF8FF] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
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
                <Button
                  onClick={() => void handleTopic(nextTopic.topic.id)}
                  disabled={busyTopic !== null}
                  className="h-10 shrink-0 rounded-full bg-[#191B27] px-5 font-semibold text-white hover:bg-[#2A2D3E]"
                >
                  {busyTopic === nextTopic.topic.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {setsByTopic.has(nextTopic.topic.id) ? "Open study set" : "Build study set"}
                </Button>
              </section>
            )}

            <section className="mt-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#6B4EE6]">
                    Revision pathway
                  </p>
                  <h2 className="mt-1 font-display text-[1.25rem] font-bold text-brand-ink">
                    Your route through the specification
                  </h2>
                  <p className="mt-0.5 text-[0.78rem] text-muted-foreground">
                    Tap a part to open its topics. Remove anything your school does
                    not teach — the rest of the pathway stays as it is.
                  </p>
                </div>
              </div>

              {pathway.units.length === 0 ? (
                <div className="mt-4 rounded-3xl border border-dashed border-border bg-white px-5 py-10 text-center">
                  <p className="font-display text-[1rem] font-bold text-brand-ink">
                    Every part has been removed
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-[0.82rem] leading-relaxed text-muted-foreground">
                    Rebuild the pathway to bring the full specification back, or
                    keep working from your existing study sets.
                  </p>
                  <Button
                    type="button"
                    onClick={() => void handleRetry()}
                    disabled={retrying}
                    className="mt-4 h-9 rounded-full bg-[#191B27] px-4 text-[0.8rem] font-semibold text-white hover:bg-[#2A2D3E]"
                  >
                    {retrying ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    Rebuild pathway
                  </Button>
                </div>
              ) : (
                <ol className="relative mt-6">
                  <span
                    aria-hidden
                    className="absolute bottom-10 left-[35px] top-6 w-[3px] rounded-full bg-gradient-to-b from-[#DCD6F8] via-[#CFE7E2] to-[#F0F1F6] sm:left-[41px]"
                  />
                  {pathway.units.map((unit, unitIndex) => {
                    const completedInUnit = unit.topics.filter((topic) =>
                      done.has(topic.id),
                    ).length;
                    const unitPercent = percent(completedInUnit, unit.topics.length);
                    const baseColor =
                      PATH_COLORS[unitIndex % PATH_COLORS.length] ?? PATH_COLORS[0]!;
                    const color = unitPercent === 100 ? PATH_COLORS[0]! : baseColor;
                    const expanded =
                      openUnit === null
                        ? unitIndex === (nextTopic?.unitIndex ?? 0)
                        : openUnit === unitIndex;
                    const setCount = unit.topics.filter((topic) =>
                      setsByTopic.has(topic.id),
                    ).length;

                    return (
                      <li key={`${unit.title}-${unitIndex}`} className="relative pb-3">
                        <div className="flex items-start gap-3 sm:gap-4">
                          <PathNode
                            percent={unitPercent}
                            color={color}
                            index={unitIndex}
                            total={pathway.units.length}
                          />

                          <div
                            className="min-w-0 flex-1 rounded-3xl border bg-white p-3.5 shadow-[0_16px_34px_-30px_rgba(22,24,31,0.55)] sm:p-4"
                            style={{ borderColor: `${color.hex}22` }}
                          >
                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                aria-expanded={expanded}
                                onClick={() =>
                                  setOpenUnit(expanded ? -1 : unitIndex)
                                }
                                className="min-w-0 flex-1 text-left"
                              >
                                <h3 className="font-display text-[1.02rem] font-bold leading-snug text-brand-ink">
                                  {unit.title}
                                </h3>
                                <p className="mt-0.5 text-[0.74rem] text-muted-foreground">
                                  {unit.topics.length} topic
                                  {unit.topics.length === 1 ? "" : "s"} ·{" "}
                                  {completedInUnit} revised
                                  {setCount > 0
                                    ? ` · ${setCount} study set${setCount === 1 ? "" : "s"}`
                                    : ""}
                                </p>
                                <div className="mt-2 flex items-center gap-2">
                                  <div className="h-1.5 w-full max-w-[170px] overflow-hidden rounded-full bg-brand-panel">
                                    <div
                                      className="h-full rounded-full transition-[width] duration-500"
                                      style={{
                                        width: `${unitPercent}%`,
                                        backgroundColor: color.hex,
                                      }}
                                    />
                                  </div>
                                  <span
                                    className="text-[0.66rem] font-semibold"
                                    style={{ color: color.hex }}
                                  >
                                    {unitPercent === 100
                                      ? "Complete"
                                      : `${unitPercent}% revised`}
                                  </span>
                                </div>
                              </button>
                              <ChevronDown
                                className={cn(
                                  "mt-1 size-4 shrink-0 text-brand-ink/40 transition-transform",
                                  expanded && "rotate-180",
                                )}
                                aria-hidden
                              />
                            </div>

                            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openTutor(unit.title)}
                                className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[0.68rem] font-semibold transition-colors"
                                style={{
                                  backgroundColor: color.soft,
                                  color: color.hex,
                                }}
                              >
                                <Sparkles className="size-3" aria-hidden />
                                Tutor for this part
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setRemoval({
                                    kind: "unit",
                                    unitIndex,
                                    title: unit.title,
                                  })
                                }
                                className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[0.68rem] font-semibold text-muted-foreground transition-colors hover:bg-[#FFEEF0] hover:text-[#C23B49]"
                              >
                                <Trash2 className="size-3" aria-hidden />
                                Remove part
                              </button>
                            </div>
                          </div>
                        </div>

                        {expanded && (
                          <div className="mt-2 pl-[86px] sm:pl-[102px]">
                            <div className="overflow-hidden rounded-2xl border border-border bg-white">
                              {unit.topics.map((topic) => {
                                const isDone = done.has(topic.id);
                                const set = setsByTopic.get(topic.id);
                                return (
                                  <div
                                    key={topic.id}
                                    className="flex flex-col gap-3 border-b border-border/70 px-4 py-4 last:border-b-0 sm:flex-row sm:items-start"
                                  >
                                    <button
                                      type="button"
                                      aria-pressed={isDone}
                                      disabled={tickingTopic === topic.id}
                                      onClick={() => void toggleTopic(topic.id, !isDone)}
                                      className={cn(
                                        "inline-flex h-7 shrink-0 items-center gap-1 self-start rounded-full border px-2.5 text-[0.68rem] font-semibold transition-colors",
                                        isDone
                                          ? "border-[#22A06B] bg-[#EAFBF0] text-[#128A4C]"
                                          : "border-border bg-white text-brand-ink/60 hover:border-[#22A06B] hover:text-[#128A4C]",
                                      )}
                                    >
                                      {tickingTopic === topic.id ? (
                                        <Loader2 className="size-3 animate-spin" />
                                      ) : null}
                                      {isDone ? "Revised" : "Mark revised"}
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
                                              <span
                                                className="mt-1.5 size-1 shrink-0 rounded-full"
                                                style={{ backgroundColor: color.hex }}
                                              />
                                              {point}
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                      {topic.examSkill && (
                                        <p className="mt-2 text-[0.72rem] leading-relaxed text-[#6B4EE6]">
                                          <span className="font-semibold">Exam skill: </span>
                                          {topic.examSkill}
                                        </p>
                                      )}
                                    </div>

                                    <div className="flex shrink-0 flex-wrap items-center gap-2 pl-9 sm:pl-0">
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
                                              ? "Build interrupted"
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
                                          !set &&
                                            "border-[#D8CCFF] bg-[#FAF8FF] text-[#5B3DF5]",
                                        )}
                                      >
                                        {busyTopic === topic.id ? (
                                          <Loader2 className="size-3.5 animate-spin" />
                                        ) : null}
                                        {set ? "Open set" : "Study this topic"}
                                      </Button>
                                      <button
                                        type="button"
                                        aria-label={`Remove ${topic.title}`}
                                        onClick={() =>
                                          setRemoval({
                                            kind: "topic",
                                            unitIndex,
                                            topicId: topic.id,
                                            title: topic.title,
                                          })
                                        }
                                        className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-[#FFEEF0] hover:text-[#C23B49]"
                                      >
                                        <Trash2 className="size-3.5" aria-hidden />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <p className="mt-4 text-[0.72rem] text-muted-foreground">
              Progress updated {relativeDate(course.updatedAt)} · last studied{" "}
              {course.lastStudiedAt ? relativeDate(course.lastStudiedAt) : "not yet"}
            </p>
          </>
        )}



        <AlertDialog
          open={removal !== null}
          onOpenChange={(open) => {
            if (!open) setRemoval(null);
          }}
        >
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display">
                Remove {removal?.title}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                This removes it from your pathway only. Study sets you already
                built stay in your library, and rebuilding the pathway brings
                every published topic back.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removing} className="rounded-full">
                Keep it
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={removing}
                onClick={(event) => {
                  event.preventDefault();
                  void handleRemove();
                }}
                className="rounded-full bg-destructive text-white hover:bg-destructive/90"
              >
                {removing ? <Loader2 className="size-4 animate-spin" /> : null}
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
