import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  BUILD_DEFAULTS,
  BUILD_MAX,
  BUILD_MIN,
} from "./lib/buildDefaults";
import { shortTitle } from "./lib/titles";
import { requireUserId } from "./lib/requireUser";
import {
  requireVerifiedUser,
  requireOwner,
} from "./lib/authorization";
import { schedule, DAY_MS, type Rating } from "./lib/fsrs";
import {
  buildPacePlan,
  examReadiness,
  examTimestamp,
  goalFromExam,
} from "./lib/studyMetrics";
import { gradeShortAnswer } from "./lib/recall";

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
  // New quiz questions mix multiple choice, cloze and typed answers.
  type: v.optional(
    v.union(v.literal("mcq"), v.literal("cloze"), v.literal("typed")),
  ),
  answer: v.optional(v.string()),
  acceptedAnswers: v.optional(v.array(v.string())),
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

/** Keeps requested lengths inside the range the UI and prompts support. */
function targetCount(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  const rounded = Math.round(value ?? fallback);
  return Math.min(max, Math.max(min, rounded));
}

// ---------------------------------------------------------------------------
// Review scheduling and daily study counts
// ---------------------------------------------------------------------------

/**
 * The streak counts questions answered, not minutes spent. A day only keeps
 * the chain once it reaches the starter tier; the higher tiers are the badge
 * for that day. This means a five-minute sprint still moves the number, while
 * one stray card cannot fake a day.
 */
export const STREAK_TIERS = [
  { key: "starter", label: "Starter", questions: 10 },
  { key: "builder", label: "Builder", questions: 25 },
  { key: "deep", label: "Deep", questions: 50 },
] as const;

const STREAK_BASE = STREAK_TIERS[0].questions;

/** Calendar day key in UTC, so a streak never depends on the viewer's clock. */
function dayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function isDue(card: { dueAt?: number }, now: number): boolean {
  return card.dueAt === undefined || card.dueAt <= now;
}

/** Older day rows only counted cards, before quiz questions were included. */
function questionsOn(day: { cardsReviewed: number; questionsAnswered?: number }): number {
  return day.questionsAnswered ?? day.cardsReviewed;
}

/**
 * Streak rule: any study today makes the streak at least one day, so a short
 * session counts the moment it happens. Days behind today only extend the chain
 * once they reached the starter tier, which is what stops one stray card on an
 * idle day from faking a day. The tiers still describe today only.
 */
function streakFrom(
  reviewed: Map<string, number>,
  now: number,
): {
  todayCount: number;
  streak: number;
  tier: string | null;
  tierQuestions: number;
  nextTier: { label: string; questions: number } | null;
} {
  const todayCount = reviewed.get(dayKey(now)) ?? 0;
  // Today counts as soon as anything was answered on it.
  let streak = todayCount > 0 ? 1 : 0;
  let cursor = now - DAY_MS;
  while ((reviewed.get(dayKey(cursor)) ?? 0) >= STREAK_BASE) {
    streak += 1;
    cursor -= DAY_MS;
    // Guard against a clock skew producing an endless loop.
    if (streak > 4000) break;
  }

  const reached = [...STREAK_TIERS]
    .reverse()
    .find((tier) => todayCount >= tier.questions);
  const next = STREAK_TIERS.find((tier) => todayCount < tier.questions);

  return {
    todayCount,
    streak,
    tier: reached?.label ?? null,
    tierQuestions: reached?.questions ?? 0,
    nextTier: next ? { label: next.label, questions: next.questions } : null,
  };
}

/** One counters row per person per day, shared by cards and quiz answers. */
async function bumpStudyDay(
  ctx: MutationCtx,
  userId: Id<"users">,
  counts: { cards?: number; questions?: number },
): Promise<void> {
  const now = Date.now();
  const day = dayKey(now);
  const cards = counts.cards ?? 0;
  const questions = counts.questions ?? 0;
  const today = await ctx.db
    .query("studyDays")
    .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
    .first();

  if (today) {
    await ctx.db.patch(today._id, {
      cardsReviewed: today.cardsReviewed + cards,
      questionsAnswered: questionsOn(today) + questions,
      updatedAt: now,
    });
    return;
  }
  await ctx.db.insert("studyDays", {
    userId,
    day,
    cardsReviewed: cards,
    questionsAnswered: questions,
    updatedAt: now,
  });
}

