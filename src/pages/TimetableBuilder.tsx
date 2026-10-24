import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { dateInputValue, daysUntilInput } from "@/lib/format";
import { courseSubtitle } from "@/lib/subjects";
import {
  extendedDailyMinutes,
  formatTime,
  SUBJECT_COLORS,
} from "@/lib/timetable";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

const SESSION_MINUTES = [25, 45, 60, 90];
const DAILY_MINUTES = [30, 60, 90, 120];
const DAYS_PER_WEEK = [3, 5, 7];
const PAPERS = ["Paper 1", "Paper 2", "Both"];
const START_HOURS = [9, 10, 14, 16, 17, 18, 19, 20];
const MAX_COURSES = 12;

type CourseSetting = {
  courseId: Id<"courses">;
  minutes: number;
  paper: string;
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

function defaultSessionMinutes(dailyMinutes: number): number {
  return dailyMinutes >= 45 ? 45 : sessionWithin(dailyMinutes);
}

export default function TimetableBuilder() {
  const navigate = useNavigate();
  const courses = useQuery(api.courses.listMine);
  const existing = useQuery(api.timetable.getMine);
  const buildPlan = useMutation(api.timetable.build);

  const initial = defaults();
  const [startDate, setStartDate] = useState(initial.startDate);
  const [examDate, setExamDate] = useState(initial.examDate);
  const [dailyMinutes, setDailyMinutes] = useState(60);
  const [startMinutes, setStartMinutes] = useState(17 * 60);
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [settings, setSettings] = useState<CourseSetting[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = (courses ?? []).filter(
    (course) => course.status === "ready" && course.topicCount > 0,
  );
  const daysLeft = daysUntilInput(examDate);
  const datesInvalid = Boolean(startDate && examDate) && examDate <= startDate;
  const minSessionMinutes =
    settings.length > 0
      ? Math.min(...settings.map((setting) => setting.minutes))
      : 25;

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
      return [
        ...current,
        {
          courseId,
          minutes: defaultSessionMinutes(dailyMinutes),
          paper: "Paper 1",
        },
      ];
    });
    setError(null);
  };

  const updateSetting = (courseId: Id<"courses">, patch: Partial<CourseSetting>) => {
    setSettings((current) =>
      current.map((setting) =>
        setting.courseId === courseId ? { ...setting, ...patch } : setting,
      ),
    );
    setError(null);
  };

  const chooseDailyMinutes = (minutes: number) => {
    setDailyMinutes(minutes);
    // A subject cannot be revised for longer than the whole day's budget, and
    // the replacement must still be one of the offered session lengths.
    const longest = sessionWithin(minutes);
    setSettings((current) =>
      current.map((setting) => ({
        ...setting,
        minutes:
          setting.minutes <= minutes ? setting.minutes : longest,
      })),
    );
    setError(null);
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
      await buildPlan({
        startDate,
        examDate,
        daysPerWeek,
        dailyMinutes,
        startMinutes,
        courseSettings: settings,
      });
      toast.success("Revision timetable built.");
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
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[#7C5CFF]">
          Revision timetable
        </p>
        <h1 className="mt-1 font-display text-[1.6rem] font-bold leading-tight text-brand-ink sm:text-[2rem]">
          Build a plan you can actually follow
        </h1>
        <p className="mt-2 max-w-2xl text-[0.92rem] leading-relaxed text-muted-foreground">
          Choose how long to spend on each subject and each school day. Bluprint
          builds a weekly calendar, and gives bank holidays, weekends and school
          holidays double the school-day time. Every session links to
          its study set.
        </p>
      </header>

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
          <section className="rounded-[2rem] border border-border bg-white p-5 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-[1.12rem] font-bold text-brand-ink">
                  1. Subjects to revise
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

          <section className="rounded-[2rem] border border-border bg-white p-5 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-6">
            <h2 className="font-display text-[1.12rem] font-bold text-brand-ink">
              2. Time per subject and paper
            </h2>
            <p className="mt-0.5 text-[0.8rem] text-muted-foreground">
              Each subject can have its own session length. Choose whether to revise
              Paper 1, Paper 2, or alternate between both.
            </p>

            {settings.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-border px-4 py-5 text-[0.82rem] text-muted-foreground">
                Select at least one subject above to set its session length.
              </p>
            ) : (
              <div className="mt-4 space-y-2.5">
                {settings.map((setting) => {
                  const course = ready.find(
                    (item) => item._id === setting.courseId,
                  );
                  if (!course) return null;
                  const index = settings.indexOf(setting);
                  const color = SUBJECT_COLORS[index % SUBJECT_COLORS.length];
                  return (
                    <div
                      key={setting.courseId}
                      className={cn(
                        "rounded-2xl border p-3.5 sm:p-4",
                        color.border,
                        color.tint,
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className={cn("size-2.5 rounded-full", color.dot)} />
                          <div className="min-w-0">
                            <p className="truncate text-[0.88rem] font-semibold text-brand-ink">
                              {course.subject}
                            </p>
                            <p className="mt-0.5 truncate text-[0.7rem] text-muted-foreground">
                              {courseSubtitle(course)}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggle(course._id)}
                          className="text-[0.7rem] font-semibold text-muted-foreground underline-offset-2 hover:text-brand-ink hover:underline"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                        <div>
                          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            Session length
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {SESSION_MINUTES.map((minutes) => {
                              const disabled = minutes > dailyMinutes;
                              return (
                                <button
                                  key={minutes}
                                  type="button"
                                  disabled={disabled}
                                  aria-pressed={setting.minutes === minutes}
                                  onClick={() =>
                                    updateSetting(setting.courseId, { minutes })
                                  }
                                  className={cn(
                                    "rounded-full border px-3 py-1.5 text-[0.74rem] font-semibold transition-colors",
                                    setting.minutes === minutes
                                      ? "border-[#191B27] bg-[#191B27] text-white"
                                      : "border-border bg-white text-brand-ink/70 hover:bg-brand-panel",
                                    disabled &&
                                      "cursor-not-allowed opacity-40 hover:bg-white",
                                  )}
                                >
                                  {minutes} min
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <label className="block text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Paper
                          <select
                            value={setting.paper}
                            aria-label={`${course.subject} paper`}
                            onChange={(event) =>
                              updateSetting(setting.courseId, {
                                paper: event.target.value,
                              })
                            }
                            className="mt-1.5 h-9 w-full rounded-xl border border-border bg-white px-2.5 text-[0.78rem] font-medium normal-case tracking-normal text-brand-ink outline-none focus:border-[#B9A6FF]"
                          >
                            {PAPERS.map((paper) => (
                              <option key={paper} value={paper}>
                                {paperLabel(paper)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border border-border bg-white p-5 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-6">
            <h2 className="font-display text-[1.12rem] font-bold text-brand-ink">
              3. Daily revision time
            </h2>
            <p className="mt-0.5 text-[0.8rem] text-muted-foreground">
              Pick a budget for a school day. Bank holidays, weekends and school
              holidays get double that automatically, because there is no school day
              to work around.
            </p>

            <div className="mt-4">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Time on a school day
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {DAILY_MINUTES.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    aria-pressed={dailyMinutes === minutes}
                    onClick={() => chooseDailyMinutes(minutes)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-[0.8rem] font-semibold transition-colors",
                      dailyMinutes === minutes
                        ? "border-[#7C5CFF] bg-[#F3ECFF] text-[#5B3DF5]"
                        : "border-border bg-white text-brand-ink/70 hover:bg-brand-panel",
                    )}
                  >
                    {minutes < 60 ? `${minutes} min` : `${minutes / 60} hour${minutes === 60 ? "" : "s"}`}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">
                Bluprint fills the budget with whole sessions, so a day can finish a
                few minutes early when the next session does not fit. A school day
                uses this budget; a bank holiday, weekend or school-holiday weekday
                can use up to{" "}
                {extendedDailyMinutes(dailyMinutes, minSessionMinutes)} minutes.
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
                      : "Every day, with longer weekend and holiday blocks."}
                </p>
              </div>

              <label className="block text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Sessions start at
                <select
                  value={startMinutes}
                  onChange={(event) => setStartMinutes(Number(event.target.value))}
                  className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-[0.82rem] font-medium normal-case tracking-normal text-brand-ink outline-none focus:border-[#B9A6FF]"
                >
                  {START_HOURS.map((hour) => (
                    <option key={hour} value={hour * 60}>
                      {formatTime(hour * 60)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-[2rem] border border-border bg-white p-5 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-6">
            <h2 className="font-display text-[1.12rem] font-bold text-brand-ink">
              4. Exam dates
            </h2>
            <p className="mt-0.5 text-[0.8rem] text-muted-foreground">
              The plan runs up to the day before your first exam. England and Wales
              bank holidays, weekends and school holidays all get double the
              school-day time. School breaks follow typical England term dates.
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
              {settings.length} subject{settings.length === 1 ? "" : "s"} ·{" "}
              {dailyMinutes} min on school days · up to{" "}
              {extendedDailyMinutes(dailyMinutes, minSessionMinutes)} min on days off ·{" "}
              {daysPerWeek} days a week
            </p>
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
              className="h-11 w-full rounded-full bg-[#191B27] px-6 text-sm font-semibold text-white hover:bg-[#2A2D3E] disabled:opacity-50 sm:w-auto"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Build revision timetable
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
