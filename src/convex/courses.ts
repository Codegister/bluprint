import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireUserId } from "./lib/requireUser";

/**
 * Course pathways: the second way into Bluprint.
 *
 * A student picks a level, exam board and several subjects. Each course is
 * stored immediately as `queued`, then a scheduled action maps the
 * specification with a larger model. The page subscribes to the course row, so
 * every pathway appears as it finishes without the browser holding a request
 * open.
 */

const MAX_COURSES_PER_SETUP = 12;

function topicIds(pathway: { units: Array<{ topics: Array<{ id: string }> }> } | undefined) {
  if (!pathway) return new Set<string>();
  return new Set(pathway.units.flatMap((unit) => unit.topics.map((topic) => topic.id)));
}

function countTopics(pathway: { units: Array<{ topics: Array<unknown> }> } | undefined) {
  if (!pathway) return 0;
  return pathway.units.reduce((sum, unit) => sum + unit.topics.length, 0);
}

/** The main screen's course table: one row per qualification, with progress. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const [courses, sets] = await Promise.all([
      ctx.db
        .query("courses")
        .withIndex("by_user_updated", (q) => q.eq("userId", userId))
        .order("desc")
        .collect(),
      ctx.db
        .query("studySets")
        .withIndex("by_user_updated", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    const now = Date.now();
    return courses.map((course) => {
      const linked = sets.filter((set) => set.courseId === course._id);
      const ids = topicIds(course.pathway);
      const completedCount = course.completedTopics.filter((id) => ids.has(id)).length;
      const cardCount = linked.reduce((sum, set) => sum + set.cardCount, 0);
      const knownCount = linked.reduce((sum, set) => sum + set.knownCount, 0);
      return {
        _id: course._id,
        subject: course.subject,
        level: course.level,
        examBoard: course.examBoard,
        tier: course.tier,
        variant: course.variant,
        poetryTheme: course.poetryTheme,
        status: course.status,
        progress: course.progress,
        errorMessage: course.errorMessage,
        processingStartedAt: course.processingStartedAt,
        topicCount: countTopics(course.pathway),
        completedCount,
        unitCount: course.pathway?.units.length ?? 0,
        setCount: linked.length,
        cardCount,
        knownCount,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
        lastStudiedAt: course.lastStudiedAt,
        isNew: now - course.createdAt < 7 * 86_400_000,
      };
    });
  },
});

/** A course workspace: the pathway, tick-off progress and linked study sets. */
export const getDetails = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const userId = await requireUserId(ctx);
    const course = await ctx.db.get(courseId);
    if (!course || course.userId !== userId) return null;

    const sets = await ctx.db
      .query("studySets")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .order("desc")
      .collect();

    const ids = topicIds(course.pathway);
    return {
      course,
      completedCount: course.completedTopics.filter((id) => ids.has(id)).length,
      topicCount: countTopics(course.pathway),
      sets: sets
        .filter((set) => set.userId === userId)
        .map((set) => ({
          _id: set._id,
          title: set.title,
          topicId: set.topicId,
          status: set.status,
          sourceType: set.sourceType,
          sourceLabel: set.sourceLabel,
          cardCount: set.cardCount,
          knownCount: set.knownCount,
          quizCount: set.quizCount,
          examCount: set.examCount,
          updatedAt: set.updatedAt,
        })),
      processingStale:
        course.status === "processing" &&
        (course.processingStartedAt === undefined ||
          Date.now() - course.processingStartedAt > 10 * 60 * 1000),
    };
  },
});

/**
 * Queues a batch of courses. The first build starts immediately and the rest
 * are staggered so a nine-course setup does not hit a free model's rate limit
 * all at once.
 */