/** A card the next review should prioritise: lapsed or never consolidated. */
function isWeakCard(card: {
  lapses?: number;
  status: string;
  reps?: number;
  stability?: number;
}): boolean {
  // A lapse only matters while the memory is still fragile. Once a card is
  // stable again it has earned its way out of the weak-spot session.
  if ((card.lapses ?? 0) > 0 && (card.stability ?? 0) < 21) return true;
  if (card.status === "again") return true;
  return (card.reps ?? 0) > 0 && (card.stability ?? 0) < 4;
}

/** Study priority: due first, then the shakiest memory. */
function byStudyPriority(
  a: { dueAt?: number; lapses?: number; stability?: number; order: number },
  b: { dueAt?: number; lapses?: number; stability?: number; order: number },
  now: number,
): number {
  const dueA = isDue(a, now) ? 0 : 1;
  const dueB = isDue(b, now) ? 0 : 1;
  if (dueA !== dueB) return dueA - dueB;
  const lapse = (b.lapses ?? 0) - (a.lapses ?? 0);
  if (lapse !== 0) return lapse;
  const stability = (a.stability ?? 0) - (b.stability ?? 0);
  if (stability !== 0) return stability;
  const due = (a.dueAt ?? 0) - (b.dueAt ?? 0);
  if (due !== 0) return due;
  return a.order - b.order;
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
    // counts, exam readiness and the pace plan are computed here so the
    // dashboard can show them without downloading every card.
    return await Promise.all(
      sets.map(async (set) => {
        const [cards, quizRows, exams] = await Promise.all([
          ctx.db
            .query("flashcards")
            .withIndex("by_set", (q) => q.eq("setId", set._id))
            .collect(),
          ctx.db
            .query("quizQuestions")
            .withIndex("by_set", (q) => q.eq("setId", set._id))
            .collect(),
          ctx.db
            .query("examQuestions")
            .withIndex("by_set", (q) => q.eq("setId", set._id))
            .collect(),
        ]);

        // Readiness only counts finished quizzes; progress counts every answer
        // saved so far. Both come from the same rows.
        const quiz = set.lastQuizTotal
          ? { score: set.lastQuizScore ?? 0, total: set.lastQuizTotal }
          : null;
        const quizSoFar = quizProgress(quizRows);
        const graded = exams.filter((exam) => exam.gradedAt !== undefined);
        const exam =
          graded.length > 0
            ? {
                earned: graded.reduce(
                  (sum, question) => sum + (question.awardedMarks ?? 0),
                  0,
                ),
                total: graded.reduce((sum, question) => sum + question.marks, 0),
              }
            : null;

        const readiness = examReadiness({ cards, quiz, exam, at: now });
        const examAt = set.examDate ? examTimestamp(set.examDate) : null;
        const projected = examAt
          ? examReadiness({ cards, quiz, exam, at: examAt })
          : readiness;

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
          // Progress the student can see: answered as they go, not only at the
          // end of a completed quiz.
          quizAnswered: quizSoFar.answered,
          quizCorrect: quizSoFar.correct,
          quizTotal: quizSoFar.total,
          examDate: set.examDate,
          dueCount: cards.filter((card) => isDue(card, now)).length,
          // Cards and missed quiz questions both earn a place in weak spots.
          weakCount:
            cards.filter(isWeakCard).length +
            quizRows.filter((question) => (question.missCount ?? 0) > 0).length,
          readiness: readiness.score,
          readinessBand: readiness.band,
          pace: buildPacePlan({
            examDate: set.examDate,
            cards,
            quizCount: set.quizCount,
            at: now,
            projected: projected.score,
          }),
        };
      }),
    );
  },
});

