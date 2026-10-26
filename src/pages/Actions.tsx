import { AppShell } from "@/components/AppShell";
import { CreateSetDialog } from "@/components/CreateSetDialog";
import { Mascot } from "@/components/Mascot";
import { EASE, Meter, enter } from "@/components/motion/Motion";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { percent } from "@/lib/format";
import { courseSubtitle, subjectMeta } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Camera,
  CalendarDays,
  Check,
  ClipboardList,
  FileText,
  GraduationCap,
  Layers3,
  LayoutGrid,
  ListChecks,
  Lock,
  PenLine,
  Sparkles,
  Timer,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";

type CourseSummary = FunctionReturnType<typeof api.courses.listMine>[number];

/** One pastel slot per action family. The tile is always ink on pastel. */
const TONES = {
  lime: "bg-gizmo-lime/70 text-[#1C1A14]",
  lilac: "bg-gizmo-lilac/60 text-[#1C1A14]",
  sky: "bg-gizmo-sky/60 text-[#1C1A14]",
  peach: "bg-gizmo-peach/70 text-[#1C1A14]",
  mint: "bg-gizmo-mint/70 text-[#1C1A14]",
} as const;

type Tone = keyof typeof TONES;

type Action = {
  key: string;
  title: string;
  copy: string;
  icon: LucideIcon;
  tone: Tone;
  /** Always available. */
  to?: string;
  /** Available once a course is selected; receives the course id. */
  courseTo?: (courseId: string) => string;
  requiresCourse?: boolean;
  /** Opens something in place (the upload dialog) instead of navigating. */
  onSelect?: () => void;
  badge?: string;
  cta?: string;
};

type ActionGroup = {
  heading: string;
  blurb: string;
  items: Action[];
};

/**
 * One action tile. Course-scoped actions stay visible without a course and
 * explain why they are locked, so the screen always shows the full set of
 * things the app can do rather than hiding half of them.
 */
function ActionCard({
  action,
  courseId,
}: {
  action: Action;
  courseId?: string;
}) {
  const Icon = action.icon;
  const locked = Boolean(action.requiresCourse && !courseId);
  // A course-scoped destination wins when a course is selected; the plain
  // destination is the fallback for "all courses".
  const href = (courseId ? action.courseTo?.(courseId) : undefined) ?? action.to;

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "grid size-9 place-items-center rounded-2xl border border-brand-ink/10 shadow-[0_2px_0_rgba(28,26,20,0.06)]",
            TONES[action.tone],
          )}
        >
          <Icon className="size-[17px]" aria-hidden />
        </span>
        {action.badge && (
          <span className="rounded-full bg-brand-panel px-2 py-0.5 text-[0.66rem] font-semibold tabular-nums text-chrome-7">
            {action.badge}
          </span>
        )}
      </div>

      {/* role=heading keeps the outline consistent whether the tile is a
          link, a button, or a locked card. */}
      <p
        role="heading"
        aria-level={3}
        className="mt-2.5 font-display text-[0.98rem] font-bold leading-snug text-brand-ink"
      >
        {action.title}
      </p>
      <p className="mt-1 text-[0.79rem] leading-relaxed text-muted-foreground">
        {action.copy}
      </p>

      <span
        className={cn(
          "mt-3 flex items-center gap-1.5 text-[0.75rem] font-semibold",
          locked ? "text-muted-foreground" : "text-brand-ink/70",
        )}
      >
        {locked ? (
          <>
            <Lock className="size-3" aria-hidden />
            Pick a course above
          </>
        ) : (
          <>
            {action.cta ?? "Open"}
            <ArrowRight
              className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
              aria-hidden
            />
          </>
        )}
      </span>
    </>
  );

  const shell =
    "group flex h-full flex-col rounded-3xl border border-border bg-card p-4 text-left";

  if (locked) {
    return (
      <div
        aria-disabled="true"
        title="Choose a course above to unlock this action"
        className={cn(shell, "cursor-not-allowed opacity-60")}
      >
        {body}
      </div>
    );
  }

  if (action.onSelect) {
    return (
      <button
        type="button"
        onClick={action.onSelect}
        className={cn(shell, "lift transition-colors hover:border-brand-ink/25")}
      >
        {body}
      </button>
    );
  }

  return (
    <Link
      to={href ?? "/dashboard"}
      className={cn(shell, "lift transition-colors hover:border-brand-ink/25")}
    >
      {body}
    </Link>
  );
}

