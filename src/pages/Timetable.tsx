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
import { useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

/** How the plan fills its sessions. Older plans predate the choice. */
function methodLabel(method: "topics" | "papers" | "mixed" | undefined): string {
  if (method === "papers") return "Past papers only";
  if (method === "mixed") return "Mix of topics and papers";
  return "Topics";
}

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
      aria-label={
        entry.kind === "paper"
          ? `Practise ${entry.topic} for ${entry.course}`
          : `Study ${entry.topic} from ${entry.course}`
      }
      className="group relative flex min-h-[62px] w-full flex-col overflow-hidden rounded-lg border border-border bg-white py-1 pl-2 pr-1 text-left shadow-[0_1px_2px_rgba(22,24,31,0.04)] transition-all hover:-translate-y-0.5 hover:border-[#CFC7E8] hover:shadow-[0_8px_18px_-12px_rgba(22,24,31,0.5)] disabled:opacity-60 sm:min-h-[78px] sm:rounded-xl sm:py-1.5 sm:pl-3 sm:pr-2"
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-1 sm:w-1.5", color.bar)}
      />
      {/* There is no shared time gutter any more, so every block carries its
          own time: the start only on a phone (a column is too narrow for a
          range), the full range from tablet size up. */}
      <span className="flex items-center justify-between gap-1">
        <span className="text-[0.5rem] font-semibold tabular-nums text-muted-foreground sm:hidden">
          {formatTime24(start)}
        </span>
        <span className="hidden text-[0.54rem] font-semibold tabular-nums text-muted-foreground sm:block">
          {formatTimeRange(start, entry.minutes)}
        </span>
        {loading && (
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
        )}
      </span>
      <span className="mt-0.5 line-clamp-3 text-[0.58rem] font-bold leading-tight text-brand-ink sm:mt-1 sm:line-clamp-2 sm:text-[0.7rem] sm:leading-snug">
        {entry.topic}
      </span>
      {/* The subject is already in the legend and the colour bar; on a phone
          the topic needs the lines more than the repeating name does. */}
      <span className="mt-auto hidden truncate pt-1 text-[0.58rem] font-medium text-muted-foreground sm:block">
        {entry.course}
      </span>
      <span className="mt-1 hidden flex-wrap items-center gap-1 sm:flex">
        {entry.kind === "paper" ? (
          <span className="w-fit rounded-full bg-[#F3F0FF] px-1.5 py-0.5 text-[0.5rem] font-semibold text-[#5130D8]">
            Past paper · 1h
          </span>
        ) : (
          <span
            className={cn(
              "w-fit rounded-full px-1.5 py-0.5 text-[0.5rem] font-semibold",
              color.tint,
              color.text,
            )}
          >
            {entry.paper ?? "All papers"}
          </span>
        )}
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
  /**
   * Rows are session slots, not clock times.
   *
   * School days start later than days off, so a grid keyed on clock times needs
   * a row for every distinct start time in the week: the early weekend rows sat
   * empty across Monday to Friday and the evening rows sat empty across the
   * weekend. Half the grid was "Free", and the weekday revision that actually
   * needs doing was pushed below the fold. Slotting by position keeps a day's
   * sessions together and makes the week only as tall as its busiest day,
   * whatever start times the plan uses.
   *
   * buildTimetableWeeks already orders each day's entries by start time.
   */
  const slotCount = days.reduce(
    (most, day) => Math.max(most, day.entries.length),
    0,
  );
  const slots = Array.from({ length: slotCount }, (_, index) => index);
  const today = new Date().toISOString().slice(0, 10);
  // Fluid columns (see .week-columns in index.css): all seven days stay on
  // screen at every width, with no sideways scrolling.
  const gridVars = { "--week-days": days.length } as CSSProperties;

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

      <div>
        <div
          className="week-columns border-b border-border bg-[#FCFCFD]"
          style={gridVars}
        >
            {days.map((day) => {
              const isToday = day.date === today;
              return (
                <div
                  key={day.date}
                  className={cn(
                    "border-l border-border/60 px-0.5 py-2 text-center sm:px-2 sm:py-2.5",
                    isToday ? "bg-[#2F6BFF] text-white" : "bg-[#FCFCFD]",
                  )}
                >
                  <p className="truncate text-[0.6rem] font-bold tracking-[-0.01em] sm:text-[0.74rem]">
                    <span className="sm:hidden">
                      {formatDayHeading(day.date).split(" ")[0]}
                    </span>
                    <span className="hidden sm:inline">
                      {formatDayHeading(day.date)}
                    </span>
                  </p>
                  <div className="mt-1 flex min-h-5 flex-col items-center justify-center gap-0.5">
                    {day.isExamDay ? (
                      <span
                        className={cn(
                          "max-w-full truncate rounded-full px-1 py-0.5 text-[0.46rem] font-semibold sm:px-1.5 sm:text-[0.52rem]",
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
                          "max-w-full truncate rounded-full px-1 py-0.5 text-[0.46rem] font-semibold sm:px-1.5 sm:text-[0.52rem]",
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
                          "max-w-full truncate rounded-full px-1 py-0.5 text-[0.46rem] font-semibold sm:px-1.5 sm:text-[0.52rem]",
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
                          "max-w-full truncate rounded-full px-1 py-0.5 text-[0.46rem] font-semibold sm:px-1.5 sm:text-[0.52rem]",
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
                          "max-w-full truncate rounded-full px-1 py-0.5 text-[0.46rem] font-semibold sm:px-1.5 sm:text-[0.52rem]",
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
                            "text-[0.5rem] font-semibold tabular-nums sm:text-[0.54rem]",
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

          {slots.length === 0 ? (
            <div className="px-6 py-12 text-center text-[0.8rem] text-muted-foreground">
              No revision is scheduled in this week.
            </div>
          ) : (
            slots.map((slot) => (
              <div
                key={slot}
                className="week-columns border-b border-border/70 last:border-b-0"
                style={gridVars}
              >
                {days.map((day) => {
                  // Row 3 is every day's third session, whether that is 13:45
                  // on a Saturday or 19:30 on a Tuesday.
                  const entry = day.entries[slot];
                  return (
                    <div
                      key={`${day.date}:${slot}`}
                      className={cn(
                        "border-l border-border/60 p-1 sm:p-1.5",
                        day.isHoliday
                          ? "bg-[#FFFBF2]"
                          : day.isExamDay
                            ? "bg-[#FFF7F9]"
                            : "bg-white",
                      )}
                    >
                      {entry ? (
                        <SessionBlock
                          entry={entry}
                          color={
                            colorByCourse.get(entry.courseId) ??
                            SUBJECT_COLORS[0]
                          }
                          loading={
                            busy ===
                            `${entry.date}:${entry.topicId}:${entry.startMinutes ?? 0}`
                          }
                          disabled={busy !== null}
                          onOpen={() => onOpen(entry)}
                        />
                      ) : slot > 0 ? (
                        // Later slots simply run out on a quieter day.
                        null
                      ) : day.isExamDay ? (
                        <div className="flex h-full min-h-[62px] items-center justify-center rounded-lg bg-[#FAE9EF] px-1 text-center text-[0.52rem] font-semibold text-[#98304F] sm:min-h-[78px] sm:text-[0.58rem]">
                          First exam
                        </div>
                      ) : (
                        <div
                          className="flex h-full min-h-[62px] items-center justify-center rounded-lg border border-dashed border-border/70 text-[0.52rem] font-medium text-muted-foreground/50 sm:min-h-[78px] sm:text-[0.58rem]"
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

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-[#FCFCFD] px-4 py-2.5 text-[0.64rem] text-muted-foreground">
        <span>
          Each day lists its own sessions in order, with the time on every block.
          Click one to open its study set or past paper.
        </span>
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

  // Plans built when each subject had its own length still report that length;
  // newer plans share one session length for the whole timetable.
  const minSessionMinutes = useMemo(() => {
    const minutes = [
      ...(plan?.courseSettings ?? []).map(
        (setting) => setting.minutes ?? plan?.sessionMinutes,
      ),
      ...(plan?.entries ?? []).map((entry) => entry.minutes),
    ].filter((value): value is number => typeof value === "number");
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
    // A past paper session opens the saved paper. If the course had none when
    // the plan was built, the course page is where one can be made.
    if (entry.kind === "paper") {
      navigate(entry.paperId ? `/papers/${entry.paperId}` : `/courses/${entry.courseId}`);
      return;
    }

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
  // Plans built before the day-off budget was stored used a 1.5× boost. Report
  // what those legacy plans actually hold rather than a figure they never used.
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
        <span>{methodLabel(plan.studyMethod)}</span>
        <span aria-hidden>·</span>
        <span>{schoolDayMinutes} min on school days</span>
        {holidayAware && (
          <>
            <span aria-hidden>·</span>
            <span>{dayOffMinutes} min on days off</span>
          </>
        )}
        <span aria-hidden>·</span>
        <span>{plan.daysPerWeek} days a week</span>
        <span aria-hidden>·</span>
        <span>
          {courseSettings.length} subject
          {courseSettings.length === 1 ? "" : "s"}
        </span>
        <span aria-hidden>·</span>
        <span>
          sessions from {formatTime24(plan.startMinutes ?? 17 * 60)} on school
          days
        </span>
        {typeof plan.dayOffStartMinutes === "number" && (
          <>
            <span aria-hidden>·</span>
            <span>{formatTime24(plan.dayOffStartMinutes)} on days off</span>
          </>
        )}
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
          This timetable was built before days off were asked for. Build it again to
          choose the time you have on bank holidays, weekends and school holidays.
        </p>
      )}

      {plan.requestedStartDate && plan.requestedStartDate !== plan.startDate && (
        <p className="mt-3 rounded-2xl bg-[#EAFBF4] px-4 py-3 text-[0.8rem] leading-relaxed text-[#0C6B4C]">
          Revision starts {formatLongDate(plan.startDate)} rather than{" "}
          {formatLongDate(plan.requestedStartDate)}, so every topic fits before your
          first exam.
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
Bank holidays
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
        Topic sessions open the study set for that topic; if one does not exist
        yet, Bluprint builds it from the course pathway and takes you straight
        there. Past paper sessions are one hour long and open the saved paper for
        that course, where your answers are marked against the mark scheme.
        School days use the school-day time and start time you chose; bank holidays,
        weekends and school holidays use the day-off time and start time. Sessions
        are spaced evenly, with one short gap between them.
      </p>
    </AppShell>
  );
}
