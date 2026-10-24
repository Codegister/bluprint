import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/requireUser";

/**
 * Revision timetables.
 *
 * The planner fills each revision day with several subject sessions, using the
 * duration chosen for that subject, until the day's time budget is used. A
 * school day gets the chosen budget; bank holidays, weekends and school
 * holidays get double, because there is no school day to work around. Sessions
 * are stored with start times so the frontend can render a real week grid
 * rather than a long list.
 */

const MAX_DAYS = 60;
// Extra weekend/holiday capacity means a plan can hold more sessions than the
// old flat-budget limit. The document stays comfortably below Convex's size
// limit even with a short session length across all 60 revision days.
const MAX_ENTRIES = 480;

const SESSION_LENGTHS = [25, 45, 60, 90];
const DAILY_LENGTHS = [30, 60, 90, 120];
// How much time a student can give a bank holiday, weekend or school holiday.
// It is asked for, not derived: half-term is not a constant multiple of a
// Tuesday evening.
const DAY_OFF_LENGTHS = [60, 90, 120, 180, 240];
const PAPERS = ["Paper 1", "Paper 2", "Both"];
const DAYS_PER_WEEK = [3, 5, 7];

// 0 = Sunday. Three-day plans use Monday/Wednesday/Friday so subjects are
// spaced rather than stacked on consecutive evenings.
const WEEKDAYS: Record<number, number[]> = {
  3: [1, 3, 5],
  5: [1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

type TopicEntry = {
  courseId: Id<"courses">;
  course: string;
  unit: string;
  topicId: string;
  topic: string;
};

type SubjectState = {
  courseId: Id<"courses">;
  subject: string;
  minutes: number;
  paper: string;
  topics: TopicEntry[];
  topicIndex: number;
  paperCount: number;
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
  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year += 1) {
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
/* School holidays (typical England term breaks)                               */
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

  addRange(lastMonday(year, 9), addDays(lastMonday(year, 9), 4), "Autumn half-term");
  addRange(
    mondayOnOrAfter(new Date(Date.UTC(year, 11, 19))),
    new Date(Date.UTC(year + 1, 0, 1)),
    "Christmas break",
  );
  const february = nthMonday(year, 1, 3);
  addRange(february, addDays(february, 4), "February half-term");
  const easter = easterSunday(year);
  addRange(addDays(easter, 1), addDays(easter, 14), "Easter break");
  addRange(lastMonday(year, 4), addDays(lastMonday(year, 4), 4), "May half-term");
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
  for (let year = start.getUTCFullYear() - 1; year <= end.getUTCFullYear(); year += 1) {
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
 * Capacity for a date: the school-day budget, or the day-off budget the
 * student chose in the builder. Nothing is assumed about holidays — someone
 * who can only manage an hour at the weekend says so, and someone with a free
 * half-term chooses a longer day instead.
 */
function dailyCapacity(
  date: Date,
  schoolDayMinutes: number,
  dayOffMinutes: number,
): number {
  const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
  const isDayOff =
    isWeekend ||
    schoolHolidayName(date) !== null ||
    bankHolidayName(date) !== null;
  return isDayOff ? dayOffMinutes : schoolDayMinutes;
}

/* -------------------------------------------------------------------------- */
/* Scheduling                                                                  */
/* -------------------------------------------------------------------------- */

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

/**
 * Fills one day up to `dailyMinutes` of study, rotating through subjects. Each
 * subject's own session length is respected; a subject that no longer fits is
 * skipped until the next day. Starting the rotation at a different subject each
 * day stops the same subject always occupying the first slot.
 *
 * Sessions are never back to back: the clock advances by the session plus a
 * break of the same length, so a 45-minute session is followed by 45 minutes
 * off before the next subject. Breaks sit outside the study budget — the
 * student asked for the amount of studying, not the amount of sitting at a desk.
 */
function scheduleDay(
  states: SubjectState[],
  dailyMinutes: number,
  startMinutes: number,
  dayIndex: number,
) {
  let remaining = dailyMinutes;
  let clock = startMinutes;
  let cursor = states.length > 0 ? dayIndex % states.length : 0;
  const sessions: Array<
    TopicEntry & {
      minutes: number;
      paper: string;
      startMinutes: number;
      breakMinutes: number;
    }
  > = [];

  while (remaining >= Math.min(...states.map((state) => state.minutes))) {
    let picked = -1;
    for (let offset = 0; offset < states.length; offset += 1) {
      const index = (cursor + offset) % states.length;
      const state = states[index];
      if (state.topics.length > 0 && state.minutes <= remaining) {
        picked = index;
        break;
      }
    }
    if (picked === -1) break;

    const state = states[picked];
    const topic = state.topics[state.topicIndex % state.topics.length];
    const paper =
      state.paper === "Both"
        ? state.paperCount % 2 === 0
          ? "Paper 1"
          : "Paper 2"
        : state.paper;

    sessions.push({
      ...topic,
      minutes: state.minutes,
      paper,
      startMinutes: clock,
      breakMinutes: 0,
    });

    state.topicIndex += 1;
    state.paperCount += 1;
    // The break after this session is the same length as the session itself.
    clock += state.minutes * 2;
    remaining -= state.minutes;
    cursor = (picked + 1) % states.length;
  }

  // A break only exists between two sessions, so the day's last one has none.
  for (let index = 0; index < sessions.length - 1; index += 1) {
    sessions[index]!.breakMinutes = sessions[index]!.minutes;
  }

  return sessions;
}

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

/**
 * Replaces the account's timetable with a new plan. The plan is built fully
 * before the old one is deleted, so a validation failure cannot leave the
 * student without a timetable.
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
    startMinutes: v.number(),
    courseSettings: v.array(
      v.object({
        courseId: v.id("courses"),
        minutes: v.number(),
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
    if (
      !Number.isInteger(args.startMinutes) ||
      args.startMinutes < 0 ||
      args.startMinutes > 23 * 60 + 30
    ) {
      throw new Error("Choose a start time for your revision sessions.");
    }
    if (args.courseSettings.length === 0) {
      throw new Error("Choose at least one course to revise.");
    }

    const settings = new Map<
      Id<"courses">,
      { courseId: Id<"courses">; minutes: number; paper: string }
    >();
    for (const setting of args.courseSettings) {
      if (settings.has(setting.courseId)) {
        throw new Error("Each course can only appear once in the timetable.");
      }
      if (!SESSION_LENGTHS.includes(setting.minutes)) {
        throw new Error("Choose a valid session length for every course.");
      }
      if (!PAPERS.includes(setting.paper)) {
        throw new Error("Choose Paper 1, Paper 2, or Both for every course.");
      }
      if (setting.minutes > args.dailyMinutes) {
        throw new Error(
          "A subject's session is longer than your daily revision time. Lower that subject's session length.",
        );
      }
      if (setting.minutes > args.dayOffMinutes) {
        throw new Error(
          "A subject's session is longer than your day-off revision time. Raise that day's time or lower the session length.",
        );
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

    const courseSettings = ordered.map((course) => ({
      course,
      setting: settings.get(course._id)!,
    }));
    const topicTotal = ordered.reduce(
      (sum, course) => sum + topicsFor(course).length,
      0,
    );
    if (topicTotal === 0) {
      throw new Error("Those courses do not have any topics to schedule yet.");
    }

    const weekdays = new Set(WEEKDAYS[args.daysPerWeek]);
    const examDate = parseDateKey(exam);
    type PlannedEntry = {
      date: string;
      courseId: Id<"courses">;
      course: string;
      unit: string;
      topicId: string;
      topic: string;
      minutes: number;
      paper: string;
      startMinutes: number;
      breakMinutes: number;
    };

    /** One full pass from a start date, with fresh per-subject cursors. */
    const planFrom = (from: Date) => {
      const states: SubjectState[] = courseSettings.map(({ course, setting }) => ({
        courseId: course._id,
        subject: course.subject,
        minutes: setting.minutes,
        paper: setting.paper,
        topics: topicsFor(course),
        topicIndex: 0,
        paperCount: 0,
      }));
      const entries: PlannedEntry[] = [];
      let cursor = from;
      let revisionDays = 0;
      let truncated = false;

      while (cursor < examDate) {
        if (weekdays.has(cursor.getUTCDay())) {
          if (revisionDays >= MAX_DAYS || entries.length >= MAX_ENTRIES) {
            truncated = true;
            break;
          }
          const sessions = scheduleDay(
            states,
            dailyCapacity(cursor, args.dailyMinutes, args.dayOffMinutes),
            args.startMinutes,
            revisionDays,
          );
          revisionDays += 1;
          for (const session of sessions) {
            entries.push({ date: toDateKey(cursor), ...session });
          }
        }
        cursor = addDays(cursor, 1);
      }

      return {
        entries,
        truncated,
        scheduledTopics: new Set(
          entries.map((entry) => `${entry.courseId}:${entry.topicId}`),
        ).size,
      };
    };

    // Start on the date the student picked. If every topic will not fit before
    // the exam, begin a day earlier and try again (up to twelve weeks): the
    // honest fix is more days, not a silently incomplete plan. Never reach into
    // the past — today is the earliest start that means anything, and the rep
    // plan uses the weekday pattern the student chose.
    let planStart = start;
    let planned = planFrom(parseDateKey(planStart));
    let daysEarlier = 0;
    const todayKey = toDateKey(new Date());
    while (planned.scheduledTopics < topicTotal && daysEarlier < 84) {
      const earlier = toDateKey(addDays(parseDateKey(planStart), -1));
      if (earlier < todayKey) break;
      planStart = earlier;
      planned = planFrom(parseDateKey(planStart));
      daysEarlier += 1;
    }
    const { entries, truncated, scheduledTopics } = planned;

    if (entries.length === 0) {
      throw new Error(
        "There are no revision days before your first exam. Choose a later exam date or more revision days.",
      );
    }

    const existing = await ctx.db
      .query("revisionPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const plan of existing) {
      await ctx.db.delete(plan._id);
    }

    const now = Date.now();
    await ctx.db.insert("revisionPlans", {
      userId,
      startDate: planStart,
      requestedStartDate: start,
      examDate: exam,
      dailyMinutes: args.dailyMinutes,
      dayOffMinutes: args.dayOffMinutes,
      startMinutes: args.startMinutes,
      daysPerWeek: args.daysPerWeek,
      courseSettings: ordered.map((course) => {
        const setting = settings.get(course._id)!;
        return {
          courseId: course._id,
          subject: course.subject,
          minutes: setting.minutes,
          paper: setting.paper,
        };
      }),
      entries,
      holidays: bankHolidaysBetween(parseDateKey(planStart), examDate),
      schoolHolidays: schoolHolidaysBetween(parseDateKey(planStart), examDate),
      topicTotal,
      scheduledTopics,
      truncated,
      createdAt: now,
      updatedAt: now,
    });

    return {
      sessions: entries.length,
      topics: topicTotal,
      startDate: planStart,
      requestedStartDate: start,
      startedEarlier: planStart !== start,
    };
  },
});