/**
 * Today's numbers: the tiered question streak, the exam-derived daily goal and
 * how much is still to cover. The goal is derived from the nearest exam across
 * every ready set, so it tightens as a real paper approaches.
 */
export const studyStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const [sets, days] = await Promise.all([
      ctx.db
        .query("studySets")
        .withIndex("by_user_updated", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("studyDays")
        .withIndex("by_user_day", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    const now = Date.now();
    const reviewed = new Map(days.map((day) => [day.day, questionsOn(day)]));
    const streak = streakFrom(reviewed, now);

    let remaining = 0;
    let nearestExam: { daysLeft: number; title: string } | null = null;

    for (const set of sets) {
      if (set.status !== "ready") continue;
      const cards = await ctx.db
        .query("flashcards")
        .withIndex("by_set", (q) => q.eq("setId", set._id))
        .collect();

      remaining += cards.filter(
        (card) =>
          (card.reps ?? 0) === 0 ||
          (card.stability ?? 0) < 21 ||
          isDue(card, now),
      ).length;
      // Questions still to answer, counted from the saved answers rather than
      // from a separate tally, so today's goal matches the quiz progress the
      // set page shows.
      const quizRows = await ctx.db
        .query("quizQuestions")
        .withIndex("by_set", (q) => q.eq("setId", set._id))
        .collect();
      const quizSoFar = quizProgress(quizRows);
      remaining += Math.max(0, quizSoFar.total - quizSoFar.answered);

      if (set.examDate) {
        const examAt = examTimestamp(set.examDate);
        if (examAt !== null) {
          const daysLeft = Math.ceil((examAt - now) / DAY_MS);
          if (
            daysLeft >= 0 &&
            (nearestExam === null || daysLeft < nearestExam.daysLeft)
          ) {
            nearestExam = { daysLeft, title: set.title };
          }
        }
      }
    }

    const goal = goalFromExam(remaining, nearestExam?.daysLeft ?? null);

    return {
      ...streak,
      goal: goal.goal,
      goalReason: goal.reason,
      examInDays: nearestExam?.daysLeft ?? null,
      examTitle: nearestExam?.title ?? null,
      remaining,
      tiers: STREAK_TIERS.map((tier) => ({
        ...tier,
        reached: streak.todayCount >= tier.questions,
      })),
    };
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

    const now = Date.now();
    const quizPart = set.lastQuizTotal
      ? { score: set.lastQuizScore ?? 0, total: set.lastQuizTotal }
      : null;
    const quizSoFar = quizProgress(quiz);
    const graded = exams.filter((exam) => exam.gradedAt !== undefined);
    const examPart =
      graded.length > 0
        ? {
            earned: graded.reduce(
              (sum, question) => sum + (question.awardedMarks ?? 0),
              0,
            ),
            total: graded.reduce((sum, question) => sum + question.marks, 0),
          }
        : null;

    const readiness = examReadiness({ cards, quiz: quizPart, exam: examPart, at: now });
    const examAt = set.examDate ? examTimestamp(set.examDate) : null;
    const projected = examAt
      ? examReadiness({ cards, quiz: quizPart, exam: examPart, at: examAt })
      : readiness;

    return {
      set,
      cards: byOrder(cards),
      quiz: byOrder(quiz),
      exams: byOrder(exams),
      sourceImages,
      readiness,
      projected,
      pace: buildPacePlan({
        examDate: set.examDate,
        cards,
        quizCount: set.quizCount,
        at: now,
        projected: projected.score,
      }),
      dueCount: cards.filter((card) => isDue(card, now)).length,
      weakCardCount: cards.filter(isWeakCard).length,
      weakQuizCount: quiz.filter((question) => (question.missCount ?? 0) > 0).length,
      quizAnswered: quizSoFar.answered,
      quizCorrect: quizSoFar.correct,
      quizTotal: quizSoFar.total,
      // Computed server-side so the page doesn't call Date.now() during render.
      processingStale:
        set.status === "processing" &&
        set.processingStartedAt !== undefined &&
        now - set.processingStartedAt > 10 * 60 * 1000,
    };
  },
});

/**
 * The cards for a quick sprint, across every ready set. Due cards come first,
 * then the shakiest memories, so a five-card sprint is the most useful five
 * cards rather than the first five in the library.
 */
export const sprintQueue = query({
  args: { length: v.number() },
  handler: async (ctx, { length }) => {
    const userId = await requireUserId(ctx);
    const limit = Math.max(1, Math.min(50, Math.round(length)));
    const sets = await ctx.db
      .query("studySets")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .collect();

    const now = Date.now();
    const collected: Array<{ card: Doc<"flashcards">; setTitle: string }> = [];

    for (const set of sets) {
      if (set.status !== "ready") continue;
      const rows = await ctx.db
        .query("flashcards")
        .withIndex("by_set", (q) => q.eq("setId", set._id))
        .collect();
      for (const card of rows) collected.push({ card, setTitle: set.title });
    }

    collected.sort((a, b) => byStudyPriority(a.card, b.card, now));
    return collected
      .slice(0, limit)
      .map(({ card, setTitle }) => ({ ...card, setTitle }));
  },
});

/**
 * The weak-spot session: the cards that keep slipping plus the quiz questions
 * that have been missed. Ordered worst first, so a short session starts with
 * the material most likely to cost marks.
 */
export const weakSpots = query({
  args: { setId: v.id("studySets") },
  handler: async (ctx, { setId }) => {
    const userId = await requireUserId(ctx);
    const set = await ctx.db.get(setId);
    if (!set || set.userId !== userId) return null;

    const [cards, quiz] = await Promise.all([
      ctx.db
        .query("flashcards")
        .withIndex("by_set", (q) => q.eq("setId", setId))
        .collect(),
      ctx.db
        .query("quizQuestions")
        .withIndex("by_set", (q) => q.eq("setId", setId))
        .collect(),
    ]);

    const weakCards = cards
      .filter(isWeakCard)
      .sort(
        (a, b) =>
          (b.lapses ?? 0) - (a.lapses ?? 0) ||
          (a.stability ?? 0) - (b.stability ?? 0),
      )
      .slice(0, 30);

    const missedQuiz = quiz
      .filter((question) => (question.missCount ?? 0) > 0)
      .sort(
        (a, b) =>
          (b.missCount ?? 0) - (a.missCount ?? 0) ||
          (b.lastMissedAt ?? 0) - (a.lastMissedAt ?? 0),
      )
      .slice(0, 12);

    return {
      setTitle: set.title,
      cards: weakCards,
      quiz: missedQuiz,
      weakCardCount: cards.filter(isWeakCard).length,
      weakQuizCount: quiz.filter((question) => (question.missCount ?? 0) > 0).length,
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
    title: v.string(),      notes: v.string(),
      sourceType,
      // "user" when the student typed the name, "auto" when it was derived from
      // the upload. The generator may replace an auto name with a topic title.
      titleSource: v.optional(
        v.union(v.literal("auto"), v.literal("user")),
      ),
      sourceLabel: v.optional(v.string()),
    course: v.optional(v.string()),
    examBoard: v.optional(v.string()),
    level: v.optional(v.string()),
    targetCardCount: v.optional(v.number()),
    targetQuizCount: v.optional(v.number()),
    targetExamCount: v.optional(v.number()),
    sourceImageIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireVerifiedUser(ctx, userId);

    const notes = normalizeStudyText(args.notes);
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
      // Defaults to "user": a name is never overwritten unless the caller says
      // it was derived from the upload.
      titleSource: args.titleSource ?? "user",
      notes,
      sourceType: args.sourceType,
      sourceLabel: safeLabel(args.sourceLabel),
      course: safeLabel(args.course),
      examBoard: safeLabel(args.examBoard),
      level: safeLabel(args.level),
      sourceImageIds: args.sourceImageIds.slice(0, 10),
      status: "queued",
      progress: "Queued",
      cardCount: 0,
      quizCount: 0,
      examCount: 0,
      // The sliders allow 1–100 of each; the generation action then caps the
      // request at what the material can actually support. The defaults come
      // from the one build config the product quotes everywhere.
      targetCardCount: targetCount(
        args.targetCardCount,
        BUILD_MIN,
        BUILD_MAX,
        BUILD_DEFAULTS.cards,
      ),
      targetQuizCount: targetCount(
        args.targetQuizCount,
        BUILD_MIN,
        BUILD_MAX,
        BUILD_DEFAULTS.quiz,
      ),
      targetExamCount: targetCount(
        args.targetExamCount,
        BUILD_MIN,
        BUILD_MAX,
        BUILD_DEFAULTS.exam,
      ),
      knownCount: 0,
      updatedAt: now,
    });
  },
});

