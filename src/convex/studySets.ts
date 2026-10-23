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

// ---------------------------------------------------------------------------
// Review scheduling
// ---------------------------------------------------------------------------

/**
 * Simplified SM-2, the schedule family Anki, RemNote and Gizmo use: a failed
 * card returns in ten minutes, a recalled card is pushed out by its ease factor
 * (starting at 1 day). Two ratings only, because that is what the UI offers.
 */
const DAY_MS = 86_400_000;
const AGAIN_DELAY_MS = 10 * 60 * 1000;
const STARTING_EASE = 2.5;
const MAX_INTERVAL_DAYS = 180;

/** Cards per day that count towards the streak, matching RemNote's default. */
export const DAILY_CARD_GOAL = 10;

/** Calendar day key in UTC, so a streak never depends on the viewer's clock. */
function dayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function isDue(card: { dueAt?: number }, now: number): boolean {
  return card.dueAt === undefined || card.dueAt <= now;
}

/**
 * Streak rule: today counts once anything has been reviewed; otherwise a streak
 * stays alive if yesterday was studied. Days are UTC keys.
 */
function streakFrom(
  reviewed: Map<string, number>,
  now: number,
): { todayCount: number; streak: number } {
  const todayCount = reviewed.get(dayKey(now)) ?? 0;
  let cursor = todayCount > 0 ? now : now - DAY_MS;
  let streak = 0;
  while ((reviewed.get(dayKey(cursor)) ?? 0) > 0) {
    streak += 1;
    cursor -= DAY_MS;
    // Guard against a clock skew producing an endless loop.
    if (streak > 4000) break;
  }
  return { todayCount, streak };
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

    const now = Date.now();

    // Leave the (potentially long) notes on the server for the list view. Due
    // counts are computed here so the dashboard can offer "study what's due"
    // without downloading every card.
    return await Promise.all(
      sets.map(async (set) => {
        const cards = await ctx.db
          .query("flashcards")
          .withIndex("by_set", (q) => q.eq("setId", set._id))
          .collect();
        return {
          _id: set._id,
          title: set.title,
          course: set.course,
          examBoard: set.examBoard,
          level: set.level,
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
          dueCount: cards.filter((card) => isDue(card, now)).length,
        };
      }),
    );
  },
});

/** Daily review progress used by the dashboard goal card and streak. */
export const studyStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const days = await ctx.db
      .query("studyDays")
      .withIndex("by_user_day", (q) => q.eq("userId", userId))
      .collect();
    const reviewed = new Map(days.map((day) => [day.day, day.cardsReviewed]));
    return { ...streakFrom(reviewed, Date.now()), goal: DAILY_CARD_GOAL };
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
    course: v.optional(v.string()),
    examBoard: v.optional(v.string()),
    level: v.optional(v.string()),
    sourceImageIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const notes = args.notes.trim();
    if (args.sourceType === "text" && notes.length < 40) {
      throw new Error("Paste at least a few sentences so Bluprint has source material.");
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
      course: args.course?.trim().slice(0, 60) || undefined,
      examBoard: args.examBoard?.trim().slice(0, 60) || undefined,
      level: args.level?.trim().slice(0, 40) || undefined,
      sourceImageIds: args.sourceImageIds.slice(0, 10),
      status: "queued",
      progress: "Queued",
      cardCount: 0,
      quizCount: 0,
      examCount: 0,
      knownCount: 0,
      updatedAt: now,
    });
  },
});

/**
 * Renames a set or changes its course / exam context. The generated material
 * is left alone; the set page offers a rebuild when the new board should be
 * reflected in the questions and marking.
 */
