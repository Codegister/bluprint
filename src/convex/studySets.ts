import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireUserId } from "./lib/requireUser";

const sourceType = v.union(
  v.literal("text"),
  v.literal("photos"),
  v.literal("video"),
);

const summaryValidator = v.object({
  overview: v.string(),
  keyPoints: v.array(v.string()),
  examFocus: v.array(v.string()),
});

const cardInput = v.object({ front: v.string(), back: v.string() });
const quizInput = v.object({
  question: v.string(),
  options: v.array(v.string()),
  correctIndex: v.number(),
  explanation: v.string(),
});
const examInput = v.object({
  question: v.string(),
  marks: v.number(),
  modelAnswer: v.string(),
  markingGuide: v.array(v.string()),
});

/** Child documents are always ordered explicitly; `_creationTime` ties are possible. */
function byOrder<T extends { order: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.order - b.order);
}

async function deleteStudySetContent(ctx: MutationCtx, setId: Id<"studySets">) {
  const sets: Array<"flashcards" | "quizQuestions" | "examQuestions" | "quizAttempts"> = [
    "flashcards",
    "quizQuestions",
    "examQuestions",
    "quizAttempts",
  ];
  for (const table of sets) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_set", (q) => q.eq("setId", setId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** The main screen: only the signed-in friend's own saved sets. */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const sets = await ctx.db
      .query("studySets")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Leave the (potentially long) notes on the server for the list view.
    return sets.map((set) => ({
      _id: set._id,
      title: set.title,
      sourceType: set.sourceType,
      sourceLabel: set.sourceLabel,
      status: set.status,
      progress: set.progress,
      errorMessage: set.errorMessage,
      cardCount: set.cardCount,
      quizCount: set.quizCount,
      examCount: set.examCount,
      knownCount: set.knownCount,
      updatedAt: set.updatedAt,
      lastStudiedAt: set.lastStudiedAt,
      lastQuizScore: set.lastQuizScore,
      lastQuizTotal: set.lastQuizTotal,
    }));
  },
});

