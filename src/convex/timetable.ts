import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/requireUser";

/**
 * Revision timetables.
 *
 * The planner fills each revision day with whole sessions plus a short final
 * block until the day's study budget is actually spent. A school day uses the
 * chosen school-day budget, and bank holidays, weekends and school holidays use
 * the day-off budget and start time the student chose. Sessions are stored with
 * start times so the frontend can render a real week grid rather than a long
 * list.
 */

const MAX_DAYS = 60;
// Extra weekend/holiday capacity means a plan can hold more sessions than the
// old flat-budget limit. The document stays comfortably below Convex's size
// limit even with a short session length across all 60 revision days.
const MAX_ENTRIES = 720;

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
 * life, and a plan that runs to midnight is one nobody follows. Sessions that
 * would cross this line are left for the next day (or the plan starts a day
 * earlier when it needs the extra capacity).
 */
const LATEST_END_MINUTES = 20 * 60;

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

type ScheduledPaper = { paperId?: Id<"pastPapers">; title: string };

type SubjectState = {
  courseId: Id<"courses">;
  subject: string;
  paper: string;
  topics: TopicEntry[];
  topicIndex: number;
  // Saved papers for this course, used in order by paper sessions. A course
  // with none still gets a paper session, labelled "Past paper practice".
  papers: ScheduledPaper[];
  paperIndex: number;
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

/** 24-hour clock used in validation messages, e.g. 19:30. */
function formatClock(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
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
 * True when the student is not at school that day: a weekend, a bank holiday
 * or a school holiday. Those days use the day-off budget and start time the
 * student chose, not a multiple of a school evening.
 */
function isDayOff(date: Date): boolean {
  const weekday = date.getUTCDay();
  if (weekday === 0 || weekday === 6) return true;
  return schoolHolidayName(date) !== null || bankHolidayName(date) !== null;
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

// Sessions are separated by one equal gap, not by a break as long as the
// session. Twenty minutes is the most, so a short evening is not spread across
// the whole afternoon, and a tight one uses whatever room it has.
const MAX_GAP_MINUTES = 20;
// Anything shorter than this is not worth a session of its own.
const MIN_BLOCK_MINUTES = 10;

/**
 * One day's study blocks. Whole sessions fill the budget, and a short final
 * block takes whatever is left when the budget does not divide exactly — a
 * two-hour evening of 25-minute sessions is four sessions plus twenty minutes,
 * not the 100 minutes that used to be scheduled.
 */
function studyBlocks(budgetMinutes: number, sessionMinutes: number): number[] {
  const blocks: number[] = [];
  let remaining = budgetMinutes;
  while (remaining >= sessionMinutes) {
    blocks.push(sessionMinutes);
    remaining -= sessionMinutes;
  }
  if (remaining >= MIN_BLOCK_MINUTES) blocks.push(remaining);
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
  // Mixed plans alternate which kind of block starts the day, so a short day
  // still mixes topics and papers across the plan instead of only ever papers.
  dayIndex = 0,
): StudyBlock[] {
  if (method === "topics") {
    return studyBlocks(budgetMinutes, sessionMinutes).map((minutes) => ({
      kind: "topic" as const,
      minutes,
    }));
  }

  if (method === "papers") {
    const count = Math.floor(budgetMinutes / PAPER_MINUTES);
    return Array.from({ length: count }, () => ({
      kind: "paper" as const,
      minutes: PAPER_MINUTES,
    }));
  }

  const blocks: StudyBlock[] = [];
  let remaining = budgetMinutes;
  let kind: "topic" | "paper" = dayIndex % 2 === 0 ? "paper" : "topic";
  while (remaining > 0) {
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
  // Whatever is left of the budget still goes to study, as a short topic block.
  if (remaining >= MIN_BLOCK_MINUTES) {
    blocks.push({ kind: "topic", minutes: remaining });
  }
  return blocks;
}

/**
 * Fills one day up to its budget, rotating through subjects. Starting the
 * rotation at a different subject each day stops the same subject always
 * occupying the first slot.
 *
 * The chosen budget is actually spent: every whole session plus the leftover
 * block is scheduled, and the sessions are spaced out with one equal gap
 * between them. Nothing runs past 8pm, so a start time too late for the whole
 * budget is filled from the time that is left instead of pretending the day is
 * longer.
 */
function scheduleDay(
  states: SubjectState[],
  capacityMinutes: number,
  startMinutes: number,
  dayIndex: number,
  // Every session is the same length. The student chooses one study block
  // length, not a different one per subject.
  sessionMinutes: number,
  // Topics only, past papers only, or a mix of the two.
  method: StudyMethod,
) {
  // A chosen start time at or after 8pm can never produce a session.
  if (startMinutes >= LATEST_END_MINUTES) return [];
  const window = LATEST_END_MINUTES - startMinutes;

  // A late start gives less room before 8pm, so the blocks are sized from the
  // time that actually exists rather than planning a day that cannot happen.
  const blocks = dayBlocks(
    method,
    Math.min(capacityMinutes, window),
    sessionMinutes,
    dayIndex,
  );
  if (blocks.length === 0) return [];

  const studyMinutes = blocks.reduce((sum, block) => sum + block.minutes, 0);
  // Equal spacing: whatever the 8pm limit leaves is shared between the gaps.
  const gapMinutes =
    blocks.length > 1
      ? Math.min(
          MAX_GAP_MINUTES,
          Math.max(0, Math.floor((window - studyMinutes) / (blocks.length - 1))),
        )
      : 0;

  let clock = startMinutes;
  let cursor = states.length > 0 ? dayIndex % states.length : 0;
  const sessions: Array<
    TopicEntry & {
      minutes: number;
      paper: string;
      startMinutes: number;
      kind: "topic" | "paper";
      paperId?: Id<"pastPapers">;
    }
  > = [];

  for (const block of blocks) {
    if (clock + block.minutes > LATEST_END_MINUTES) break;
    let picked = -1;
    for (let offset = 0; offset < states.length; offset += 1) {
      const index = (cursor + offset) % states.length;
      if (states[index]!.topics.length > 0) {
        picked = index;
        break;
      }
    }
    if (picked === -1) break;

    const state = states[picked]!;
    const paper =
      state.paper === "Both"
        ? state.paperCount % 2 === 0
          ? "Paper 1"
          : "Paper 2"
        : state.paper;
    state.paperCount += 1;

    if (block.kind === "paper") {
      const saved = state.papers[state.paperIndex % state.papers.length];
      if (!saved) break;
      state.paperIndex += 1;
      sessions.push({
        courseId: state.courseId,
        course: state.subject,
        unit: "Past paper",
        topicId: `paper:${state.courseId}:${state.paperIndex}`,
        topic: saved.title,
        minutes: block.minutes,
        paper,
        startMinutes: clock,
        kind: "paper",
        ...(saved.paperId ? { paperId: saved.paperId } : {}),
      });
    } else {
      const topic = state.topics[state.topicIndex % state.topics.length]!;
      state.topicIndex += 1;
      sessions.push({
        ...topic,
        minutes: block.minutes,
        paper,
        startMinutes: clock,
        kind: "topic",
      });
    }

    clock += block.minutes + gapMinutes;
    cursor = (picked + 1) % states.length;
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
    // Session length is unused by a papers-only plan, where every block is one
    // hour. Mixed plans still use it for their topic blocks.
    const blockMinutes =
      args.studyMethod === "papers" ? PAPER_MINUTES : args.sessionMinutes;
    if (args.studyMethod !== "papers" && args.sessionMinutes > args.dailyMinutes) {
      throw new Error(
        "A session is longer than your school-day revision time. Choose a longer day or a shorter session.",
      );
    }
    if (args.studyMethod !== "papers" && args.sessionMinutes > args.dayOffMinutes) {
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
      throw new Error("Revision has to start before 8pm. Choose an earlier start time.");
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
      kind: "topic" | "paper";
      paperId?: Id<"pastPapers">;
    };

    // Saved papers are read once so a paper session links to the paper the
    // student can actually practise. A course with none still gets a labelled
    // slot, and the course page is where a paper can be built.
    const paperLists = await Promise.all(
      ordered.map((course) =>
        ctx.db
          .query("pastPapers")
          .withIndex("by_course", (q) => q.eq("courseId", course._id))
          .collect(),
      ),
    );
    const savedByCourse = new Map<Id<"courses">, ScheduledPaper[]>(
      ordered.map((course, index) => [
        course._id,
        (paperLists[index] ?? [])
          .filter(
            (paper) =>
              paper.userId === userId &&
              paper.status === "ready" &&
              paper.questionCount > 0,
          )
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((paper) => ({ paperId: paper._id, title: paper.title })),
      ]),
    );
    const papersFor = (courseId: Id<"courses">): ScheduledPaper[] => {
      const saved = savedByCourse.get(courseId) ?? [];
      return saved.length > 0 ? saved : [{ title: "Past paper practice" }];
    };

    /** One full pass from a start date, with fresh per-subject cursors. */
    const planFrom = (from: Date) => {
      const states: SubjectState[] = courseSettings.map(({ course, setting }) => ({
        courseId: course._id,
        subject: course.subject,
        paper: setting.paper,
        topics: topicsFor(course),
        topicIndex: 0,
        papers: papersFor(course._id),
        paperIndex: 0,
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
          const off = isDayOff(cursor);
          const sessions = scheduleDay(
            states,
            off ? args.dayOffMinutes : args.dailyMinutes,
            off ? args.dayOffStartMinutes : args.startMinutes,
            revisionDays,
            args.sessionMinutes,
            args.studyMethod,
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
    // Only the topics route tries to cover every topic. Papers and mixed plans
    // are bounded by the time the student has, so they keep the chosen start.
    while (
      args.studyMethod === "topics" &&
      planned.scheduledTopics < topicTotal &&
      daysEarlier < 84
    ) {
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

    // Paper sessions are not pathway topics, so a paper or mixed plan reports
    // what it schedules instead of claiming to cover the topic list.
    const targetTotal =
      args.studyMethod === "topics" ? topicTotal : entries.length;
    const plannedTotal =
      args.studyMethod === "topics" ? scheduledTopics : entries.length;

    const now = Date.now();
    await ctx.db.insert("revisionPlans", {
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
      courseSettings: ordered.map((course) => {
        const setting = settings.get(course._id)!;
        return {
          courseId: course._id,
          subject: course.subject,
          paper: setting.paper,
        };
      }),
      entries,
      holidays: bankHolidaysBetween(parseDateKey(planStart), examDate),
      schoolHolidays: schoolHolidaysBetween(parseDateKey(planStart), examDate),
      topicTotal: targetTotal,
      scheduledTopics: plannedTotal,
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
