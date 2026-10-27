import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SkeletonBuilderPage } from "@/components/Skeletons";
import { EASE, enter, reveal } from "@/components/motion/Motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { dateInputValue, daysUntilInput } from "@/lib/format";
import { courseSubtitle } from "@/lib/subjects";
import { formatLongDate, formatTime, SUBJECT_COLORS } from "@/lib/timetable";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

const SESSION_MINUTES = [25, 45, 60, 90];
const DAILY_MINUTES = [30, 60, 90, 120];
// Time on a bank holiday, weekend or school holiday is asked for rather than
// assumed, so a busy weekend and a free half-term can be planned differently.
const DAY_OFF_MINUTES = [60, 90, 120, 180, 240];
const DAYS_PER_WEEK = [3, 5, 7];
const PAPERS = ["Paper 1", "Paper 2", "Both"];
/** The three study routes a plan can take. */
const STUDY_METHODS = [
  {
    value: "topics",
    title: "Topics",
    description:
      "Work through the pathway, one topic study set per session.",
  },
  {
    value: "papers",
    title: "Past papers",
    description:
      "Only saved past papers. Each paper is a one-hour session.",
  },
  {
    value: "mixed",
    title: "Mix of both",
    description:
      "Alternate a past paper with a topic session, so recall and exam practice both get time.",
  },
] as const;
type StudyMethod = (typeof STUDY_METHODS)[number]["value"];
const START_HOURS = [9, 10, 14, 16, 17, 18, 19];
// Sessions never cross this line, so a start time plus the longest session has
// to land before it. Kept in step with the planner's LATEST_END_MINUTES.
const LATEST_END = 20 * 60;
const MAX_COURSES = 12;
/** The builder runs as three pages; each has its own URL and one decision. */
const STEPS = [
  { title: "Subjects" },
  { title: "Study time" },
  { title: "Exam dates" },
] as const;

type CourseSetting = {
  courseId: Id<"courses">;
};

/**
 * The unfinished builder is kept for the browser tab. Each step is its own URL,
 * and a reload used to lose the subjects chosen on step one, so step four asked
 * to build a timetable with nothing selected.
 */
const DRAFT_KEY = "bluprint.timetable-builder-draft";

type StoredDraft = {
  startDate: string;
  examDate: string;
  dailyMinutes: number;
  dayOffMinutes: number;
  sessionMinutes: number;
  startMinutes: number;
  dayOffStartMinutes: number;
  daysPerWeek: number;
  paper: string;
  studyMethod: StudyMethod;
  courseIds: string[];
};

/** Reads only values the form can actually hold; anything else is ignored. */
function readDraft(): Partial<StoredDraft> {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<StoredDraft>;
    if (!parsed || typeof parsed !== "object") return {};
    const draft: Partial<StoredDraft> = {};
    for (const key of ["startDate", "examDate"] as const) {
      const value = parsed[key];
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        draft[key] = value;
      }
    }
    const numbers = [
      ["dailyMinutes", DAILY_MINUTES],
      ["dayOffMinutes", DAY_OFF_MINUTES],
      ["sessionMinutes", SESSION_MINUTES],
      ["daysPerWeek", DAYS_PER_WEEK],
      ["startMinutes", START_HOURS.map((hour) => hour * 60)],
      ["dayOffStartMinutes", START_HOURS.map((hour) => hour * 60)],
    ] as const;
    for (const [key, allowed] of numbers) {
      const value = parsed[key];
      if (typeof value === "number" && (allowed as readonly number[]).includes(value)) {
        draft[key] = value;
      }
    }
    if (parsed.studyMethod && STUDY_METHODS.some((m) => m.value === parsed.studyMethod)) {
      draft.studyMethod = parsed.studyMethod;
    }
    if (typeof parsed.paper === "string" && PAPERS.includes(parsed.paper)) {
      draft.paper = parsed.paper;
    }
    if (Array.isArray(parsed.courseIds)) {
      draft.courseIds = parsed.courseIds.filter(
        (id): id is string => typeof id === "string",
      );
    }
    return draft;
  } catch {
    // Private browsing, or a draft written by an older version.
    return {};
  }
}

