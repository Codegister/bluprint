import { AppShell } from "@/components/AppShell";
import { SkeletonTimetablePage } from "@/components/Skeletons";
import { EASE, Meter, enter, reveal } from "@/components/motion/Motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { readableError } from "@/lib/errors";
import { daysUntilInput } from "@/lib/format";
import {
  addDaysKey,
  colorForCourses,
  formatDayLabel,
  formatLongDate,
  formatTime24,
  formatTimeRange,
  parseTimeInput,
  SUBJECT_COLORS,
  type SubjectColor,
} from "@/lib/timetable";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { motion } from "framer-motion";
import {
  Ban,
  CalendarPlus,
  Check,
  ChevronRight,
  Clock3,
  Loader2,
  Plus,
  Sparkles,
  Utensils,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

type DayView = NonNullable<FunctionReturnType<typeof api.timetable.getDayView>>;
type Day = NonNullable<DayView["day"]>;
type DaySession = Day["sessions"][number];
type Blocked = DayView["blocked"][number];
type Meal = DayView["meals"][number];

/** The planner works in UTC calendar keys; keep the screen on the same clock. */
function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Revision weekday pattern, kept in step with the planner. */
function isRevisionDate(date: string, daysPerWeek: number): boolean {
  const patterns: Record<number, number[]> = {
    3: [1, 3, 5],
    5: [1, 2, 3, 4, 5],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return (patterns[daysPerWeek] ?? patterns[5]!).includes(weekday);
}

function methodLabel(method: string): string {
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

function reasonCopy(reason: string | null): string {
  switch (reason) {
    case "rest":
      return "This is a rest day in your plan.";
    case "past":
      return "This day has already passed.";
    case "before-start":
      return "Your plan has not started yet.";
    case "after-exam":
      return "Your first exam has passed.";
    case "no-courses":
      return "One of your courses is still being built, so this day has nothing to study yet.";
    default:
      return "This day's plan has not been generated yet.";
  }
}

/** One day chip in the horizontal strip. */
function DayChip({
  date,
  today,
  examDate,
  daysPerWeek,
  selected,
  summary,
  onSelect,
  index,
}: {
  date: string;
  today: string;
  examDate: string;
  daysPerWeek: number;
  selected: boolean;
  summary: DayView["days"][number] | undefined;
  onSelect: () => void;
  index: number;
}) {
  const isToday = date === today;
  const isExam = date === examDate;
  const isRest = !isRevisionDate(date, daysPerWeek);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const weekday = parsed.toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "UTC",
  });
  const dayNumber = parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    timeZone: "UTC",
  });

  const status = isExam
    ? "Exam day"
    : summary
      ? summary.count === 0
        ? "No sessions"
        : `${summary.done}/${summary.count} done`
      : isRest
        ? "Rest"
        : "Not planned";

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: index * 0.03 }}
      className={cn(
        "group flex min-w-[86px] flex-1 flex-col items-start gap-1 rounded-2xl border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-[#191B27] bg-[#191B27] text-white"
          : "border-border bg-white text-brand-ink hover:border-[#B9B0E8] hover:bg-[#FBFAFF]",
      )}
    >
      <span className="flex w-full items-center justify-between gap-1">
        <span
          className={cn(
            "text-[0.62rem] font-semibold uppercase tracking-[0.08em]",
            selected ? "text-white/60" : "text-muted-foreground",
          )}
        >
          {weekday}
        </span>
        {isToday && (
          <span
            className={cn(
              "size-1.5 rounded-full",
              selected ? "bg-white" : "bg-[#5B3DF5]",
            )}
            aria-label="Today"
          />
        )}
      </span>
      <span className="font-display text-[1.15rem] font-bold leading-none">
        {dayNumber}
      </span>
      <span
        className={cn(
          "truncate text-[0.6rem] font-medium",
          selected
            ? "text-white/70"
            : isExam
              ? "text-[#B23A55]"
              : isRest
                ? "text-muted-foreground/60"
                : "text-muted-foreground",
        )}
      >
        {status}
      </span>
    </motion.button>
  );
}