/**
 * Mild normalization for text that will be stored and later shown to the user
 * or passed into prompts. It trims obvious control characters and collapses
 * degenerate whitespace, but it does not change the content.
 */
function normalizeStudyText(value: string): string {
  return value
    .slice(0, 60_000)
    .replace(/\x00/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Label-style fields are short, plain text. Keep them boring. */
function safeLabel(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.replace(/\x00/g, "").trim();
  return trimmed.length > 0 ? trimmed.slice(0, 60) : undefined;
}

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
    // Optional so older clients can still rename a set without touching its
    // build length. The rebuild action reads these targets.
    targetCardCount: v.optional(v.number()),
    targetQuizCount: v.optional(v.number()),
    targetExamCount: v.optional(v.number()),
  },
  handler: async (
    ctx,
    {
      setId,
      title,
      course,
      examBoard,
      level,
      targetCardCount,
      targetQuizCount,
      targetExamCount,
    },
  ) => {
    const userId = await requireUserId(ctx);
    const set = await requireOwner(
      await ctx.db.get(setId),
      userId,
    );

    const nextTitle = normalizeStudyText(title);
    if (nextTitle.length < 2) throw new Error("Give the set a name first.");

    // Only the fields the caller actually sent are patched. An inline rename
    // sends just the title, and must not clear the course, board or counts.
    await ctx.db.patch(setId, {
      title: nextTitle,
      // Naming it by hand means the generator stops titling it.
      titleSource: "user" as const,
      ...(course !== undefined ? { course: safeLabel(course) } : {}),
      ...(examBoard !== undefined ? { examBoard: safeLabel(examBoard) } : {}),
      ...(level !== undefined ? { level: safeLabel(level) } : {}),
      ...(targetCardCount !== undefined
        ? {
            targetCardCount: targetCount(
              targetCardCount,
              BUILD_MIN,
              BUILD_MAX,
              set.targetCardCount ?? BUILD_DEFAULTS.cards,
            ),
          }
        : {}),
      ...(targetQuizCount !== undefined
        ? {
            targetQuizCount: targetCount(
              targetQuizCount,
              BUILD_MIN,
              BUILD_MAX,
              set.targetQuizCount ?? BUILD_DEFAULTS.quiz,
            ),
          }
        : {}),
      ...(targetExamCount !== undefined
        ? {
            targetExamCount: targetCount(
              targetExamCount,
              BUILD_MIN,
              BUILD_MAX,
              set.targetExamCount ?? BUILD_DEFAULTS.exam,
            ),
          }
        : {}),
      updatedAt: Date.now(),
    });
  },
});

