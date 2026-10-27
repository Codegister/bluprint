import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireOwner } from "./lib/authorization";
import { requireUserId } from "./lib/requireUser";
import { toCriteria } from "./lib/markingCriteria";

/**
 * Past papers.
 *
 * A course owns a small set of saved past papers. Each one is a full practice
 * paper written from the stored specification by the NVIDIA model, then saved
 * as questions so it is identical on every visit and can be scheduled in the
 * revision timetable.
 *
 * A paper is always one hour (PAPER_MINUTES): the timetable assumes that, and
 * the practice page states it, so the estimate is never invented per paper.
 */

export const PAPER_MINUTES = 60;
/** Enough to practise a subject properly without flooding the picker. */
const MAX_PAPERS_PER_COURSE = 4;
/** A build that has not moved in this long is treated as stalled. */
const STALE_MS = 10 * 60 * 1000;

const generatedQuestion = v.object({
  question: v.string(),
  marks: v.number(),
  marking: v.optional(v.union(v.literal("points"), v.literal("levels"))),
  modelAnswer: v.string(),
  markingGuide: v.array(v.string()),
  // The board's layout, written by the paper generator. Optional so the shape
  // stays compatible with any caller that does not supply it.
  label: v.optional(v.string()),
  section: v.optional(v.string()),
  sectionInstruction: v.optional(v.string()),
  commandWord: v.optional(v.string()),
  specReference: v.optional(v.string()),
});

/** The paper's cover page, built server-side from the board's own rubric. */
const paperCover = v.object({
  paperLabel: v.string(),
  qualification: v.string(),
  timeAllowed: v.string(),
  totalMarks: v.number(),
  materials: v.array(v.string()),
  instructions: v.array(v.string()),
  information: v.array(v.string()),
  advice: v.array(v.string()),
});

function stale(paper: Doc<"pastPapers">): boolean {
  return (
    paper.status === "processing" &&
    (paper.processingStartedAt === undefined ||
      Date.now() - paper.processingStartedAt > STALE_MS)
  );
}

/** Papers for one course, newest last so "Practice paper 1" reads first. */
export const listForCourse = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const userId = await requireUserId(ctx);
    const course = await ctx.db.get(courseId);
    if (!course || course.userId !== userId) return [];

    const papers = await ctx.db
      .query("pastPapers")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();

    return papers
      .filter((paper) => paper.userId === userId)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((paper) => ({
        _id: paper._id,
        title: paper.title,
        paper: paper.paper,
        formatId: paper.formatId,
        status: paper.status,
        progress: paper.progress,
        errorMessage: paper.errorMessage,
        durationMinutes: paper.durationMinutes,
        totalMarks: paper.totalMarks,
        questionCount: paper.questionCount,
        answeredCount: paper.answeredCount,
        earnedMarks: paper.earnedMarks,
        createdAt: paper.createdAt,
        updatedAt: paper.updatedAt,
        lastAttemptedAt: paper.lastAttemptedAt,
        processingStale: stale(paper),
      }));
  },
});

/** One paper with its questions, for the practice page. */
export const getDetails = query({
  args: { paperId: v.id("pastPapers") },
  handler: async (ctx, { paperId }) => {
    const userId = await requireUserId(ctx);
    const paper = await ctx.db.get(paperId);
    if (!paper || paper.userId !== userId) return null;

    const [course, questions] = await Promise.all([
      ctx.db.get(paper.courseId),
      ctx.db
        .query("pastPaperQuestions")
        .withIndex("by_paper", (q) => q.eq("paperId", paperId))
        .collect(),
    ]);

    return {
      paper,
      // Missing only when the course was deleted; the page still opens.
      course: course && course.userId === userId ? course : null,
      questions: questions.sort((a, b) => a.order - b.order),
      processingStale: stale(paper),
    };
  },
});

/**
 * Queues one more practice paper for a course. A paper that is still building
 * is returned instead of starting a second paid generation.
 */
