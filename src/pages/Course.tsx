import { AppShell } from "@/components/AppShell";
import { NextStep } from "@/components/NextStep";
import { SkeletonCoursePage } from "@/components/Skeletons";
import { SaveMyExamsPapers } from "@/components/study/SaveMyExamsPapers";
import { LiteratureTextChoices } from "@/components/study/LiteratureTextChoices";
import { TopicNotes } from "@/components/study/TopicNotes";
import { CoursePastPapers } from "@/components/study/CoursePastPapers";
import {
  PathwaySectionsDialog,
  type BuildCounts,
} from "@/components/study/PathwaySectionsDialog";
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
import { Counter, Meter, enter } from "@/components/motion/Motion";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { planSummary, resolveCoursePaper } from "@/convex/lib/paperPlan";
import { CURRENT_PATHWAY_VERSION } from "@/convex/lib/pathwayVersion";
import { AI_NOT_CONFIGURED_MESSAGE } from "@/lib/aiAvailability";
import { notifyError } from "@/lib/errors";
import { retryTransient } from "@/lib/retry";
import { useAiAvailability } from "@/lib/useAiAvailability";
import { CourseCoveragePanel } from "@/components/study/CourseCoveragePanel";
import { percent, plural, relativeDate } from "@/lib/format";
import {
  pathwayPartIdsForTopics,
  pathwayPartOptions,
  pathwayTopicOptions,
} from "@/lib/pathwaySections";
import { courseSubtitle } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  Layers3,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

/**
 * Faceted pathway nodes, painted from the chrome ramp rather than a set of
 * subject hues. Values are CSS variables because the progress ring is a conic
 * gradient and each unit keeps one shade down the path; the variables flip
 * with the dark theme automatically.
 */


/**
 * Five destinations: the pathway, the specification behind it, the detailed
 * notes, practice, and the sets built from it.
 */
type CourseSection = "pathway" | "spec" | "notes" | "practice" | "sets";

/** The current paper format for the course page, from the index row itself. */
function coursePaperFormat(course: Doc<"courses">, paper?: string) {
  const plan = resolveCoursePaper(course, paper);
  return plan.ok
    ? { id: plan.plan.key, summary: planSummary(plan.plan) }
    : null;
}

const COURSE_SECTIONS: Array<{ value: CourseSection; label: string }> = [
  { value: "pathway", label: "Pathway" },
  { value: "spec", label: "Specification" },
  { value: "notes", label: "Notes" },
  { value: "practice", label: "Practice" },
  { value: "sets", label: "Study sets" },
];

const SECTION_LINK_CLASS =
  "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[0.8rem] font-semibold transition-colors";


function PathNode({
  percent,
  index,
  total,
}: {
  percent: number;
  index: number;
  total: number;
}) {
  return (
    <span className="path-stamp relative z-10">
      <span className="path-stamp-value">{percent}%</span>
      <span className="path-stamp-label">
        Part {index + 1}/{total}
      </span>
    </span>
  );
}

function LoadingCard() {
  // A shape of the pathway page rather than a spinner, so the hero, progress
  // card and unit rows appear in place instead of the layout jumping.
  return <SkeletonCoursePage />;
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
        <Link to="/courses">Back to my courses</Link>
      </Button>
    </div>
  );
}

