import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { readableError } from "@/lib/errors";
import { daysUntilInput } from "@/lib/format";
import {
  buildTimetableWeeks,
  colorForCourses,
  extendedDailyMinutes,
  formatDayHeading,
  formatDayLabel,
  formatLongDate,
  formatTime24,
  formatTimeRange,
  SUBJECT_COLORS,
  type RevisionEntry,
  type SubjectColor,
  type TimetableWeek,
} from "@/lib/timetable";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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
  const start = entry.startMinutes ?? 17 * 60;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      title={`${entry.unit} · ${entry.topic}`}
      aria-label={`Study ${entry.topic} from ${entry.course}`}
      className="group relative flex min-h-[78px] w-full flex-col overflow-hidden rounded-xl border border-border bg-white py-1.5 pl-3 pr-2 text-left shadow-[0_1px_2px_rgba(22,24,31,0.04)] transition-all hover:-translate-y-0.5 hover:border-[#CFC7E8] hover:shadow-[0_8px_18px_-12px_rgba(22,24,31,0.5)] disabled:opacity-60"
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-1.5", color.bar)}
      />
      <span className="flex items-center justify-between gap-1">
        <span className="text-[0.54rem] font-semibold tabular-nums text-muted-foreground">
          {formatTimeRange(start, entry.minutes)}
        </span>
        {loading && (
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
        )}
      </span>
      <span className="mt-1 line-clamp-2 text-[0.7rem] font-bold leading-snug text-brand-ink">
        {entry.topic}
      </span>
      <span className="mt-auto truncate pt-1 text-[0.58rem] font-medium text-muted-foreground">
        {entry.course}
      </span>
      <span
        className={cn(
          "mt-1 w-fit rounded-full px-1.5 py-0.5 text-[0.5rem] font-semibold",
          color.tint,
          color.text,
        )}
      >
        {entry.paper ?? "All papers"}
      </span>
    </button>
  );
}

const FREE_CELL_STYLE = {
  backgroundImage:
    "repeating-linear-gradient(135deg, #F7F7FA 0 7px, #FCFCFD 7px 14px)",
};