export const create = mutation({
  args: {
    courseId: v.id("courses"),
    // Which paper of the qualification to write, when the course is split.
    // Missing means the whole qualification is examinable.
    paper: v.optional(v.string()),
  },
  handler: async (ctx, { courseId, paper }) => {
    const userId = await requireUserId(ctx);
    const course = await requireOwner(
      await ctx.db.get(courseId),
      userId,
    ) as Doc<"courses">;
    if (course.status !== "ready" || !course.pathway) {
      throw new Error("Wait for this course pathway to finish, then build a past paper.");
    }

    const papers = await ctx.db
      .query("pastPapers")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    const mine = papers.filter((paper) => paper.userId === userId);

    const building = mine.find(
      (paper) => paper.status === "queued" || paper.status === "processing",
    );
    if (building) return { paperId: building._id, created: false };

    // Never leave a stalled paper blocking the course's paper allowance.
    const usable = mine.filter((row) => !stale(row));
    if (usable.length >= MAX_PAPERS_PER_COURSE) {
      throw new Error(
        `This course already has ${MAX_PAPERS_PER_COURSE} saved papers. Remove one to build another.`,
      );
    }

    // A paper choice must be one the specification publishes, so a paper is
    // never labelled with a "Paper 9" the course does not have.
    const groups = course.pathway.papers ?? [];
    const chosen = paper?.trim();
    if (chosen && !groups.some((group) => group.label === chosen)) {
      throw new Error("Choose one of the papers this course is examined in.");
    }

    // Keep numbering stable when an older paper has been removed.
    const highest = mine.reduce((max, row) => {
      const match = /practice paper (\d+)/i.exec(row.title);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0);
    const samePaper = chosen
      ? mine.filter((row) => row.paper === chosen).length
      : 0;

    const now = Date.now();
    const paperId = await ctx.db.insert("pastPapers", {
      userId,
      courseId,
      title: chosen
        ? `${chosen} practice paper ${samePaper + 1}`
        : `Practice paper ${highest + 1}`,
      paper: chosen,
      durationMinutes: PAPER_MINUTES,
      totalMarks: 0,
      questionCount: 0,
      answeredCount: 0,
      earnedMarks: 0,
      status: "queued",
      progress: "Queued",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.ai.buildPastPaper, { paperId });
    return { paperId, created: true };
  },
});

/** Re-runs a paper that failed, keeping its place in the list. */
export const rebuild = mutation({
  args: { paperId: v.id("pastPapers") },
  handler: async (ctx, { paperId }) => {
    const userId = await requireUserId(ctx);
    await requireOwner(await ctx.db.get(paperId), userId);

    const questions = await ctx.db
      .query("pastPaperQuestions")
      .withIndex("by_paper", (q) => q.eq("paperId", paperId))
      .collect();
    for (const question of questions) {
      await ctx.db.delete(question._id);
    }

    await ctx.db.patch(paperId, {
      status: "queued",
      progress: "Queued",
      errorMessage: undefined,
      questionCount: 0,
      totalMarks: 0,
      answeredCount: 0,
      earnedMarks: 0,
      processingStartedAt: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.ai.buildPastPaper, { paperId });
    return { queued: true };
  },
});

/** Removes a paper and its questions. Attempts go with it, as expected. */
export const remove = mutation({
  args: { paperId: v.id("pastPapers") },
  handler: async (ctx, { paperId }) => {
    const userId = await requireUserId(ctx);
    await requireOwner(await ctx.db.get(paperId), userId);

    const questions = await ctx.db
      .query("pastPaperQuestions")
      .withIndex("by_paper", (q) => q.eq("paperId", paperId))
      .collect();
    for (const question of questions) {
      await ctx.db.delete(question._id);
    }
    await ctx.db.delete(paperId);
  },
});

// ---------------------------------------------------------------------------
// Action helpers
// ---------------------------------------------------------------------------

export const getForBuild = internalQuery({
  args: { paperId: v.id("pastPapers") },
  handler: async (ctx, { paperId }) => {
    return await ctx.db.get(paperId);
  },
});

/** One question plus the paper it belongs to, for AI marking. */
export const getQuestionForGrading = internalQuery({
  args: { questionId: v.id("pastPaperQuestions") },
  handler: async (ctx, { questionId }) => {
    const question = await ctx.db.get(questionId);
    if (!question) return null;
    const paper = await ctx.db.get(question.paperId);
    if (!paper) return null;
    return { question, paper };
  },
});

/** Takes ownership of a build so two schedulers cannot generate twice. */
export const claimBuild = internalMutation({
  args: { paperId: v.id("pastPapers") },
  handler: async (ctx, { paperId }) => {
    const paper = await ctx.db.get(paperId);
    if (!paper || paper.status === "ready") return { claimed: false };

    const now = Date.now();
    const running =
      paper.status === "processing" &&
      paper.processingStartedAt !== undefined &&
      now - paper.processingStartedAt < STALE_MS;
    if (running) return { claimed: false };

    await ctx.db.patch(paperId, {
      status: "processing",
      progress: "Reading your specification…",
      errorMessage: undefined,
      processingStartedAt: now,
      updatedAt: now,
    });
    return { claimed: true };
  },
});

export const completeBuild = internalMutation({
  args: {
    paperId: v.id("pastPapers"),
    formatId: v.string(),
    cover: paperCover,
    questions: v.array(generatedQuestion),
  },
  handler: async (ctx, { paperId, formatId, cover, questions }) => {
    const paper = await ctx.db.get(paperId);
    if (!paper) throw new Error("Past paper not found.");

    let totalMarks = 0;
    for (const [index, question] of questions.entries()) {
      await ctx.db.insert("pastPaperQuestions", {
        paperId,
        userId: paper.userId,
        question: question.question,
        marks: question.marks,
        marking: question.marking,
        modelAnswer: question.modelAnswer,
        markingGuide: question.markingGuide,
        // The guide stored as discrete criteria, so the marked page can render
        // one row per mark with its own text and evidence.
        criteria: toCriteria(question.markingGuide),
        order: index,
        label: question.label,
        section: question.section,
        sectionInstruction: question.sectionInstruction,
        commandWord: question.commandWord,
        specReference: question.specReference,
      });
      totalMarks += question.marks;
    }

    await ctx.db.patch(paperId, {
      status: "ready",
      progress: undefined,
      errorMessage: undefined,
      formatId,
      cover,
      questionCount: questions.length,
      totalMarks,
      answeredCount: 0,
      earnedMarks: 0,
      processingStartedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const failBuild = internalMutation({
  args: { paperId: v.id("pastPapers"), message: v.string() },
  handler: async (ctx, { paperId, message }) => {
    await ctx.db.patch(paperId, {
      status: "error",
      errorMessage: message.slice(0, 600),
      progress: undefined,
      processingStartedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

/** One row of the marked checklist: a guide bullet and its quoted evidence. */
const markCheck = v.object({
  point: v.string(),
  marks: v.number(),
  awarded: v.number(),
  evidence: v.string(),
});

/** Stores one marked answer and refreshes the paper's progress counters. */
export const saveQuestionResult = internalMutation({
  args: {
    questionId: v.id("pastPaperQuestions"),
    answer: v.string(),
    awardedMarks: v.number(),
    feedback: v.string(),
    checklist: v.optional(v.array(markCheck)),
  },
  handler: async (ctx, { questionId, answer, awardedMarks, feedback, checklist }) => {
    const question = await ctx.db.get(questionId);
    if (!question) throw new Error("Question not found.");
    const paper = await ctx.db.get(question.paperId);
    if (!paper || paper.userId !== question.userId) {
      throw new Error("That question does not belong to this paper.");
    }

    const now = Date.now();
    await ctx.db.patch(questionId, {
      userAnswer: answer.slice(0, 12000),
      awardedMarks: Math.max(0, Math.min(question.marks, Math.round(awardedMarks))),
      feedback: feedback.slice(0, 4000),
      checklist: checklist?.slice(0, 40),
      gradedAt: now,
    });

    const questions = await ctx.db
      .query("pastPaperQuestions")
      .withIndex("by_paper", (q) => q.eq("paperId", question.paperId))
      .collect();
    const answered = questions.filter((row) => row.awardedMarks !== undefined);

    await ctx.db.patch(paper._id, {
      answeredCount: answered.length,
      earnedMarks: answered.reduce(
        (sum, row) => sum + (row.awardedMarks ?? 0),
        0,
      ),
      lastAttemptedAt: now,
      updatedAt: now,
    });
  },
});
