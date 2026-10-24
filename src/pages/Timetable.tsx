import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { readableError } from "@/lib/errors";
import { daysUntilInput } from "@/lib/format";
import {
  buildTimetableWeeks,
  colorForCourses,
  formatDayLabel,
  formatLongDate,
  formatTime,
  SUBJECT_COLORS,
  type RevisionEntry,
  type SubjectColor,
  type TimetableDay,
} from "@/lib/timetable";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

function SessionBlock({
  entry,
  color,
  loading,
  disabled,
  onOpen,
}: {
  entry: RevisionEntry;
  color: SubjectColor;
  loading: boolean;
  disabled: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      title={`${entry.unit} · ${entry.topic}`}
      aria-label={`Study ${entry.topic} from ${entry.course}`}
      className={cn(
        "relative w-full overflow-hidden rounded-xl border py-1.5 pl-3 pr-2 text-left transition-shadow hover:shadow-[0_6px_16px_-10px_rgba(22,24,31,0.55)] disabled:opacity-60",
        color.tint,
        color.border,
      )}
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-1.5", color.bar)}
      />
      <span className="flex items-center justify-between gap-1">
        <span className={cn("text-[0.62rem] font-bold", color.text)}>
          {formatTime(entry.startMinutes ?? 17 * 60)}
        </span>
        <span className="text-[0.58rem] font-medium text-muted-foreground">
          {durationLabel(entry.minutes)}
        </span>
      </span>
      <span className="mt-0.5 block text-[0.7rem] font-semibold leading-snug text-brand-ink line-clamp-2">
        {entry.topic}
      </span>
      <span className="mt-0.5 block truncate text-[0.6rem] text-muted-foreground">
        {entry.course}
      </span>
      <span className="mt-1 flex items-center gap-1">
        <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[0.55rem] font-semibold text-brand-ink/70">
          {entry.paper ?? "All papers"}
        </span>
        {loading && (
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
        )}
      </span>
    </button>
  );
}

function DaySessions({
  day,
  colorByCourse,
  busy,
  onOpen,
  emptyLabel,
}: {
  day: TimetableDay;
  colorByCourse: Map<string, SubjectColor>;
  busy: string | null;
  onOpen: (entry: RevisionEntry) => void;
  emptyLabel: string;
}) {
  return (
    <>
      {day.isHoliday && (
        <div className="rounded-lg border border-[#EBD6AB] bg-[#FFF8EA] px-2 py-1.5">
          <p className="text-[0.58rem] font-bold uppercase tracking-[0.05em] text-[#8A5D00]">
            Bank holiday
          </p>
          <p className="mt-0.5 text-[0.62rem] font-medium leading-snug text-[#8A5D00]">
            {day.holidayName}
          </p>
          <p className="mt-0.5 text-[0.56rem] text-[#8A5D00]/75">
            Revision paused
          </p>
        </div>
      )}
      {day.isExamDay && (
        <div className="rounded-lg border border-[#EDC4D2] bg-[#FAE9EF] px-2 py-1.5">
          <p className="text-[0.58rem] font-bold uppercase tracking-[0.05em] text-[#98304F]">
            First exam
          </p>
          <p className="mt-0.5 text-[0.56rem] text-[#98304F]/80">
            No revision scheduled
          </p>
        </div>
      )}

      <div className="mt-1.5 space-y-1.5">
        {day.entries.map((entry) => {
          const key = `${entry.date}:${entry.topicId}:${entry.startMinutes ?? 0}`;
          return (
            <SessionBlock
              key={key}
              entry={entry}
              color={colorByCourse.get(entry.courseId) ?? SUBJECT_COLORS[0]}
              loading={busy === key}
              disabled={busy !== null}
              onOpen={() => onOpen(entry)}
            />
          );
        })}
        {day.entries.length === 0 && !day.isHoliday && !day.isExamDay && (
          <p className="px-1 py-5 text-center text-[0.64rem] text-muted-foreground/60">
            {emptyLabel}
          </p>
        )}
        {day.entries.length === 0 && day.isExamDay && (
          <p className="px-1 pt-1 text-center text-[0.56rem] text-muted-foreground/60">
            {emptyLabel}
          </p>
        )}
      </div>
    </>
  );
}