function WeekTable({
  week,
  daysPerWeek,
  colorByCourse,
  busy,
  onOpen,
  weekIndex,
  weekCount,
  onPrevious,
  onNext,
}: {
  week: TimetableWeek;
  daysPerWeek: number;
  colorByCourse: Map<string, SubjectColor>;
  busy: string | null;
  onOpen: (entry: RevisionEntry) => void;
  weekIndex: number;
  weekCount: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  // Five- and three-day plans read as a school week. Seven-day plans add the
  // weekend columns, which is where the extra capacity is most visible.
  const days =
    daysPerWeek === 7 ? week.days : week.days.filter((day) => !day.isWeekend);
  const entriesByStart = new Map<number, Map<string, RevisionEntry[]>>();
  for (const day of days) {
    for (const entry of day.entries) {
      const start = entry.startMinutes ?? 17 * 60;
      const byDate = entriesByStart.get(start) ?? new Map<string, RevisionEntry[]>();
      const list = byDate.get(day.date) ?? [];
      list.push(entry);
      byDate.set(day.date, list);
      entriesByStart.set(start, byDate);
    }
  }
  const starts = [...entriesByStart.keys()].sort((a, b) => a - b);
  const today = new Date().toISOString().slice(0, 10);
  const gridStyle = {
    gridTemplateColumns: `76px repeat(${days.length}, minmax(0, 1fr))`,
  };
  const minimumWidth = days.length === 7 ? 1040 : 860;

  return (
    <section className="mt-4 overflow-hidden rounded-[1.6rem] border border-border bg-white shadow-[0_18px_44px_-34px_rgba(22,24,31,0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[#FCFCFD] px-4 py-3">
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Week {weekIndex + 1} of {weekCount}
          </p>
          <p className="mt-0.5 text-[0.88rem] font-bold text-brand-ink">
            {formatDayLabel(week.days[0].date)} – {formatDayLabel(week.days[6].date)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={onPrevious}
            disabled={weekIndex === 0}
            aria-label="Previous week"
            className="rounded-full border-border bg-white shadow-none hover:bg-brand-panel"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-[0.7rem] font-semibold text-muted-foreground">
            {durationLabel(week.minutes)} planned
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={onNext}
            disabled={weekIndex >= weekCount - 1}
            aria-label="Next week"
            className="rounded-full border-border bg-white shadow-none hover:bg-brand-panel"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: minimumWidth }}>
          <div
            className="grid border-b border-border bg-[#FCFCFD]"
            style={gridStyle}
          >
            <div className="sticky left-0 z-10 flex items-end bg-[#FCFCFD] px-2.5 py-2 text-[0.56rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Time
            </div>
            {days.map((day) => {
              const isToday = day.date === today;
              return (
                <div
                  key={day.date}
                  className={cn(
                    "border-l border-border/60 px-2 py-2.5 text-center",
                    isToday ? "bg-[#2F6BFF] text-white" : "bg-[#FCFCFD]",
                  )}
                >
                  <p className="text-[0.74rem] font-bold tracking-[-0.01em]">
                    {formatDayHeading(day.date)}
                  </p>
                  <div className="mt-1 flex min-h-5 flex-col items-center justify-center gap-0.5">
                    {day.isExamDay ? (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[0.52rem] font-semibold",
                          isToday
                            ? "bg-white/20 text-white"
                            : "bg-[#FAE9EF] text-[#98304F]",
                        )}
                      >
                        First exam
                      </span>
                    ) : day.isHoliday ? (
                      <span
                        className={cn(
                          "truncate rounded-full px-1.5 py-0.5 text-[0.52rem] font-semibold",
                          isToday
                            ? "bg-white/20 text-white"
                            : "bg-[#FFF6E5] text-[#8A5D00]",
                        )}
                        title={day.holidayName ?? "Bank holiday"}
                      >
                        Bank holiday
                      </span>
                    ) : day.isSchoolHoliday ? (
                      <span
                        className={cn(
                          "max-w-full truncate rounded-full px-1.5 py-0.5 text-[0.52rem] font-semibold",
                          isToday
                            ? "bg-white/20 text-white"
                            : "bg-[#E6F9F6] text-[#0A655C]",
                        )}
                        title={day.schoolHolidayName ?? "School holiday"}
                      >
                        {day.schoolHolidayName ?? "School holiday"}
                      </span>
                    ) : day.isWeekend ? (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[0.52rem] font-semibold",
                          isToday
                            ? "bg-white/20 text-white"
                            : "bg-brand-panel text-muted-foreground",
                        )}
                      >
                        Weekend
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[0.52rem] font-semibold",
                          isToday
                            ? "bg-white/20 text-white"
                            : day.minutes > 0
                              ? "bg-brand-panel text-muted-foreground"
                              : "text-muted-foreground/60",
                        )}
                      >
                        {day.minutes > 0 ? durationLabel(day.minutes) : "Free"}
                      </span>
                    )}
                    {/* The extra time on a day off was previously hidden behind
                        the badge, which made a longer holiday block look empty. */}
                    {(day.isHoliday || day.isSchoolHoliday || day.isWeekend) &&
                      day.minutes > 0 && (
                        <span
                          className={cn(
                            "text-[0.54rem] font-semibold tabular-nums",
                            isToday ? "text-white/75" : "text-muted-foreground",
                          )}
                        >
                          {durationLabel(day.minutes)}
                        </span>
                      )}
                  </div>
                </div>
              );
            })}
          </div>

          {starts.length === 0 ? (
            <div className="px-6 py-12 text-center text-[0.8rem] text-muted-foreground">
              No revision is scheduled in this week.
            </div>
          ) : (
            starts.map((start) => (
              <div
                key={start}
                className="grid border-b border-border/70 last:border-b-0"
                style={gridStyle}
              >
                <div className="sticky left-0 z-10 flex items-start border-r border-border/60 bg-[#FCFCFD] px-2.5 py-2">
                  <span className="text-[0.66rem] font-bold tabular-nums text-brand-ink">
                    {formatTime24(start)}
                  </span>
                </div>
                {days.map((day) => {
                  const entries = entriesByStart.get(start)?.get(day.date) ?? [];
                  const paused = day.isExamDay;
                  // A previous row's longer session can still be running here.
                  // Leave that cell blank rather than labelling it "Free".
                  const covered = day.entries.some((entry) => {
                    const entryStart = entry.startMinutes ?? 17 * 60;
                    return entryStart < start && start < entryStart + entry.minutes;
                  });
                  return (
                    <div
                      key={`${day.date}:${start}`}
                      className={cn(
                        "min-h-[94px] border-l border-border/60 p-1.5",
                        day.isHoliday
                          ? "bg-[#FFFBF2]"
                          : day.isExamDay
                            ? "bg-[#FFF7F9]"
                            : "bg-white",
                      )}
                    >
                      {entries.length > 0 ? (
                        <div className="space-y-1.5">
                          {entries.map((entry) => {
                            const key = `${entry.date}:${entry.topicId}:${entry.startMinutes ?? 0}`;
                            return (
                              <SessionBlock
                                key={key}
                                entry={entry}
                                color={
                                  colorByCourse.get(entry.courseId) ??
                                  SUBJECT_COLORS[0]
                                }
                                loading={busy === key}
                                disabled={busy !== null}
                                onOpen={() => onOpen(entry)}
                              />
                            );
                          })}
                        </div>
                      ) : paused || covered ? (
                        <div className="h-full min-h-[74px]" />
                      ) : (
                        <div
                          className="flex h-full min-h-[74px] items-center justify-center rounded-lg border border-dashed border-border/70 text-[0.58rem] font-medium text-muted-foreground/50"
                          style={FREE_CELL_STYLE}
                        >
                          Free
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-[#FCFCFD] px-4 py-2.5 text-[0.64rem] text-muted-foreground">
        <span>Click a session to open its study set.</span>
        <span>
          {days.length} day{days.length === 1 ? "" : "s"} · {" "}
          {durationLabel(week.minutes)} planned
        </span>
      </div>
    </section>
  );
}

export default function Timetable() {
  const navigate = useNavigate();
  const plan = useQuery(api.timetable.getMine);
  const openTopic = useMutation(api.courses.createTopicSet);
  const [busy, setBusy] = useState<string | null>(null);
  // null follows the first scheduled session; a number is a week the student
  // has explicitly paged to.
  const [weekIndex, setWeekIndex] = useState<number | null>(null);

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

  const minSessionMinutes = useMemo(() => {
    const minutes =
      plan?.courseSettings?.map((setting) => setting.minutes) ??
      plan?.entries.map((entry) => entry.minutes) ??
      [];
    return minutes.length > 0 ? Math.min(...minutes) : 25;
  }, [plan]);

  const weeks = useMemo(() => (plan ? buildTimetableWeeks(plan) : []), [plan]);
  /**
   * Open on the week that holds the first session. A plan can start in a week
   * with no revision days (a start date mid-holiday, or a three-day week), and
   * landing on that empty grid reads as a broken timetable.
   */
  const firstEntryWeek = useMemo(() => {
    if (!plan || plan.entries.length === 0) return 0;
    const first = plan.entries.reduce(
      (earliest, entry) => (entry.date < earliest ? entry.date : earliest),
      plan.entries[0]!.date,
    );
    const index = weeks.findIndex((week) =>
      week.days.some((day) => day.date === first),
    );
    return index >= 0 ? index : 0;
  }, [plan, weeks]);

  const currentWeekIndex = Math.min(
    weekIndex ?? firstEntryWeek,
    Math.max(0, weeks.length - 1),
  );
  const currentWeek = weeks[currentWeekIndex];

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
  const holidayAware = plan.schoolHolidays !== undefined;
  const schoolDayMinutes = plan.dailyMinutes ?? plan.sessionMinutes ?? 60;
  // Plans built before day-off minutes were stored used a 1.5x boost, so report
  // what those plans actually hold rather than today's doubled figure.
  const dayOffMinutes =
    plan.dayOffMinutes ??
    (holidayAware
      ? Math.max(
          Math.round((schoolDayMinutes * 1.5) / 5) * 5,
          schoolDayMinutes + minSessionMinutes,
        )
      : extendedDailyMinutes(schoolDayMinutes, minSessionMinutes));

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
        <span>{schoolDayMinutes} min on school days</span>
        {holidayAware && (
          <>
            <span aria-hidden>·</span>
            <span>
              up to {dayOffMinutes} min on days off
            </span>
          </>
        )}
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
          This plan reaches the planner's limit before your first exam. Build it
          again nearer the exam to add more spaced review.
        </p>
      )}

      {!holidayAware && (
        <p className="mt-3 rounded-2xl bg-[#F3ECFF] px-4 py-3 text-[0.8rem] leading-relaxed text-[#5B3DF5]">
          This timetable was built before holiday-aware scheduling. Build it again
          to double the time on bank holidays, weekends and school holidays, and to
          label half-terms in the grid.
        </p>
      )}

      {currentWeek && (
        <WeekTable
          week={currentWeek}
          daysPerWeek={plan.daysPerWeek}
          colorByCourse={colorByCourse}
          busy={busy}
          onOpen={(entry) => void handleOpen(entry)}
          weekIndex={currentWeekIndex}
          weekCount={weeks.length}
          onPrevious={() => setWeekIndex(Math.max(0, currentWeekIndex - 1))}
          onNext={() =>
            setWeekIndex(Math.min(weeks.length - 1, currentWeekIndex + 1))
          }
        />
      )}

      {visibleHolidays.length > 0 && (
        <section className="mt-4 rounded-2xl border border-[#EBD6AB] bg-[#FFFBF2] px-4 py-3">
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[#8A5D00]">
Bank holidays · double time
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
        School days use the budget you chose. Bank holidays, weekends and typical
        England school holidays get double that, so days off carry more work.
      </p>
    </AppShell>
  );
}
