import { AppShell } from "@/components/AppShell";
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
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
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
/** The builder runs as four pages; each has its own URL and one decision. */
const STEPS = [
  { title: "Subjects", color: "#128A4C", tint: "bg-[#EAFBF4]" },
  { title: "Length and papers", color: "#6B4DBE", tint: "bg-[#F3F0FF]" },
  { title: "Daily plan", color: "#2B7FB8", tint: "bg-[#EAF4FD]" },
  { title: "Exam dates", color: "#B7791F", tint: "bg-[#FFF7EC]" },
] as const;

type CourseSetting = {
  courseId: Id<"courses">;
};

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
  const { step: stepParam } = useParams<{ step?: string }>();
  // Invalid or missing step values fall back to the first page rather than a
  // blank screen.
  const parsedStep = Number(stepParam ?? "1");
  const step = Number.isInteger(parsedStep)
    ? Math.min(4, Math.max(1, parsedStep))
    : 1;
  const courses = useQuery(api.courses.listMine);
  const existing = useQuery(api.timetable.getMine);
  const buildPlan = useMutation(api.timetable.build);

  const initial = defaults();
  const [startDate, setStartDate] = useState(initial.startDate);
  const [examDate, setExamDate] = useState(initial.examDate);
  const [dailyMinutes, setDailyMinutes] = useState(60);
  const [dayOffMinutes, setDayOffMinutes] = useState(180);
  // One uninterrupted study block, shared by every subject.
  const [sessionMinutes, setSessionMinutes] = useState(45);
  const [startMinutes, setStartMinutes] = useState(17 * 60);
  // A day off has its own start time: half-term mornings are not a school
  // evening after clubs.
  const [dayOffStartMinutes, setDayOffStartMinutes] = useState(10 * 60);
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  // One paper answer for the whole timetable instead of a choice per subject.
  const [paper, setPaper] = useState("Paper 1");
  // Topics, past papers, or a mix of both, for every subject in the plan.
  const [studyMethod, setStudyMethod] = useState<StudyMethod>("topics");
  const [settings, setSettings] = useState<CourseSetting[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const target = Math.min(4, Math.max(1, next));
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

  const submit = async () => {
    if (settings.length === 0) {
      setError("Choose at least one course to revise.");
      return;
    }
    if (!startDate || !examDate) {
      setError("Choose both a start date and an exam date.");
      return;
    }
    if (daysLeft <= 0) {
      setError("Choose an exam date in the future.");
      return;
    }
    if (examDate <= startDate) {
      setError("Your first exam needs to be after your start date.");
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
        <div className="flex min-h-[320px] items-center justify-center rounded-[2rem] border border-border bg-white">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
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

      <header className="mt-4">
        <h1 className="font-display text-[1.6rem] font-bold leading-tight tracking-[-0.03em] text-brand-ink sm:text-[2rem]">
          Build a plan you can actually follow
        </h1>
        <p className="mt-2 max-w-2xl text-[0.92rem] leading-relaxed text-muted-foreground">
          Four short steps. You choose the time you have, and when revision
          starts, on school days and on days off. Bluprint fills that time with
          evenly spaced sessions, and every session links to its study set.
        </p>
      </header>

      <ol className="mt-5 flex flex-wrap items-stretch gap-2">
        {STEPS.map((entry, index) => {
          const value = index + 1;
          const active = value === step;
          const done = value < step;
          return (
            <li key={entry.title} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => goToStep(value)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left transition-colors",
                  active
                    ? "bg-white shadow-[0_10px_24px_-22px_rgba(22,24,31,0.5)]"
                    : "border-border bg-white hover:border-brand-pink/40",
                )}
                style={
                  active
                    ? {
                        backgroundColor: `${entry.color}12`,
                        borderColor: `${entry.color}44`,
                      }
                    : undefined
                }
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-[0.66rem] font-bold text-white",
                    !active && !done && "bg-[#C9CBD6]",
                  )}
                  style={{ backgroundColor: active || done ? entry.color : undefined }}
                >
                  {done ? <Check className="size-3" aria-hidden /> : value}
                </span>
                <span
                  className={cn(
                    "truncate text-[0.76rem] font-semibold",
                    active ? "text-brand-ink" : "text-muted-foreground",
                  )}
                >
                  {entry.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {ready.length === 0 ? (
        <section className="mt-6 rounded-[2rem] border border-dashed border-border bg-white p-6 sm:p-8">
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
        </section>
      ) : (
        <div className="mt-6 space-y-4 pb-10">
          <section
            hidden={step !== 1}
            className="rounded-[2rem] border border-border bg-white p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-[#0C6B4C]">
                  Step 1 of 4
                </p>
                <h2 className="mt-1 font-display text-[1.22rem] font-bold text-brand-ink">
                  Which subjects are you revising?
                </h2>
                <p className="mt-0.5 text-[0.8rem] text-muted-foreground">
                  Select a course for each subject you want on the timetable.
                </p>
              </div>
              <span className="rounded-full bg-[#F3ECFF] px-2.5 py-1 text-[0.72rem] font-bold text-[#5B3DF5]">
                {settings.length} selected
              </span>
            </div>

            <div className="mt-4 grid items-start gap-2 sm:grid-cols-2">
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
                  <button
                    key={course._id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggle(course._id)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors",
                      active
                        ? `${color.tint} ${color.border}`
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
                        active ? color.text : "text-[#5B3DF5]",
                      )}
                    >
                      {active ? "Selected" : "Add"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section
            hidden={step !== 2}
            className="rounded-[2rem] border border-border bg-white p-5 sm:p-6"
          >
            <p className="text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-[#6B4EE6]">
              Step 2 of 4
            </p>
            <h2 className="mt-1 font-display text-[1.22rem] font-bold text-brand-ink">
              How do you want to study?
            </h2>
            <p className="mt-0.5 text-[0.8rem] text-muted-foreground">
              Choose one route for the whole timetable. Each day is filled with
              whole sessions until your time is used up, with an even gap between
              one session and the next.
            </p>

            <div className="mt-4">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Study method
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {STUDY_METHODS.map((option) => {
                  const active = studyMethod === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => chooseStudyMethod(option.value)}
                      className={cn(
                        "rounded-2xl border px-3.5 py-3 text-left transition-colors",
                        active
                          ? "border-[#6B4EE6] bg-[#F6F2FF]"
                          : "border-border bg-white hover:bg-brand-panel",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[0.84rem] font-semibold text-brand-ink">
                          {option.title}
                        </span>
                        {active && (
                          <Check
                            className="size-3.5 shrink-0 text-[#6B4EE6]"
                            aria-hidden
                          />
                        )}
                      </span>
                      <span className="mt-1 block text-[0.7rem] leading-relaxed text-muted-foreground">
                        {option.description}
                      </span>
                    </button>
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
                Session length
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
                Applies to every subject and to every day. Nothing runs past
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
                        ? "border-[#6B4EE6] bg-[#F3ECFF] text-[#5130D8]"
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
              <p className="mt-4 rounded-2xl bg-[#F3F0FF] px-4 py-3 text-[0.78rem] leading-relaxed text-[#5130D8]">
                A past paper takes an hour, so every session is one full paper. The
                session length and paper label only apply to topic sessions and can
                be chosen on the mix route.
              </p>
            )}
          </section>

          <section
            hidden={step !== 3}
            className="rounded-[2rem] border border-border bg-white p-5 sm:p-6"
          >
            <p className="text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-[#1B5C8A]">
              Step 3 of 4
            </p>
            <h2 className="mt-1 font-display text-[1.22rem] font-bold text-brand-ink">
              How much time do you have each day?
            </h2>
            <p className="mt-0.5 text-[0.8rem] text-muted-foreground">
              Pick the study time you realistically have and when you can start.
              That time is filled with sessions, spaced equally apart.
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
                        ? "border-[#7C5CFF] bg-[#F3ECFF] text-[#5B3DF5]"
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
                Bluprint fills this time with {sessionMinutes}-minute sessions, plus
                a shorter final block when your time does not divide exactly, so the
                whole budget is used. Choosing a day shorter than the session
                shortens the session to the longest block that still fits.
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
                          ? "border-[#6B4DBE] bg-[#F3F0FF] text-[#5130D8]"
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
                          ? "border-[#12B8A6] bg-[#E6F9F6] text-[#0E8C7F]"
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
                    className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-[0.82rem] font-medium normal-case tracking-normal text-brand-ink outline-none focus:border-[#B9A6FF]"
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
                  equally with a short gap between them.
                </span>
              </div>
            </div>
          </section>

          <section
            hidden={step !== 4}
            className="rounded-[2rem] border border-border bg-white p-5 sm:p-6"
          >
            <p className="text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-[#8A5A12]">
              Step 4 of 4
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
            <p className="rounded-2xl bg-[#FFEEF0] px-4 py-3 text-[0.8rem] leading-relaxed text-[#C23B49]">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[0.76rem] leading-relaxed text-muted-foreground">
              {step === 4 ? (
                <>
                  {settings.length} subject{settings.length === 1 ? "" : "s"} ·{" "}
                  {methodLabel} ·{" "}
                  {studyMethod === "papers"
                    ? "60 min papers"
                    : `${sessionMinutes} min sessions`}{" "}
                  · {dailyMinutes} min on school days · {dayOffMinutes} min on days
                  off · {daysPerWeek} days a week
                </>
              ) : (
                <>
                  Step {step} of 4 · {STEPS[step - 1]!.title}
                  {settings.length > 0 ? ` · ${settings.length} subjects` : ""}
                </>
              )}
            </p>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => goToStep(step - 1)}
                  className="h-11 rounded-full border-border bg-white px-4 text-sm font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  Back
                </Button>
              )}
              {step < 4 ? (
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
                  disabled={
                    saving ||
                    settings.length === 0 ||
                    !startDate ||
                    !examDate ||
                    daysLeft <= 0 ||
                    datesInvalid
                  }
                  className="h-11 flex-1 rounded-full bg-[#191B27] px-6 text-sm font-semibold text-white hover:bg-[#2A2D3E] disabled:opacity-50 sm:flex-none"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                  Build revision timetable
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