export default function Timetable() {
  const navigate = useNavigate();
  const plan = useQuery(api.timetable.getMine);
  const openTopic = useMutation(api.courses.createTopicSet);
  const [busy, setBusy] = useState<string | null>(null);

  const courseSettings = useMemo(() => {
    if (!plan) return [];
    if (plan.courseSettings && plan.courseSettings.length > 0) {
      return plan.courseSettings;
    }
    // Plans built before per-subject settings existed still get colours.
    return [
      ...new Map(
        plan.entries.map((entry) => [
          entry.courseId,
          { courseId: entry.courseId, subject: entry.course },
        ]),
      ).values(),
    ];
  }, [plan]);

  const colorByCourse = useMemo(
    () => colorForCourses(courseSettings),
    [courseSettings],
  );

  const weeks = useMemo(() => (plan ? buildTimetableWeeks(plan) : []), [plan]);

  const totalMinutes = useMemo(
    () => (plan?.entries ?? []).reduce((sum, entry) => sum + entry.minutes, 0),
    [plan],
  );

  const visibleHolidays = useMemo(() => {
    if (!plan) return [];
    const lastDay = weeks[weeks.length - 1]?.days[6]?.date ?? plan.startDate;
    return (plan.holidays ?? []).filter(
      (holiday) => holiday.date >= plan.startDate && holiday.date <= lastDay,
    );
  }, [plan, weeks]);

  const handleOpen = async (entry: RevisionEntry) => {
    const key = `${entry.date}:${entry.topicId}:${entry.startMinutes ?? 0}`;
    setBusy(key);
    try {
      const result = await openTopic({
        courseId: entry.courseId,
        topicId: entry.topicId,
      });
      navigate(`/sets/${result.setId}`);
    } catch (error) {
      toast.error(readableError(error, "Could not open that revision topic."));
    } finally {
      setBusy(null);
    }
  };

  if (plan === undefined) {
    return (
      <AppShell>
        <div className="flex min-h-[320px] items-center justify-center rounded-[2rem] border border-border bg-white">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (plan === null) {
    return (
      <AppShell>
        <header>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[#7C5CFF]">
            Revision timetable
          </p>
          <h1 className="mt-1 font-display text-[1.6rem] font-bold leading-tight text-brand-ink sm:text-[2rem]">
            Your revision timetable
          </h1>
          <p className="mt-2 max-w-2xl text-[0.92rem] leading-relaxed text-muted-foreground">
            Turn your courses into a colour-coded weekly plan, then open a study
            set straight from any session.
          </p>
        </header>

        <section className="mt-6 rounded-[2rem] border border-dashed border-border bg-white p-7 sm:p-9">
          <h2 className="font-display text-[1.2rem] font-bold text-brand-ink">
            No timetable yet
          </h2>
          <p className="mt-2 max-w-xl text-[0.88rem] leading-relaxed text-muted-foreground">
            Tell Bluprint which subjects you are revising, how long to spend on
            each one, and when your first exam is. The weekly plan will appear
            here and in the sidebar.
          </p>
          <Button
            asChild
            className="mt-5 h-11 rounded-full bg-[#191B27] px-6 font-semibold text-white hover:bg-[#2A2D3E]"
          >
            <Link to="/timetable/new">Build revision timetable</Link>
          </Button>
        </section>
      </AppShell>
    );
  }

  const daysLeft = daysUntilInput(plan.examDate);

  return (
    <AppShell>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[#7C5CFF]">
            Revision timetable
          </p>
          <h1 className="mt-1 font-display text-[1.6rem] font-bold leading-tight text-brand-ink sm:text-[2rem]">
            Your revision timetable
          </h1>
          <p className="mt-2 text-[0.9rem] text-muted-foreground">
            First exam {formatLongDate(plan.examDate)} ·{" "}
            {daysLeft > 0
              ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} to go`
              : "Exam date has passed"}
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="h-10 rounded-full border-border bg-white px-5 text-[0.82rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
        >
          <Link to="/timetable/new">Build new timetable</Link>
        </Button>
      </header>

      <section className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-border bg-white px-4 py-3 text-[0.78rem] text-muted-foreground">
        <span>
          <span className="font-semibold text-brand-ink">{plan.entries.length}</span>{" "}
          sessions
        </span>
        <span aria-hidden>·</span>
        <span>{durationLabel(totalMinutes)} total</span>
        <span aria-hidden>·</span>
        <span>{plan.dailyMinutes ?? plan.sessionMinutes ?? 60} minutes a day</span>
        <span aria-hidden>·</span>
        <span>{plan.daysPerWeek} days a week</span>
        <span aria-hidden>·</span>
        <span>
          {courseSettings.length} subject
          {courseSettings.length === 1 ? "" : "s"}
        </span>
        {plan.scheduledTopics < plan.topicTotal && (
          <>
            <span aria-hidden>·</span>
            <span>
              Covers {plan.scheduledTopics} of {plan.topicTotal} topics
            </span>
          </>
        )}
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border bg-white px-4 py-3">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Subjects
        </p>
        {courseSettings.map((setting) => {
          const color = colorByCourse.get(setting.courseId);
          if (!color) return null;
          return (
            <span
              key={setting.courseId}
              className="inline-flex items-center gap-1.5 text-[0.76rem] font-medium text-brand-ink"
            >
              <span className={cn("size-2.5 rounded-full", color.dot)} />
              {setting.subject}
            </span>
          );
        })}
      </div>

      {plan.truncated && (
        <p className="mt-3 rounded-2xl bg-[#FFF6E5] px-4 py-3 text-[0.8rem] leading-relaxed text-[#8A5D00]">
          This plan reaches the 60 revision-day limit before your first exam. Build
          it again nearer the exam to add more spaced review.
        </p>
      )}

      {/* Desktop: a seven-column weekly calendar. */}
      <div className="mt-4 hidden overflow-x-auto rounded-[1.6rem] border border-border bg-white shadow-[0_18px_44px_-34px_rgba(22,24,31,0.35)] xl:block">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[84px_repeat(7,minmax(0,1fr))] border-b border-border bg-[#FCFCFD]">
            <div className="px-3 py-2.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Week
            </div>
            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
              (day) => (
                <div
                  key={day}
                  className="border-l border-border/60 px-2.5 py-2.5 text-center text-[0.64rem] font-semibold uppercase tracking-[0.06em] text-brand-ink/70"
                >
                  {day.slice(0, 3)}
                </div>
              ),
            )}
          </div>

          {weeks.map((week, weekIndex) => (
            <div
              key={week.weekStart}
              className="grid grid-cols-[84px_repeat(7,minmax(0,1fr))] border-b border-border last:border-b-0"
            >
              <div className="border-r border-border/60 bg-[#FCFCFD] px-3 py-4">
                <p className="text-[0.68rem] font-bold text-brand-ink">
                  Week {weekIndex + 1}
                </p>
                <p className="mt-0.5 text-[0.6rem] leading-snug text-muted-foreground">
                  {formatDayLabel(week.weekStart)}
                  <br />
                  {formatDayLabel(week.days[6].date)}
                </p>
                {week.minutes > 0 && (
                  <p className="mt-2 text-[0.58rem] font-semibold text-[#5B3DF5]">
                    {durationLabel(week.minutes)}
                  </p>
                )}
              </div>
              {week.days.map((day) => (
                <div
                  key={day.date}
                  className={cn(
                    "min-h-[150px] border-l border-border/60 p-2",
                    day.isHoliday
                      ? "bg-[#FFFBF2]"
                      : day.isExamDay
                        ? "bg-[#FFF7F9]"
                        : "bg-white",
                  )}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-1 px-0.5">
                    <span className="text-[0.62rem] font-semibold text-brand-ink/75">
                      {formatDayLabel(day.date)}
                    </span>
                    {day.minutes > 0 && (
                      <span className="text-[0.56rem] font-medium text-muted-foreground">
                        {durationLabel(day.minutes)}
                      </span>
                    )}
                  </div>
                  <DaySessions
                    day={day}
                    colorByCourse={colorByCourse}
                    busy={busy}
                    onOpen={(entry) => void handleOpen(entry)}
                    emptyLabel="—"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile and tablet: one card per week, with all seven days. */}
      <div className="mt-4 space-y-3 xl:hidden">
        {weeks.map((week, weekIndex) => (
          <section
            key={week.weekStart}
            className="overflow-hidden rounded-[1.5rem] border border-border bg-white"
          >
            <div className="flex items-center justify-between gap-3 bg-[#FCFCFD] px-4 py-3">
              <div>
                <p className="text-[0.7rem] font-bold text-brand-ink">
                  Week {weekIndex + 1}
                </p>
                <p className="mt-0.5 text-[0.66rem] text-muted-foreground">
                  {formatDayLabel(week.weekStart)} – {formatDayLabel(week.days[6].date)}
                </p>
              </div>
              {week.minutes > 0 && (
                <span className="text-[0.66rem] font-semibold text-[#5B3DF5]">
                  {durationLabel(week.minutes)}
                </span>
              )}
            </div>

            {week.days.map((day) => (
              <div
                key={day.date}
                className={cn(
                  "border-t border-border/60 px-3 py-3",
                  day.isHoliday && "bg-[#FFFBF2]",
                  day.isExamDay && !day.isHoliday && "bg-[#FFF7F9]",
                )}
              >
                <div className="flex items-center justify-between px-1">
                  <p className="text-[0.76rem] font-semibold text-brand-ink">
                    {day.label}
                  </p>
                  {day.minutes > 0 && (
                    <span className="text-[0.62rem] font-medium text-muted-foreground">
                      {durationLabel(day.minutes)}
                    </span>
                  )}
                </div>
                <div className="mt-1.5">
                  <DaySessions
                    day={day}
                    colorByCourse={colorByCourse}
                    busy={busy}
                    onOpen={(entry) => void handleOpen(entry)}
                    emptyLabel="No revision planned"
                  />
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>

      {visibleHolidays.length > 0 && (
        <section className="mt-4 rounded-2xl border border-[#EBD6AB] bg-[#FFFBF2] px-4 py-3">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#8A5D00]">
            England and Wales bank holidays skipped
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {visibleHolidays.map((holiday) => (
              <span
                key={holiday.date}
                className="rounded-full border border-[#EBD6AB] bg-white/70 px-2 py-1 text-[0.66rem] font-medium text-[#8A5D00]"
              >
                {formatDayLabel(holiday.date)} · {holiday.name}
              </span>
            ))}
          </div>
        </section>
      )}

      <p className="mt-4 text-[0.72rem] leading-relaxed text-muted-foreground">
        Each session opens the study set for that topic. If one does not exist yet,
        Bluprint builds it from the course pathway and takes you straight there.
        Sessions on England and Wales bank holidays are left out of the plan.
      </p>
    </AppShell>
  );
}