/** One study session on the selected day. */
function SessionRow({
  session,
  color,
  isPast,
  busy,
  onOpen,
  onToggle,
}: {
  session: DaySession;
  color: SubjectColor;
  isPast: boolean;
  busy: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const done = Boolean(session.done);
  return (
    <div
      className={cn(
        "group relative flex gap-3 rounded-2xl border bg-white px-3 py-3 transition-colors sm:gap-4 sm:px-4",
        done
          ? "border-border/70 bg-[#FAFAF7]"
          : "border-border hover:border-[#CFC7E8]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-3 left-0 w-[3px] rounded-full",
          color.bar,
          done && "opacity-40",
        )}
      />

      <div className="w-[62px] shrink-0 pl-1 text-[0.66rem] font-semibold tabular-nums leading-relaxed text-muted-foreground">
        <p className="text-brand-ink/80">
          {formatTime24(session.startMinutes)}
        </p>
        <p>{formatTime24(session.startMinutes + session.minutes)}</p>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p
            className={cn(
              "text-[0.88rem] font-semibold leading-snug text-brand-ink",
              done && "text-brand-ink/55 line-through",
            )}
          >
            {session.topic}
          </p>
          {session.carriedFrom && (
            <span className="rounded-full bg-[#FFF0DC] px-2 py-0.5 text-[0.56rem] font-bold uppercase tracking-[0.04em] text-[#96650A]">
              Catch-up
            </span>
          )}
          {isPast && !done && (
            <span className="rounded-full bg-[#FDE8ED] px-2 py-0.5 text-[0.56rem] font-bold uppercase tracking-[0.04em] text-[#B23A55]">
              Missed
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[0.7rem] text-muted-foreground">
          {session.course} · {session.unit}
        </p>
        {session.carriedFrom && (
          <p className="mt-1 text-[0.64rem] text-muted-foreground">
            Originally planned for {formatDayLabel(session.carriedFrom)}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            aria-pressed={done}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[0.68rem] font-semibold transition-colors disabled:opacity-60",
              done
                ? "border-[#CBE7D8] bg-[#EAF8F0] text-[#128A4C]"
                : "border-border bg-white text-brand-ink/70 hover:border-[#B9B0E8] hover:text-brand-ink",
            )}
          >
            {busy ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Check className="size-3" />
            )}
            {done ? "Done" : "Mark done"}
          </button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpen}
            className="h-7 rounded-full border-border bg-white px-2.5 text-[0.68rem] font-semibold shadow-none"
          >
            {session.kind === "paper" ? "Sit paper" : "Open set"}
            <ChevronRight className="size-3" />
          </Button>
          <span
            className={cn(
              "ml-auto text-[0.62rem] font-medium",
              done ? "text-[#128A4C]" : "text-muted-foreground",
            )}
          >
            {session.minutes} min
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * A meal the planner keeps free. Showing it explains why the afternoon has a
 * gap instead of looking like unplanned time.
 */
function MealRow({ meal }: { meal: Meal }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[#EBD6AB] bg-[#FFFBF2] px-3 py-2 sm:gap-4 sm:px-4">
      <span className="w-[62px] shrink-0 text-[0.66rem] font-semibold tabular-nums leading-relaxed text-muted-foreground">
        <span className="block text-brand-ink/70">
          {formatTime24(meal.startMinutes)}
        </span>
        <span className="block">{formatTime24(meal.endMinutes)}</span>
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <Utensils className="size-3.5 shrink-0 text-[#B7791F]" aria-hidden />
        <span className="truncate text-[0.78rem] font-medium text-brand-ink/70">
          {meal.label} break
        </span>
      </span>
      <span className="shrink-0 text-[0.62rem] font-medium text-muted-foreground">
        Kept free
      </span>
    </div>
  );
}

/** Blocked-out time, shown inline with the day's work. */
function BlockedRow({ period }: { period: Blocked }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-[#F7F5EF] px-3 py-2.5">
      <span className="w-[62px] shrink-0 text-[0.66rem] font-semibold tabular-nums leading-relaxed text-muted-foreground">
        <span className="block text-brand-ink/70">
          {formatTime24(period.startMinutes)}
        </span>
        <span className="block">{formatTime24(period.endMinutes)}</span>
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <Ban className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-[0.78rem] font-medium text-brand-ink/70">
          {period.label?.trim() || "Blocked out"}
        </span>
      </span>
    </div>
  );
}

function BlockTimeDialog({
  open,
  onOpenChange,
  date,
  blocked,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  blocked: Blocked[];
  onSaved: (blocks: Blocked[]) => Promise<void>;
}) {
  // Typed rather than picked from a long list: most blocks are a familiar
  // time, and 35 options in a dropdown were harder to scan than one field.
  const [fromText, setFromText] = useState("18:00");
  const [untilText, setUntilText] = useState("20:00");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const start = parseTimeInput(fromText);
    const end = parseTimeInput(untilText);
    if (start === null || end === null) {
      toast.error("Type a time like 18:00 (or 6:30pm).");
      return;
    }
    if (end <= start) {
      toast.error("Choose an end time after the start time.");
      return;
    }
    const overlaps = blocked.some(
      (period) => start < period.endMinutes && end > period.startMinutes,
    );
    if (overlaps) {
      toast.error("That overlaps a period you have already blocked.");
      return;
    }
    setSaving(true);
    try {
      const next: Blocked[] = [
        ...blocked,
        {
          date,
          startMinutes: start,
          endMinutes: end,
          ...(label.trim() ? { label: label.trim() } : {}),
        },
      ];
      await onSaved(next);
      // Start the next block from a clean form rather than the one just saved.
      setFromText("18:00");
      setUntilText("20:00");
      setLabel("");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        readableError(error, "Could not block out that time. Try again."),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-[1.2rem] font-bold">
            Block out time
          </DialogTitle>
          <DialogDescription>
            {formatLongDate(date)}. Blocked time is skipped when this day is
            planned, so the rest of the day is rebuilt around it.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            From
            <Input
              value={fromText}
              onChange={(event) => setFromText(event.target.value)}
              autoComplete="off"
              maxLength={8}
              placeholder="18:00"
              className="mt-1.5 h-10 rounded-xl border-border bg-white text-[0.82rem] font-medium normal-case tracking-normal shadow-none"
            />
          </label>
          <label className="block text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Until
            <Input
              value={untilText}
              onChange={(event) => setUntilText(event.target.value)}
              autoComplete="off"
              maxLength={8}
              placeholder="20:00"
              className="mt-1.5 h-10 rounded-xl border-border bg-white text-[0.82rem] font-medium normal-case tracking-normal shadow-none"
            />
          </label>
          <p className="text-[0.7rem] leading-relaxed text-muted-foreground sm:col-span-2">
            Type a time using the 24-hour clock, for example 18:00. Times like
            6:30pm work too.
          </p>
          <label className="block text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground sm:col-span-2">
            What's happening? (optional)
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={60}
              placeholder="Football, family dinner, shift at work…"
              className="mt-1.5 h-10 rounded-xl border-border bg-white text-[0.82rem] normal-case tracking-normal shadow-none"
            />
          </label>
        </div>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-full border-border bg-white px-4 text-[0.8rem] font-semibold shadow-none"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="h-10 rounded-full bg-[#191B27] px-5 text-[0.8rem] font-semibold text-white hover:bg-[#2A2D3E]"
          >
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Block it out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Timetable() {
  const navigate = useNavigate();
  const plan = useQuery(api.timetable.getMine);
  const [selected, setSelected] = useState<string | null>(null);
  const today = utcToday();
  const defaultDate = plan && plan.startDate > today ? plan.startDate : today;
  // A rebuilt plan can start after the stored selection. Clamp the selection
  // while deriving the day, rather than syncing it from an effect.
  const activeDate =
    selected && plan && selected >= plan.startDate && selected <= plan.examDate
      ? selected
      : defaultDate;
  const view = useQuery(api.timetable.getDayView, { date: activeDate });

  const ensureDay = useMutation(api.timetable.ensureDay);
  const openTopic = useMutation(api.courses.createTopicSet);
  const setBlockedPeriods = useMutation(api.timetable.setBlockedPeriods);
  const setSessionDone = useMutation(api.timetable.setSessionDone);

  const [busySession, setBusySession] = useState<string | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [savingBlocks, setSavingBlocks] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);
  // One automatic generation attempt per plan/day. Without this a failed call
  // would retry on every render.
  const autoTried = useRef(new Set<string>());

  // The day on screen is generated individually, when it is first opened. The
  // call is harmless when the day already exists; the server rebuilds only a
  // stale day (one generated ahead of time, before new missed work appeared).
  useEffect(() => {
    if (!view || view.date !== activeDate || view.reason) return;
    const key = `${view.plan._id}:${activeDate}`;
    if (autoTried.current.has(key)) return;
    autoTried.current.add(key);
    ensureDay({ date: activeDate })
      .then((result) => {
        if (!result.generated) {
          setDayError(reasonCopy(result.reason));
        }
      })
      .catch((error) => {
        autoTried.current.delete(key);
        setDayError(
          readableError(error, "Could not plan this day. Please try again."),
        );
      });
  }, [view, activeDate, ensureDay]);

  const colorByCourse = useMemo(
    () => colorForCourses(view?.plan.courseSettings ?? []),
    [view],
  );

  const strip = useMemo(() => {
    if (!view) return [];
    const start = view.plan.startDate > today ? view.plan.startDate : today;
    return Array.from({ length: 7 }, (_, index) => addDaysKey(start, index))
      .filter((date) => date <= view.plan.examDate);
  }, [view, today]);

  const daySessions = useMemo(() => {
    if (!view?.day) return [];
    return [...view.day.sessions].sort(
      (a, b) => a.startMinutes - b.startMinutes,
    );
  }, [view]);

  const blockedByTime = useMemo(
    () => [...(view?.blocked ?? [])].sort((a, b) => a.startMinutes - b.startMinutes),
    [view],
  );

  /** Sessions, meals and blocked periods interleaved on one timeline. */
  const timeline = useMemo(() => {
    const items: Array<
      | { kind: "session"; at: number; session: DaySession }
      | { kind: "blocked"; at: number; period: Blocked }
      | { kind: "meal"; at: number; meal: Meal }
    > = [
      ...daySessions.map((session) => ({
        kind: "session" as const,
        at: session.startMinutes,
        session,
      })),
      ...blockedByTime.map((period) => ({
        kind: "blocked" as const,
        at: period.startMinutes,
        period,
      })),
      ...(view?.meals ?? []).map((meal) => ({
        kind: "meal" as const,
        at: meal.startMinutes,
        meal,
      })),
    ];
    return items.sort((a, b) => a.at - b.at);
  }, [daySessions, blockedByTime, view]);

  const doneCount = daySessions.filter((session) => session.done).length;
  const plannedMinutes = daySessions.reduce(
    (sum, session) => sum + session.minutes,
    0,
  );
  const progress =
    daySessions.length > 0
      ? Math.round((doneCount / daySessions.length) * 100)
      : 0;

  const saveBlocks = async (next: Blocked[]) => {
    setSavingBlocks(true);
    setDayError(null);
    try {
      await setBlockedPeriods({
        date: activeDate,
        periods: next.map((period) => ({
          startMinutes: period.startMinutes,
          endMinutes: period.endMinutes,
          ...(period.label ? { label: period.label } : {}),
        })),
      });
      toast.success("Day replanned around that time.");
    } finally {
      setSavingBlocks(false);
    }
  };

  const removeBlock = async (period: Blocked) => {
    setSavingBlocks(true);
    try {
      await setBlockedPeriods({
        date: activeDate,
        periods: blockedByTime
          .filter(
            (entry) =>
              !(
                entry.startMinutes === period.startMinutes &&
                entry.endMinutes === period.endMinutes
              ),
          )
          .map((entry) => ({
            startMinutes: entry.startMinutes,
            endMinutes: entry.endMinutes,
            ...(entry.label ? { label: entry.label } : {}),
          })),
      });
      toast.success("Blocked time removed.");
    } catch (error) {
      toast.error(
        readableError(error, "Could not remove that blocked time."),
      );
    } finally {
      setSavingBlocks(false);
    }
  };

  const toggleSession = async (session: DaySession) => {
    setBusySession(session.id);
    try {
      await setSessionDone({
        date: activeDate,
        sessionId: session.id,
        done: !session.done,
      });
    } catch (error) {
      toast.error(
        readableError(error, "Could not update that session. Try again."),
      );
    } finally {
      setBusySession(null);
    }
  };

  const handleOpen = async (session: DaySession) => {
    if (session.kind === "paper") {
      navigate(
        session.paperId
          ? `/papers/${session.paperId}`
          : `/courses/${session.courseId}`,
      );
      return;
    }
    try {
      const result = await openTopic({
        courseId: session.courseId,
        topicId: session.topicId,
      });
      navigate(`/sets/${result.setId}`);
    } catch (error) {
      toast.error(
        readableError(error, "Could not open that revision topic."),
      );
    }
  };

  if (plan === undefined || view === undefined) {
    return (
      <AppShell>
        <SkeletonTimetablePage />
      </AppShell>
    );
  }

  if (plan === null || view === null) {
    return (
      <AppShell>
        <header className="chrome-plate rounded-[1.6rem] px-5 py-5">
          <motion.h1
            className="chrome-title font-display text-[1.6rem] font-bold leading-tight tracking-[-0.03em] sm:text-[2rem]"
            {...enter(0.02)}
          >
            Your revision timetable
          </motion.h1>
          <motion.p
            className="mt-2 max-w-2xl text-[0.92rem] leading-relaxed text-muted-foreground"
            {...enter(0.08)}
          >
            Tell Bluprint what you are studying and when your first exam is.
            From then on, each day's work is planned when you open it.
          </motion.p>
        </header>

        <motion.section
          className="mt-6 rounded-[2rem] border border-dashed border-border bg-white p-7 sm:p-9"
          {...reveal(0.14)}
        >
          <h2 className="font-display text-[1.2rem] font-bold text-brand-ink">
            No timetable yet
          </h2>
          <p className="mt-2 max-w-xl text-[0.88rem] leading-relaxed text-muted-foreground">
            Pick your subjects, how long you can study on a school day and on a
            day off, and your first exam date. Your timetable will appear here a
            day at a time, and you can block out time on any day that changes.
          </p>
          <Button
            asChild
            className="mt-5 h-11 rounded-full bg-[#191B27] px-6 font-semibold text-white hover:bg-[#2A2D3E]"
          >
            <Link to="/timetable/new">Build revision timetable</Link>
          </Button>
        </motion.section>
      </AppShell>
    );
  }

  const isToday = activeDate === today;
  const daysLeft = daysUntilInput(view.plan.examDate);
  const isPast = activeDate < today;
  const canGenerate = !isPast && !view.reason && !view.day && !dayError;
  const nextRevision = strip.find(
    (date) =>
      date > activeDate && isRevisionDate(date, view.plan.daysPerWeek),
  );
  const dayLabel =
    activeDate === view.plan.examDate
      ? "Exam day"
      : isToday
        ? "Today"
        : formatDayLabel(activeDate);

  return (
    <AppShell>
      <header className="chrome-plate flex flex-wrap items-end justify-between gap-4 rounded-[1.6rem] px-5 py-5">
        <div>
          <p className="mono-label text-[#5B3DF5]">{dayLabel}</p>
          <motion.h1
            className="mt-1 font-display text-[1.6rem] font-bold leading-tight tracking-[-0.03em] text-brand-ink sm:text-[2rem]"
            {...enter(0.02)}
          >
            {isToday ? "Today's revision" : formatLongDate(activeDate)}
          </motion.h1>
          <motion.p
            className="mt-1.5 text-[0.9rem] text-muted-foreground"
            {...enter(0.08)}
          >
            First exam {formatLongDate(view.plan.examDate)} ·{" "}
            {daysLeft > 0
              ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} to go`
              : "exam date has passed"}
          </motion.p>
        </div>
        <Button
          asChild
          variant="outline"
          className="h-10 rounded-full border-border bg-white px-4 text-[0.8rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
        >
          <Link to="/timetable/new">
            <CalendarPlus className="size-3.5" />
            Rebuild plan
          </Link>
        </Button>
      </header>

      {/* One day at a time. The strip only chooses which day to generate and
          show; the week grid is gone. */}
      <motion.div
        className="mt-5 flex gap-2 overflow-x-auto pb-1 no-scrollbar"
        {...reveal(0.1)}
      >
        {strip.map((date, index) => (
          <DayChip
            key={date}
            date={date}
            today={today}
            examDate={view.plan.examDate}
            daysPerWeek={view.plan.daysPerWeek}
            selected={date === activeDate}
            summary={view.days.find((entry) => entry.date === date)}
            onSelect={() => {
              setSelected(date);
              setDayError(null);
            }}
            index={index}
          />
        ))}
      </motion.div>

      {view.missed > 0 && (
        <motion.div
          className="mt-4 flex flex-col gap-1 rounded-2xl border border-[#F0DCB8] bg-[#FFF9EC] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          {...reveal(0.12)}
        >
          <p className="flex items-start gap-2 text-[0.8rem] leading-relaxed text-[#7A5410]">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <span className="font-semibold">
                {view.missed} missed session{view.missed === 1 ? "" : "s"}
              </span>{" "}
              waiting to be caught up. Bluprint adds one or two to the next few
              days, so nothing lands in one long block.
            </span>
          </p>
        </motion.div>
      )}

      {dayError && (
        <p className="mt-4 rounded-2xl bg-[#FFEEF0] px-4 py-3 text-[0.8rem] leading-relaxed text-[#B23A55]">
          {dayError}
        </p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <motion.section
          className="overflow-hidden rounded-[1.7rem] border border-border bg-white"
          {...reveal(0.14)}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[#FCFCFA] px-4 py-3 sm:px-5">
            <div>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                {view.day ? `${daySessions.length} session${daySessions.length === 1 ? "" : "s"}` : "Day plan"}
              </p>
              <p className="mt-0.5 font-display text-[1rem] font-bold text-brand-ink">
                {view.isDayOff ? "Day off" : "School day"} ·{" "}
                {formatTime24(
                  view.isDayOff
                    ? view.plan.dayOffStartMinutes
                    : view.plan.startMinutes,
                )}{" "}
                start
              </p>
            </div>
            <div className="flex items-center gap-2">
              {daySessions.length > 0 && (
                <div className="w-24">
                  <Meter
                    value={progress}
                    className="h-1.5 bg-brand-panel"
                    barClassName="bg-[#5B3DF5]"
                    label="Sessions completed"
                  />
                </div>
              )}
              <span className="text-[0.7rem] font-semibold tabular-nums text-muted-foreground">
                {daySessions.length > 0
                  ? `${doneCount}/${daySessions.length} done`
                  : "—"}
              </span>
            </div>
          </div>

          <div className="px-3 py-3 sm:px-4 sm:py-4">
            {!view.day ? (
              <div className="rounded-2xl border border-dashed border-border bg-[#FCFCFA] px-5 py-8 text-center">
                {canGenerate ? (
                  <div
                    role="status"
                    aria-busy="true"
                    aria-live="polite"
                    className="space-y-2"
                  >
                    <span className="sr-only">Planning this day</span>
                    {[0, 1, 2].map((index) => (
                      <div
                        key={index}
                        aria-hidden="true"
                        className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 sm:gap-4 sm:px-4"
                      >
                        <Skeleton className="h-9 w-[54px] shrink-0 rounded-lg" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <Skeleton className="h-3 w-2/5" />
                          <Skeleton className="h-2.5 w-1/4" />
                          <Skeleton className="h-6 w-20 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <p className="text-[0.86rem] font-semibold text-brand-ink">
                      {view.reason
                        ? reasonCopy(view.reason)
                        : dayError
                          ? "This day could not be planned."
                          : "Planning this day…"}
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-[0.78rem] leading-relaxed text-muted-foreground">
                      {dayError
                        ? "Try another day, or rebuild the plan if the problem continues."
                        : view.reason === "rest"
                          ? `Your plan revises ${view.plan.daysPerWeek} days a week.${nextRevision ? ` The next planned day is ${formatDayLabel(nextRevision)}.` : ""}`
                          : view.reason === "past"
                            ? "No sessions were saved for this day. Open today's plan to pick up where the plan left off."
                            : view.reason === "before-start"
                              ? `Your first planned day is ${formatLongDate(view.plan.startDate)}.`
                              : "Blocked time and rest days are respected when a day is planned."}
                    </p>
                  </>
                )}
              </div>
            ) : timeline.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-[#FCFCFA] px-5 py-8 text-center text-[0.82rem] text-muted-foreground">
                Nothing fits in the time left today. Remove a blocked period or
                choose a shorter session when you rebuild.
              </div>
            ) : (
              <div className="space-y-2">
                {timeline.map((item, index) =>
                  item.kind === "session" ? (
                    <motion.div
                      key={item.session.id}
                      {...reveal(0.02 + index * 0.02, 10)}
                    >
                      <SessionRow
                        session={item.session}
                        color={
                          colorByCourse.get(item.session.courseId) ??
                          SUBJECT_COLORS[0]!
                        }
                        isPast={isPast}
                        busy={busySession === item.session.id}
                        onOpen={() => void handleOpen(item.session)}
                        onToggle={() => void toggleSession(item.session)}
                      />
                    </motion.div>
                  ) : item.kind === "meal" ? (
                    <motion.div
                      key={`meal-${item.meal.label}`}
                      {...reveal(0.02 + index * 0.02, 10)}
                    >
                      <MealRow meal={item.meal} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key={`blocked-${item.period.startMinutes}-${item.period.endMinutes}`}
                      {...reveal(0.02 + index * 0.02, 10)}
                    >
                      <BlockedRow period={item.period} />
                    </motion.div>
                  ),
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-[#FCFCFA] px-4 py-2.5 text-[0.66rem] text-muted-foreground">
            <span>
              {plannedMinutes > 0
                ? `${durationLabel(plannedMinutes)} planned · ${methodLabel(view.plan.studyMethod)}`
                : "No sessions planned"}
            </span>
            <span>
              Tick a session when it is done. Unticked past sessions are caught
              up later.
            </span>
          </div>
        </motion.section>

        <div className="space-y-4">
          <motion.section
            className="rounded-[1.7rem] border border-border bg-white p-4"
            {...reveal(0.18)}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-display text-[0.98rem] font-bold text-brand-ink">
                <Ban className="size-3.5 text-muted-foreground" />
                Blocked time
              </h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setBlockOpen(true)}
                disabled={isPast || activeDate > view.plan.examDate}
                className="h-7 rounded-full border-border bg-white px-2.5 text-[0.66rem] font-semibold shadow-none"
              >
                <Plus className="size-3" />
                Block time
              </Button>
            </div>

            {blockedByTime.length === 0 ? (
              <p className="mt-2 text-[0.76rem] leading-relaxed text-muted-foreground">
                Nothing blocked. Add a match, a shift or weekend plans and this
                day is replanned around it.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {blockedByTime.map((period) => (
                  <div
                    key={`${period.startMinutes}-${period.endMinutes}`}
                    className="flex items-start justify-between gap-2 rounded-xl border border-border bg-[#FCFCFA] px-2.5 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[0.76rem] font-semibold text-brand-ink">
                        {period.label?.trim() || "Blocked out"}
                      </p>
                      <p className="text-[0.66rem] tabular-nums text-muted-foreground">
                        {formatTimeRange(
                          period.startMinutes,
                          period.endMinutes - period.startMinutes,
                        )}
                      </p>
                    </div>
                    {!isPast && (
                      <button
                        type="button"
                        onClick={() => void removeBlock(period)}
                        disabled={savingBlocks}
                        aria-label={`Remove ${period.label ?? "blocked period"}`}
                        className="shrink-0 text-[0.64rem] font-semibold text-muted-foreground hover:text-[#B23A55] disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.section>

          <motion.section
            className="rounded-[1.7rem] border border-border bg-[#FCFAF4] p-4"
            {...reveal(0.22)}
          >
            <h2 className="flex items-center gap-2 font-display text-[0.98rem] font-bold text-brand-ink">
              <Clock3 className="size-3.5 text-muted-foreground" />
              This plan
            </h2>
            <dl className="mt-3 space-y-2 text-[0.76rem]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Study time</dt>
                <dd className="font-semibold text-brand-ink">
                  {view.isDayOff
                    ? `${view.plan.dayOffMinutes} min today`
                    : `${view.plan.dailyMinutes} min on school days`}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Session length</dt>
                <dd className="text-right font-semibold text-brand-ink">
                  Up to {view.plan.sessionMinutes} min
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Breaks</dt>
                <dd className="font-semibold text-brand-ink">
                  10 min between
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Cadence</dt>
                <dd className="font-semibold text-brand-ink">
                  {view.plan.daysPerWeek} days a week
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Subject mix</dt>
                <dd className="font-semibold text-brand-ink">
                  {methodLabel(view.plan.studyMethod)}
                </dd>
              </div>
            </dl>

            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-border/70 pt-3">
              {view.plan.courseSettings.map((setting) => {
                const color = colorByCourse.get(setting.courseId);
                if (!color) return null;
                return (
                  <span
                    key={setting.courseId}
                    className="inline-flex items-center gap-1.5 text-[0.7rem] font-medium text-brand-ink/75"
                  >
                    <span className={cn("size-2 rounded-full", color.dot)} />
                    {setting.subject}
                  </span>
                );
              })}
            </div>
          </motion.section>

          <motion.section
            className="rounded-[1.7rem] border border-dashed border-border bg-white p-4"
            {...reveal(0.26)}
          >
            <h2 className="font-display text-[0.92rem] font-bold text-brand-ink">
              How the day works
            </h2>
            <p className="mt-1.5 text-[0.74rem] leading-relaxed text-muted-foreground">
              Each day is built from your courses, rotating between subjects.
              A short topic gets 20 minutes, a longer one up to your session
              length. Sessions are spread across the day with a 10-minute break
              between them, and lunch and dinner stay free. Unticked sessions
              are caught up a couple at a time, so missed work never lands in
              one long block.
            </p>
          </motion.section>
        </div>
      </div>

      <BlockTimeDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        date={activeDate}
        blocked={blockedByTime}
        onSaved={saveBlocks}
      />
    </AppShell>
  );
}