/** The course rail: one chip per saved course, plus all-courses and add. */
function CoursePicker({
  courses,
  selected,
  onSelect,
  totalDue,
  setCount,
}: {
  courses: CourseSummary[] | undefined;
  selected: string | null;
  onSelect: (courseId: string | null) => void;
  totalDue: number;
  setCount: number;
}) {
  const selectedCourse = courses?.find((course) => course._id === selected);

  return (
    <motion.section
      className="chrome-plate mt-4 rounded-[1.6rem] px-4 pb-4 pt-3.5"
      {...enter(0.1, 10)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-6 place-items-center rounded-lg bg-gizmo-lime text-[#1C1A14]">
          <GraduationCap className="size-3.5" aria-hidden />
        </span>
        <p className="mono-label text-chrome-7">Course</p>
        <p className="text-[0.74rem] text-muted-foreground">
          {selectedCourse
            ? `${selectedCourse.setCount} ${selectedCourse.setCount === 1 ? "set" : "sets"} · ${selectedCourse.completedCount}/${selectedCourse.topicCount} topics done`
            : `${totalDue} due · ${setCount} saved ${setCount === 1 ? "set" : "sets"}`}
        </p>
        <Link
          to="/courses/new"
          className="ml-auto text-[0.75rem] font-semibold text-brand-ink/70 underline-offset-2 hover:text-brand-ink hover:underline"
        >
          Add course
        </Link>
      </div>

      <div
        role="group"
        aria-label="Choose a course"
        className="no-scrollbar -mx-1 mt-2.5 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-pressed={!selectedCourse}
          className={cn(
            "flex h-[58px] shrink-0 items-center gap-2 rounded-2xl border px-3 text-left transition-colors",
            !selectedCourse
              ? "border-brand-ink/25 bg-gizmo-lime/55 text-[#1C1A14] shadow-[0_2px_0_rgba(28,26,20,0.1)]"
              : "border-border bg-white text-brand-ink/75 hover:bg-brand-panel",
          )}
        >
          <span className="grid size-7 place-items-center rounded-xl bg-white/70 text-[#1C1A14]">
            <LayoutGrid className="size-4" aria-hidden />
          </span>
          <span>
            <span className="block text-[0.84rem] font-semibold">All courses</span>
            <span
              className={cn(
                "block text-[0.68rem]",
                !selectedCourse ? "text-[#1C1A14]/65" : "text-muted-foreground",
              )}
            >
              Every action
            </span>
          </span>
          {!selectedCourse && <Check className="ml-1 size-3.5" aria-hidden />}
        </button>

        {courses === undefined ? (
          <span className="h-[58px] w-40 shrink-0 animate-pulse rounded-2xl bg-brand-panel" />
        ) : (
          courses.map((course) => {
            const meta = subjectMeta(course.subject);
            const Icon = meta.icon;
            const active = selected === course._id;
            return (
              <button
                key={course._id}
                type="button"
                onClick={() => onSelect(course._id)}
                aria-pressed={active}
                title={courseSubtitle(course)}
                className={cn(
                  "flex h-[58px] shrink-0 items-center gap-2 rounded-2xl border px-3 text-left transition-colors",
                  active
                    ? "border-brand-ink/25 bg-gizmo-lilac/55 text-[#1C1A14] shadow-[0_2px_0_rgba(28,26,20,0.1)]"
                    : "border-border bg-white text-brand-ink/75 hover:bg-brand-panel",
                )}
              >
                <span
                  className={cn("grid size-7 place-items-center rounded-xl", meta.tint)}
                  style={{ color: meta.color }}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block max-w-[150px] truncate text-[0.84rem] font-semibold">
                    {course.subject}
                  </span>
                  <span
                    className={cn(
                      "block max-w-[150px] truncate text-[0.68rem]",
                      active ? "text-[#1C1A14]/65" : "text-muted-foreground",
                    )}
                  >
                    {course.level}
                    {course.examBoard !== "None" ? ` · ${course.examBoard}` : ""}
                  </span>
                </span>
                {active && <Check className="ml-1 size-3.5 shrink-0" aria-hidden />}
              </button>
            );
          })
        )}
      </div>

      {selectedCourse && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-2.5">
          <p className="text-[0.76rem] font-semibold text-brand-ink">
            {courseSubtitle(selectedCourse)}
          </p>
          <div className="flex items-center gap-2">
            <Meter
              value={percent(
                selectedCourse.completedCount,
                Math.max(1, selectedCourse.topicCount),
              )}
              className="h-1.5 w-24"
              barClassName="bg-brand-pink-deep"
              label={`${selectedCourse.subject} pathway progress`}
            />
            <span className="text-[0.7rem] text-muted-foreground">
              {percent(selectedCourse.completedCount, Math.max(1, selectedCourse.topicCount))}%
              mapped
            </span>
          </div>
          <Link
            to={`/courses/${selectedCourse._id}`}
            className="ml-auto inline-flex items-center gap-1 text-[0.76rem] font-semibold text-brand-ink hover:underline"
          >
            Open course
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      )}
    </motion.section>
  );
}

/**
 * The actions dashboard.
 *
 * The library on /dashboard answers "what have I saved?". This screen answers
 * "what can I do next?" — every workflow in the app in one place, scoped by
 * the course chosen at the top. Course-scoped actions read the selected course
 * from the URL, so a link to this page can open on that course.
 */
export default function Actions() {
  const courses = useQuery(api.courses.listMine);
  const sets = useQuery(api.studySets.listMine);
  const study = useQuery(api.studySets.studyStats);
  const [searchParams, setSearchParams] = useSearchParams();
  const [newSetOpen, setNewSetOpen] = useState(false);

  const requestedCourse = searchParams.get("course");
  // Only trust an id that still belongs to the account.
  const selectedCourse =
    courses?.find((course) => course._id === requestedCourse) || null;
  const courseId = selectedCourse?._id;

  const selectCourse = (next: string | null) => {
    setSearchParams(next ? { course: next } : {}, { replace: true });
  };

  const stats = useMemo(() => {
    const list = sets ?? [];
    return {
      due: list.reduce((sum, set) => sum + (set.dueCount ?? 0), 0),
      weakSets: list.filter((set) => set.weakCount > 0),
      ready: list.filter((set) => set.status === "ready").length,
    };
  }, [sets]);

  const weakSet = stats.weakSets[0];

  const groups: ActionGroup[] = [
    {
      heading: "Add material",
      blurb: "Turn a page of notes into a full study set, or set up a whole course.",
      items: [
        {
          key: "new-set",
          title: "New study set",
          copy: "Photograph notes, sample a video or paste text. Bluprint writes the summary, cards, quiz and marked exam questions.",
          icon: Camera,
          tone: "lime",
          onSelect: () => setNewSetOpen(true),
          cta: "Upload notes",
        },
        {
          key: "topic-set",
          title: "Build from a course topic",
          copy: "Open the pathway and generate a set from one topic's published specification.",
          icon: BookOpen,
          tone: "lilac",
          requiresCourse: true,
          courseTo: (id) => `/courses/${id}`,
          cta: "Choose a topic",
        },
        {
          key: "add-course",
          title: "Add courses",
          copy: "Pick your qualification, exam board and subjects to map into revision pathways.",
          icon: GraduationCap,
          tone: "sky",
          to: "/courses/new",
          cta: "Choose courses",
        },
      ],
    },
    {
      heading: "Practise",
      blurb: "Recall first, then check it with quiz questions and marked written answers.",
      items: [
        {
          key: "due",
          title: "Review due flashcards",
          copy: "Everything the scheduler has ready today, with the shakiest memories first.",
          icon: Layers3,
          tone: "mint",
          to: "/today",
          badge: stats.due > 0 ? `${stats.due} due` : undefined,
          cta: stats.due > 0 ? "Start review" : "Open the queue",
        },
        {
          key: "sprint",
          title: "Quick sprint",
          copy: "Ten cards in one sitting — the shortest way to keep a streak alive.",
          icon: Timer,
          tone: "peach",
          to: "/today?sprint=10",
          cta: "Start a sprint",
        },
        {
          key: "sets",
          title: "Quiz & exam sets",
          copy: "Open this course's sets to take a multiple-choice quiz or a marked written paper.",
          icon: ListChecks,
          tone: "lime",
          requiresCourse: true,
          courseTo: (id) => `/courses/${id}/sets`,
          cta: "Open sets",
        },
        {
          key: "papers",
          title: "Past papers",
          copy: "Sit a saved practice paper in the real question format, marked question by question.",
          icon: FileText,
          tone: "lilac",
          requiresCourse: true,
          courseTo: (id) => `/courses/${id}/papers`,
          cta: "Sit a paper",
        },
        {
          key: "topic-papers",
          title: "Exam-style questions",
          copy: "Topic questions with a marking guide, written from the specification for this course.",
          icon: PenLine,
          tone: "sky",
          requiresCourse: true,
          courseTo: (id) => `/courses/${id}/topic-papers`,
          cta: "Answer questions",
        },
        {
          key: "weak",
          title: "Weak spots",
          copy: "Cards you have lapsed on and quiz questions you have missed, gathered together.",
          icon: TriangleAlert,
          tone: "peach",
          to: weakSet ? `/sets/${weakSet._id}/weak` : "/today",
          badge: weakSet ? `${weakSet.weakCount} flagged` : undefined,
          cta: weakSet ? "Fix weak spots" : "Open the queue",
        },
      ],
    },
    {
      heading: "Understand",
      blurb: "Ask about the material, or read the pathway the course was mapped from.",
      items: [
        {
          key: "tutor",
          title: "AI tutor",
          copy: "Ask for an explanation, a worked example or an exam question in plain language.",
          icon: Sparkles,
          tone: "sky",
          to: "/tutor",
          courseTo: (id) => `/tutor?course=${id}`,
          cta: "Open the tutor",
        },
        {
          key: "course-tutor",
          title: "Ask about this course",
          copy: "Start the tutor scoped to this course, so every answer uses its topics and notes.",
          icon: GraduationCap,
          tone: "lilac",
          requiresCourse: true,
          courseTo: (id) => `/tutor?course=${id}`,
          cta: "Ask a question",
        },
        {
          key: "pathway",
          title: "Course pathway",
          copy: "Tick off topics, read the unit notes and see how much of the specification is mapped.",
          icon: ClipboardList,
          tone: "mint",
          requiresCourse: true,
          courseTo: (id) => `/courses/${id}`,
          cta: "Open pathway",
        },
      ],
    },
    {
      heading: "Plan",
      blurb: "The daily queue, the timetable, and everywhere your saved work lives.",
      items: [
        {
          key: "today",
          title: "Today's queue",
          copy: "Your daily question goal, the cards due now and the weak spots that need a second pass.",
          icon: Timer,
          tone: "peach",
          to: "/today",
          badge: study ? `${study.todayCount}/${study.goal}` : undefined,
          cta: "Open today",
        },
        {
          key: "timetable",
          title: "Revision timetable",
          copy: "This week's sessions, built from your topics and exam dates.",
          icon: CalendarDays,
          tone: "sky",
          to: "/timetable",
          cta: "Open timetable",
        },
        {
          key: "new-timetable",
          title: "Build a timetable",
          copy: "Choose topics, papers or a mix, set your study days and generate a weekly plan.",
          icon: CalendarDays,
          tone: "lime",
          to: "/timetable/new",
          cta: "Start the builder",
        },
        {
          key: "courses",
          title: "My courses",
          copy: "Every pathway you have mapped, with topic progress and linked materials.",
          icon: GraduationCap,
          tone: "lilac",
          to: "/courses",
          badge: courses ? `${courses.length}` : undefined,
          cta: "Open courses",
        },
        {
          key: "saved-sets",
          title: "My saved sets",
          copy: "The library of everything you have built, with readiness and last scores.",
          icon: Layers3,
          tone: "mint",
          to: "/dashboard",
          badge: sets ? `${sets.length}` : undefined,
          cta: "Open library",
        },
      ],
    },
  ];

  return (
    <AppShell>
      <motion.header
        className="chrome-hero relative overflow-hidden rounded-[2rem] px-5 pb-5 pt-6 sm:px-7 sm:pb-6 sm:pt-7"
        {...enter(0.04, 14)}
      >
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="sticker -rotate-1 bg-gizmo-lime text-brand-ink">
              <LayoutGrid className="size-3" aria-hidden />
              All actions
            </span>
            <h1 className="chrome-title mt-3 font-display text-[1.75rem] font-extrabold leading-[1.05] tracking-[-0.035em] sm:text-[2.2rem]">
              What do you want to{" "}
              <span className="highlighter">work on?</span>
            </h1>
            <p className="mt-2 max-w-lg text-[0.9rem] leading-relaxed text-brand-ink/65">
              {selectedCourse
                ? `${selectedCourse.subject} is selected. Course actions below open straight into it.`
                : "Every workflow in one place. Choose a course to scope the practice actions to it."}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                onClick={() => setNewSetOpen(true)}
                className="h-11 rounded-full bg-[#191B27] px-5 text-sm font-semibold text-white shadow-[0_14px_24px_-18px_rgba(25,27,39,0.9)] transition-transform hover:-translate-y-0.5 hover:bg-[#2A2D3E]"
              >
                New study set
                <ArrowRight className="size-4" />
              </Button>
              <p className="text-[0.78rem] font-medium text-brand-ink/55">
                {stats.due} due · {stats.ready} ready{" "}
                {stats.ready === 1 ? "set" : "sets"} · {courses?.length ?? 0}{" "}
                {(courses?.length ?? 0) === 1 ? "course" : "courses"}
              </p>
            </div>
          </div>

          <motion.div
            className="hidden shrink-0 sm:block"
            initial={{ opacity: 0, scale: 0.9, rotate: 4 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
          >
            <Mascot size={126} />
          </motion.div>
        </div>
      </motion.header>

      <CoursePicker
        courses={courses}
        selected={selectedCourse?._id ?? null}
        onSelect={selectCourse}
        totalDue={stats.due}
        setCount={sets?.length ?? 0}
      />

      {courses !== undefined && courses.length === 0 && (
        <div className="mt-5 rounded-2xl border border-dashed border-border bg-white/70 px-4 py-3 text-[0.82rem] leading-relaxed text-muted-foreground">
          No courses yet. Add one to unlock past papers, topic sets and the
          course-scoped practice actions — or start with a single upload below.
        </div>
      )}

      {groups.map((group) => (
        <section key={group.heading} className="mt-7">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="font-display text-[1.1rem] font-bold text-brand-ink">
              {group.heading}
            </h2>
            <p className="text-[0.76rem] leading-relaxed text-muted-foreground">
              {group.blurb}
            </p>
            <span className="hidden h-px flex-1 border-t border-dashed border-border sm:block" />
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((action) => (
              <ActionCard key={action.key} action={action} courseId={courseId ?? undefined} />
            ))}
          </div>
        </section>
      ))}

      <CreateSetDialog open={newSetOpen} onOpenChange={setNewSetOpen} />
    </AppShell>
  );
}