/** Full detail for one set. Returns null (rather than leaking) for someone else's set. */
export const getDetails = query({
  args: { setId: v.id("studySets") },
  handler: async (ctx, { setId }) => {
    const userId = await requireUserId(ctx);
    const set = await ctx.db.get(setId);
    if (!set || set.userId !== userId) return null;

    const [cards, quiz, exams] = await Promise.all([
      ctx.db
        .query("flashcards")
        .withIndex("by_set", (q) => q.eq("setId", setId))
        .collect(),
      ctx.db
        .query("quizQuestions")
        .withIndex("by_set", (q) => q.eq("setId", setId))
        .collect(),
      ctx.db
        .query("examQuestions")
        .withIndex("by_set", (q) => q.eq("setId", setId))
        .collect(),
    ]);

    // Signed storage URLs for the uploaded photos / sampled video frames.
    const sourceImages: Array<{ id: Id<"_storage">; url: string }> = [];
    for (const imageId of set.sourceImageIds) {
      const url = await ctx.storage.getUrl(imageId);
      if (url) sourceImages.push({ id: imageId, url });
    }

    return {
      set,
      cards: byOrder(cards),
      quiz: byOrder(quiz),
      exams: byOrder(exams),
      sourceImages,
      // Computed server-side so the page doesn't call Date.now() during render.
      processingStale:
        set.status === "processing" &&
        set.processingStartedAt !== undefined &&
        Date.now() - set.processingStartedAt > 10 * 60 * 1000,
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations used by the app
// ---------------------------------------------------------------------------

/** Browsers upload straight to Convex storage; the key never passes through here. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    notes: v.string(),
    sourceType,
    sourceLabel: v.optional(v.string()),
    sourceImageIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const notes = args.notes.trim();
    if (args.sourceType === "text" && notes.length < 40) {
      throw new Error("Paste at least a few sentences so Pip has something to work with.");
    }
    if (notes.length > 60_000) {
      throw new Error("That's a lot of notes. Please use under 60,000 characters.");
    }

    const now = Date.now();
    const title =
      args.title.trim().slice(0, 80) ||
      (args.sourceType === "text" ? "Pasted notes" : "Untitled study set");

    return await ctx.db.insert("studySets", {
      userId,
      title,
      notes,
      sourceType: args.sourceType,
      sourceLabel: args.sourceLabel?.slice(0, 120),
      sourceImageIds: args.sourceImageIds.slice(0, 10),
      status: "queued",
      progress: "Waiting for Pip…",
      cardCount: 0,
      quizCount: 0,
      examCount: 0,
      knownCount: 0,
      updatedAt: now,
    });
  },
});

export const remove = mutation({
  args: { setId: v.id("studySets") },
  handler: async (ctx, { setId }) => {
    const userId = await requireUserId(ctx);
    const set = await ctx.db.get(setId);
    if (!set || set.userId !== userId) throw new Error("Study set not found.");

    await deleteStudySetContent(ctx, setId);
    for (const imageId of set.sourceImageIds) {
      await ctx.storage.delete(imageId);
    }
    await ctx.db.delete(setId);
  },
});

/** Saves a self-rated flashcard review and keeps the set's mastery count in sync. */
export const reviewCard = mutation({
  args: {
    cardId: v.id("flashcards"),
    outcome: v.union(v.literal("known"), v.literal("again")),
  },
  handler: async (ctx, { cardId, outcome }) => {
    const userId = await requireUserId(ctx);
    const card = await ctx.db.get(cardId);
    if (!card || card.userId !== userId) throw new Error("Flashcard not found.");
    const set = await ctx.db.get(card.setId);
    if (!set || set.userId !== userId) throw new Error("Study set not found.");

    const now = Date.now();
    await ctx.db.patch(cardId, {
      status: outcome,
      reviewCount: card.reviewCount + 1,
      lastReviewedAt: now,
    });

    let knownCount = set.knownCount;
    if (outcome === "known" && card.status !== "known") knownCount += 1;
    if (outcome === "again" && card.status === "known") knownCount -= 1;

    await ctx.db.patch(set._id, {
      knownCount: Math.max(0, Math.min(set.cardCount, knownCount)),
      lastStudiedAt: now,
      updatedAt: now,
    });
  },
});

export const submitQuiz = mutation({
  args: {
    setId: v.id("studySets"),
    answers: v.array(v.number()),
  },
  handler: async (ctx, { setId, answers }) => {
    const userId = await requireUserId(ctx);
    const set = await ctx.db.get(setId);
    if (!set || set.userId !== userId) throw new Error("Study set not found.");

    const questions = byOrder(
      await ctx.db
        .query("quizQuestions")
        .withIndex("by_set", (q) => q.eq("setId", setId))
        .collect(),
    );
    if (questions.length === 0) throw new Error("This set has no quiz yet.");

    let score = 0;
    questions.forEach((question, index) => {
      if (answers[index] === question.correctIndex) score += 1;
    });

    const now = Date.now();
    await ctx.db.insert("quizAttempts", {
      setId,
      userId,
      score,
      total: questions.length,
      completedAt: now,
    });
    await ctx.db.patch(setId, {
      lastQuizScore: score,
      lastQuizTotal: questions.length,
      lastStudiedAt: now,
      updatedAt: now,
    });

    return { score, total: questions.length };
  },
});

// ---------------------------------------------------------------------------
// Internal functions used by the NVIDIA action.
// Actions cannot touch the database directly, so they call these.
// ---------------------------------------------------------------------------

export const getForProcessing = internalQuery({
  args: { setId: v.id("studySets") },
  handler: async (ctx, { setId }) => {
    return await ctx.db.get(setId);
  },
});

/**
 * Atomically takes ownership of a generation run. StrictMode in development
 * can fire the page effect twice, and two NVIDIA runs would waste quota.
 */
export const claimForProcessing = internalMutation({
  args: { setId: v.id("studySets") },
  handler: async (ctx, { setId }) => {
    const set = await ctx.db.get(setId);
    if (!set) return { claimed: false, set: null };
    const now = Date.now();
    const stillRunning =
      set.status === "processing" &&
      set.processingStartedAt !== undefined &&
      now - set.processingStartedAt < 10 * 60 * 1000;
    if (stillRunning) return { claimed: false, set };

    await ctx.db.patch(setId, {
      status: "processing",
      progress: "Reading your material…",
      errorMessage: undefined,
      processingStartedAt: now,
      updatedAt: now,
    });
    return { claimed: true, set: { ...set, status: "processing" as const } };
  },
});

export const setProgress = internalMutation({
  args: { setId: v.id("studySets"), progress: v.string() },
  handler: async (ctx, { setId, progress }) => {
    await ctx.db.patch(setId, { progress });
  },
});

export const saveExtractedNotes = internalMutation({
  args: { setId: v.id("studySets"), notes: v.string() },
  handler: async (ctx, { setId, notes }) => {
    await ctx.db.patch(setId, { notes });
  },
});

export const completeGeneration = internalMutation({
  args: {
    setId: v.id("studySets"),
    summary: summaryValidator,
    cards: v.array(cardInput),
    quiz: v.array(quizInput),
    exams: v.array(examInput),
  },
  handler: async (ctx, { setId, summary, cards, quiz, exams }) => {
    const set = await ctx.db.get(setId);
    if (!set) throw new Error("Study set not found.");

    // Makes retrying a failed or interrupted run safe.
    await deleteStudySetContent(ctx, setId);

    const now = Date.now();
    for (const [index, card] of cards.entries()) {
      await ctx.db.insert("flashcards", {
        setId,
        userId: set.userId,
        front: card.front,
        back: card.back,
        order: index,
        status: "new",
        reviewCount: 0,
      });
    }
    for (const [index, question] of quiz.entries()) {
      await ctx.db.insert("quizQuestions", {
        setId,
        userId: set.userId,
        question: question.question,
        options: question.options,
        correctIndex: question.correctIndex,
        explanation: question.explanation,
        order: index,
      });
    }
    for (const [index, question] of exams.entries()) {
      await ctx.db.insert("examQuestions", {
        setId,
        userId: set.userId,
        question: question.question,
        marks: question.marks,
        modelAnswer: question.modelAnswer,
        markingGuide: question.markingGuide,
        order: index,
      });
    }

    await ctx.db.patch(setId, {
      summary,
      cardCount: cards.length,
      quizCount: quiz.length,
      examCount: exams.length,
      knownCount: 0,
      lastQuizScore: undefined,
      lastQuizTotal: undefined,
      status: "ready",
      progress: undefined,
      errorMessage: undefined,
      processingStartedAt: undefined,
      updatedAt: now,
    });
  },
});

export const failGeneration = internalMutation({
  args: { setId: v.id("studySets"), message: v.string() },
  handler: async (ctx, { setId, message }) => {
    await ctx.db.patch(setId, {
      status: "error",
      errorMessage: message.slice(0, 600),
      progress: undefined,
      processingStartedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const getExamForGrading = internalQuery({
  args: { examId: v.id("examQuestions") },
  handler: async (ctx, { examId }) => {
    const exam = await ctx.db.get(examId);
    if (!exam) return null;
    const set = await ctx.db.get(exam.setId);
    if (!set) return null;
    return { exam, set };
  },
});

export const saveExamResult = internalMutation({
  args: {
    examId: v.id("examQuestions"),
    answer: v.string(),
    awardedMarks: v.number(),
    feedback: v.string(),
  },
  handler: async (ctx, { examId, answer, awardedMarks, feedback }) => {
    const exam = await ctx.db.get(examId);
    if (!exam) throw new Error("Question not found.");
    const set = await ctx.db.get(exam.setId);
    if (!set) throw new Error("Study set not found.");

    const now = Date.now();
    await ctx.db.patch(examId, {
      userAnswer: answer.slice(0, 5000),
      awardedMarks: Math.max(0, Math.min(exam.marks, Math.round(awardedMarks))),
      feedback: feedback.slice(0, 4000),
      gradedAt: now,
    });
    await ctx.db.patch(set._id, { lastStudiedAt: now, updatedAt: now });
  },
});