/** Exam date validation: an empty value clears the pace plan. */
function safeExamDate(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;
  return Number.isFinite(Date.parse(`${trimmed}T00:00:00Z`))
    ? trimmed
    : undefined;
}

/**
 * Sets or clears the exam this set is for. Kept apart from `updateDetails` so
 * a rename from an older client cannot wipe the date the goal depends on.
 */
export const setExamDate = mutation({
  args: {
    setId: v.id("studySets"),
    examDate: v.optional(v.string()),
  },
  handler: async (ctx, { setId, examDate }) => {
    const userId = await requireUserId(ctx);
    await requireOwner(await ctx.db.get(setId), userId);
    await ctx.db.patch(setId, {
      examDate: safeExamDate(examDate),
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { setId: v.id("studySets") },
  handler: async (ctx, { setId }) => {
    const userId = await requireUserId(ctx);
    const set = await requireOwner(
      await ctx.db.get(setId),
      userId,
    );

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
 * Applies one FSRS review: schedules the next showing, keeps the set's mastery
 * count in sync and bumps the daily question counter. Kept separate from the
 * mutation so the schedule can be exercised directly.
 */
async function applyReview(
  ctx: MutationCtx,
  userId: Id<"users">,
  cardId: Id<"flashcards">,
  rating: Rating,
) {
  const card = await ctx.db.get(cardId);
  if (!card || card.userId !== userId) throw new Error("Flashcard not found.");
  const set = await ctx.db.get(card.setId);
  if (!set || set.userId !== userId) throw new Error("Study set not found.");

  const now = Date.now();
  const next = schedule(
    {
      state: card.fsrsState,
      stability: card.stability,
      difficulty: card.difficulty,
      lastReviewedAt: card.lastReviewedAt,
      lapses: card.lapses,
      reps: card.reps,
    },
    rating,
    now,
  );

  await ctx.db.patch(cardId, {
    // Hard is still a successful recall in FSRS; only Again is a lapse.
    status: rating >= 2 ? "known" : "again",
    reviewCount: card.reviewCount + 1,
    lastReviewedAt: now,
    dueAt: next.dueAt,
    intervalDays: next.intervalDays,
    fsrsState: next.state,
    stability: next.stability,
    difficulty: next.difficulty,
    lapses: next.lapses,
    reps: next.reps,
    lastRating: rating,
  });

  let knownCount = set.knownCount;
  if (rating >= 2 && card.status !== "known") knownCount += 1;
  if (rating === 1 && card.status === "known") knownCount -= 1;

  await ctx.db.patch(set._id, {
    knownCount: Math.max(0, Math.min(set.cardCount, knownCount)),
    lastStudiedAt: now,
    updatedAt: now,
  });

  await bumpStudyDay(ctx, userId, { cards: 1, questions: 1 });

  return {
    dueAt: next.dueAt,
    intervalDays: next.intervalDays,
    stability: next.stability,
    state: next.state,
  };
}

/** Saves one FSRS rating (1 Again – 4 Easy) for a card. */
export const reviewCard = mutation({
  args: {
    cardId: v.id("flashcards"),
    rating: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4)),
  },
  handler: async (ctx, { cardId, rating }) => {
    const userId = await requireUserId(ctx);
    await requireOwner(await ctx.db.get(cardId), userId);
    return await applyReview(ctx, userId, cardId, rating as Rating);
  },
});

/**
 * How far through the quiz the student is, read from the saved answers. This is
 * the one source of truth for quiz progress: a question counts the moment it is
 * checked, so "1 of 6 answered" is the same number on the set page, in the
 * library and in today's goal.
 */
function quizProgress(rows: Array<{ lastAnsweredAt?: number; lastCorrect?: boolean }>): {
  answered: number;
  correct: number;
  total: number;
} {
  return {
    answered: rows.filter((row) => row.lastAnsweredAt !== undefined).length,
    correct: rows.filter((row) => row.lastCorrect === true).length,
    total: rows.length,
  };
}

/** Grades one answer against the saved question. Shared by both mutations. */
function gradeQuizQuestion(
  question: Doc<"quizQuestions">,
  response: { selectedIndex?: number; text?: string },
): { correct: boolean; expected: string } {
  const type = question.type ?? "mcq";
  if (type === "mcq") {
    return {
      correct: response.selectedIndex === question.correctIndex,
      expected: question.options[question.correctIndex] ?? "",
    };
  }

  const expected = question.answer ?? "";
  const grade = gradeShortAnswer(expected, question.acceptedAnswers, response.text ?? "");
  return { correct: grade.correct, expected };
}

/**
 * Checks a single typed, dictated or multiple-choice answer before the student
 * moves on. The expected answer comes back so the explanation can show it.
 */
export const checkQuizAnswer = mutation({
  args: {
    questionId: v.id("quizQuestions"),
    selectedIndex: v.optional(v.number()),
    text: v.optional(v.string()),
  },
  handler: async (ctx, { questionId, selectedIndex, text }) => {
    const userId = await requireUserId(ctx);
    const question = await requireOwner(
      await ctx.db.get(questionId),
      userId,
    );
    const grade = gradeQuizQuestion(question, { selectedIndex, text });

    // Saved as soon as it is checked, so leaving the quiz half-finished still
    // counts as progress everywhere. The first answer moves the day's counts;
    // re-answering the same question does not count twice.
    const first = question.lastAnsweredAt === undefined;
    await ctx.db.patch(question._id, {
      lastAnswer: text?.slice(0, 2000),
      lastSelectedIndex: selectedIndex,
      lastCorrect: grade.correct,
      lastAnsweredAt: Date.now(),
    });
    if (first) await bumpStudyDay(ctx, userId, { questions: 1 });

    return grade;
  },
});

export const submitQuiz = mutation({
  args: {
    setId: v.id("studySets"),
    responses: v.array(
      v.object({
        questionId: v.id("quizQuestions"),
        selectedIndex: v.optional(v.number()),
        text: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { setId, responses }) => {
    const userId = await requireUserId(ctx);
    const set = await requireOwner(
      await ctx.db.get(setId),
      userId,
    );

    const questions = byOrder(
      await ctx.db
        .query("quizQuestions")
        .withIndex("by_set", (q) => q.eq("setId", setId))
        .collect(),
    );
    if (questions.length === 0) throw new Error("This set has no quiz yet.");

    // This is a client trust boundary: the server expects exactly one response
    // per saved question and grades every one itself.
    if (responses.length !== questions.length) {
      throw new Error("That quiz submission did not look right. Open the quiz again and retry.");
    }
    const byId = new Map(responses.map((response) => [response.questionId, response]));
    if (byId.size !== questions.length) {
      throw new Error("That quiz submission did not look right. Open the quiz again and retry.");
    }

    const now = Date.now();
    const results: Array<{
      questionId: Id<"quizQuestions">;
      correct: boolean;
      expected: string;
    }> = [];
    let score = 0;
    let newlyAnswered = 0;

    for (const question of questions) {
      const response = byId.get(question._id);
      if (!response) {
        throw new Error("That quiz submission did not look right. Open the quiz again and retry.");
      }

      const grade = gradeQuizQuestion(question, response);
      if (grade.correct) score += 1;
      results.push({ questionId: question._id, ...grade });

      // Per-question accuracy powers the weak-spot session. A correct answer
      // slowly works a question out of the list: one miss needs one correct
      // attempt to clear, rather than staying flagged forever.
      await ctx.db.patch(question._id, {
        correctCount:
          (question.correctCount ?? 0) + (grade.correct ? 1 : 0),
        missCount: grade.correct
          ? Math.max(0, (question.missCount ?? 0) - 1)
          : (question.missCount ?? 0) + 1,
        lastMissedAt: grade.correct ? question.lastMissedAt : now,
        lastAnswer:
          response.text === undefined
            ? question.lastAnswer
            : response.text.slice(0, 2000),
        lastSelectedIndex:
          response.selectedIndex === undefined
            ? question.lastSelectedIndex
            : response.selectedIndex,
        lastCorrect: grade.correct,
        lastAnsweredAt: now,
      });
      if (question.lastAnsweredAt === undefined) newlyAnswered += 1;
    }

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
    // Only questions answered for the first time move the day's counts, so a
    // quiz checked question by question is not counted twice when submitted.
    if (newlyAnswered > 0) {
      await bumpStudyDay(ctx, userId, { questions: newlyAnswered });
    }

    return { score, total: questions.length, results };
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
      progressPercent: 2,
      errorMessage: undefined,
      processingStartedAt: now,
      updatedAt: now,
    });
    return { claimed: true, set: { ...set, status: "processing" as const } };
  },
});

export const setProgress = internalMutation({
  args: {
    setId: v.id("studySets"),
    progress: v.string(),
    // Optional for older callers; the build screen falls back to a queued bar.
    percent: v.optional(v.number()),
  },
  handler: async (ctx, { setId, progress, percent }) => {
    await ctx.db.patch(setId, {
      progress,
      ...(percent === undefined
        ? {}
        : { progressPercent: Math.max(0, Math.min(99, Math.round(percent))) }),
    });
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
    // A short topic name from the generator, applied only when the student has
    // not named the set themselves.
    title: v.optional(v.string()),
    generationNote: v.optional(v.string()),
  },
  handler: async (ctx, { setId, summary, cards, quiz, exams, title, generationNote }) => {
    const set = await ctx.db.get(setId);
    if (!set) throw new Error("Study set not found.");

    const generatedTitle = title ? shortTitle(title) : "";
    const named = generatedTitle.length >= 3 && set.titleSource !== "user";

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
        // New cards are due immediately and have no memory state yet. FSRS
        // reads the first rating to set their starting stability.
        dueAt: now,
        intervalDays: 0,
        fsrsState: "new",
        lapses: 0,
        reps: 0,
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
        type: question.type,
        answer: question.answer,
        acceptedAnswers: question.acceptedAnswers,
        order: index,
        missCount: 0,
        correctCount: 0,
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
      // The generator's short topic title replaces a name derived from the
      // upload, and leaves a name the student typed alone.
      ...(named ? { title: generatedTitle, titleSource: "auto" as const } : {}),
      cardCount: cards.length,
      quizCount: quiz.length,
      examCount: exams.length,
      knownCount: 0,
      generationNote,
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

/**
 * One flashcard plus its set, for meaning-based recall marking. The set carries
 * the course and board, which the prompt uses to keep the judgement in the
 * student's own subject.
 */
export const getCardForGrading = internalQuery({
  args: { cardId: v.id("flashcards") },
  handler: async (ctx, { cardId }) => {
    const card = await ctx.db.get(cardId);
    if (!card) return null;
    const set = await ctx.db.get(card.setId);
    if (!set) return null;
    return { card, set };
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

/** One row of the marked checklist: a guide bullet and its quoted evidence. */
const markCheck = v.object({
  point: v.string(),
  marks: v.number(),
  awarded: v.number(),
  evidence: v.string(),
});

export const saveExamResult = internalMutation({
  args: {
    examId: v.id("examQuestions"),
    answer: v.string(),
    awardedMarks: v.number(),
    feedback: v.string(),
    checklist: v.optional(v.array(markCheck)),
  },
  handler: async (ctx, { examId, answer, awardedMarks, feedback, checklist }) => {
    const exam = await ctx.db.get(examId);
    if (!exam) throw new Error("Question not found.");
    const set = await ctx.db.get(exam.setId);
    if (!set) throw new Error("Study set not found.");
    if (exam.userId !== set.userId) {
      throw new Error("That question does not belong to the same set.");
    }

    const now = Date.now();
    await ctx.db.patch(examId, {
      userAnswer: normalizeStudyText(answer).slice(0, 5000),
      awardedMarks: Math.max(0, Math.min(exam.marks, Math.round(awardedMarks))),
      feedback: normalizeStudyText(feedback).slice(0, 4000),
      checklist: checklist?.slice(0, 40),
      gradedAt: now,
    });
    await ctx.db.patch(set._id, { lastStudiedAt: now, updatedAt: now });
    // A marked written question is still a question answered: it moves the
    // tiered streak and the daily goal like a card or a quiz question.
    await bumpStudyDay(ctx, exam.userId, { questions: 1 });
  },
});