export const createMany = mutation({
  args: {
    level: v.string(),
    examBoard: v.string(),
    courses: v.array(
      v.object({
        subject: v.string(),
        // Each subject may sit with a different board. The top-level board is
        // the fallback for anything that omits one.
        examBoard: v.optional(v.string()),
        tier: v.optional(v.string()),
        variant: v.optional(v.string()),
        poetryTheme: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const level = args.level.trim().slice(0, 40);
    const defaultBoard = args.examBoard.trim().slice(0, 60);
    if (!level) {
      throw new Error("Choose your level first.");
    }

    // GCSE defaults to Higher. The picker sends this explicitly, but enforcing
    // it here keeps older clients and direct calls consistent. GCSE routes are
    // separate subjects now, so drop any legacy Triple/Combined variant.
    const defaultTier = level === "GCSE" ? "Higher" : undefined;
    const requested = args.courses
      .map((course) => ({
        subject: course.subject.trim().slice(0, 80),
        examBoard:
          course.examBoard?.trim().slice(0, 60) || defaultBoard || undefined,
        tier: course.tier?.trim().slice(0, 40) || defaultTier,
        variant:
          level === "GCSE"
            ? undefined
            : course.variant?.trim().slice(0, 40) || undefined,
        poetryTheme: course.poetryTheme?.trim().slice(0, 80) || undefined,
      }))
      .filter((course) => course.subject.length > 0)
      .slice(0, MAX_COURSES_PER_SETUP);

    if (requested.length === 0) {
      throw new Error("Pick at least one course.");
    }
    if (requested.some((course) => !course.examBoard)) {
      throw new Error("Choose an exam board for every course.");
    }

    const existing = await ctx.db
      .query("courses")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .collect();
    const known = new Set(
      existing.map(
        (course) =>
          `${course.subject}|${course.level}|${course.examBoard}|${course.variant ?? ""}|${course.tier ?? ""}|${course.poetryTheme ?? ""}`.toLowerCase(),
      ),
    );

    const now = Date.now();
    const ids: Id<"courses">[] = [];
    for (const course of requested) {
      const key = `${course.subject}|${level}|${course.examBoard}|${course.variant ?? ""}|${course.tier ?? ""}|${course.poetryTheme ?? ""}`.toLowerCase();
      if (known.has(key)) continue;
      known.add(key);

      const courseId = await ctx.db.insert("courses", {
        userId,
        subject: course.subject,
        level,
        examBoard: course.examBoard!,
        tier: course.tier,
        variant: course.variant,
        poetryTheme: course.poetryTheme,
        status: "queued",
        progress: "Queued",
        completedTopics: [],
        createdAt: now,
        updatedAt: now,
      });
      ids.push(courseId);
    }

    // Stagger server-side builds. They continue even if the student closes the
    // tab, and the course page updates reactively when each one finishes.
    for (const [index, courseId] of ids.entries()) {
      await ctx.scheduler.runAfter(index * 10_000, internal.ai.buildCoursePathway, {
        courseId,
      });
    }

    return { ids, queued: ids.length, skipped: requested.length - ids.length };
  },
});

/** Ticks a topic off as revised, or clears the tick. */
export const setTopicDone = mutation({
  args: {
    courseId: v.id("courses"),
    topicId: v.string(),
    done: v.boolean(),
  },
  handler: async (ctx, { courseId, topicId, done }) => {
    const userId = await requireUserId(ctx);
    const course = await ctx.db.get(courseId);
    if (!course || course.userId !== userId) throw new Error("Course not found.");
    if (!topicIds(course.pathway).has(topicId)) {
      throw new Error("That topic is not part of this pathway.");
    }

    const completed = new Set(course.completedTopics);
    if (done) completed.add(topicId);
    else completed.delete(topicId);
    const now = Date.now();
    await ctx.db.patch(courseId, {
      completedTopics: [...completed],
      lastStudiedAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Creates the study set for one pathway topic. The pathway already contains a
 * summary, key points and exam skill, so those become the source material for
 * the normal summary/flashcards/quiz/exam pipeline.
 */
export const createTopicSet = mutation({
  args: {
    courseId: v.id("courses"),
    topicId: v.string(),
  },
  handler: async (ctx, { courseId, topicId }) => {
    const userId = await requireUserId(ctx);
    const course = await ctx.db.get(courseId);
    if (!course || course.userId !== userId) throw new Error("Course not found.");
    if (!course.pathway) throw new Error("This pathway is still being built.");

    const unit = course.pathway.units.find((entry) =>
      entry.topics.some((topic) => topic.id === topicId),
    );
    const topic = unit?.topics.find((entry) => entry.id === topicId);
    if (!unit || !topic) throw new Error("That topic is not part of this pathway.");

    // Reuse an existing set for this topic so repeated taps never create
    // duplicate decks.
    const existing = await ctx.db
      .query("studySets")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    const match = existing.find(
      (set) => set.userId === userId && set.topicId === topicId,
    );
    if (match) return { setId: match._id, created: false };

    const notes = [
      `Course: ${course.level} ${course.subject}`,
      `Exam board: ${course.examBoard}${course.variant ? ` · ${course.variant}` : ""}${course.tier ? ` · ${course.tier}` : ""}`,
      course.poetryTheme ? `Poetry theme: ${course.poetryTheme}` : "",
      `Unit: ${unit.title}`,
      `Topic: ${topic.title}${topic.specReference ? ` (specification ${topic.specReference})` : ""}`,
      unit.summary ? `Unit overview: ${unit.summary}` : "",
      topic.summary,
      "",
      "Key points:",
      ...topic.keyPoints.map((point) => `- ${point}`),
      topic.examSkill ? `\nExam skill: ${topic.examSkill}` : "",
      `\nCourse context: ${course.pathway.overview}`,
      "\nWrite revision material for this topic at the depth and command-word style of this qualification. Stay within the specification for this course.",
    ]
      .filter((line) => line !== "")
      .join("\n");

    const now = Date.now();
    const setId = await ctx.db.insert("studySets", {
      userId,
      title: topic.title.slice(0, 80),
      notes,
      sourceType: "text",
      sourceLabel: "Course pathway",
      course: course.subject,
      examBoard: course.examBoard,
      level: course.level,
      courseId,
      topicId,
      sourceImageIds: [],
      status: "queued",
      progress: "Queued",
      cardCount: 0,
      quizCount: 0,
      examCount: 0,
      targetCardCount: 20,
      targetQuizCount: 10,
      targetExamCount: 4,
      knownCount: 0,
      updatedAt: now,
    });

    await ctx.db.patch(courseId, { lastStudiedAt: now, updatedAt: now });
    return { setId, created: true };
  },
});

/**
 * Deletes the pathway, not the student's work. Study sets built from its topics
 * stay in the library and simply lose their course link.
 */
export const remove = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const userId = await requireUserId(ctx);
    const course = await ctx.db.get(courseId);
    if (!course || course.userId !== userId) throw new Error("Course not found.");

    const sets = await ctx.db
      .query("studySets")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    for (const set of sets) {
      if (set.userId === userId) {
        await ctx.db.patch(set._id, { courseId: undefined, topicId: undefined });
      }
    }
    await ctx.db.delete(courseId);
  },
});

// ---------------------------------------------------------------------------
// Action helpers
// ---------------------------------------------------------------------------

export const getForBuild = internalQuery({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    return await ctx.db.get(courseId);
  },
});

/**
 * Atomically takes ownership of a build. Two schedulers (a queued batch and a
 * manual retry) can otherwise build the same course twice and spend free-model
 * quota on a duplicate map.
 */
export const claimBuild = internalMutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const course = await ctx.db.get(courseId);
    if (!course || course.status === "ready") return { claimed: false };

    const now = Date.now();
    const running =
      course.status === "processing" &&
      course.processingStartedAt !== undefined &&
      now - course.processingStartedAt < 10 * 60 * 1000;
    if (running) return { claimed: false };

    await ctx.db.patch(courseId, {
      status: "processing",
      progress: "Mapping the specification…",
      errorMessage: undefined,
      processingStartedAt: now,
      updatedAt: now,
    });
    return { claimed: true };
  },
});

export const completeBuild = internalMutation({
  args: {
    courseId: v.id("courses"),
    pathway: v.object({
      overview: v.string(),
      examFormat: v.string(),
      units: v.array(
        v.object({
          title: v.string(),
          summary: v.string(),
          topics: v.array(
            v.object({
              id: v.string(),
              title: v.string(),
              specReference: v.optional(v.string()),
              summary: v.string(),
              keyPoints: v.array(v.string()),
              examSkill: v.string(),
            }),
          ),
        }),
      ),
    }),
  },
  handler: async (ctx, { courseId, pathway }) => {
    const course = await ctx.db.get(courseId);
    if (!course) throw new Error("Course not found.");

    // Preserve tick-offs across a rebuild by matching topic titles, not
    // positional ids — a regenerated map may reorder units.
    const completed = new Set(course.completedTopics);
    const completedTitles = new Set(
      (course.pathway?.units ?? [])
        .flatMap((unit) => unit.topics)
        .filter((topic) => completed.has(topic.id))
        .map((topic) => topic.title.trim().toLowerCase()),
    );
    const preserved = pathway.units
      .flatMap((unit) => unit.topics)
      .filter((topic) => completedTitles.has(topic.title.trim().toLowerCase()))
      .map((topic) => topic.id);

    await ctx.db.patch(courseId, {
      pathway,
      completedTopics: preserved,
      status: "ready",
      progress: undefined,
      errorMessage: undefined,
      processingStartedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const failBuild = internalMutation({
  args: { courseId: v.id("courses"), message: v.string() },
  handler: async (ctx, { courseId, message }) => {
    await ctx.db.patch(courseId, {
      status: "error",
      errorMessage: message.slice(0, 600),
      progress: undefined,
      processingStartedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

/** Clears the previous failure so the scheduled action can run again. */
export const resetBuild = internalMutation({
  args: { courseId: v.id("courses"), userId: v.id("users") },
  handler: async (ctx, { courseId, userId }) => {
    const course = await ctx.db.get(courseId);
    if (!course || course.userId !== userId) throw new Error("Course not found.");
    await ctx.db.patch(courseId, {
      status: "queued",
      progress: "Queued to rebuild",
      errorMessage: undefined,
      processingStartedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Keeps a build moving in the background when even the fallback pathway could
 * not be stored. It never writes the `error` status, so the UI never asks the
 * student to retry.
 */
export const queueRetry = internalMutation({
  args: { courseId: v.id("courses"), message: v.string() },
  handler: async (ctx, { courseId, message }) => {
    const course = await ctx.db.get(courseId);
    if (!course) return;
    await ctx.db.patch(courseId, {
      status: "queued",
      progress: message.slice(0, 160),
      errorMessage: undefined,
      processingStartedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Repairs courses left in a failed or stale state by an older build. The
 * dashboard and course page call this automatically, so a student never has to
 * press a retry button.
 */
export const recoverMine = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const courses = await ctx.db
      .query("courses")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .collect();

    const now = Date.now();
    let recovered = 0;
    for (const course of courses) {
      const stale =
        course.status === "processing" &&
        (course.processingStartedAt === undefined ||
          now - course.processingStartedAt > 10 * 60 * 1000);
      if (course.status !== "error" && !stale) continue;

      await ctx.db.patch(course._id, {
        status: "queued",
        progress: "Preparing a fresh pathway…",
        errorMessage: undefined,
        processingStartedAt: undefined,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(
        recovered * 20_000,
        internal.ai.buildCoursePathway,
        { courseId: course._id },
      );
      recovered += 1;
    }
    return { recovered };
  },
});

/** One-off repair for deployments that predate automatic recovery. */
export const recoverAllFailed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const courses = await ctx.db.query("courses").collect();
    const now = Date.now();
    let recovered = 0;
    for (const course of courses) {
      const stale =
        course.status === "processing" &&
        (course.processingStartedAt === undefined ||
          now - course.processingStartedAt > 10 * 60 * 1000);
      if (course.status !== "error" && !stale) continue;

      await ctx.db.patch(course._id, {
        status: "queued",
        progress: "Preparing a fresh pathway…",
        errorMessage: undefined,
        processingStartedAt: undefined,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(
        recovered * 20_000,
        internal.ai.buildCoursePathway,
        { courseId: course._id },
      );
      recovered += 1;
    }
    return { recovered };
  },
});