/** Indeterminate bar for a pathway that is still being mapped. */
function BuildingBar() {
  return (
    <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-brand-panel">
      <motion.div
        className="h-full w-1/3 rounded-full bg-chrome-5"
        animate={{ x: ["-110%", "310%"] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
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
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-chrome-6">
          Building pathway
        </p>
        <h2 className="mt-1 font-display text-[1.3rem] font-bold text-brand-ink">
          Mapping {course.subject}
        </h2>
        <p className="mt-1 text-[0.84rem] text-muted-foreground">
          {course.progress || "Waiting to start"}
        </p>
      </div>

      <BuildingBar />

      <p className="mt-4 text-[0.78rem] leading-relaxed text-muted-foreground">
        This usually takes under a minute. You can leave this page: the pathway
        keeps building in the background.
      </p>

      {stale && (
        <p className="mt-4 rounded-2xl bg-[#FFF6E5] px-4 py-3 text-[0.8rem] leading-relaxed text-[#8A5D00]">
          This is taking longer than usual. Bluprint will restart it
          automatically. No action is needed.
        </p>
      )}
    </section>
  );
}

function RecoveringPanel({ course }: { course: Doc<"courses"> }) {
  return (
    <section className="mt-6 rounded-[2rem] border border-border bg-white p-6 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-8">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-chrome-6">
        Preparing pathway
      </p>
      <h2 className="mt-1 font-display text-[1.3rem] font-bold text-brand-ink">
        Putting the finishing touches on {course.subject}
      </h2>
      <p className="mt-2 max-w-2xl text-[0.86rem] leading-relaxed text-muted-foreground">
        Bluprint is completing this map automatically. You can leave this page;
        it will be ready when you come back.
      </p>
      <BuildingBar />
    </section>
  );
}

export default function Course() {
  const { courseId, section } = useParams<{ courseId: string; section?: string }>();
  const navigate = useNavigate();
  const validId = Boolean(courseId && /^[a-z0-9]{20,40}$/i.test(courseId));
  // Every course destination has its own URL. Older `?tab=` links still open
  // the matching screen, but all new navigation uses the path.
  const [searchParams] = useSearchParams();
  const legacyTab = searchParams.get("tab");
  // Two old destinations (past papers, topic papers) now share one Practice
  // screen; their URLs still land on the right sub-tab.
  const requested = section ?? legacyTab;
  const activeSection: CourseSection =
    requested === "sets"
      ? "sets"
      : requested === "notes"
        ? "notes"
        : requested === "spec"
          ? "spec"
          : requested === "practice" ||
              requested === "papers" ||
              requested === "topic-papers"
            ? "practice"
            : "pathway";
  const [practiceTab, setPracticeTab] = useState<"papers" | "topics">(
    requested === "topic-papers" ? "topics" : "papers",
  );
  // A deep link to either old destination still selects the matching sub-tab.
  useEffect(() => {
    if (requested === "papers") setPracticeTab("papers");
    if (requested === "topic-papers") setPracticeTab("topics");
  }, [requested]);
  const sectionPath = (value: CourseSection) =>
    value === "pathway" ? `/courses/${courseId}` : `/courses/${courseId}/${value}`;
  const details = useQuery(
    api.courses.getDetails,
    validId ? { courseId: courseId as Id<"courses"> } : "skip",
  );
  const createTopicSet = useMutation(api.courses.createTopicSet);
  const setTopicDone = useMutation(api.courses.setTopicDone);
  const removeCourse = useMutation(api.courses.remove);
  const recoverCourses = useMutation(api.courses.recoverMine);
  const repairPathways = useMutation(api.courses.repairPathways);
  const rebuild = useAction(api.ai.rebuildCoursePathway);
  const syncCognitoLinks = useAction(api.ai.syncCognitoLinks);
  const { unavailable: aiUnavailable } = useAiAvailability();

  // Pathways saved before topic notes and paper splits existed are filled in
  // once, so an existing course gains them without a rebuild.
  const linksRequested = useRef(false);
  useEffect(() => {
    if (!details || details.course.status !== "ready") return;
    if (details.pathwayVersion < CURRENT_PATHWAY_VERSION) return;
    const pathway = details.course.pathway;
    if (!pathway || pathway.cognitoSyncedAt || linksRequested.current) return;
    linksRequested.current = true;
    void syncCognitoLinks({ courseId: details.course._id }).catch(() => {
      linksRequested.current = false;
    });
  }, [details, syncCognitoLinks]);

  const recoveryRequested = useRef(false);
  useEffect(() => {
    if (!details) return;
    const needsFormat =
      details.course.status === "ready" &&
      details.pathwayVersion < CURRENT_PATHWAY_VERSION;
    if (
      details.course.status !== "error" &&
      !details.processingStale &&
      !needsFormat
    ) {
      recoveryRequested.current = false;
      return;
    }
    if (recoveryRequested.current) return;
    recoveryRequested.current = true;
    void recoverCourses().catch(() => {
      recoveryRequested.current = false;
    });
  }, [details, recoverCourses]);

  // Older English Literature builds could show two copies of the anthology.
  // The saved pathway is repaired once per visit; the mutation only writes if
  // the units actually change, and it reuses poem ids so linked sets survive.
  const repairRequested = useRef<string | null>(null);
  useEffect(() => {
    if (!details || details.course.status !== "ready") return;
    if (details.pathwayVersion < CURRENT_PATHWAY_VERSION) return;
    if (details.course.subject.trim().toLowerCase() !== "english literature") {
      return;
    }
    // Each course is checked once per visit; the ref holds the id, not a
    // boolean, so opening a second literature course still repairs it.
    if (repairRequested.current === details.course._id) return;
    repairRequested.current = details.course._id;
    void repairPathways().catch(() => {
      repairRequested.current = null;
    });
  }, [details, repairPathways]);

  const [retrying, setRetrying] = useState(false);
  const [busyTopic, setBusyTopic] = useState<string | null>(null);
  // The topics preselected when the build picker opens. Null while it is closed.
  const [buildSelection, setBuildSelection] = useState<string[] | null>(null);
  // A single topic opened from inside a part keeps its own one-topic dialog.
  const [buildSingleTopic, setBuildSingleTopic] = useState<string | null>(null);
  const [tickingTopic, setTickingTopic] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // null means "follow the next unfinished unit"; -1 means every unit closed.
  const [openUnit, setOpenUnit] = useState<number | null>(null);
  // The one topic whose notes are open, so only one is read at once.
  const [notesTopic, setNotesTopic] = useState<string | null>(null);
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

  // A set can cover several sections of the pathway, so every one of its topics
  // points at it. The newest set wins, which is why the query is newest first.
  const setsByTopic = useMemo(() => {
    const map = new Map<string, NonNullable<typeof details>["sets"][number]>();
    for (const set of details?.sets ?? []) {
      for (const topicId of set.topicIds) {
        if (!map.has(topicId)) map.set(topicId, set);
      }
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

  const topicOptions = useMemo(
    () => pathwayTopicOptions(details?.course.pathway?.units ?? []),
    [details],
  );
  const partOptions = useMemo(
    () => pathwayPartOptions(details?.course.pathway?.units ?? []),
    [details],
  );
  const singleBuildTopic = buildSingleTopic
    ? topicOptions.find((topic) => topic.id === buildSingleTopic)
    : undefined;
  const buildDialogOptions = singleBuildTopic
    ? [
        {
          id: singleBuildTopic.id,
          title: singleBuildTopic.title,
          number: 1,
          topicIds: [singleBuildTopic.id],
          topicCount: 1,
        },
      ]
    : partOptions;
  const buildDialogSelection = singleBuildTopic
    ? [singleBuildTopic.id]
    : pathwayPartIdsForTopics(partOptions, buildSelection ?? []);

  // The notes tab opens on the topic being worked through, so the screen shows
  // notes straight away instead of a list waiting to be tapped.
  const notesOpened = useRef(false);
  useEffect(() => {
    if (activeSection !== "notes" || notesOpened.current) return;
    const pathway = details?.course.pathway;
    const first = nextTopic?.topic.id ?? pathway?.units[0]?.topics[0]?.id;
    if (!first) return;
    notesOpened.current = true;
    setNotesTopic((current) => current ?? first);
  }, [activeSection, details, nextTopic]);

  const handleRetry = async () => {
    if (!validId) return;
    setRetrying(true);
    try {
      await rebuild({ courseId: courseId as Id<"courses"> });
      toast.success("Rebuilding the pathway in the background.");
    } catch (error) {
      notifyError(error, "Could not rebuild this pathway.");
    } finally {
      setRetrying(false);
    }
  };

  const buildSet = async (topicIds: string[], counts: BuildCounts) => {
    const firstTopicId = topicIds[0];
    if (!validId || !firstTopicId) return;

    // Reopening a set that already covers this selection needs no model call.
    // Check that first, so the AI guard cannot block saved work.
    const selected = new Set(topicIds);
    const existing = details?.sets.find((set) => {
      const covered = set.topicIds ?? (set.topicId ? [set.topicId] : []);
      return (
        covered.length === topicIds.length &&
        covered.every((topicId) => selected.has(topicId))
      );
    });
    if (existing) {
      setBuildSelection(null);
      navigate(`/sets/${existing._id}`);
      return;
    }
    if (aiUnavailable) {
      toast.error(AI_NOT_CONFIGURED_MESSAGE);
      return;
    }

    setBusyTopic(firstTopicId);
    try {
      const result = await createTopicSet({
        courseId: courseId as Id<"courses">,
        topicId: firstTopicId,
        topicIds,
        targetCardCount: counts.cards,
        targetQuizCount: counts.quiz,
        targetExamCount: counts.exam,
      });
      setBuildSelection(null);
      navigate(`/sets/${result.setId}`);
    } catch (error) {
      notifyError(error, "Could not build material for those topics.");
    } finally {
      setBusyTopic(null);
    }
  };

  /** Opens the build panel for the topic's own set. */
  const handleTopic = (topicId: string) => {
    if (!validId) return;
    const existing = setsByTopic.get(topicId);
    if (existing) {
      navigate(`/sets/${existing._id}`);
      return;
    }
    if (!topicOptions.some((option) => option.id === topicId)) return;
    setBuildSingleTopic(topicId);
    setBuildSelection([topicId]);
  };

  /** Opens the part picker without changing an existing single-topic set. */
  const handleChooseTopics = (topicId: string) => {
    if (!validId) return;
    setBuildSingleTopic(null);
    setBuildSelection([topicId]);
  };

  /**
   * The next-topic "Build study set" action opens the part picker, so the
   * student sees every part in the subject instead of only the next topic.
   * An existing set still opens directly.
   */
  const handleBuildSet = (topicId: string) => {
    if (!validId) return;
    const existing = setsByTopic.get(topicId);
    if (existing) {
      navigate(`/sets/${existing._id}`);
      return;
    }
    handleChooseTopics(topicId);
  };

  const toggleTopic = async (topicId: string, done: boolean) => {
    if (!validId) return;
    setTickingTopic(topicId);
    try {
      await retryTransient(
        () =>
          setTopicDone({
            courseId: courseId as Id<"courses">,
            topicId,
            done,
          }),
        { attempts: 2, delayMs: 500 },
      );
    } catch (error) {
      notifyError(error, "Could not update that topic.");
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
      notifyError(error, "Could not remove that item.");
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
      navigate("/courses");
    } catch (error) {
      notifyError(error, "Could not remove that course.");
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

    // Topic titles, so a study set can be labelled with the topic it came from.
    const topicTitleById = new Map<string, string>();
    for (const unit of pathway?.units ?? []) {
      for (const topic of unit.topics) {
        topicTitleById.set(topic.id, topic.title);
      }
    }
    // A topic paper is a topic's own exam-style questions, saved with its study
    // set. Practice groups them with the whole-course papers behind one tab.
    const topicPapers = sets.filter((set) => set.examCount > 0);
    const currentSection: CourseSection = activeSection;

    return (
      <>
        <div
          className="course-cover chrome-plate relative z-20 flex flex-wrap items-center gap-3 rounded-[1.6rem] px-4 py-4"
          style={{ overflow: "visible" }}
        >
          <Link
            to="/courses"
            className="text-[0.8rem] font-semibold text-muted-foreground hover:text-brand-ink"
          >
            All courses
          </Link>
          <div className="min-w-0 flex-1">
            <motion.h1
              className="truncate font-display text-[1.6rem] font-bold leading-tight tracking-[-0.03em] text-brand-ink sm:text-[2rem]"
              {...enter(0.04)}
            >
              {course.subject}
            </motion.h1>
            <motion.p
              className="mt-0.5 text-[0.8rem] text-muted-foreground"
              {...enter(0.1)}
            >
              {courseSubtitle(course)}
            </motion.p>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {currentSection === "pathway" &&
              course.status === "ready" &&
              nextTopic && (
                <Button
                  type="button"
                  onClick={() => handleTopic(nextTopic.topic.id)}
                  disabled={busyTopic !== null}
                  className="h-9 rounded-full px-4 text-[0.8rem] font-semibold"
                >
                  {busyTopic === nextTopic.topic.id && (
                    <Loader2 className="size-3.5 animate-spin" />
                  )}
                  Continue
                  <ArrowRight className="size-3.5" aria-hidden />
                </Button>
              )}

            {pathway && (
              <details className="relative">
                <summary
                  aria-label="More course actions"
                  className="grid size-9 cursor-pointer list-none place-items-center rounded-full border border-border bg-card text-[1rem] font-bold text-brand-ink/70 transition-colors hover:bg-brand-panel hover:text-brand-ink [&::-webkit-details-marker]:hidden"
                >
                  ⋯
                </summary>
                <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-border bg-card p-1 shadow-lg">
                  <button
                    type="button"
                    onClick={(event) => {
                      const menu = event.currentTarget.closest("details");
                      if (menu instanceof HTMLDetailsElement) menu.open = false;
                      openTutor();
                    }}
                    className="block w-full rounded-lg px-2.5 py-2 text-left text-[0.82rem] font-medium text-brand-ink hover:bg-brand-panel"
                  >
                    Ask the tutor
                  </button>
                  <button
                    type="button"
                    disabled={retrying}
                    onClick={(event) => {
                      const menu = event.currentTarget.closest("details");
                      if (menu instanceof HTMLDetailsElement) menu.open = false;
                      void handleRetry();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[0.82rem] font-medium text-brand-ink hover:bg-brand-panel disabled:opacity-40"
                  >
                    <RotateCcw
                      className={cn("size-3.5", retrying && "animate-spin")}
                      aria-hidden
                    />
                    {retrying ? "Rebuilding…" : "Rebuild pathway"}
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={(event) => {
                      const menu = event.currentTarget.closest("details");
                      if (menu instanceof HTMLDetailsElement) menu.open = false;
                      setConfirmingDelete(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[0.82rem] font-medium text-destructive hover:bg-destructive/10 disabled:opacity-40"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Remove course
                  </button>
                </div>
              </details>
            )}
          </div>
        </div>

        {course.status === "error" ? (
          <RecoveringPanel course={course} />
        ) : course.status !== "ready" || !pathway ? (
          <BuildingPanel course={course} stale={details.processingStale} />
        ) : (
          <>
            {currentSection === "pathway" && (
            <motion.section
              className="course-facts mt-6 grid overflow-hidden rounded-3xl border border-border bg-white sm:grid-cols-3"
              {...enter(0.14, 12)}
            >
              <div className="px-5 py-4">
                <p className="text-[0.72rem] font-medium text-muted-foreground">
                  Topics revised
                </p>
                <p className="mt-0.5 font-display text-[1.5rem] font-bold leading-tight text-brand-ink">
                  <Counter value={details.completedCount} />
                  <span className="text-[0.95rem] font-semibold text-muted-foreground">
                    {" "}
                    / {details.topicCount}
                  </span>
                </p>
                <Meter
                  value={mastery}
                  className="mt-2 h-1.5"
                  barClassName="bg-[#0B6B45]"
                  label="Topics revised"
                />
              </div>
              <div className="border-t border-border px-5 py-4 sm:border-l sm:border-t-0">
                <p className="text-[0.72rem] font-medium text-muted-foreground">
                  Study sets built
                </p>
                <p className="mt-0.5 font-display text-[1.5rem] font-bold leading-tight text-brand-ink">
                  <Counter value={sets.length} />
                </p>
                <p className="mt-1 text-[0.72rem] leading-relaxed text-muted-foreground">
                  {sets.length === 0
                    ? "Open a topic to make the first one"
                    : `${plural(cards, "card")} across this course`}
                </p>
              </div>
              <div className="border-t border-border px-5 py-4 sm:border-l sm:border-t-0">
                <p className="text-[0.72rem] font-medium text-muted-foreground">
                  Cards known
                </p>
                <p className="mt-0.5 font-display text-[1.5rem] font-bold leading-tight text-brand-ink">
                  {cards > 0 ? (
                    <Counter value={percent(known, cards)} suffix="%" />
                  ) : (
                    "n/a"
                  )}
                </p>
                <p className="mt-1 text-[0.72rem] leading-relaxed text-muted-foreground">
                  {cards > 0 ? `${known} of ${plural(cards, "card")}` : "Build material to track this"}
                </p>
              </div>
            </motion.section>
            )}

            <nav
              aria-label="Course sections"
              className="course-tabs mt-5 flex flex-wrap gap-1.5"
            >
              {COURSE_SECTIONS.map((item) => {
                const active = currentSection === item.value;
                return (
                  <Link
                    key={item.value}
                    to={sectionPath(item.value)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      SECTION_LINK_CLASS,
                      active
                        ? "border-brand-sky bg-brand-sky text-brand-cream"
                        : "border-border bg-white text-brand-ink/70 hover:border-brand-sky/30 hover:bg-brand-sky/10",
                    )}
                  >
                    {item.label}
                    {item.value === "sets" && (
                      <span className="rounded-full bg-brand-panel px-1.5 py-0.5 text-[0.65rem] font-semibold text-brand-ink/60">
                        {sets.length}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {currentSection === "pathway" && (<>
                <section className="course-assessment mt-4 rounded-[2rem] border border-border bg-white p-5 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-[1.1rem] font-bold text-brand-ink">
                        How this course is assessed
                      </h2>
                  <p className="mt-1 max-w-2xl text-[0.84rem] leading-relaxed text-muted-foreground">
                    {pathway.examFormat}
                  </p>
                </div>
                <span className="rounded-full bg-[#EAFBF0] px-3 py-1.5 text-[0.72rem] font-semibold text-[#0B6B45]">
                  {partOptions.length} part{partOptions.length === 1 ? "" : "s"} ·{" "}
                  {details.topicCount} topic{details.topicCount === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-4 max-w-3xl text-[0.88rem] leading-relaxed text-brand-ink/75">
                {pathway.overview}
              </p>
              <p className="mt-3 text-[0.72rem] leading-relaxed text-muted-foreground">
                {pathway.source === "specification"
                  ? "Mapped directly from the board's published specification. Every reference above is the board's own."
                  : pathway.source === "savemyexams"
                    ? "This pathway follows Save My Exams' published revision notes. It is a notes-based route through the course, not the board's specification document."
                    : "Built from the published course outline. Always check your exam board's current specification before relying on a topic list."}                </p>
                </section>

                <LiteratureTextChoices
                  key={`${course.litShakespeare ?? ""}|${course.litNovel ?? ""}|${course.litModern ?? ""}|${course.poetryTheme ?? ""}`}
                  course={course}
                />

                {nextTopic && (
              <section className="course-next mt-4 flex flex-col gap-4 rounded-[2rem] border border-border bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="min-w-0">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-chrome-7">
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
                  type="button"
                  variant="outline"
                  onClick={() => handleBuildSet(nextTopic.topic.id)}
                  disabled={busyTopic !== null}
                  className="h-10 shrink-0 rounded-full border-border bg-white px-5 font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
                >
                  {busyTopic === nextTopic.topic.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {setsByTopic.has(nextTopic.topic.id) ? "Open study set" : "Build study set"}
                </Button>
              </section>
            )}

            {/* The pathway is tall enough to exceed a phone screen, so it
                animates on mount instead of waiting to be "in view". */}
            <motion.section className="course-pathway mt-6" {...enter(0.05, 10)}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-chrome-7">
                    Revision pathway
                  </p>
                  <h2 className="mt-1 font-display text-[1.25rem] font-bold text-brand-ink">
                    Your route through the specification
                  </h2>
                  <p className="mt-0.5 text-[0.78rem] text-muted-foreground">
                    Tap a part to open its topics. Remove anything your school does
                    not teach. The rest of the pathway stays as it is.
                  </p>
                </div>
                {partOptions.length > 1 && (
                  <Button
                    type="button"
                    onClick={() => {
                      setBuildSingleTopic(null);
                      setBuildSelection(topicOptions.map((option) => option.id));
                    }}
                    disabled={busyTopic !== null}
                    className="h-10 rounded-full bg-[#191B27] px-5 text-[0.8rem] font-semibold text-white hover:bg-[#2A2D3E]"
                  >
                    <Layers3 className="size-4" aria-hidden />
                    Build from parts
                  </Button>
                )}
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
                <ol className="rise-stagger relative mt-6">
                  <span
                    aria-hidden
                    className="absolute bottom-10 left-[35px] top-6 w-[2px] rounded-full bg-border sm:left-[41px]"
                  />
                  {pathway.units.map((unit, unitIndex) => {
                    const completedInUnit = unit.topics.filter((topic) =>
                      done.has(topic.id),
                    ).length;
                    const unitPercent = percent(completedInUnit, unit.topics.length);
                    // One accent down the whole pathway. The old per-unit hues
                    // made the path look like a legend instead of a route.
                    const color = {
                      hex: "var(--olive-deep)",
                      soft: "var(--accent-wash)",
                    };
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
                            index={unitIndex}
                            total={pathway.units.length}
                          />

                          <div className="course-unit min-w-0 flex-1 p-3.5 sm:p-4">
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
                                  <Meter
                                    value={unitPercent}
                                    className="h-1.5 w-full max-w-[170px]"
                                    barStyle={{ backgroundColor: color.hex }}
                                    label={`${unit.title} revised`}
                                  />
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
                                  "mt-1 size-4 shrink-0 text-brand-ink/65 transition-transform",
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
                            <div className="course-topics rise-stagger overflow-hidden rounded-2xl border border-border bg-white">
                              {unit.topics.map((topic) => {
                                const isDone = done.has(topic.id);
                                const set = setsByTopic.get(topic.id);
                                return (
                                  <div
                                    key={topic.id}
                                    className="border-b border-border/70 last:border-b-0"
                                  >
                                    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start">
                                    <button
                                      type="button"
                                      aria-pressed={isDone}
                                      disabled={tickingTopic === topic.id}
                                      onClick={() => void toggleTopic(topic.id, !isDone)}
                                      className={cn(
                                        "inline-flex h-7 shrink-0 items-center gap-1 self-start rounded-full border px-2.5 text-[0.68rem] font-semibold transition-colors",
                                        isDone
                                          ? "border-[#22A06B] bg-[#EAFBF0] text-[#0B6B45]"
                                          : "border-border bg-white text-brand-ink/60 hover:border-[#22A06B] hover:text-[#0B6B45]",
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
                                              ? "text-brand-ink/65 line-through"
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
                                        <p className="mt-2 text-[0.72rem] leading-relaxed text-chrome-7">
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
                                              ? "bg-[#EAFBF0] text-[#0B6B45]"
                                              : set.status === "error"
                                                ? "bg-[#FFEEF0] text-[#C23B49]"
                                                : "bg-[#FFF6E5] text-[#96650A]",
                                          )}
                                        >
                                          {set.status === "ready"
                                            ? plural(set.cardCount, "card")
                                            : set.status === "error"
                                              ? "Build interrupted"
                                              : "Building"}
                                        </span>
                                      )}
                                      <Button
                                        type="button"
                                        onClick={() => handleTopic(topic.id)}
                                        disabled={busyTopic !== null}
                                        variant="outline"
                                        className={cn(
                                          "h-8 rounded-full border-border bg-white px-3 text-[0.76rem] font-semibold text-brand-ink hover:bg-brand-panel",
                                          !set &&
                                            "border-chrome-4 bg-brand-panel text-chrome-7",
                                        )}
                                      >
                                        {busyTopic === topic.id ? (
                                          <Loader2 className="size-3.5 animate-spin" />
                                        ) : null}
                                        {set ? "Open set" : "Study this topic"}
                                      </Button>
                                      {partOptions.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => handleChooseTopics(topic.id)}
                                          disabled={busyTopic !== null}
                                          title="Choose parts for one set"
                                          className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-white px-2.5 text-[0.72rem] font-semibold text-brand-ink/65 transition-colors hover:bg-brand-panel hover:text-brand-ink disabled:opacity-50"
                                        >
                                          <Layers3 className="size-3" aria-hidden />
                                          Choose parts
                                        </button>
                                      )}
                                      {/* Every topic has notes: published ones
                                          where the course has them, and Bluprint's
                                          own where it does not. */}
                                      <button
                                        type="button"
                                        aria-expanded={notesTopic === topic.id}
                                        onClick={() =>
                                          setNotesTopic(
                                            notesTopic === topic.id
                                              ? null
                                              : topic.id,
                                          )
                                        }
                                        className={cn(
                                          "inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[0.74rem] font-semibold transition-colors",
                                          notesTopic === topic.id
                                            ? "bg-brand-panel text-chrome-8"
                                            : "text-chrome-7 hover:bg-brand-panel",
                                        )}
                                      >
                                        <BookOpen className="size-3.5" aria-hidden />
                                        Notes
                                      </button>
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

                                    {notesTopic === topic.id && (
                                      <div className="px-4 pb-4">
                                        <TopicNotes
                                          courseId={course._id}
                                          topicId={topic.id}
                                          onClose={() => setNotesTopic(null)}
                                        />
                                      </div>
                                    )}
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
            </motion.section>

                <p className="mt-4 text-[0.72rem] text-muted-foreground">
                  Progress updated {relativeDate(course.updatedAt)} · last studied{" "}
                  {course.lastStudiedAt ? relativeDate(course.lastStudiedAt) : "not yet"}
                </p>
            </>)}

            {currentSection === "spec" && (
              <CourseCoveragePanel courseId={course._id} />
            )}

            {currentSection === "notes" && (
              <motion.section
                className="mt-4 rounded-[2rem] border border-border bg-white p-5 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-6"
                {...enter(0.05, 10)}
              >
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-chrome-7">
                  Detailed notes
                </p>
                <h2 className="mt-1 font-display text-[1.2rem] font-bold text-brand-ink">
                  Notes for every topic in this course
                </h2>
                <p className="mt-1 max-w-2xl text-[0.84rem] leading-relaxed text-muted-foreground">
                  Open a topic to read its notes. Save My Exams notes are shown
                  when Bluprint can match the course safely; where it cannot,
                  Bluprint writes them from the specification. Each one is
                  prepared once and kept for next time.
                </p>

                {pathway.units.length === 0 ? (
                  <p className="mt-5 rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[0.84rem] leading-relaxed text-muted-foreground">
                    Every part of this pathway has been removed, so there are no
                    topics to read. Rebuild the pathway to bring them back.
                  </p>
                ) : (
                  <div className="rise-stagger mt-5 space-y-6">
                    {pathway.units.map((unit, unitIndex) => (
                      <div key={`${unit.title}-${unitIndex}`}>
                        <h3 className="font-display text-[0.98rem] font-bold text-brand-ink">
                          {unit.title}
                        </h3>
                        <ul className="mt-2 space-y-2">
                          {unit.topics.map((topic) => (
                            <li
                              key={topic.id}
                              className="rounded-2xl border border-border bg-white"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2 px-3.5 py-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-[0.86rem] font-semibold text-brand-ink">
                                    {topic.specReference ? (
                                      <span className="mr-1.5 text-[0.78rem] text-muted-foreground">
                                        {topic.specReference}
                                      </span>
                                    ) : null}
                                    {topic.title}
                                  </p>
                                  <p className="mt-0.5 text-[0.78rem] leading-relaxed text-muted-foreground">
                                    {topic.summary}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  aria-expanded={notesTopic === topic.id}
                                  onClick={() =>
                                    setNotesTopic(
                                      notesTopic === topic.id ? null : topic.id,
                                    )
                                  }
                                  className={cn(
                                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[0.76rem] font-semibold transition-colors",
                                    notesTopic === topic.id
                                      ? "border-brand-sky bg-brand-sky text-brand-cream"
                                      : "border-border bg-white text-brand-ink/75 hover:border-brand-sky/30 hover:bg-brand-sky/10",
                                  )}
                                >
                                  <BookOpen className="size-3.5" aria-hidden />
                                  {notesTopic === topic.id
                                    ? "Hide notes"
                                    : "Read notes"}
                                </button>
                              </div>

                              {notesTopic === topic.id && (
                                <div className="px-3.5 pb-3.5">
                                  <TopicNotes
                                    courseId={course._id}
                                    topicId={topic.id}
                                    onClose={() => setNotesTopic(null)}
                                  />
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </motion.section>
            )}

            {currentSection === "practice" && (
              <div
                role="group"
                aria-label="Practice type"
                className="mt-4 inline-flex rounded-full border border-border bg-card p-1"
              >
                {(
                  [
                    ["papers", "Past papers"],
                    ["topics", "By topic"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={practiceTab === value}
                    onClick={() => setPracticeTab(value)}
                    className={cn(
                      "h-8 rounded-full px-3.5 text-[0.8rem] font-semibold transition-colors",
                      practiceTab === value
                        ? "bg-brand-ink text-white"
                        : "text-brand-ink/65 hover:bg-brand-panel hover:text-brand-ink",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {currentSection === "practice" && practiceTab === "papers" && (<>
                <CoursePastPapers
                  courseId={course._id}
                  formatId={coursePaperFormat(course)?.id}
                  formatIdForPaper={(paper) =>
                    coursePaperFormat(course, paper)?.id ?? ""
                  }
                  formatSummary={coursePaperFormat(course)?.summary}
                  papers={pathway.papers}
                />

                <SaveMyExamsPapers courseId={course._id} />
            </>)}

            {currentSection === "practice" && practiceTab === "topics" && (<>
                  <section className="rounded-[2rem] border border-border bg-white p-5 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-chrome-7">
                          Topic papers
                        </p>
                        <h2 className="mt-1 font-display text-[1.1rem] font-bold text-brand-ink">
                          Exam practice, one topic at a time
                        </h2>
                        <p className="mt-1 max-w-2xl text-[0.84rem] leading-relaxed text-muted-foreground">
                          These are the exam-style questions saved with each topic's
                          study set. Write your answer and it is marked against the
                          topic's guide, so you can see exactly where the marks go.
                        </p>
                      </div>
                      <span className="rounded-full bg-brand-panel px-3 py-1.5 text-[0.7rem] font-semibold text-chrome-7">
                        {topicPapers.length} topic
                        {topicPapers.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    {topicPapers.length === 0 && (
                      <p className="mt-4 rounded-2xl border border-dashed border-border bg-brand-panel px-4 py-4 text-[0.82rem] leading-relaxed text-muted-foreground">
                        No topic questions yet. Build a study set from a topic on
                        the pathway and its exam practice appears here.
                      </p>
                    )}

                    <ul className="rise-stagger mt-4 grid gap-2.5">
                      {topicPapers.map((set) => (
                        <li
                          key={set._id}
                          className="flex flex-col gap-3 rounded-2xl border border-border bg-[#FCFCFD] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <h3 className="truncate text-[0.9rem] font-semibold text-brand-ink">
                              {topicTitleById.get(set.topicId ?? "") ?? set.title}
                            </h3>
                            <p className="mt-0.5 text-[0.74rem] text-muted-foreground">
                              {set.examCount} exam-style question
                              {set.examCount === 1 ? "" : "s"} · marked against
                              the guide
                              {set.status === "ready" ? "" : " · set still building"}
                            </p>
                          </div>
                          <Button
                            asChild
                            variant="outline"
                            className="h-8 shrink-0 rounded-full border-border bg-white px-3 text-[0.76rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
                          >
                            <Link to={`/sets/${set._id}/exam`}>
                              Open topic paper
                            </Link>
                          </Button>
                        </li>
                      ))}
                    </ul>

                    <p className="mt-3 text-[0.7rem] leading-relaxed text-muted-foreground">
                      Questions are written for this specification and saved with
                      the set, so a paper reads the same every time.
                    </p>
                  </section>
            </>)}

            {currentSection === "sets" && (<>
                <section className="rounded-[2rem] border border-border bg-white p-5 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-chrome-7">
                        Study sets
                      </p>
                      <h2 className="mt-1 font-display text-[1.1rem] font-bold text-brand-ink">
                        Everything built from this course
                      </h2>
                      <p className="mt-1 max-w-2xl text-[0.84rem] leading-relaxed text-muted-foreground">
                        One set per topic, holding the summary, flashcards, quiz and
                        exam questions for that topic. Sets you uploaded yourself
                        live in your main library.
                      </p>
                    </div>
                    <span className="rounded-full bg-brand-panel px-3 py-1.5 text-[0.7rem] font-semibold text-chrome-7">
                      {sets.length} set{sets.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {sets.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-border bg-brand-panel px-4 py-6 text-center">
                      <p className="font-display text-[0.98rem] font-bold text-brand-ink">
                        No study sets yet
                      </p>
                      <p className="mx-auto mt-1 max-w-md text-[0.8rem] leading-relaxed text-muted-foreground">
                        Open a topic in the pathway and choose "Study this topic"
                        to build the first set for this course.
                      </p>
                      <Button
                        asChild
                        variant="outline"
                        className="mt-3 h-9 rounded-full border-border bg-white px-4 text-[0.8rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
                      >
                        <Link to={`/courses/${course._id}`}>Go to pathway</Link>
                      </Button>
                    </div>
                  ) : (
                    <ul className="rise-stagger mt-4 grid gap-2.5">
                      {sets.map((set) => {
                        const mastery = percent(set.knownCount, set.cardCount);
                        return (
                          <li
                            key={set._id}
                            className="flex flex-col gap-3 rounded-2xl border border-border bg-[#FCFCFD] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-[0.9rem] font-semibold text-brand-ink">
                                  {set.title}
                                </h3>
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[0.62rem] font-semibold",
                                    set.status === "ready"
                                      ? "bg-[#EAFBF0] text-[#0B6B45]"
                                      : set.status === "error"
                                        ? "bg-[#FFEEF0] text-[#C23B49]"
                                        : "bg-[#FFF6E5] text-[#96650A]",
                                  )}
                                >
                                  {set.status === "ready"
                                    ? "Ready"
                                    : set.status === "error"
                                      ? "Build interrupted"
                                      : "Building"}
                                </span>
                                {set.topicId && topicTitleById.has(set.topicId) && (
                                  <span className="rounded-full bg-brand-panel px-2 py-0.5 text-[0.62rem] font-semibold text-brand-ink/60">
                                    {topicTitleById.get(set.topicId)}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-[0.74rem] text-muted-foreground">
                                {plural(set.cardCount, "card")} ·{" "}
                                {plural(set.quizCount, "quiz question")} ·{" "}
                                {plural(set.examCount, "exam question")} · updated{" "}
                                {relativeDate(set.updatedAt)}
                              </p>
                              {set.status === "ready" && set.cardCount > 0 && (
                                <div className="mt-2 flex items-center gap-2">
                                  <Meter
                                    value={mastery}
                                    className="h-1.5 w-full max-w-[190px]"
                                    barClassName="bg-[#0B6B45]"
                                    label={`${set.title} mastery`}
                                  />
                                  <span className="shrink-0 text-[0.66rem] font-semibold text-muted-foreground">
                                    {mastery}% known
                                  </span>
                                </div>
                              )}
                            </div>
                            <Button
                              asChild
                              variant="outline"
                              className="h-8 shrink-0 rounded-full border-border bg-white px-3 text-[0.76rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
                            >
                              <Link to={`/sets/${set._id}`}>
                                {set.status === "ready" ? "Open set" : "View set"}
                              </Link>
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
            </>)}
          </>
        )}

        {course.status === "ready" && (
          <NextStep
            to="/today"
            title="Revise what you've mapped"
            hint="Today pulls the due cards from every course into one session"
            className="mt-6"
          />
        )}

        <PathwaySectionsDialog
          // Keyed per opening so the checklist starts from the chosen parts.
          key={buildSingleTopic ?? buildSelection?.join("|") ?? "closed"}
          open={buildSelection !== null}
          onOpenChange={(open) => {
            if (!open) {
              setBuildSelection(null);
              setBuildSingleTopic(null);
            }
          }}
          options={buildDialogOptions}
          initialSelectedIds={buildDialogSelection}
          busy={busyTopic !== null}
          noun={singleBuildTopic ? "topic" : "part"}
          onBuild={(topicIds, counts) => void buildSet(topicIds, counts)}
        />

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

  return (
    <AppShell>
      <div className="course-screen">{body}</div>
    </AppShell>
  );
}
