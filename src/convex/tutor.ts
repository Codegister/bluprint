import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { requireUserId } from "./lib/requireUser";

/**
 * Saved AI tutor threads, one per study set.
 *
 * The browser only reads a thread through `listMessages`, which returns no
 * note text and nothing belonging to another account. The Node action in
 * `ai.ts` asks for a bounded slice of history before calling NVIDIA, then
 * saves the question and answer together so a failed call never leaves a
 * half-written conversation.
 */

/** How many previous turns are replayed as context for the next answer. */
const HISTORY_LIMIT = 10;

/**
 * `_creationTime` can tie for rows inserted in one transaction, so the saved
 * `createdAt` decides the order and the student's question always precedes the
 * reply.
 */
function inConversationOrder<
  T extends { createdAt: number; role: "user" | "assistant"; _creationTime: number },
>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      a.createdAt - b.createdAt ||
      a._creationTime - b._creationTime ||
      (a.role === "user" ? -1 : 1),
  );
}

export const listMessages = query({
  args: { setId: v.id("studySets") },
  handler: async (ctx, { setId }) => {
    const userId = await requireUserId(ctx);
    const set = await ctx.db.get(setId);
    // A set that belongs to someone else reads as an empty conversation
    // rather than an error, so an old link cannot confirm it exists.
    if (!set || set.userId !== userId) return [];

    const rows = await ctx.db
      .query("tutorMessages")
      .withIndex("by_set", (q) => q.eq("setId", setId))
      .order("asc")
      .collect();

    return inConversationOrder(rows).map((row) => ({
      _id: row._id,
      role: row.role,
      content: row.content,
      createdAt: row.createdAt,
      streaming: row.streaming ?? false,
      sources: row.sources ?? [],
    }));
  },
});

/** Everything the action needs: the set's material plus recent turns. */
export const getTutorContext = internalQuery({
  args: { setId: v.id("studySets"), userId: v.id("users") },
  handler: async (ctx, { setId, userId }) => {
    const set = await ctx.db.get(setId);
    if (!set || set.userId !== userId) return null;

    const rows = await ctx.db
      .query("tutorMessages")
      .withIndex("by_set", (q) => q.eq("setId", setId))
      .order("asc")
      .collect();

    return {
      set: {
        title: set.title,
        notes: set.notes,
        course: set.course,
        examBoard: set.examBoard,
        level: set.level,
      },
      messages: inConversationOrder(rows.filter((row) => !row.streaming))
        .slice(-HISTORY_LIMIT)
        .map((row) => ({ role: row.role, content: row.content })),
    };
  },
});

/**
 * Course and unit threads share one table and are separated by `unitTitle`:
 * a missing title is the whole-course conversation, a present one is that
 * unit's conversation. The two never see each other's history.
 */
function sameScope(
  row: { unitTitle?: string },
  unitTitle: string | undefined,
): boolean {
  return (row.unitTitle ?? null) === (unitTitle ?? null);
}

/** Everything the course-scoped tutor has been asked, newest last. */
export const listCourseMessages = query({
  args: { courseId: v.id("courses"), unitTitle: v.optional(v.string()) },
  handler: async (ctx, { courseId, unitTitle }) => {
    const userId = await requireUserId(ctx);
    const course = await ctx.db.get(courseId);
    if (!course || course.userId !== userId) return [];

    const rows = await ctx.db
      .query("courseTutorMessages")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();

    return inConversationOrder(rows.filter((row) => sameScope(row, unitTitle))).map(
      (row) => ({
        _id: row._id,
        role: row.role,
        content: row.content,
        createdAt: row.createdAt,
        streaming: row.streaming ?? false,
        sources: row.sources ?? [],
      }),
    );
  },
});

/**
 * The material the course-scoped tutor explains from: the whole pathway for a
 * course question, or one unit's topics for a unit question. Guided by the
 * same "only what the specification publishes" rule as the pathway itself.
 */