function defaults() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  const exam = new Date();
  exam.setDate(exam.getDate() + 29);
  return {
    startDate: dateInputValue(start),
    examDate: dateInputValue(exam),
  };
}

function paperLabel(value: string) {
  return value === "Both" ? "Papers 1 and 2" : value;
}

/** Largest offered session length that fits inside the daily budget. */
function sessionWithin(minutes: number): number {
  const allowed = SESSION_MINUTES.filter((value) => value <= minutes);
  return allowed[allowed.length - 1] ?? SESSION_MINUTES[0];
}

export default function TimetableBuilder() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // The step lives in the URL, but every step shares one route so moving
  // between them does not remount the page and lose the draft.
  const stepSegment = pathname.split("/").filter(Boolean)[2];
  const parsedStep = Number(stepSegment ?? "1");
  const step = Number.isInteger(parsedStep)
    ? Math.min(3, Math.max(1, parsedStep))
    : 1;
  const courses = useQuery(api.courses.listMine);
  const existing = useQuery(api.timetable.getMine);
  const buildPlan = useMutation(api.timetable.build);

  const initial = defaults();
  // `useState` with a function keeps the storage read to the first render.
  const [stored] = useState(readDraft);
  // A tab left open overnight can hold dates that have already passed. Ignoring
  // them keeps the first render valid instead of offering a stale plan.
  const todayKey = dateInputValue(new Date());
  const draftStart =
    stored.startDate && stored.startDate >= todayKey
      ? stored.startDate
      : initial.startDate;
  const draftExam =
    stored.examDate && stored.examDate > draftStart
      ? stored.examDate
      : initial.examDate;
  const [startDate, setStartDate] = useState(draftStart);
  const [examDate, setExamDate] = useState(draftExam);
  const [dailyMinutes, setDailyMinutes] = useState(stored.dailyMinutes ?? 60);
  const [dayOffMinutes, setDayOffMinutes] = useState(stored.dayOffMinutes ?? 180);
  // One uninterrupted study block, shared by every subject.
  const [sessionMinutes, setSessionMinutes] = useState(stored.sessionMinutes ?? 45);
  const [startMinutes, setStartMinutes] = useState(stored.startMinutes ?? 17 * 60);
  // A day off has its own start time: half-term mornings are not a school
  // evening after clubs.
  const [dayOffStartMinutes, setDayOffStartMinutes] = useState(
    stored.dayOffStartMinutes ?? 10 * 60,
  );
  const [daysPerWeek, setDaysPerWeek] = useState(stored.daysPerWeek ?? 5);
  // One paper answer for the whole timetable instead of a choice per subject.
  const [paper, setPaper] = useState(stored.paper ?? "Paper 1");
  // Topics, past papers, or a mix of both, for every subject in the plan.
  const [studyMethod, setStudyMethod] = useState<StudyMethod>(
    stored.studyMethod ?? "topics",
  );
  const [settings, setSettings] = useState<CourseSetting[]>(
    (stored.courseIds ?? []).map((courseId) => ({
      courseId: courseId as Id<"courses">,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Remember every choice so a step change, or a refresh, picks up where the
  // student left off.
  useEffect(() => {
    const draft: StoredDraft = {
      startDate,
      examDate,
      dailyMinutes,
      dayOffMinutes,
      sessionMinutes,
      startMinutes,
      dayOffStartMinutes,
      daysPerWeek,
      paper,
      studyMethod,
      courseIds: settings.map((setting) => setting.courseId),
    };
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // A full or unavailable store is not worth failing the form over.
    }
  }, [
    startDate,
    examDate,
    dailyMinutes,
    dayOffMinutes,
    sessionMinutes,
    startMinutes,
    dayOffStartMinutes,
    daysPerWeek,
    paper,
    studyMethod,
    settings,
  ]);

  useEffect(() => {
    // Each step is a page, so start at the top of it.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const ready = (courses ?? []).filter(
    (course) => course.status === "ready" && course.topicCount > 0,
  );
  const daysLeft = daysUntilInput(examDate);
  const datesInvalid = Boolean(startDate && examDate) && examDate <= startDate;
  const longestSessionMinutes = sessionMinutes;

  // A saved draft can name a course that has since been deleted. Drop it once
  // the list arrives rather than failing at submit time.
  useEffect(() => {
    if (!courses) return;
    const available = new Set(
      courses
        .filter((course) => course.status === "ready" && course.topicCount > 0)
        .map((course) => course._id as string),
    );
    setSettings((current) => {
      const next = current.filter((setting) =>
        available.has(setting.courseId as string),
      );
      return next.length === current.length ? current : next;
    });
  }, [courses]);
  const toggle = (courseId: Id<"courses">) => {
    const alreadySelected = settings.some(
      (setting) => setting.courseId === courseId,
    );
    if (!alreadySelected && settings.length >= MAX_COURSES) {
      setError(`A timetable can hold up to ${MAX_COURSES} subjects.`);
      return;
    }
    setSettings((current) => {
      if (current.some((setting) => setting.courseId === courseId)) {
        return current.filter((setting) => setting.courseId !== courseId);
      }
      return [...current, { courseId }];
    });
    setError(null);
  };

  const chooseDayOffMinutes = (minutes: number) => {
    setDayOffMinutes(minutes);
    // A session cannot outlast the day it sits in.
    if (sessionMinutes > minutes) setSessionMinutes(sessionWithin(minutes));
    setError(null);
  };

  const chooseDailyMinutes = (minutes: number) => {
    setDailyMinutes(minutes);
    if (sessionMinutes > minutes) setSessionMinutes(sessionWithin(minutes));
    setError(null);
  };

  const chooseSessionMinutes = (minutes: number) => {
    setSessionMinutes(minutes);
    setError(null);
  };

  const chooseStudyMethod = (method: StudyMethod) => {
    setStudyMethod(method);
    // A past paper fills a whole hour, so a paper day needs at least that much
    // time. Raise the budget rather than sending a plan the server must reject.
    if (method !== "topics") {
      if (dailyMinutes < 60) setDailyMinutes(60);
      if (dayOffMinutes < 60) setDayOffMinutes(90);
    }
    setError(null);
  };

  const methodLabel =
    STUDY_METHODS.find((method) => method.value === studyMethod)?.title ??
    "Topics";

  const goToStep = (next: number) => {
    const target = Math.min(3, Math.max(1, next));
    navigate(target === 1 ? "/timetable/new" : `/timetable/new/${target}`);
  };

  const nextStep = () => {
    if (step === 1 && settings.length === 0) {
      setError("Choose at least one course to revise.");
      return;
    }
    setError(null);
    goToStep(step + 1);
  };

  /**
   * Every requirement in one place, with the step that can fix it. The button
   * stays clickable so a missing answer is explained instead of leaving the
   * student with a dead control.
   */
  const findProblem = (): { step: number; message: string } | null => {
    if (settings.length === 0) {
      return { step: 1, message: "Choose at least one course to revise." };
    }
    if (!startDate || !examDate) {
      return {
        step: 3,
        message: "Choose both a start date and an exam date.",
      };
    }
    if (datesInvalid) {
      return {
        step: 3,
        message: "Your first exam needs to be after your start date.",
      };
    }
    if (daysLeft <= 0) {
      return { step: 3, message: "Choose an exam date in the future." };
    }
    return null;
  };

  const submit = async () => {
    const problem = findProblem();
    if (problem) {
      setError(problem.message);
      goToStep(problem.step);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await buildPlan({
        startDate,
        examDate,
        daysPerWeek,
        dailyMinutes,
        dayOffMinutes,
        startMinutes,
        dayOffStartMinutes,
        sessionMinutes,
        studyMethod,
        courseSettings: settings.map((setting) => ({
          courseId: setting.courseId,
          paper,
        })),
      });
      if (result.startedEarlier) {
        toast.success(
          `Timetable built. To fit every topic, revision starts on ${formatLongDate(result.startDate)}.`,
        );
      } else {
        toast.success("Revision timetable built.");
      }
      // The plan is saved; a fresh visit should start from a clean draft.
      try {
        window.sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        // Nothing to clean up if storage is unavailable.
      }
      navigate("/timetable");
    } catch (buildError) {
      const message = readableError(
        buildError,
        "Could not build that timetable. Please try again.",
      );
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (courses === undefined) {
    return (
      <AppShell>
        <SkeletonBuilderPage />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link
        to="/timetable"
        className="text-[0.8rem] font-semibold text-muted-foreground hover:text-brand-ink"
      >
        Back to timetable
      </Link>

      <PageHeader
        className="mt-4"
        eyebrow="Step 4 · Timetable"
        title="Build a plan you can actually follow"
        description="Three short steps. Choose your subjects, the time you have on school days and days off, then your first exam date. Bluprint spreads that time across the day with breaks and space for meals, and every session links to its study set."
      />

      {/* A quiet stepper: one accent marks where you are, mint marks what is
          done. The steps used to each carry their own colour, which made
          navigation compete with the form itself. */}
      <nav aria-label="Timetable steps" className="mt-5">
        <ol className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {STEPS.map((entry, index) => {
            const value = index + 1;
            const active = value === step;
            const done = value < step;
            return (
              <li key={entry.title} className="flex min-w-0 flex-1 items-center gap-1">
                <button
                  type="button"
                  onClick={() => goToStep(value)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 rounded-full px-2 py-1.5 text-left transition-colors sm:px-3",
                    active
                      ? "bg-white shadow-[0_1px_0_rgba(25,26,30,0.04)] ring-1 ring-border"
                      : "hover:bg-white/60",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full text-[0.6rem] font-bold transition-colors",
                      done
                        ? "bg-brand-mint/20 text-brand-mint"
                        : active
                          ? "bg-brand-sky text-brand-cream"
                          : "bg-brand-sky/10 text-brand-sky/70",
                    )}
                  >
                    {done ? <Check className="size-3" aria-hidden /> : value}
                  </span>
                  <span
                    className={cn(
                      "truncate text-[0.74rem] font-semibold",
                      active ? "text-brand-ink" : "text-muted-foreground",
                    )}
                  >
                    {entry.title}
                  </span>
                </button>
                {value < STEPS.length && (
                  <span
                    aria-hidden
                    className="hidden h-px w-3 shrink-0 bg-border sm:block"
                  />
                )}
              </li>
            );
          })}
        </ol>
        <div
          className="mt-2 h-1 overflow-hidden rounded-full bg-brand-panel"
          aria-hidden
        >
          <motion.div
            animate={{ width: `${(step / STEPS.length) * 100}%` }}
            transition={{ duration: 0.45, ease: EASE }}
            className="h-full rounded-full bg-brand-sky"
          />
        </div>
      </nav>

      {ready.length === 0 ? (
        <motion.section
          className="mt-6 rounded-[2rem] border border-dashed border-border bg-white p-6 sm:p-8"
          {...reveal(0.12)}
        >
          <h2 className="font-display text-[1.15rem] font-bold text-brand-ink">
            No ready course pathways yet
          </h2>
          <p className="mt-2 max-w-xl text-[0.88rem] leading-relaxed text-muted-foreground">
            A timetable is built from the topics in your course pathways. Choose
            your courses first and wait for their maps to finish, then come back
            here.
          </p>
          <Button
            asChild
            className="mt-4 h-10 rounded-full bg-[#191B27] px-5 font-semibold text-white hover:bg-[#2A2D3E]"
          >
            <Link to="/courses/new">Choose courses</Link>
          </Button>
        </motion.section>
      ) : (
        <motion.div
          key={step}
          className="mt-6 space-y-4 pb-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          <section
            hidden={step !== 1}
            className="rounded-[2rem] border border-border bg-white p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="mono-label text-muted-foreground">
                  Step 1 of 3
                </p>
                <h2 className="mt-1 font-display text-[1.22rem] font-bold text-brand-ink">
                  Which subjects are you revising?
                </h2>
                <p className="mt-0.5 text-[0.8rem] text-muted-foreground">
                  Select a course for each subject you want on the timetable.
                </p>
              </div>
              <span className="rounded-full bg-brand-panel px-2.5 py-1 text-[0.72rem] font-bold text-chrome-7">
                {settings.length} selected
              </span>
            </div>

            <div className="rise-stagger mt-4 grid items-start gap-2 sm:grid-cols-2">
              {ready.map((course, index) => {
                const selectedIndex = settings.findIndex(
                  (setting) => setting.courseId === course._id,
                );
                const active = selectedIndex >= 0;
                const color =
                  SUBJECT_COLORS[
                    (active ? selectedIndex : index) % SUBJECT_COLORS.length
                  ];
                return (
                  <motion.button
                    key={course._id}
                    type="button"
                    aria-pressed={active}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => toggle(course._id)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors",
                      active
                        ? `${color.tint} ${color.border} subject-tile`
                        : "border-border bg-white hover:bg-brand-panel",
                    )}
                  >
                    <span
                      className={cn(
                        "size-2.5 shrink-0 rounded-full",
                        active ? color.dot : "bg-border",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.86rem] font-semibold text-brand-ink">
                        {course.subject}
                      </span>
                      <span className="mt-0.5 block truncate text-[0.7rem] text-muted-foreground">
                        {courseSubtitle(course)} · {course.topicCount} topics
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-[0.7rem] font-semibold",
                        active ? color.text : "text-chrome-7",
                      )}
                    >
                      {active ? "Selected" : "Add"}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </section>

          <section
            hidden={step !== 2}
            className="rounded-[2rem] border border-border bg-white p-5 sm:p-6"
          >
            <p className="mono-label text-muted-foreground">
              Step 2 of 3
            </p>
            <h2 className="mt-1 font-display text-[1.22rem] font-bold text-brand-ink">
              How do you want to study?
            </h2>
            <p className="mt-0.5 text-[0.8rem] text-muted-foreground">
              Choose one route for the whole timetable. Each day rotates between
              your subjects, uses the time you have, and leaves a 10-minute
              break between sessions.
            </p>

            <div className="mt-4">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Study method
              </p>
              <div className="rise-stagger mt-2 grid gap-2 sm:grid-cols-3">
                {STUDY_METHODS.map((option) => {
                  const active = studyMethod === option.value;
                  return (
                    <motion.button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => chooseStudyMethod(option.value)}
                      className={cn(
                        "rounded-2xl border px-3.5 py-3 text-left transition-colors",
                        active
                          ? "border-chrome-6 bg-brand-panel"
                          : "border-border bg-white hover:bg-brand-panel",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[0.84rem] font-semibold text-brand-ink">
                          {option.title}
                        </span>
                        {active && (
                          <Check
                            className="size-3.5 shrink-0 text-chrome-7"
                            aria-hidden
                          />
                        )}
                      </span>
                      <span className="mt-1 block text-[0.7rem] leading-relaxed text-muted-foreground">
                        {option.description}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
              {studyMethod !== "topics" && (
                <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">
                  Every paper counts as a 60-minute session, so a paper day needs at
                  least an hour of revision time.
                </p>
              )}
            </div>

            <div
              className={cn("mt-5", studyMethod === "papers" && "hidden")}
            >
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Longest session
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SESSION_MINUTES.map((minutes) => {
                  const disabled = minutes > dailyMinutes || minutes > dayOffMinutes;
                  return (
                    <button
                      key={minutes}
                      type="button"
                      disabled={disabled}
                      aria-pressed={sessionMinutes === minutes}
                      onClick={() => chooseSessionMinutes(minutes)}
                      className={cn(
                        "rounded-full border px-4 py-2 text-[0.8rem] font-semibold transition-colors",
                        sessionMinutes === minutes
                          ? "border-[#191B27] bg-[#191B27] text-white"
                          : "border-border bg-white text-brand-ink/70 hover:bg-brand-panel",
                        disabled && "cursor-not-allowed opacity-40 hover:bg-white",
                      )}
                    >
                      {minutes} min
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">
                A short topic needs about 20 minutes; a long one uses your full
                length. Everything is set down with a 10-minute break between
                sessions, and lunch and dinner are kept free. Nothing runs past
                8:00 pm; a session that would cross that line waits for the next
                revision day.
              </p>
            </div>

            <div
              className={cn("mt-5", studyMethod === "papers" && "hidden")}
            >
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Papers
              </p>
              <h3 className="mt-1 font-display text-[1rem] font-bold text-brand-ink">
                Which paper are you revising?
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {PAPERS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={paper === option}
                    onClick={() => {
                      setPaper(option);
                      setError(null);
                    }}
                    className={cn(
                      "rounded-full border px-4 py-2 text-[0.8rem] font-semibold transition-colors",
                      paper === option
                        ? "border-chrome-6 bg-brand-panel text-chrome-8"
                        : "border-border bg-white text-brand-ink/70 hover:bg-brand-panel",
                    )}
                  >
                    {paperLabel(option)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">
                One answer for every subject. “Papers 1 and 2” alternates the two
                across sessions so the whole timetable covers both. It labels topic
                sessions; a past paper session always opens the saved paper itself.
              </p>
            </div>

            {studyMethod === "papers" && (
              <p className="mt-4 rounded-2xl bg-brand-panel px-4 py-3 text-[0.78rem] leading-relaxed text-chrome-8">
                A past paper takes an hour, so every session is one full paper. The
                session length and paper label only apply to topic sessions and can
                be chosen on the mix route.
              </p>
            )}
          </section>

          <section
            hidden={step !== 2}
            className="rounded-[2rem] border border-border bg-white p-5 sm:p-6"
          >
            <p className="mono-label text-muted-foreground">Daily plan</p>
            <h2 className="mt-1 font-display text-[1.22rem] font-bold text-brand-ink">
              How much time do you have each day?
            </h2>
            <p className="mt-0.5 text-[0.8rem] text-muted-foreground">
              Pick the study time you realistically have and when you can start.
              Sessions are spread across that time rather than stacked at the
              start, with 10-minute breaks and meals left free.
            </p>

            <div className="mt-4">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Time on a school day
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {DAILY_MINUTES.map((minutes) => {
                  // Papers are an hour each, so half an hour cannot hold one.
                  const tooShort =
                    minutes < 60 && studyMethod !== "topics";
                  return (
                  <button
                    key={minutes}
                    type="button"
                    disabled={tooShort}
                    aria-pressed={dailyMinutes === minutes}
                    onClick={() => chooseDailyMinutes(minutes)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-[0.8rem] font-semibold transition-colors",
                      dailyMinutes === minutes
                        ? "border-chrome-6 bg-brand-panel text-chrome-7"
                        : "border-border bg-white text-brand-ink/70 hover:bg-brand-panel",
                      tooShort && "cursor-not-allowed opacity-40 hover:bg-white",
                    )}
                  >
                    {minutes < 60 ? `${minutes} min` : `${minutes / 60} hour${minutes === 60 ? "" : "s"}`}
                  </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">
                Bluprint uses this as study time: whole topics, each taking what
                its notes need (never less than 20 minutes and never more than
                your longest session). It spreads them out with a 10-minute
                break between each one, and keeps lunch and dinner free.
              </p>
            </div>

            <div className="mt-5">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Time on a day off
              </p>
              <p className="mt-0.5 text-[0.72rem] text-muted-foreground">
                Weekends, bank holidays and school holidays use this budget. Pick
                what you can actually manage, not a multiple of a school day.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {DAY_OFF_MINUTES.map((minutes) => {
                  const disabled = minutes < longestSessionMinutes;
                  return (
                    <button
                      key={minutes}
                      type="button"
                      disabled={disabled}
                      aria-pressed={dayOffMinutes === minutes}
                      onClick={() => chooseDayOffMinutes(minutes)}
                      className={cn(
                        "rounded-full border px-4 py-2 text-[0.8rem] font-semibold transition-colors",
                        dayOffMinutes === minutes
                          ? "border-chrome-6 bg-brand-panel text-chrome-8"
                          : "border-border bg-white text-brand-ink/70 hover:bg-brand-panel",
                        disabled &&
                          "cursor-not-allowed opacity-40 hover:bg-white",
                      )}
                    >
                      {minutes < 60
                        ? `${minutes} min`
                        : `${minutes / 60} hour${minutes === 60 ? "" : "s"}`}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">
                At least as long as one session, so a study block still fits on a
                day off.
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Revision days each week
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DAYS_PER_WEEK.map((days) => (
                    <button
                      key={days}
                      type="button"
                      aria-pressed={daysPerWeek === days}
                      onClick={() => setDaysPerWeek(days)}
                      className={cn(
                        "rounded-full border px-4 py-2 text-[0.8rem] font-semibold transition-colors",
                        daysPerWeek === days
                          ? "border-chrome-6 bg-chrome-3 text-chrome-8"
                          : "border-border bg-white text-brand-ink/70 hover:bg-brand-panel",
                      )}
                    >
                      {days} days
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[0.7rem] text-muted-foreground">
                  {daysPerWeek === 3
                    ? "Monday, Wednesday and Friday."
                    : daysPerWeek === 5
                      ? "Monday to Friday. Weekends stay free."
                      : "Every day, using your day-off time at weekends and on holidays."}
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  School days start at
                  <select
                    value={startMinutes}
                    onChange={(event) =>
                      setStartMinutes(Number(event.target.value))
                    }
                    className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-[0.82rem] font-medium normal-case tracking-normal text-brand-ink outline-none focus:border-chrome-4"
                  >
                    {START_HOURS.map((hour) => (
                      <option
                        key={hour}
                        value={hour * 60}
                        disabled={hour * 60 + longestSessionMinutes > LATEST_END}
                      >
                        {formatTime(hour * 60)}
                        {hour * 60 + longestSessionMinutes > LATEST_END
                          ? ". Too late for your sessions"
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Days off start at
                  <select
                    value={dayOffStartMinutes}
                    onChange={(event) =>
                      setDayOffStartMinutes(Number(event.target.value))
                    }
                    className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-[0.82rem] font-medium normal-case tracking-normal text-brand-ink outline-none focus:border-[#A6D9B9]"
                  >
                    {START_HOURS.map((hour) => (
                      <option
                        key={hour}
                        value={hour * 60}
                        disabled={hour * 60 + longestSessionMinutes > LATEST_END}
                      >
                        {formatTime(hour * 60)}
                        {hour * 60 + longestSessionMinutes > LATEST_END
                          ? ". Too late for your sessions"
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="block text-[0.7rem] font-normal normal-case tracking-normal text-muted-foreground">
                  Nothing is scheduled to run past {"8:00 pm"}, so starting late
                  can leave part of the day's time unplanned. Sessions are spaced
                  out through the day with a 10-minute break between them, and
                  lunch and dinner are left free automatically.
                </span>
              </div>
            </div>
          </section>

          <section
            hidden={step !== 3}
            className="rounded-[2rem] border border-border bg-white p-5 sm:p-6"
          >
            <p className="mono-label text-muted-foreground">
              Step 3 of 3
            </p>
            <h2 className="mt-1 font-display text-[1.22rem] font-bold text-brand-ink">
              When does revision start, and when is the first exam?
            </h2>
            <p className="mt-0.5 text-[0.8rem] text-muted-foreground">
              The plan runs up to the day before your first exam. Bank holidays,
              weekends and school holidays use the day-off time you chose, and
              England's usual school breaks are recognised. If every topic will not
              fit, revision starts earlier than the date below. Bluprint never
              leaves topics unscheduled.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-[0.72rem] font-semibold text-brand-ink">
                Start revising
                <Input
                  type="date"
                  value={startDate}
                  min={dateInputValue(new Date())}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="mt-1.5 h-11 rounded-2xl border-border bg-white text-sm shadow-none"
                />
              </label>
              <label className="block text-[0.72rem] font-semibold text-brand-ink">
                First exam
                <Input
                  type="date"
                  value={examDate}
                  min={startDate}
                  onChange={(event) => setExamDate(event.target.value)}
                  className="mt-1.5 h-11 rounded-2xl border-border bg-white text-sm shadow-none"
                />
              </label>
            </div>

            {datesInvalid ? (
              <p className="mt-3 text-[0.8rem] font-medium text-[#C23B49]">
                Your first exam needs to be after your start date.
              </p>
            ) : (
              <p className="mt-3 text-[0.8rem] font-medium text-muted-foreground">
                {daysLeft > 0
                  ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} until your first exam.`
                  : "Choose a future exam date."}
              </p>
            )}
          </section>

          {existing && (
            <p className="rounded-2xl bg-[#FFF6E5] px-4 py-3 text-[0.8rem] leading-relaxed text-[#8A5D00]">
              Building a new timetable replaces the one currently in your sidebar.
            </p>
          )}
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="rounded-2xl bg-[#FFEEF0] px-4 py-3 text-[0.8rem] leading-relaxed text-[#C23B49]"
            >
              {error}
            </motion.p>
          )}

          {/* One bar, one primary action. It stays in reach on a long step, and
              it is never disabled for a missing answer: pressing it explains
              what is needed and moves to that step. */}
          <div className="chrome-bar sticky bottom-3 z-20 rounded-[1.4rem] border px-4 py-3 shadow-[0_18px_38px_-30px_rgba(22,24,31,0.55)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="mono-label text-chrome-7">Step {step} of 3</p>
                <p className="mt-0.5 truncate text-[0.8rem] text-muted-foreground">
                  {step === 3 && settings.length === 0
                    ? "No subjects chosen yet."
                    : step === 3
                      ? `${settings.length} subject${settings.length === 1 ? "" : "s"} · ${methodLabel} · ${
                          studyMethod === "papers"
                        ? "60 min papers"
                        : `${sessionMinutes} min max`
                        }`
                      : `${STEPS[step - 1]!.title}${
                          settings.length > 0
                            ? ` · ${settings.length} selected`
                            : ""
                        }`}
                </p>
              </div>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                {step > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => goToStep(step - 1)}
                    className="h-11 rounded-full px-4 text-sm font-semibold text-brand-ink hover:bg-brand-panel"
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                    Back
                  </Button>
                )}
                {step < 3 ? (
                  <Button
                    type="button"
                    onClick={nextStep}
                    className="h-11 flex-1 rounded-full bg-[#191B27] px-6 text-sm font-semibold text-white hover:bg-[#2A2D3E] sm:flex-none"
                  >
                    Next
                    <ChevronRight className="size-4" aria-hidden />
                  </Button>
                ) : (
                  <Button
                    onClick={() => void submit()}
                    disabled={saving}
                    className="h-11 flex-1 rounded-full bg-[#191B27] px-6 text-sm font-semibold text-white hover:bg-[#2A2D3E] disabled:opacity-60 sm:flex-none"
                  >
                    {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                    Build revision timetable
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AppShell>
  );
}
