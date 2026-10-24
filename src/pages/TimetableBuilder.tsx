import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { courseSubtitle } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { dateInputValue, daysUntilInput } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

const SESSION_MINUTES = [25, 45, 60, 90];
const DAYS_PER_WEEK = [3, 5, 7];

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

export default function TimetableBuilder() {
  const navigate = useNavigate();
  const courses = useQuery(api.courses.listMine);
  const existing = useQuery(api.timetable.getMine);
  const buildPlan = useMutation(api.timetable.build);

  const initial = defaults();
  const [startDate, setStartDate] = useState(initial.startDate);
  const [examDate, setExamDate] = useState(initial.examDate);
  const [sessionMinutes, setSessionMinutes] = useState(45);
  const [daysPerWeek, setDaysPerWeek] = useState(5);
  const [selected, setSelected] = useState<Id<"courses">[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = (courses ?? []).filter(
    (course) => course.status === "ready" && course.topicCount > 0,
  );
  const daysLeft = daysUntilInput(examDate);
  const datesInvalid = Boolean(startDate && examDate) && examDate <= startDate;

  const toggle = (courseId: Id<"courses">) => {
    setSelected((current) =>
      current.includes(courseId)
        ? current.filter((id) => id !== courseId)
        : [...current, courseId],
    );
    setError(null);
  };

  const submit = async () => {
    if (selected.length === 0) {
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
        sessionMinutes,
        daysPerWeek,
        courseIds: selected,
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
          Choose what you are revising, how long each session should be, and when
          your exams start. Bluprint will lay out one topic per revision day and
          link every entry to a study set.
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
                  1. What do you want to revise?
                </h2>
                <p className="mt-0.5 text-[0.8rem] text-muted-foreground">
                  Select the courses to draw revision topics from.
                </p>
              </div>
              <span className="rounded-full bg-[#F3ECFF] px-2.5 py-1 text-[0.72rem] font-bold text-[#5B3DF5]">
                {selected.length} selected
              </span>
            </div>

            <div className="mt-4 grid items-start gap-2 sm:grid-cols-2">
              {ready.map((course) => {
                const active = selected.includes(course._id);
                return (
                  <button
                    key={course._id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggle(course._id)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors",
                      active
                        ? "border-[#191B27] bg-[#FAFAFF]"
                        : "border-border bg-white hover:bg-brand-panel",
                    )}
                  >
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
                        active ? "text-[#128A4C]" : "text-[#5B3DF5]",
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
              2. How do you want to revise?
            </h2>
            <p className="mt-0.5 text-[0.8rem] text-muted-foreground">
              Each revision day gets one focused session.
            </p>

            <div className="mt-4">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Session length
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SESSION_MINUTES.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    aria-pressed={sessionMinutes === minutes}
                    onClick={() => setSessionMinutes(minutes)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-[0.8rem] font-semibold transition-colors",
                      sessionMinutes === minutes
                        ? "border-[#7C5CFF] bg-[#F3ECFF] text-[#5B3DF5]"
                        : "border-border bg-white text-brand-ink/70 hover:bg-brand-panel",
                    )}
                  >
                    {minutes} minutes
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
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
                    ? "Monday to Friday, with weekends free."
                    : "Every day."}
              </p>
            </div>
          </section>

          <section className="rounded-[2rem] border border-border bg-white p-5 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-6">
            <h2 className="font-display text-[1.12rem] font-bold text-brand-ink">
              3. When are your exams?
            </h2>
            <p className="mt-0.5 text-[0.8rem] text-muted-foreground">
              The plan runs up to the day before your first exam.
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
              {selected.length} course{selected.length === 1 ? "" : "s"} ·{" "}
              {sessionMinutes} minutes · {daysPerWeek} days a week
            </p>
            <Button
              onClick={() => void submit()}
              disabled={
                saving ||
                selected.length === 0 ||
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