export const getCourseTutorContext = internalQuery({
  args: {
    courseId: v.id("courses"),
    unitTitle: v.optional(v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, { courseId, unitTitle, userId }) => {
    const course = await ctx.db.get(courseId);
    if (!course || course.userId !== userId) return null;
    const pathway = course.pathway;
    if (!pathway) return null;

    const unit = unitTitle
      ? pathway.units.find((entry) => entry.title === unitTitle)
      : undefined;
    if (unitTitle && !unit) return null;

    const header = [
      `Course: ${course.level} ${course.subject} (${course.examBoard})`,
      course.tier ? `Tier: ${course.tier}` : "",
      `How it is assessed: ${pathway.examFormat}`,
      unit ? `Unit: ${unit.title}` : `Course overview: ${pathway.overview}`,
    ]
      .filter(Boolean)
      .join("\n");

    const sections = unit
      ? [unit]
      : pathway.units.map((entry) => ({
          ...entry,
          // Whole-course questions need the shape of every unit without
          // replaying every key point, so topics are summarised by title.
          topics: entry.topics.map((topic) => ({
            ...topic,
            keyPoints: [],
            summary: topic.summary.slice(0, 240),
          })),
        }));

    const body = sections
      .map((entry) => {
        const topics = entry.topics
          .map((topic) =>
            [
              `- ${topic.title}${topic.specReference ? ` (${topic.specReference})` : ""}`,
              `  ${topic.summary}`,
              ...topic.keyPoints.map((point) => `  * ${point}`),
              topic.examSkill ? `  Exam skill: ${topic.examSkill}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n");
        return `## ${entry.title}\n${entry.summary}\n${topics}`;
      })
      .join("\n\n");

    const rows = await ctx.db
      .query("courseTutorMessages")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();

    return {
      title: unit ? `${course.subject} · ${unit.title}` : course.subject,
      material: `${header}\n\n${body}`.slice(0, 16_000),
      course: course.subject,
      examBoard: course.examBoard,
      level: course.level,
      messages: inConversationOrder(
        rows.filter((row) => sameScope(row, unitTitle) && !row.streaming),
      )
        .slice(-HISTORY_LIMIT)
        .map((row) => ({ role: row.role, content: row.content })),
    };
  },
});

/* -------------------------------------------------------------------------- */
/* Streaming replies                                                          */
/* -------------------------------------------------------------------------- */

/**
 * A reply is written as it arrives: the question and an empty assistant row are
 * saved first, the action appends tokens to that row, and the row is marked
 * complete at the end. If the action dies, the next question deletes the
 * half-written row, so a crash never leaves a conversation mid-sentence.
 */
const MAX_ANSWER_CHARS = 8000;
const MAX_QUESTION_CHARS = 1200;

/** Persists the question and opens an empty reply for the streaming action. */
export const beginTutorExchange = internalMutation({
  args: {
    setId: v.id("studySets"),
    userId: v.id("users"),
    question: v.string(),
  },
  handler: async (ctx, { setId, userId, question }) => {
    const set = await ctx.db.get(setId);
    if (!set || set.userId !== userId) throw new Error("Study set not found.");

    const existing = await ctx.db
      .query("tutorMessages")
      .withIndex("by_set", (q) => q.eq("setId", setId))
      .collect();
    for (const row of existing) {
      if (row.streaming) await ctx.db.delete(row._id);
    }

    const now = Date.now();
    await ctx.db.insert("tutorMessages", {
      setId,
      userId,
      role: "user",
      content: question.slice(0, MAX_QUESTION_CHARS),
      createdAt: now,
    });
    return await ctx.db.insert("tutorMessages", {
      setId,
      userId,
      role: "assistant",
      content: "",
      createdAt: now + 1,
      streaming: true,
    });
  },
});

/** Replaces the streaming reply's text (and sources, once the search is done). */
export const appendTutorAnswer = internalMutation({
  args: {
    messageId: v.id("tutorMessages"),
    content: v.string(),
    sources: v.optional(v.array(v.object({ title: v.string(), url: v.string() }))),
  },
  handler: async (ctx, { messageId, content, sources }) => {
    const row = await ctx.db.get(messageId);
    if (!row) return;
    await ctx.db.patch(messageId, {
      content: content.slice(0, MAX_ANSWER_CHARS),
      ...(sources === undefined ? {} : { sources }),
    });
  },
});

/** Marks a reply finished and keeps the deck near the top of "Jump back in". */
export const finishTutorExchange = internalMutation({
  args: { messageId: v.id("tutorMessages") },
  handler: async (ctx, { messageId }) => {
    const row = await ctx.db.get(messageId);
    if (!row) return;
    const now = Date.now();
    await ctx.db.patch(messageId, { streaming: false });
    await ctx.db.patch(row.setId, { lastStudiedAt: now, updatedAt: now });
  },
});

/** Drops a reply that failed, leaving the question saved for a retry. */
export const discardTutorAnswer = internalMutation({
  args: { messageId: v.id("tutorMessages") },
  handler: async (ctx, { messageId }) => {
    await ctx.db.delete(messageId);
  },
});

/** Course-scoped equivalent of `beginTutorExchange`. */
export const beginCourseTutorExchange = internalMutation({
  args: {
    courseId: v.id("courses"),
    userId: v.id("users"),
    unitTitle: v.optional(v.string()),
    question: v.string(),
  },
  handler: async (ctx, { courseId, userId, unitTitle, question }) => {
    const course = await ctx.db.get(courseId);
    if (!course || course.userId !== userId) throw new Error("Course not found.");

    const existing = await ctx.db
      .query("courseTutorMessages")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    for (const row of existing) {
      if (row.streaming && sameScope(row, unitTitle)) {
        await ctx.db.delete(row._id);
      }
    }

    const now = Date.now();
    const scope = unitTitle ? { unitTitle } : {};
    await ctx.db.insert("courseTutorMessages", {
      courseId,
      userId,
      role: "user",
      content: question.slice(0, MAX_QUESTION_CHARS),
      createdAt: now,
      ...scope,
    });
    return await ctx.db.insert("courseTutorMessages", {
      courseId,
      userId,
      role: "assistant",
      content: "",
      createdAt: now + 1,
      streaming: true,
      ...scope,
    });
  },
});

export const appendCourseTutorAnswer = internalMutation({
  args: {
    messageId: v.id("courseTutorMessages"),
    content: v.string(),
    sources: v.optional(v.array(v.object({ title: v.string(), url: v.string() }))),
  },
  handler: async (ctx, { messageId, content, sources }) => {
    const row = await ctx.db.get(messageId);
    if (!row) return;
    await ctx.db.patch(messageId, {
      content: content.slice(0, MAX_ANSWER_CHARS),
      ...(sources === undefined ? {} : { sources }),
    });
  },
});

export const finishCourseTutorExchange = internalMutation({
  args: { messageId: v.id("courseTutorMessages") },
  handler: async (ctx, { messageId }) => {
    const row = await ctx.db.get(messageId);
    if (!row) return;
    const now = Date.now();
    await ctx.db.patch(messageId, { streaming: false });
    await ctx.db.patch(row.courseId, { lastStudiedAt: now, updatedAt: now });
  },
});

export const discardCourseTutorAnswer = internalMutation({
  args: { messageId: v.id("courseTutorMessages") },
  handler: async (ctx, { messageId }) => {
    await ctx.db.delete(messageId);
  },
});

