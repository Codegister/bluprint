/**
 * Real past-paper questions, supplied with their official mark scheme.
 *
 * This is the feature that makes the marking credible against the revision
 * sites: the student brings the question and the scheme, and Bluprint grades
 * against that scheme, criterion by criterion, with the same evidence guard as
 * a generated question. Nothing is invented, and the scheme is kept and shown
 * back so the mark can be checked by eye.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/requireUser";
import { parseMarkScheme, schemeIsUsable } from "./lib/realPaper";

/** Long enough for a two-page question, short enough to keep a row small. */
const MAX_QUESTION = 4000;
const MAX_SCHEME = 12000;

export const create = mutation({
  args: {
    title: v.string(),
    question: v.string(),
    marks: v.number(),
    schemeText: v.string(),
    source: v.optional(v.union(v.literal("text"), v.literal("photo"))),
    sourceImageId: v.optional(v.id("_storage")),
    courseId: v.optional(v.id("courses")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const question = args.question.trim();
    if (question.length < 10) {
      throw new Error("Paste the question before saving it.");
    }
    if (question.length > MAX_QUESTION) {
      throw new Error(
        `Keep the question under ${MAX_QUESTION.toLocaleString()} characters.`,
      );
    }
    const schemeText = args.schemeText.trim();
    if (schemeText.length === 0) {
      throw new Error("Paste the official mark scheme so the answer has something to be marked against.");
    }
    if (schemeText.length > MAX_SCHEME) {
      throw new Error(
        `Keep the mark scheme under ${MAX_SCHEME.toLocaleString()} characters.`,
      );
    }

    const marks = Math.max(1, Math.min(100, Math.round(args.marks)));
    const criteria = parseMarkScheme(schemeText, marks);
    if (!schemeIsUsable(criteria)) {
      throw new Error(
        "That mark scheme did not read as any credit points. Put one point per line, like the board prints it.",
      );
    }

    const now = Date.now();
    const id = await ctx.db.insert("realQuestions", {
      userId,
      title: args.title.trim().slice(0, 120) || "Past-paper question",
      courseId: args.courseId,
      question,
      marks,
      schemeText,
      criteria,
      source: args.source ?? "text",
      sourceImageId: args.sourceImageId,
      createdAt: now,
      updatedAt: now,
    });
    return { id, criteria };
  },
});

/** Every saved real question for this account, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("realQuestions")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    return rows.map((row) => ({
      _id: row._id,
      title: row.title,
      question: row.question,
      marks: row.marks,
      criteria: row.criteria,
      source: row.source,
      sourceImageId: row.sourceImageId,
      awardedMarks: row.awardedMarks,
      userAnswer: row.userAnswer,
      checklist: row.checklist,
      lowConfidence: row.lowConfidence,
      gradedAt: row.gradedAt,
      createdAt: row.createdAt,
    }));
  },
});

export const get = query({
  args: { questionId: v.id("realQuestions") },
  handler: async (ctx, { questionId }) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(questionId);
    if (!row || row.userId !== userId) return null;
    const imageUrl = row.sourceImageId
      ? await ctx.storage.getUrl(row.sourceImageId)
      : null;
    return { ...row, imageUrl };
  },
});

/** The row the marking action needs, without trusting the caller with an id. */
export const getForGrading = internalQuery({
  args: { questionId: v.id("realQuestions") },
  handler: async (ctx, { questionId }) => {
    const row = await ctx.db.get(questionId);
    if (!row) return null;
    let course: { subject: string; examBoard?: string; level?: string } | null = null;
    if (row.courseId) {
      const courseRow = await ctx.db.get(row.courseId);
      if (courseRow) {
        course = {
          subject: courseRow.subject,
          examBoard: courseRow.examBoard,
          level: courseRow.level,
        };
      }
    }
    return { row, course };
  },
});

/** Stores a marked answer. Called only by the marking action. */
export const saveResult = internalMutation({
  args: {
    questionId: v.id("realQuestions"),
    answer: v.string(),
    awardedMarks: v.number(),
    feedback: v.string(),
    checklist: v.optional(
      v.array(
        v.object({
          point: v.string(),
          marks: v.number(),
          awarded: v.number(),
          evidence: v.string(),
        }),
      ),
    ),
    lowConfidence: v.optional(v.boolean()),
    markPasses: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.questionId);
    if (!row) return;
    await ctx.db.patch(args.questionId, {
      userAnswer: args.answer.slice(0, 12000),
      awardedMarks: Math.max(0, Math.min(row.marks, Math.round(args.awardedMarks))),
      feedback: args.feedback.slice(0, 4000),
      checklist: args.checklist?.slice(0, 40),
      lowConfidence: args.lowConfidence,
      markPasses: args.markPasses?.slice(0, 4),
      gradedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/** Keeps an answer that could not be marked, so the student does not lose it. */
export const saveDraft = internalMutation({
  args: { questionId: v.id("realQuestions"), answer: v.string() },
  handler: async (ctx, { questionId, answer }) => {
    const row = await ctx.db.get(questionId);
    if (!row) return;
    await ctx.db.patch(questionId, {
      userAnswer: answer.slice(0, 12000),
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { questionId: v.id("realQuestions") },
  handler: async (ctx, { questionId }) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(questionId);
    if (!row || row.userId !== userId) throw new Error("Question not found.");
    if (row.sourceImageId) await ctx.storage.delete(row.sourceImageId);
    await ctx.db.delete(questionId);
  },
});
