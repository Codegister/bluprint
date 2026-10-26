import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireUserId } from "./lib/requireUser";

/**
 * Revision timetables.
 *
 * A plan stores the student's choices (subjects, session length, daily time,
 * exam date). It no longer fills in every day up front: each day's sessions are
 * generated when the student opens that day. That makes blocked-out time easy
 * to respect (only one day is rebuilt), keeps the saved documents small, and
 * means missed sessions are carried into the next day the student actually
 * opens rather than being buried in a week grid.
 *
 * Missed work is caught up over several days, never in one block: a day takes
 * at most two carried sessions, chosen oldest first. The rest stay in the
 * backlog for the following days.
 */

const SESSION_LENGTHS = [25, 45, 60, 90];
const DAILY_LENGTHS = [30, 60, 90, 120];
// How much time a student can give a bank holiday, weekend or school holiday.
// It is asked for, not derived: half-term is not a constant multiple of a
// Tuesday evening.
const DAY_OFF_LENGTHS = [60, 90, 120, 180, 240];
const PAPERS = ["Paper 1", "Paper 2", "Both"];
const DAYS_PER_WEEK = [3, 5, 7];
/**
 * How a plan spends its session slots. "topics" is the original route through
 * the pathway, "papers" works only through saved past papers, and "mixed"
 * alternates the two.
 */
const STUDY_METHODS = ["topics", "papers", "mixed"] as const;
type StudyMethod = (typeof STUDY_METHODS)[number];
/** A past paper is one hour, so every paper block is 60 minutes. */
const PAPER_MINUTES = 60;

/**
 * Revision stops at 8pm. Evenings after that are for the rest of a student's
 * life, and a plan that runs to midnight is one nobody follows.
 */
const LATEST_END_MINUTES = 20 * 60;
/** A short breather between sessions, and the shortest block worth planning. */
const GAP_MINUTES = 10;
const MIN_BLOCK_MINUTES = 10;
/** A guard against a plan that would put an implausible number of sessions in
 *  one day (for example, a 25-minute session in a four-hour day off). */
const MAX_SESSIONS_PER_DAY = 14;
/**
 * At most two missed sessions are added to a day. The point of catch-up is to
 * keep the normal rhythm, not to replace an evening with a five-hour block.
 */
const MAX_CARRY_PER_DAY = 2;