export const updateDetails = mutation({
  args: {
    setId: v.id("studySets"),
    title: v.string(),
    course: v.optional(v.string()),
    examBoard: v.optional(v.string()),
    level: v.optional(v.string()),
  },
  handler: async (ctx, { setId, title, course, examBoard, level }) => {
    const userId = await requireUserId(ctx);
    const set = await ctx.db.get(setId);
    if (!set || set.userId !== userId) throw new Error("Study set not found.");

    const nextTitle = title.trim().slice(0, 80);
    if (nextTitle.length < 2) throw new Error("Give the set a name first.");

    await ctx.db.patch(setId, {
      title: nextTitle,
      course: course?.trim().slice(0, 60) || undefined,
      examBoard: examBoard?.trim().slice(0, 60) || undefined,
      level: level?.trim().slice(0, 40) || undefined,
      updatedAt: Date.now(),
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

    // Tutor conversations are owned by the set, so they go with it. A rebuild
    // keeps them; only deleting the set removes the thread.
    const tutorRows = await ctx.db
      .query("tutorMessages")
      .withIndex("by_set", (q) => q.eq("setId", setId))
      .collect();
    for (const row of tutorRows) await ctx.db.delete(row._id);

    for (const imageId of set.sourceImageIds) {
      await ctx.storage.delete(imageId);
    }
    await ctx.db.delete(setId);
  },
});

/**
 * Applies one self-rated review: schedules the next showing, keeps the set's
 * mastery count in sync and bumps the daily counter. Kept separate from the
 * mutation so the schedule can be exercised directly.
 */
async function applyReview(
  ctx: MutationCtx,
  userId: Id<"users">,
  cardId: Id<"flashcards">,
  outcome: "known" | "again",
) {
    const card = await ctx.db.get(cardId);
    if (!card || card.userId !== userId) throw new Error("Flashcard not found.");
    const set = await ctx.db.get(card.setId);
    if (!set || set.userId !== userId) throw new Error("Study set not found.");

    const now = Date.now();
    const ease = card.ease ?? STARTING_EASE;

    // Fail: back in ten minutes, ease trimmed. Recall: interval grows by the
    // ease factor, starting at one day, and ease slowly rises.
    const intervalDays =
      outcome === "again"
        ? 0
        : card.intervalDays && card.intervalDays > 0
          ? Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(card.intervalDays * ease)))
          : 1;
    const dueAt =
      outcome === "again" ? now + AGAIN_DELAY_MS : now + intervalDays * DAY_MS;

    await ctx.db.patch(cardId, {
      status: outcome,
      reviewCount: card.reviewCount + 1,
      lastReviewedAt: now,
      dueAt,
      intervalDays,
      ease:
        outcome === "again"
          ? Math.max(1.3, Math.round((ease - 0.2) * 100) / 100)
          : Math.min(3, Math.round((ease + 0.1) * 100) / 100),
    });

    let knownCount = set.knownCount;
    if (outcome === "known" && card.status !== "known") knownCount += 1;
    if (outcome === "again" && card.status === "known") knownCount -= 1;

    await ctx.db.patch(set._id, {
      knownCount: Math.max(0, Math.min(set.cardCount, knownCount)),
      lastStudiedAt: now,
      updatedAt: now,
    });

    // One counters row per day powers the daily goal and streak.
    const day = dayKey(now);
    const today = await ctx.db
      .query("studyDays")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .first();
    if (today) {
      await ctx.db.patch(today._id, {
        cardsReviewed: today.cardsReviewed + 1,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("studyDays", {
        userId,
        day,
        cardsReviewed: 1,
        updatedAt: now,
      });
    }
}

/** Saves a self-rated flashcard review and keeps the set's mastery count in sync. */
export const reviewCard = mutation({
  args: {
    cardId: v.id("flashcards"),
    outcome: v.union(v.literal("known"), v.literal("again")),
  },
  handler: async (ctx, { cardId, outcome }) => {
    const userId = await requireUserId(ctx);
    return await applyReview(ctx, userId, cardId, outcome);
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
        // New cards are due immediately.
        dueAt: now,
        intervalDays: 0,
        ease: STARTING_EASE,
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
