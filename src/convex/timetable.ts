import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/requireUser";

/**
 * Revision timetables.
 *
 * A plan is deliberately deterministic: the student supplies their courses,
 * session length, revision days and first exam date, and the server lays out
 * one topic per revision day. This keeps the timetable instant and reliable,
 * and every entry points back to a real course topic that can be turned into a
 * study set with one tap.
 */

const MAX_COURSES = 12;
const MAX_SESSIONS = 60;
const SESSION_MINUTES = [25, 45, 60, 90];
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
 * Round-robin the selected courses so a five-subject plan does not put every
 * Biology topic back to back. Topics that are not revised are still included;
 * the plan is a first pass through the material.
 */
function interleaveTopics(courses: Doc<"courses">[]): TopicEntry[] {
  const groups = courses.map(topicsFor).filter((group) => group.length > 0);
  if (groups.length === 0) return [];

  const longest = Math.max(...groups.map((group) => group.length));
  const pool: TopicEntry[] = [];
  for (let index = 0; index < longest; index += 1) {
    for (const group of groups) {
      const entry = group[index];
      if (entry) pool.push(entry);
    }
  }
  return pool;
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
 * Replaces the account's timetable with a new plan. Rebuilding is destructive
 * by design: there is one current plan, so an old schedule cannot linger and
 * compete with the new one in the sidebar.
 */
export const build = mutation({
  args: {
    startDate: v.string(),
    examDate: v.string(),
    sessionMinutes: v.number(),
    daysPerWeek: v.number(),
    courseIds: v.array(v.id("courses")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const start = dateKey(args.startDate);
    const exam = dateKey(args.examDate);
    if (!start || !exam) throw new Error("Choose a valid start and exam date.");
    if (parseDateKey(exam) <= parseDateKey(start)) {
      throw new Error("Your first exam needs to be after your start date.");
    }
    if (!SESSION_MINUTES.includes(args.sessionMinutes)) {
      throw new Error("Choose a session length between 25 and 90 minutes.");
    }
    if (!DAYS_PER_WEEK.includes(args.daysPerWeek)) {
      throw new Error("Choose three, five, or seven revision days a week.");
    }

    const courseIds = [...new Set(args.courseIds)].slice(0, MAX_COURSES);
    if (courseIds.length === 0) {
      throw new Error("Choose at least one course to revise.");
    }

    const docs = await Promise.all(courseIds.map((id) => ctx.db.get(id)));
    const courses = docs.filter(
      (course): course is Doc<"courses"> =>
        Boolean(
          course &&
            course.userId === userId &&
            course.status === "ready" &&
            course.pathway &&
            topicsFor(course).length > 0,
        ),
    );
    if (courses.length !== courseIds.length) {
      throw new Error(
        "One of those courses is still being built. Wait for its pathway to finish, then try again.",
      );
    }
    // Keep the student's chosen order so the first session follows the order
    // they picked in the setup form.
    const ordered = courseIds
      .map((id) => courses.find((course) => course._id === id))
      .filter((course): course is Doc<"courses"> => Boolean(course));

    const topics = interleaveTopics(ordered);
    if (topics.length === 0) {
      throw new Error("Those courses do not have any topics to schedule yet.");
    }

    const weekdays = new Set(WEEKDAYS[args.daysPerWeek]);
    const dates: string[] = [];
    let cursor = parseDateKey(start);
    let truncated = false;
    const examDate = parseDateKey(exam);

    while (cursor < examDate) {
      if (weekdays.has(cursor.getUTCDay())) {
        if (dates.length >= MAX_SESSIONS) {
          truncated = true;
          break;
        }
        dates.push(toDateKey(cursor));
      }
      cursor = addDays(cursor, 1);
    }

    if (dates.length === 0) {
      throw new Error(
        "There are no revision days before your first exam. Choose a later exam date or more revision days.",
      );
    }

    const entries = dates.map((date, index) => {
      // If there are more revision days than topics, cycle back through the
      // material for a second pass. The same topic still opens the same set.
      const topic = topics[index % topics.length];
      return {
        date,
        courseId: topic.courseId,
        course: topic.course,
        unit: topic.unit,
        topicId: topic.topicId,
        topic: topic.topic,
        minutes: args.sessionMinutes,
      };
    });

    const scheduledTopics = new Set(
      entries.map((entry) => `${entry.courseId}:${entry.topicId}`),
    ).size;

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
      startDate: start,
      examDate: exam,
      sessionMinutes: args.sessionMinutes,
      daysPerWeek: args.daysPerWeek,
      entries,
      topicTotal: topics.length,
      scheduledTopics,
      truncated,
      createdAt: now,
      updatedAt: now,
    });

    return { sessions: entries.length, topics: topics.length };
  },
});