// 0 = Sunday. Three-day plans use Monday/Wednesday/Friday so subjects are
// spaced rather than stacked on consecutive evenings.
const WEEKDAYS: Record<number, number[]> = {
  3: [1, 3, 5],
  5: [1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

type PlanSession = Doc<"timetableDays">["sessions"][number];
type BlockedPeriod = NonNullable<
  Doc<"revisionPlans">["blockedPeriods"]
>[number];

type TopicEntry = {
  courseId: Id<"courses">;
  course: string;
  unit: string;
  topicId: string;
  topic: string;
};

type ScheduledPaper = { paperId?: Id<"pastPapers">; title: string };

type CoursePlan = {
  courseId: Id<"courses">;
  subject: string;
  paper: string;
  topics: TopicEntry[];
  papers: ScheduledPaper[];
};

function dateKey(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === value ? value : null;
}

function parseDateKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** 24-hour clock used in validation messages, e.g. 19:30. */
function formatClock(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}`;
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/* -------------------------------------------------------------------------- */
/* UK bank holidays (England & Wales)                                         */
/* -------------------------------------------------------------------------- */

/**
 * Easter Sunday using the Meeus/Jones/Butcher algorithm. Good Friday and
 * Easter Monday move every year, so hard-coding April dates would age badly.
 */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function firstMonday(year: number, monthIndex: number): Date {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const offset = (1 - first.getUTCDay() + 7) % 7;
  return addDays(first, offset);
}

function lastMonday(year: number, monthIndex: number): Date {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  const back = (last.getUTCDay() + 6) % 7;
  return addDays(last, -back);
}

function nextWeekday(value: Date): Date {
  let next = value;
  while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
    next = addDays(next, 1);
  }
  return next;
}

function observedFixed(value: Date): Date {
  if (value.getUTCDay() === 6) return addDays(value, 2);
  if (value.getUTCDay() === 0) return addDays(value, 1);
  return value;
}

const holidayCache = new Map<number, Map<string, string>>();

function bankHolidaysForYear(year: number): Map<string, string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const holidays = new Map<string, string>();
  const add = (date: Date, name: string) => holidays.set(toDateKey(date), name);

  add(observedFixed(new Date(Date.UTC(year, 0, 1))), "New Year's Day");
  const easter = easterSunday(year);
  add(addDays(easter, -2), "Good Friday");
  add(addDays(easter, 1), "Easter Monday");
  add(firstMonday(year, 4), "Early May bank holiday");
  add(lastMonday(year, 4), "Spring bank holiday");
  add(lastMonday(year, 7), "Summer bank holiday");

  const christmas = observedFixed(new Date(Date.UTC(year, 11, 25)));
  let boxing = observedFixed(new Date(Date.UTC(year, 11, 26)));
  // When Christmas and Boxing Day both fall on a weekend, the substitute
  // Boxing Day moves to the next weekday after the Christmas substitute.
  if (toDateKey(boxing) === toDateKey(christmas)) {
    boxing = nextWeekday(addDays(christmas, 1));
  }
  add(christmas, "Christmas Day");
  add(boxing, "Boxing Day");

  holidayCache.set(year, holidays);
  return holidays;
}

function bankHolidayName(date: Date): string | null {
  return bankHolidaysForYear(date.getUTCFullYear()).get(toDateKey(date)) ?? null;
}

function bankHolidaysBetween(start: Date, end: Date) {
  const seen = new Map<string, string>();
  for (
    let year = start.getUTCFullYear();
    year <= end.getUTCFullYear();
    year += 1
  ) {
    for (const [date, name] of bankHolidaysForYear(year)) {
      if (date >= toDateKey(start) && date < toDateKey(end) && !seen.has(date)) {
        seen.set(date, name);
      }
    }
  }
  return [...seen.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, name]) => ({ date, name }));
}

/* -------------------------------------------------------------------------- */
/* School holidays (typical England term breaks)                              */
/* -------------------------------------------------------------------------- */

function mondayOnOrAfter(value: Date): Date {
  const offset = (1 - value.getUTCDay() + 7) % 7;
  return addDays(value, offset);
}

function nthMonday(year: number, monthIndex: number, occurrence: number): Date {
  const first = mondayOnOrAfter(new Date(Date.UTC(year, monthIndex, 1)));
  return addDays(first, (occurrence - 1) * 7);
}

const schoolHolidayCache = new Map<number, Map<string, string>>();

/**
 * Typical England school break dates. Local authorities differ by a week in
 * places, so these are the common Monday-to-Friday windows rather than an
 * official calendar. They are used to give holiday weekdays the same extra
 * capacity as a weekend.
 */
function schoolHolidaysForYear(year: number): Map<string, string> {
  const cached = schoolHolidayCache.get(year);
  if (cached) return cached;

  const holidays = new Map<string, string>();
  const addRange = (start: Date, end: Date, name: string) => {
    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
      const weekday = cursor.getUTCDay();
      if (weekday !== 0 && weekday !== 6) {
        holidays.set(toDateKey(cursor), name);
      }
    }
  };

  addRange(
    lastMonday(year, 9),
    addDays(lastMonday(year, 9), 4),
    "Autumn half-term",
  );
  addRange(
    mondayOnOrAfter(new Date(Date.UTC(year, 11, 19))),
    new Date(Date.UTC(year + 1, 0, 1)),
    "Christmas break",
  );
  const february = nthMonday(year, 1, 3);
  addRange(february, addDays(february, 4), "February half-term");
  const easter = easterSunday(year);
  addRange(addDays(easter, 1), addDays(easter, 14), "Easter break");
  addRange(
    lastMonday(year, 4),
    addDays(lastMonday(year, 4), 4),
    "May half-term",
  );
  const summer = nthMonday(year, 6, 3);
  addRange(summer, new Date(Date.UTC(year, 7, 31)), "Summer break");

  schoolHolidayCache.set(year, holidays);
  return holidays;
}

function schoolHolidayName(date: Date): string | null {
  const key = toDateKey(date);
  return (
    schoolHolidaysForYear(date.getUTCFullYear()).get(key) ??
    // The Christmas range starts in the previous calendar year and can include
    // the first day of January.
    schoolHolidaysForYear(date.getUTCFullYear() - 1).get(key) ??
    null
  );
}

function schoolHolidaysBetween(start: Date, end: Date) {
  const seen = new Map<string, string>();
  for (
    let year = start.getUTCFullYear() - 1;
    year <= end.getUTCFullYear();
    year += 1
  ) {
    for (const [date, name] of schoolHolidaysForYear(year)) {
      if (date >= toDateKey(start) && date < toDateKey(end) && !seen.has(date)) {
        seen.set(date, name);
      }
    }
  }
  return [...seen.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, name]) => ({ date, name }));
}

/**
 * True when the student is not at school that day: a weekend, a bank holiday
 * or a school holiday. Those days use the day-off budget and start time the
 * student chose.
 */
function isDayOff(date: Date): boolean {
  const weekday = date.getUTCDay();
  if (weekday === 0 || weekday === 6) return true;
  return schoolHolidayName(date) !== null || bankHolidayName(date) !== null;
}

/* -------------------------------------------------------------------------- */
/* Availability                                                               */
/* -------------------------------------------------------------------------- */

type Window = { start: number; end: number };

/**
 * The parts of a day between `start` and `end` that are not blocked. Periods
 * are expected in clock minutes from midnight.
 */
function freeWindows(
  start: number,
  end: number,
  periods: Array<{ start: number; end: number }>,
): Window[] {
  const windows: Window[] = [];
  let cursor = start;
  for (const period of [...periods].sort((a, b) => a.start - b.start)) {
    if (period.end <= start || period.start >= end) continue;
    if (period.start > cursor) {
      windows.push({ start: cursor, end: Math.min(period.start, end) });
    }
    cursor = Math.max(cursor, period.end);
  }
  if (cursor < end) windows.push({ start: cursor, end });
  return windows.filter((window) => window.end - window.start >= 0);
}

/**
 * Places sessions into the free windows in order, keeping a small gap between
 * them. Returns null when a block no longer fits, which is how a blocked-out
 * evening silently reduces the day instead of pushing sessions past 8pm.
 */
function placeBlocks(
  blocks: Array<{ minutes: number }>,
  windows: Window[],
): Array<number | null> {
  let windowIndex = 0;
  let clock = windows[0]?.start ?? 0;
  return blocks.map((block) => {
    while (windowIndex < windows.length) {
      const window = windows[windowIndex]!;
      if (clock < window.start) clock = window.start;
      if (clock + block.minutes <= window.end) {
        const start = clock;
        clock += block.minutes + GAP_MINUTES;
        return start;
      }
      windowIndex += 1;
      if (windowIndex < windows.length) clock = windows[windowIndex]!.start;
    }
    return null;
  });
}

/* -------------------------------------------------------------------------- */
/* Session shapes                                                             */
/* -------------------------------------------------------------------------- */

/**
 * One day's study blocks. Whole sessions fill the budget, and a short final
 * block takes whatever is left when the budget does not divide exactly — a
 * two-hour evening of 25-minute sessions is four sessions plus twenty minutes,
 * not the 100 minutes that used to be scheduled.
 */
function studyBlocks(budgetMinutes: number, sessionMinutes: number): number[] {
  const blocks: number[] = [];
  let remaining = budgetMinutes;
  while (remaining >= sessionMinutes && blocks.length < MAX_SESSIONS_PER_DAY) {
    blocks.push(sessionMinutes);
    remaining -= sessionMinutes;
  }
  if (remaining >= MIN_BLOCK_MINUTES && blocks.length < MAX_SESSIONS_PER_DAY) {
    blocks.push(remaining);
  }
  return blocks;
}

type StudyBlock = { kind: "topic" | "paper"; minutes: number };

/**
 * One day's blocks for the chosen study method.
 *
 * Past papers are whole one-hour sessions, so a paper day holds as many hours
 * as the budget allows. The mixed route alternates a paper with the student's
 * normal session length, and a leftover too short for a paper is still offered
 * to a topic block rather than left unplanned.
 */
function dayBlocks(
  method: StudyMethod,
  budgetMinutes: number,
  sessionMinutes: number,
  dayIndex = 0,
): StudyBlock[] {
  if (method === "topics") {
    return studyBlocks(budgetMinutes, sessionMinutes).map((minutes) => ({
      kind: "topic" as const,
      minutes,
    }));
  }

  if (method === "papers") {
    const count = Math.min(
      Math.floor(budgetMinutes / PAPER_MINUTES),
      MAX_SESSIONS_PER_DAY,
    );
    return Array.from({ length: count }, () => ({
      kind: "paper" as const,
      minutes: PAPER_MINUTES,
    }));
  }

  const blocks: StudyBlock[] = [];
  let remaining = budgetMinutes;
  let kind: "topic" | "paper" = dayIndex % 2 === 0 ? "paper" : "topic";
  while (remaining > 0 && blocks.length < MAX_SESSIONS_PER_DAY) {
    const minutes = kind === "paper" ? PAPER_MINUTES : sessionMinutes;
    if (remaining < minutes) {
      // A paper needs the full hour; anything shorter can go to a topic block.
      if (kind === "paper" && remaining >= MIN_BLOCK_MINUTES) {
        kind = "topic";
        continue;
      }
      break;
    }
    blocks.push({ kind, minutes });
    remaining -= minutes;
    kind = kind === "paper" ? "topic" : "paper";
  }
  if (remaining >= MIN_BLOCK_MINUTES && blocks.length < MAX_SESSIONS_PER_DAY) {
    blocks.push({ kind: "topic", minutes: remaining });
  }
  return blocks;
}

/** Pathway topics for one course, flattened with their unit. */
function topicsFor(course: Doc<"courses">): TopicEntry[] {
  return (course.pathway?.units ?? []).flatMap((unit) =>
    unit.topics.map((topic) => ({
      courseId: course._id,
      course: course.subject,
      unit: unit.title,
      topicId: topic.id,
      topic: topic.title,
    })),
  );
}

/* -------------------------------------------------------------------------- */
/* Plan reading                                                               */
/* -------------------------------------------------------------------------- */

/** Reads the saved plan for the signed-in account, or null if none exists. */
export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const plans = await ctx.db
      .query("revisionPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return plans.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
  },
});

async function latestPlan(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"revisionPlans"> | null> {
  const plans = await ctx.db
    .query("revisionPlans")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return plans.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}

async function daysForPlan(
  ctx: QueryCtx | MutationCtx,
  planId: Id<"revisionPlans">,
): Promise<Array<Doc<"timetableDays">>> {
  const days = await ctx.db
    .query("timetableDays")
    .withIndex("by_plan_date", (q) => q.eq("planId", planId))
    .collect();
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

function planSettings(plan: Doc<"revisionPlans">) {
  return {
    sessionMinutes: plan.sessionMinutes ?? 45,
    dailyMinutes: plan.dailyMinutes ?? 60,
    dayOffMinutes: plan.dayOffMinutes ?? 180,
    startMinutes: plan.startMinutes ?? 17 * 60,
    dayOffStartMinutes: plan.dayOffStartMinutes ?? 10 * 60,
    daysPerWeek: plan.daysPerWeek,
    method: (plan.studyMethod ?? "topics") as StudyMethod,
  };
}

function isRevisionDay(date: string, plan: Doc<"revisionPlans">): boolean {
  const weekdays = WEEKDAYS[plan.daysPerWeek] ?? WEEKDAYS[5]!;
  return weekdays.includes(parseDateKey(date).getUTCDay());
}

/** Revision days from `date` (inclusive) up to, but not including, the exam. */
function revisionDaysLeft(
  date: string,
  examDate: string,
  plan: Doc<"revisionPlans">,
): number {
  const weekdays = new Set(WEEKDAYS[plan.daysPerWeek] ?? WEEKDAYS[5]!);
  let count = 0;
  for (
    let cursor = parseDateKey(date);
    cursor < parseDateKey(examDate);
    cursor = addDays(cursor, 1)
  ) {
    if (weekdays.has(cursor.getUTCDay())) count += 1;
  }
  return count;
}

/** How many revision days have already passed at the start of `date`. */
function revisionDayIndex(date: string, plan: Doc<"revisionPlans">): number {
  const weekdays = new Set(WEEKDAYS[plan.daysPerWeek] ?? WEEKDAYS[5]!);
  let index = 0;
  for (
    let cursor = parseDateKey(plan.startDate);
    cursor < parseDateKey(date);
    cursor = addDays(cursor, 1)
  ) {
    if (weekdays.has(cursor.getUTCDay())) index += 1;
  }
  return index;
}

/** The courses and saved papers a day can draw from. */
async function coursePlans(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  plan: Doc<"revisionPlans">,
): Promise<CoursePlan[]> {
  const settings = plan.courseSettings ?? [];
  const courses = await Promise.all(
    settings.map((setting) => ctx.db.get(setting.courseId)),
  );
  const plans: CoursePlan[] = [];

  for (let index = 0; index < settings.length; index += 1) {
    const setting = settings[index]!;
    const course = courses[index];
    if (
      !course ||
      course.userId !== userId ||
      course.status !== "ready" ||
      topicsFor(course).length === 0
    ) {
      continue;
    }
    const saved = await ctx.db
      .query("pastPapers")
      .withIndex("by_course", (q) => q.eq("courseId", course._id))
      .collect();
    const papers = saved
      .filter(
        (paper) =>
          paper.userId === userId &&
          paper.status === "ready" &&
          paper.questionCount > 0,
      )
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((paper) => ({ paperId: paper._id, title: paper.title }));
    plans.push({
      courseId: course._id,
      subject: course.subject,
      paper: setting.paper,
      topics: topicsFor(course),
      papers: papers.length > 0 ? papers : [{ title: "Past paper practice" }],
    });
  }

  return plans;
}

/* -------------------------------------------------------------------------- */
/* Daily generation                                                           */
/* -------------------------------------------------------------------------- */

type CarriedCandidate = {
  day: string;
  session: PlanSession;
};

/**
 * Adds one day to the timetable.
 *
 * `force` rebuilds the day after its blocked periods change. Completed sessions
 * survive a rebuild and keep their time reserved, so ticking a session done and
 * then blocking out the rest of the evening does not lose the work already done.
 */
async function generateDay(
  ctx: MutationCtx,
  userId: Id<"users">,
  plan: Doc<"revisionPlans">,
  date: string,
  force: boolean,
): Promise<
  | { generated: true; day: Doc<"timetableDays"> }
  | { generated: false; reason: string }
> {
  const today = toDateKey(new Date());
  if (date < plan.startDate) return { generated: false, reason: "before-start" };
  if (date > plan.examDate) return { generated: false, reason: "after-exam" };
  if (date < today) return { generated: false, reason: "past" };
  if (!isRevisionDay(date, plan)) return { generated: false, reason: "rest" };

  const existingDays = await daysForPlan(ctx, plan._id);
  const existing = existingDays.find((day) => day.date === date) ?? null;
  if (existing && !force) return { generated: true, day: existing };

  const settings = planSettings(plan);
  const off = isDayOff(parseDateKey(date));
  const start = off ? settings.dayOffStartMinutes : settings.startMinutes;
  const budget = off ? settings.dayOffMinutes : settings.dailyMinutes;

  // Completed sessions are fixed points in the day: they stay put, keep their
  // time reserved, and the rest of the budget is planned around them.
  const kept = (existing?.sessions ?? [])
    .filter((session) => session.done)
    .sort((a, b) => a.startMinutes - b.startMinutes);
  const keptMinutes = kept.reduce((sum, session) => sum + session.minutes, 0);
  const remainingBudget = Math.max(0, budget - keptMinutes);

  const blocked: BlockedPeriod[] = (plan.blockedPeriods ?? []).filter(
    (period) => period.date === date,
  );
  const windows = freeWindows(start, LATEST_END_MINUTES, [
    ...blocked.map((period) => ({
      start: period.startMinutes,
      end: period.endMinutes,
    })),
    ...kept.map((session) => ({
      start: session.startMinutes,
      end: session.startMinutes + session.minutes,
    })),
  ]);

  // Topic and paper cursors advance with everything planned on earlier days,
  // so a day always continues from where the last one finished.
  const otherDays = existingDays.filter((day) => day.date !== date);

  // Catch-up sessions already sitting on this day are about to be dropped and
  // replanned. Their originals were marked as carried, so unmark them first:
  // if the rebuilt day has no room, the work stays in the backlog for another
  // day instead of disappearing with the old plan.
  const droppedCarry = (existing?.sessions ?? []).filter(
    (session) => !session.done && session.carriedFrom,
  );
  if (droppedCarry.length > 0) {
    const byOrigin = new Map<string, PlanSession[]>();
    for (const session of droppedCarry) {
      const list = byOrigin.get(session.carriedFrom!) ?? [];
      list.push(session);
      byOrigin.set(session.carriedFrom!, list);
    }
    for (const [originDate, dropped] of byOrigin) {
      const originDay = existingDays.find((day) => day.date === originDate);
      if (!originDay) continue;
      const ids = new Set(dropped.map((session) => session.topicId));
      const updated = originDay.sessions.map((session) => {
        if (session.done || !ids.has(session.topicId)) return session;
        const rest = { ...session };
        delete rest.carriedOn;
        return rest;
      });
      await ctx.db.patch(originDay._id, {
        sessions: updated as typeof originDay.sessions,
        updatedAt: Date.now(),
      });
    }
  }

  const topicCount = new Map<string, number>();
  const paperCount = new Map<string, number>();
  let totalSessions = 0;
  // Only earlier days move the topic cursor. A day planned ahead must not
  // change what today studies.
  for (const day of otherDays.filter((entry) => entry.date < date)) {
    for (const session of day.sessions) {
      totalSessions += 1;
      const key = session.courseId;
      if (session.kind === "paper") {
        paperCount.set(key, (paperCount.get(key) ?? 0) + 1);
      } else {
        topicCount.set(key, (topicCount.get(key) ?? 0) + 1);
      }
    }
  }
  for (const session of kept) {
    const key = session.courseId;
    if (session.kind === "paper") {
      paperCount.set(key, (paperCount.get(key) ?? 0) + 1);
    } else {
      topicCount.set(key, (topicCount.get(key) ?? 0) + 1);
    }
  }

  const courses = await coursePlans(ctx, userId, plan);
  if (courses.length === 0) {
    return { generated: false, reason: "no-courses" };
  }

  const blocks = dayBlocks(
    settings.method,
    remainingBudget,
    settings.sessionMinutes,
    revisionDayIndex(date, plan),
  );

  type Pending =
    | {
        kind: "new";
        block: StudyBlock;
      }
    | {
        kind: "carry";
        origin: CarriedCandidate;
      };

  // Missed sessions are taken oldest first, and only as many as this day can
  // absorb without turning revision into a marathon. The rest are left for the
  // following days, which is what spreads catch-up over several sessions.
  const backlog: CarriedCandidate[] = [
    ...otherDays
      .filter((day) => day.date < date)
      .flatMap((day) =>
        day.sessions
          .filter((session) => !session.done && !("carriedOn" in session))
          .map((session) => ({ day: day.date, session })),
      ),
    // The catch-up work being replanned from this day is a candidate again.
    ...droppedCarry.map((session) => ({
      day: session.carriedFrom!,
      session,
    })),
  ].sort(
      (a, b) =>
        a.day.localeCompare(b.day) ||
        (a.session.startMinutes ?? 0) - (b.session.startMinutes ?? 0),
    );
  const daysLeft = Math.max(1, revisionDaysLeft(date, plan.examDate, plan));
  const carryLimit = Math.min(
    MAX_CARRY_PER_DAY,
    Math.max(1, Math.ceil(backlog.length / daysLeft)),
  );
  const carried = backlog.slice(0, carryLimit);

  const pending: Pending[] = blocks.map((block) => ({ kind: "new", block }));
  for (const origin of carried) {
    pending.push({ kind: "carry", origin });
  }

  const starts = placeBlocks(
    pending.map((item) =>
      item.kind === "new"
        ? { minutes: item.block.minutes }
        : { minutes: item.origin.session.minutes },
    ),
    windows,
  );

  const sessions: PlanSession[] = [...kept];
  let cursor = courses.length > 0 ? totalSessions % courses.length : 0;
  const carriedOriginIds = new Map<string, Set<string>>();

  for (let index = 0; index < pending.length; index += 1) {
    const startMinutes = starts[index];
    if (startMinutes === null || startMinutes === undefined) continue;
    const item = pending[index]!;

    if (item.kind === "carry") {
      const origin = item.origin;
      const session = origin.session;
      sessions.push({
        id: `${date}:carry:${session.id}`,
        courseId: session.courseId,
        course: session.course,
        unit: session.unit,
        topicId: session.topicId,
        topic: session.topic,
        minutes: session.minutes,
        ...(session.paper ? { paper: session.paper } : {}),
        ...(session.kind ? { kind: session.kind } : {}),
        ...(session.paperId ? { paperId: session.paperId } : {}),
        startMinutes,
        // The earliest day this work was missed. A session that was already a
        // catch-up keeps its first missed date rather than today's.
        carriedFrom: session.carriedFrom ?? origin.day,
      });
      const originSet = carriedOriginIds.get(origin.day) ?? new Set<string>();
      originSet.add(session.id);
      carriedOriginIds.set(origin.day, originSet);
      continue;
    }

    if (item.block.kind === "paper") {
      const chosen = pickCourse(courses, cursor, "paper");
      if (!chosen) break;
      const course = chosen.course;
      const paperIndex = paperCount.get(course.courseId) ?? 0;
      const saved = course.papers[paperIndex % course.papers.length]!;
      paperCount.set(course.courseId, paperIndex + 1);
      sessions.push({
        id: `${date}:${index}:paper:${course.courseId}`,
        courseId: course.courseId,
        course: course.subject,
        unit: "Past paper",
        topicId: `paper:${course.courseId}:${paperIndex}`,
        topic: saved.title,
        minutes: item.block.minutes,
        paper: resolvePaperLabel(course.paper, paperIndex),
        kind: "paper",
        ...(saved.paperId ? { paperId: saved.paperId } : {}),
        startMinutes,
      });
      cursor = chosen.next;
      continue;
    }

    const chosen = pickCourse(courses, cursor, "topic");
    if (!chosen) break;
    const course = chosen.course;
    const topicIndex = topicCount.get(course.courseId) ?? 0;
    const topic = course.topics[topicIndex % course.topics.length]!;
    topicCount.set(course.courseId, topicIndex + 1);
    sessions.push({
      id: `${date}:${index}:topic:${course.courseId}`,
      courseId: topic.courseId,
      course: topic.course,
      unit: topic.unit,
      topicId: topic.topicId,
      topic: topic.topic,
      minutes: item.block.minutes,
      paper: resolvePaperLabel(
        course.paper,
        paperCount.get(course.courseId) ?? 0,
      ),
      kind: "topic",
      startMinutes,
    });
    cursor = chosen.next;
  }

  const now = Date.now();
  const nextSessions = sessions.sort(
    (a, b) => a.startMinutes - b.startMinutes,
  );

  let saved: Doc<"timetableDays">;
  if (existing) {
    await ctx.db.patch(existing._id, {
      sessions: nextSessions,
      generatedAt: now,
      updatedAt: now,
    });
    saved = { ...existing, sessions: nextSessions, generatedAt: now, updatedAt: now };
  } else {
    const id = await ctx.db.insert("timetableDays", {
      userId,
      planId: plan._id,
      date,
      sessions: nextSessions,
      generatedAt: now,
      updatedAt: now,
    });
    const inserted = await ctx.db.get(id);
    if (!inserted) throw new Error("Could not save today's plan. Try again.");
    saved = inserted;
  }

  // Mark the originals as carried so the same missed session is never added to
  // two future days. The day still shows them as missed.
  for (const [originDate, ids] of carriedOriginIds) {
    const originDay = existingDays.find((day) => day.date === originDate);
    if (!originDay) continue;
    const updated = originDay.sessions.map((session) =>
      ids.has(session.id)
        ? { ...session, carriedOn: date }
        : session,
    );
    await ctx.db.patch(originDay._id, {
      sessions: updated as typeof originDay.sessions,
      updatedAt: now,
    });
  }

  return { generated: true, day: saved };
}

type PickedCourse = { course: CoursePlan; next: number };

/** Next course in the rotation that still has work of the requested kind. */
function pickCourse(
  courses: CoursePlan[],
  from: number,
  kind: "topic" | "paper",
): PickedCourse | null {
  for (let offset = 0; offset < courses.length; offset += 1) {
    const index = (from + offset) % courses.length;
    const course = courses[index]!;
    if (kind === "topic" ? course.topics.length > 0 : course.papers.length > 0) {
      return { course, next: (index + 1) % courses.length };
    }
  }
  return null;
}

/** Paper 1/2 label for a paper session when the course asks for "Both". */
function resolvePaperLabel(paper: string, index: number): string {
  if (paper !== "Both") return paper;
  return index % 2 === 0 ? "Paper 1" : "Paper 2";
}

/* -------------------------------------------------------------------------- */
/* Public day API                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Everything the timetable screen needs for one date: the plan settings, that
 * day's sessions (if it has been generated), the blocked periods, and how much
 * missed work is waiting to be caught up.
 */
export const getDayView = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const date = dateKey(args.date);
    if (!date) return null;
    const plan = await latestPlan(ctx, userId);
    if (!plan) return null;

    const days = await daysForPlan(ctx, plan._id);
    const day = days.find((entry) => entry.date === date) ?? null;
    const today = toDateKey(new Date());

    // A missed session is one from a past day that is neither done nor already
    // moved forward. Carried copies live on their new day, so they are only
    // counted again if that new day has also passed.
    const missed = days
      .filter((entry) => entry.date < today)
      .flatMap((entry) => entry.sessions)
      .filter(
        (session) => !session.done && !("carriedOn" in session),
      ).length;

    const blocked = (plan.blockedPeriods ?? []).filter(
      (period) => period.date === date,
    );

    const reason = (() => {
      if (date < plan.startDate) return "before-start" as const;
      if (date > plan.examDate) return "after-exam" as const;
      if (date < today) return "past" as const;
      if (!isRevisionDay(date, plan)) return "rest" as const;
      return null;
    })();

    const settings = planSettings(plan);
    const off = isDayOff(parseDateKey(date));

    return {
      date,
      today,
      plan: {
        _id: plan._id,
        startDate: plan.startDate,
        requestedStartDate: plan.requestedStartDate ?? null,
        examDate: plan.examDate,
        studyMethod: settings.method,
        dailyMinutes: settings.dailyMinutes,
        dayOffMinutes: settings.dayOffMinutes,
        startMinutes: settings.startMinutes,
        dayOffStartMinutes: settings.dayOffStartMinutes,
        sessionMinutes: settings.sessionMinutes,
        daysPerWeek: settings.daysPerWeek,
        topicTotal: plan.topicTotal,
        courseSettings: (plan.courseSettings ?? []).map((setting) => ({
          courseId: setting.courseId,
          subject: setting.subject,
          paper: setting.paper,
        })),
      },
      day,
      days: days.map((entry) => ({
        date: entry.date,
        count: entry.sessions.length,
        done: entry.sessions.filter((session) => session.done).length,
        minutes: entry.sessions.reduce(
          (sum, session) => sum + session.minutes,
          0,
        ),
      })),
      blocked,
      missed,
      reason,
      isDayOff: off,
    };
  },
});

/**
 * Creates (or returns) one day's plan. The screen calls this for the day it is
 * showing, so days are generated individually and only when needed.
 */
export const ensureDay = mutation({
  args: {
    date: v.string(),
    // Rebuild after a blocked period changes. Done sessions are preserved.
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const date = dateKey(args.date);
    if (!date) throw new Error("Choose a valid day.");
    const plan = await latestPlan(ctx, userId);
    if (!plan) throw new Error("Build a revision timetable first.");

    // Fill any missing revision days before the requested one, in order. A
    // later day must follow on from the day before it, otherwise jumping ahead
    // would restart the topic rotation.
    const today = toDateKey(new Date());
    // A day generated ahead of time (or yesterday) does not know about work
    // missed since. Rebuild it once today so catch-up gets folded in.
    const todayDay = await ctx.db
      .query("timetableDays")
      .withIndex("by_plan_date", (q) =>
        q.eq("planId", plan._id).eq("date", today),
      )
      .unique();
    const refreshToday = Boolean(
      todayDay &&
        todayDay.generatedAt <
          new Date(`${today}T00:00:00.000Z`).getTime(),
    );

    let cursor = parseDateKey(
      plan.startDate > today ? plan.startDate : today,
    );
    const target = parseDateKey(date);
    let result: Awaited<ReturnType<typeof generateDay>> | null = null;
    while (cursor <= target) {
      const key = toDateKey(cursor);
      if (isRevisionDay(key, plan)) {
        const generated = await generateDay(
          ctx,
          userId,
          plan,
          key,
          key === date
            ? (args.force ?? false) || (key === today && refreshToday)
            : key === today && refreshToday,
        );
        if (key === date) result = generated;
      }
      cursor = addDays(cursor, 1);
    }
    if (result) return result;
    return await generateDay(ctx, userId, plan, date, args.force ?? false);
  },
});

/** Replaces the blocked periods for one date and rebuilds that day. */
export const setBlockedPeriods = mutation({
  args: {
    date: v.string(),
    periods: v.array(
      v.object({
        startMinutes: v.number(),
        endMinutes: v.number(),
        label: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const date = dateKey(args.date);
    if (!date) throw new Error("Choose a valid day.");
    if (args.periods.length > 8) {
      throw new Error("You can block up to eight periods in one day.");
    }
    for (const period of args.periods) {
      if (
        !Number.isInteger(period.startMinutes) ||
        !Number.isInteger(period.endMinutes) ||
        period.startMinutes < 0 ||
        period.endMinutes > 24 * 60 ||
        period.endMinutes <= period.startMinutes
      ) {
        throw new Error("Each blocked period needs a start before its end.");
      }
    }

    const plan = await latestPlan(ctx, userId);
    if (!plan) throw new Error("Build a revision timetable first.");
    if (date < plan.startDate || date > plan.examDate) {
      throw new Error("That date is outside your revision plan.");
    }

    const others = (plan.blockedPeriods ?? []).filter(
      (period) => period.date !== date,
    );
    const nextBlocks = [
      ...others,
      ...args.periods.map((period) => ({
        date,
        startMinutes: period.startMinutes,
        endMinutes: period.endMinutes,
        ...(period.label?.trim() ? { label: period.label.trim() } : {}),
      })),
    ];
    await ctx.db.patch(plan._id, {
      blockedPeriods: nextBlocks,
      updatedAt: Date.now(),
    });

    // Rebuild a day that already exists so the blocks take effect now. A day
    // that has never been generated is left alone: it will be created in order
    // when it is opened, so a later day is never planned ahead of earlier ones.
    const today = toDateKey(new Date());
    const existingDay = await ctx.db
      .query("timetableDays")
      .withIndex("by_plan_date", (q) =>
        q.eq("planId", plan._id).eq("date", date),
      )
      .unique();
    if (existingDay || date === today) {
      const refreshed = await ctx.db.get(plan._id);
      if (refreshed) {
        await generateDay(ctx, userId, refreshed, date, true);
      }
    }

    return { date, blocked: args.periods.length };
  },
});

/** Ticks a session done, or puts it back on the list. */
export const setSessionDone = mutation({
  args: {
    date: v.string(),
    sessionId: v.string(),
    done: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const date = dateKey(args.date);
    if (!date) throw new Error("Choose a valid day.");
    const plan = await latestPlan(ctx, userId);
    if (!plan) throw new Error("Build a revision timetable first.");

    const day = await ctx.db
      .query("timetableDays")
      .withIndex("by_plan_date", (q) =>
        q.eq("planId", plan._id).eq("date", date),
      )
      .unique();
    if (!day) throw new Error("That day has not been planned yet.");

    const found = day.sessions.some(
      (session) => session.id === args.sessionId,
    );
    if (!found) {
      throw new Error("That session has changed. Refresh the day and try again.");
    }

    const now = Date.now();
    const sessions = day.sessions.map((session) => {
      if (session.id !== args.sessionId) return session;
      // Rebuild the object rather than storing `doneAt: undefined`: Convex
      // documents cannot hold undefined values.
      const rest = { ...session };
      delete rest.doneAt;
      return args.done
        ? { ...rest, done: true, doneAt: now }
        : { ...rest, done: false };
    });
    await ctx.db.patch(day._id, {
      sessions: sessions as typeof day.sessions,
      updatedAt: now,
    });

    return { done: args.done };
  },
});

/* -------------------------------------------------------------------------- */
/* Building a plan                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Replaces the account's timetable with new settings. No days are filled in
 * here: the planner only records the choices and works out how many topics a
 * day can hold, so it can still warn that revision needs to start earlier.
 */
export const build = mutation({
  args: {
    startDate: v.string(),
    examDate: v.string(),
    daysPerWeek: v.number(),
    dailyMinutes: v.number(),
    // How much time the student actually has on a weekend, bank holiday or
    // school holiday. Asked explicitly, never derived from the school-day budget.
    dayOffMinutes: v.number(),
    // Sessions start at the school-day time on school days, and at the day-off
    // time on holidays and weekends.
    startMinutes: v.number(),
    dayOffStartMinutes: v.number(),
    // One uninterrupted study block length, shared by every subject.
    sessionMinutes: v.number(),
    // Topics, past papers, or a mix of both, for the whole plan.
    studyMethod: v.union(
      v.literal("topics"),
      v.literal("papers"),
      v.literal("mixed"),
    ),
    courseSettings: v.array(
      v.object({
        courseId: v.id("courses"),
        paper: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const start = dateKey(args.startDate);
    const exam = dateKey(args.examDate);
    if (!start || !exam) throw new Error("Choose a valid start and exam date.");
    if (parseDateKey(exam) <= parseDateKey(start)) {
      throw new Error("Your first exam needs to be after your start date.");
    }
    if (!DAYS_PER_WEEK.includes(args.daysPerWeek)) {
      throw new Error("Choose three, five, or seven revision days a week.");
    }
    if (!DAILY_LENGTHS.includes(args.dailyMinutes)) {
      throw new Error("Choose between 30 and 120 minutes of revision a day.");
    }
    if (!DAY_OFF_LENGTHS.includes(args.dayOffMinutes)) {
      throw new Error("Choose how much time you can give a day off.");
    }
    if (!SESSION_LENGTHS.includes(args.sessionMinutes)) {
      throw new Error("Choose how long one study session should be.");
    }
    if (!STUDY_METHODS.includes(args.studyMethod)) {
      throw new Error("Choose topics, past papers, or a mix of both.");
    }
    // A paper is a fixed one-hour task, so a day that studies papers needs room
    // for at least one whole paper.
    if (
      args.studyMethod !== "topics" &&
      (args.dailyMinutes < PAPER_MINUTES || args.dayOffMinutes < PAPER_MINUTES)
    ) {
      throw new Error(
        "A past paper takes an hour, so choose at least 60 minutes on a school day and on a day off.",
      );
    }
    const blockMinutes =
      args.studyMethod === "papers" ? PAPER_MINUTES : args.sessionMinutes;
    if (
      args.studyMethod !== "papers" &&
      args.sessionMinutes > args.dailyMinutes
    ) {
      throw new Error(
        "A session is longer than your school-day revision time. Choose a longer day or a shorter session.",
      );
    }
    if (
      args.studyMethod !== "papers" &&
      args.sessionMinutes > args.dayOffMinutes
    ) {
      throw new Error(
        "A session is longer than your day-off revision time. Choose a longer day off or a shorter session.",
      );
    }
    if (args.startMinutes + blockMinutes > LATEST_END_MINUTES) {
      throw new Error(
        `A ${blockMinutes}-minute session starting at ${formatClock(args.startMinutes)} would finish after 8pm. Start earlier or shorten the session.`,
      );
    }
    if (
      !Number.isInteger(args.startMinutes) ||
      args.startMinutes < 0 ||
      args.startMinutes > 23 * 60 + 30
    ) {
      throw new Error("Choose a start time for your school-day revision sessions.");
    }
    if (args.startMinutes >= LATEST_END_MINUTES) {
      throw new Error(
        "Revision has to start before 8pm. Choose an earlier start time.",
      );
    }
    if (
      !Number.isInteger(args.dayOffStartMinutes) ||
      args.dayOffStartMinutes < 0 ||
      args.dayOffStartMinutes > 23 * 60 + 30
    ) {
      throw new Error("Choose a start time for revision on days off.");
    }
    if (args.dayOffStartMinutes >= LATEST_END_MINUTES) {
      throw new Error(
        "Revision on days off has to start before 8pm. Choose an earlier start time.",
      );
    }
    if (args.dayOffStartMinutes + blockMinutes > LATEST_END_MINUTES) {
      throw new Error(
        `A ${blockMinutes}-minute session starting at ${formatClock(args.dayOffStartMinutes)} on a day off would finish after 8pm. Start earlier or shorten the session.`,
      );
    }
    if (args.courseSettings.length === 0) {
      throw new Error("Choose at least one course to revise.");
    }

    const settings = new Map<
      Id<"courses">,
      { courseId: Id<"courses">; paper: string }
    >();
    for (const setting of args.courseSettings) {
      if (settings.has(setting.courseId)) {
        throw new Error("Each course can only appear once in the timetable.");
      }
      if (!PAPERS.includes(setting.paper)) {
        throw new Error("Choose Paper 1, Paper 2, or Both for every course.");
      }
      settings.set(setting.courseId, setting);
    }

    const courseIds = [...settings.keys()];
    if (courseIds.length > 12) throw new Error("Choose no more than 12 courses.");

    const docs = await Promise.all(courseIds.map((id) => ctx.db.get(id)));
    const courses = docs.filter(
      (course): course is Doc<"courses"> =>
        Boolean(
          course &&
            course.userId === userId &&
            course.status === "ready" &&
            topicsFor(course).length > 0,
        ),
    );
    if (courses.length !== courseIds.length) {
      throw new Error(
        "One of those courses is still being built. Wait for its pathway to finish, then try again.",
      );
    }

    const ordered = courseIds
      .map((id) => courses.find((course) => course._id === id))
      .filter((course): course is Doc<"courses"> => Boolean(course));

    const topicTotal = ordered.reduce(
      (sum, course) => sum + topicsFor(course).length,
      0,
    );
    if (topicTotal === 0) {
      throw new Error("Those courses do not have any topics to schedule yet.");
    }

    const examDate = parseDateKey(exam);
    const weekdays = new Set(WEEKDAYS[args.daysPerWeek]!);

    /** Estimated whole sessions available from `from` until the exam. */
    const slotsFrom = (from: Date): number => {
      let slots = 0;
      for (
        let cursor = from;
        cursor < examDate;
        cursor = addDays(cursor, 1)
      ) {
        if (!weekdays.has(cursor.getUTCDay())) continue;
        const off = isDayOff(cursor);
        const start = off ? args.dayOffStartMinutes : args.startMinutes;
        if (start >= LATEST_END_MINUTES) continue;
        const budget = off ? args.dayOffMinutes : args.dailyMinutes;
        slots += dayBlocks(
          args.studyMethod,
          Math.min(budget, LATEST_END_MINUTES - start),
          args.sessionMinutes,
          0,
        ).length;
      }
      return slots;
    };

    // Start on the date the student picked. If every topic will not fit before
    // the exam, begin a day earlier and try again (up to twelve weeks): the
    // honest fix is more days, not a silently incomplete plan. Never reach into
    // the past — today is the earliest start that means anything.
    let planStart = start;
    let daysEarlier = 0;
    const todayKey = toDateKey(new Date());
    let estimatedSlots = slotsFrom(parseDateKey(planStart));
    while (
      args.studyMethod === "topics" &&
      estimatedSlots < topicTotal &&
      daysEarlier < 84
    ) {
      const earlier = toDateKey(addDays(parseDateKey(planStart), -1));
      if (earlier < todayKey) break;
      planStart = earlier;
      estimatedSlots = slotsFrom(parseDateKey(planStart));
      daysEarlier += 1;
    }

    const existing = await ctx.db
      .query("revisionPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const plan of existing) {
      const days = await daysForPlan(ctx, plan._id);
      for (const day of days) {
        await ctx.db.delete(day._id);
      }
      await ctx.db.delete(plan._id);
    }

    const now = Date.now();
    const planId = await ctx.db.insert("revisionPlans", {
      userId,
      startDate: planStart,
      requestedStartDate: start,
      examDate: exam,
      studyMethod: args.studyMethod,
      dailyMinutes: args.dailyMinutes,
      dayOffMinutes: args.dayOffMinutes,
      startMinutes: args.startMinutes,
      dayOffStartMinutes: args.dayOffStartMinutes,
      sessionMinutes: args.sessionMinutes,
      daysPerWeek: args.daysPerWeek,
      courseSettings: ordered.map((course) => ({
        courseId: course._id,
        subject: course.subject,
        paper: settings.get(course._id)!.paper,
      })),
      blockedPeriods: [],
      // Days hold the actual sessions now. entries stays for older plans.
      entries: [],
      holidays: bankHolidaysBetween(parseDateKey(planStart), examDate),
      schoolHolidays: schoolHolidaysBetween(parseDateKey(planStart), examDate),
      topicTotal,
      scheduledTopics: 0,
      truncated:
        args.studyMethod === "topics" && estimatedSlots < topicTotal,
      createdAt: now,
      updatedAt: now,
    });

    // If the plan is already running, plan today straight away so the timetable
    // screen opens on real work rather than an empty state.
    const today = toDateKey(new Date());
    if (
      planStart <= today &&
      today < exam &&
      weekdays.has(parseDateKey(today).getUTCDay())
    ) {
      const planDoc = await ctx.db.get(planId);
      if (planDoc) {
        await generateDay(ctx, userId, planDoc, today, false);
      }
    }

    return {
      sessions: 0,
      topics: topicTotal,
      startDate: planStart,
      requestedStartDate: start,
      startedEarlier: planStart !== start,
    };
  },
});
