import { getAuthUserId } from "@convex-dev/auth/server";
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
  clipNote,
  noteLimitMessage,
  withinNoteLimit,
} from "./lib/noteLimits";
import { consumeBuildAllowance } from "./buildUsage";
import {
  BUILD_DEFAULTS,
  BUILD_MAX,
  BUILD_MIN,
} from "./lib/buildDefaults";
import { cleanTopicTitle, shortTitle } from "./lib/titles";
import { matchSpecPoint } from "./lib/specMapping";
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
import { deriveRecallUnits, gradeShortAnswer } from "./lib/recall";
import { alignCriteria, toCriteria } from "./lib/markingCriteria";
import { summaryValidator } from "./lib/summary";
import { validateStudySelection } from "./lib/catalogue";
import {
  MAX_CARD_BACK_CHARS,
  MAX_CARD_FRONT_CHARS,
  cardNeedsRepair,
  gradeQuizResponse,
  keyPointsForCards,
  linkKeyPointsToSpecs,
  prepareCards,
  prepareQuiz,
  repairCardAnswer,
  sourceCoverage,
} from "./lib/studySetQuality";
import { shortfallFor, shortfallSentence } from "./lib/buildDefaults";
import { cleanGeneratedText } from "./lib/register";
import { isSyllabusOutline } from "./lib/syllabusOutline";

const sourceType = v.union(
  v.literal("text"),
  v.literal("photos"),
  v.literal("video"),
);

// The summary schema is imported, not declared here: the parser that builds a
// summary and the mutation that stores it must agree on every field. A local
// copy is exactly how `title` once broke every build.

const cardInput = v.object({
  front: v.string(),
  back: v.string(),
  // True when the item uses a fact the student's notes do not contain. Shown as
  // "Beyond your notes" so enrichment is visible instead of indistinguishable.
  beyondNotes: v.optional(v.boolean()),
});
const quizInput = v.object({
  question: v.string(),
  options: v.array(v.string()),
  correctIndex: v.number(),
  explanation: v.string(),
  beyondNotes: v.optional(v.boolean()),
  // New quiz questions mix multiple choice, cloze and typed answers.
  type: v.optional(
    v.union(v.literal("mcq"), v.literal("cloze"), v.literal("typed")),
  ),
  answer: v.optional(v.string()),
  acceptedAnswers: v.optional(v.array(v.string())),
  // Zero-based card index the generator used. Treated as a hint and checked
  // against the card's text before it is stored.
  sourceCard: v.optional(v.number()),
});
const examInput = v.object({
  question: v.string(),
  marks: v.number(),
  modelAnswer: v.string(),
  markingGuide: v.array(v.string()),
  beyondNotes: v.optional(v.boolean()),
  // Optional on the way in: the build derives these from the guide below.
  criteria: v.optional(
    v.array(
      v.object({ id: v.string(), marks: v.number(), text: v.string() }),
    ),
  ),
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

export async function deleteStudySetContent(ctx: MutationCtx, setId: Id<"studySets">) {
  const sets: Array<
    "flashcards" | "quizQuestions" | "examQuestions" | "quizAttempts" | "reviewEvents"
  > = [
    "flashcards",
    "quizQuestions",
    "examQuestions",
    "quizAttempts",
    "reviewEvents",
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
    // Signed out is an empty library, not an error. The HTTP API returns real
    // JSON here (and the client never renders data for a missing session), so
    // a probe can tell a working deployment from a half-loaded one without a
    // redacted "Server Error".
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
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

    /**
     * The Today strip's "X/Y questions": every card, quiz question and exam
     * question in the student's ready sets, and how many of those they have
     * answered correctly. The three parts are returned with it, so the number
     * can always be explained on screen.
     */
    const items = {
      total: 0,
      correct: 0,
      cards: { total: 0, correct: 0 },
      quiz: { total: 0, correct: 0 },
      exam: { total: 0, correct: 0 },
    };

    for (const set of sets) {
      if (set.status !== "ready") continue;
      const cards = await ctx.db
        .query("flashcards")
        .withIndex("by_set", (q) => q.eq("setId", set._id))
        .collect();
      const exams = await ctx.db
        .query("examQuestions")
        .withIndex("by_set", (q) => q.eq("setId", set._id))
        .collect();

      items.cards.total += cards.length;
      items.cards.correct += cards.filter(
        (card) => card.status === "known",
      ).length;
      items.exam.total += exams.length;
      // A written answer counts as correctly answered once it earns at least
      // half the marks; the exact mark is still shown on the set page.
      items.exam.correct += exams.filter(
        (exam) =>
          exam.awardedMarks !== undefined &&
          exam.awardedMarks >= Math.ceil(exam.marks / 2),
      ).length;

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
      items.quiz.total += quizRows.length;
      items.quiz.correct += quizSoFar.correct;

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
    items.total =
      items.cards.total + items.quiz.total + items.exam.total;
    items.correct =
      items.cards.correct + items.quiz.correct + items.exam.correct;

    // A daily goal larger than the whole workspace is not a goal. It is capped
    // at the items that exist, and the page labels it against that total.
    const dailyGoal =
      items.total > 0 ? Math.min(goal.goal, items.total) : goal.goal;

    return {
      ...streak,
      goal: dailyGoal,
      goalReason: goal.reason,
      examInDays: nearestExam?.daysLeft ?? null,
      examTitle: nearestExam?.title ?? null,
      remaining,
      items,
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
    // The page filters due cards against this single server timestamp rather
    // than reading the browser clock during render. It also lets an all-caught-
    // up screen say when the next card is actually coming back.
    const nextDueAt = cards.reduce<number | undefined>((next, card) => {
      if (card.dueAt === undefined || card.dueAt <= now) return next;
      return next === undefined || card.dueAt < next ? card.dueAt : next;
    }, undefined);

    return {
      asOf: now,
      nextDueAt,
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
      cardRepairNeeded: cards.some(cardNeedsRepair),
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
    // The same limit the dialog shows. Checked before the allowance is spent, so
    // an oversized paste fails with a clear message and does not consume one of
    // the student's builds (nothing was generated, so nothing should count).
    if (!withinNoteLimit(notes)) {
      throw new Error(noteLimitMessage(notes.length));
    }

    // Rate limit before anything is written or generated: a guest can otherwise
    // start build after build and burn the deployment's AI tokens. An invalid
    // request above returns before this point, so only a real build counts.
    await consumeBuildAllowance(ctx, userId, "set");

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
  // Deliberately does not slice: the length check must see how long the note
  // really is. Slicing here quietly turned a 30,800-character paste into a
  // 20,000-character build instead of failing it, which is exactly the
  // silent-billing bug this limit exists to prevent.
  return value
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

    // Settings are a second write path, so they use the same catalogue guard as
    // creating a course. A direct caller cannot move a set to a qualification
    // or subject that does not exist.
    if (level !== undefined || examBoard !== undefined || course !== undefined) {
      const nextLevel = level !== undefined ? safeLabel(level) : set.level;
      const nextCourse = course !== undefined ? safeLabel(course) : set.course;
      const nextBoard =
        examBoard !== undefined ? safeLabel(examBoard) : set.examBoard;
      if (nextLevel && nextCourse) {
        validateStudySelection({
          level: nextLevel,
          subject: nextCourse,
          examBoard: nextBoard,
        });
      }
    }

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
  review?: {
    source?: "automatic" | "self";
    correct?: boolean;
    score?: number;
    coveredUnits?: string[];
    missedUnits?: string[];
  },
) {
  const card = await ctx.db.get(cardId);
  if (!card || card.userId !== userId) throw new Error("Flashcard not found.");
  const set = await ctx.db.get(card.setId);
  if (!set || set.userId !== userId) throw new Error("Study set not found.");

  const now = Date.now();
  const source = review?.source ?? "self";
  const firstExposure = card.reviewCount === 0;
  // A self-rated pass on the first sighting cannot earn more than Hard. The
  // automatic check is the evidence; tapping Good without one should not skip
  // the learning step FSRS would otherwise require.
  const effectiveRating: Rating =
    source === "self" && firstExposure && rating >= 3 ? 2 : rating;
  const next = schedule(
    {
      state: card.fsrsState,
      stability: card.stability,
      difficulty: card.difficulty,
      lastReviewedAt: card.lastReviewedAt,
      lapses: card.lapses,
      reps: card.reps,
    },
    effectiveRating,
    now,
  );

  await ctx.db.patch(cardId, {
    // Hard is still a successful recall in FSRS; only Again is a lapse.
    status: effectiveRating >= 2 ? "known" : "again",
    reviewCount: card.reviewCount + 1,
    lastReviewedAt: now,
    dueAt: next.dueAt,
    intervalDays: next.intervalDays,
    fsrsState: next.state,
    stability: next.stability,
    difficulty: next.difficulty,
    lapses: next.lapses,
    reps: next.reps,
    lastRating: effectiveRating,
  });

  await ctx.db.insert("reviewEvents", {
    cardId,
    setId: card.setId,
    userId,
    rating: effectiveRating,
    source,
    correct: review?.correct,
    score: review?.score,
    coveredUnits: review?.coveredUnits,
    missedUnits: review?.missedUnits,
    firstExposure,
    reviewedAt: now,
  });

  let knownCount = set.knownCount;
  if (effectiveRating >= 2 && card.status !== "known") knownCount += 1;
  if (effectiveRating === 1 && card.status === "known") knownCount -= 1;

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
    source,
    effectiveRating,
  };
}

/** Saves one FSRS rating (1 Again – 4 Easy) for a card. */
export const reviewCard = mutation({
  args: {
    cardId: v.id("flashcards"),
    rating: v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4)),
    // The card screen records whether the pass came from the automatic check
    // or from the student's own rating.
    source: v.optional(v.union(v.literal("automatic"), v.literal("self"))),
    correct: v.optional(v.boolean()),
    score: v.optional(v.number()),
    coveredUnits: v.optional(v.array(v.string())),
    missedUnits: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { cardId, rating, ...review }) => {
    const userId = await requireUserId(ctx);
    await requireOwner(await ctx.db.get(cardId), userId);
    return await applyReview(
      ctx,
      userId,
      cardId,
      rating as Rating,
      review,
    );
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
) {
  return gradeQuizResponse(question, response);
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
      answered: boolean;
      selectedIndex?: number;
      text?: string;
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
      results.push({
        questionId: question._id,
        ...grade,
        ...(response.selectedIndex === undefined
          ? {}
          : { selectedIndex: response.selectedIndex }),
        ...(response.text === undefined
          ? {}
          : { text: response.text.slice(0, 2000) }),
      });

      if (grade.answered) {
        // Per-question accuracy powers the weak-spot session. A correct answer
        // slowly works a question out of the list.
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
      } else {
        // A skipped item is unanswered, not option A. Clearing the last answer
        // keeps progress and the weak-spot list honest too.
        await ctx.db.patch(question._id, {
          lastAnswer: undefined,
          lastSelectedIndex: undefined,
          lastCorrect: false,
          lastAnsweredAt: undefined,
        });
      }
      if (grade.answered && question.lastAnsweredAt === undefined) newlyAnswered += 1;
    }

    await ctx.db.insert("quizAttempts", {
      setId,
      userId,
      score,
      total: questions.length,
      results,
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

/** Existing quiz and exam rows, reused when only the cards are rebuilt. */
export const getContentForRepair = internalQuery({
  args: { setId: v.id("studySets") },
  handler: async (ctx, { setId }) => {
    const [quiz, exams] = await Promise.all([
      ctx.db
        .query("quizQuestions")
        .withIndex("by_set", (q) => q.eq("setId", setId))
        .collect(),
      ctx.db
        .query("examQuestions")
        .withIndex("by_set", (q) => q.eq("setId", setId))
        .collect(),
    ]);
    return { quiz: byOrder(quiz), exams: byOrder(exams) };
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

/**
 * Progress writes are no-ops once a set has been deleted mid-build.
 *
 * Deleting a set while it was still generating used to surface Convex's own
 * "Update on nonexistent document ID" in the page's toast, because the action
 * kept patching a row that no longer existed. Checking first keeps orphaned
 * writes out of the database and out of the UI.
 */
export const setProgress = internalMutation({
  args: {
    setId: v.id("studySets"),
    progress: v.string(),
    // Optional for older callers; the build screen falls back to a queued bar.
    percent: v.optional(v.number()),
  },
  handler: async (ctx, { setId, progress, percent }) => {
    const set = await ctx.db.get(setId);
    if (!set) return { written: false };
    await ctx.db.patch(setId, {
      progress,
      ...(percent === undefined
        ? {}
        : { progressPercent: Math.max(0, Math.min(99, Math.round(percent))) }),
    });
    return { written: true };
  },
});

export const saveExtractedNotes = internalMutation({
  args: { setId: v.id("studySets"), notes: v.string() },
  handler: async (ctx, { setId, notes }) => {
    const set = await ctx.db.get(setId);
    if (!set) return { written: false };
    // Text read from photos is clipped rather than refused: the student
    // uploaded pages, not characters, and failing here would lose their work.
    await ctx.db.patch(setId, { notes: clipNote(notes) });
    return { written: true };
  },
});

/**
 * Whether a build should keep running. Read between stages so a deleted set
 * stops costing AI calls instead of finishing work nobody will see.
 */
export const isActive = internalQuery({
  args: { setId: v.id("studySets") },
  handler: async (ctx, { setId }) => {
    const set = await ctx.db.get(setId);
    return set !== null;
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
    // The number the student asked for. The final note is computed after the
    // filters run, so it always matches the rows that were actually stored.
    requested: v.object({
      cards: v.number(),
      quiz: v.number(),
      exams: v.number(),
    }),
    // A partial save keeps the rows and counts but leaves the set building.
    // The final call is the only one that marks it ready.
    final: v.optional(v.boolean()),
    // A section that failed while the rest finished, shown beside the set.
    failureNote: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { setId, summary, cards, quiz, exams, title, requested, final, failureNote },
  ) => {
    const set = await ctx.db.get(setId);
    // Deleted mid-build: stop quietly rather than writing into a missing set.
    if (!set) return { stored: false };

    const generatedTitle = title ? shortTitle(title) : "";
    const named = generatedTitle.length >= 3 && set.titleSource !== "user";

    // Makes retrying a failed or interrupted run safe.
    await deleteStudySetContent(ctx, setId);

    const now = Date.now();
    const specPoints = set.specPoints ?? [];
    const syllabusOutline = isSyllabusOutline(set.notes);
    const level = set.level;
    const subject = set.course;

    // Register and glossary replacements run before anything is stored, so a
    // GCSE set cannot carry A-Level wording and one concept keeps one name
    // across its stem and explanation.
    const storedSummary = cleanGeneratedText(summary, level, subject);
    const storedCards = cards.map((card) =>
      cleanGeneratedText(card, level, subject),
    );
    const storedQuiz = quiz.map((question) =>
      cleanGeneratedText(question, level, subject),
    );
    const storedExams = exams.map((question) =>
      cleanGeneratedText(question, level, subject),
    );

    // A card is a fact from the notes, not a copy of them. This pass grounds,
    // shortens and deduplicates the deck before any count is written.
    const { cards: contentCards } = prepareCards(storedCards, set.notes);
    // The summary and the deck cannot disagree: one key point per card, in the
    // same order, each derived from that card's question and answer.
    const keyPoints = keyPointsForCards(contentCards);

    const keyPointLinks =
      specPoints.length > 0
        ? linkKeyPointsToSpecs(keyPoints, specPoints)
        : { links: [], missing: [] };
    const summaryToStore =
      keyPointLinks.links.length > 0
        ? {
            ...storedSummary,
            keyPoints: keyPointLinks.links.map((link) => link.text),
            keyPointSpecs: keyPointLinks.links,
          }
        : specPoints.length > 0
          ? // A set with a specification but no matching key points must report
            // zero coverage, not fall back to item tags.
            { ...storedSummary, keyPoints, keyPointSpecs: [] as Array<{ text: string; specRef: string }> }
          : { ...storedSummary, keyPoints };

    // Each item is tagged to the specification statement it teaches, when the
    // set came from a course topic. Matching is deterministic, so the same item
    // always carries the same tag.
    const tag = (text: string): string | undefined =>
      specPoints.length > 0
        ? (matchSpecPoint(text, specPoints).id ?? undefined)
        : undefined;

    for (const [index, card] of contentCards.entries()) {
      await ctx.db.insert("flashcards", {
        setId,
        userId: set.userId,
        front: card.front,
        back: card.back,
        order: index,
        beyondNotes: card.beyondNotes,
        specRef: tag(`${card.front} ${card.back}`),
        // Stored at generation, never derived from the answer's length at
        // grading time.
        recallThreshold: 0.75,
        recallUnits: deriveRecallUnits(card.back),
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

    // The quiz is a second retrieval opportunity, not a reworded card. It is
    // grounded in the notes, disjoint from the deck, free of cloze, inverse
    // pairs, shared answers, leaking explanations and giveaway options.
    const preparedQuiz = prepareQuiz(
      storedQuiz,
      contentCards,
      set.notes,
      keyPoints,
      { level, subject },
    );

    for (const [index, question] of preparedQuiz.items.entries()) {
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
        beyondNotes: syllabusOutline ? undefined : question.beyondNotes,
        // Quiz facts are deliberately disjoint from cards, so there is no
        // source card to link. The field stays optional for older rows.
        specRef: tag(
          `${question.question} ${question.answer ?? ""} ${question.explanation}`,
        ),
        order: index,
        missCount: 0,
        correctCount: 0,
      });
    }

    for (const [index, question] of storedExams.entries()) {
      await ctx.db.insert("examQuestions", {
        setId,
        userId: set.userId,
        question: question.question,
        marks: question.marks,
        modelAnswer: question.modelAnswer,
        markingGuide: question.markingGuide,
        beyondNotes: syllabusOutline ? undefined : question.beyondNotes,
        specRef: tag(`${question.question} ${question.modelAnswer}`),
        // Stored as discrete criteria, with the marks the guide declares.
        criteria:
          question.criteria
            ? alignCriteria(question.criteria)
            : alignCriteria(toCriteria(question.markingGuide)),
        order: index,
      });
    }

    // One rule for every shortfall, using the numbers that were actually
    // stored. The page never gets a second, contradictory explanation.
    const generationNote = [
      contentCards.length < requested.cards
        ? shortfallSentence(contentCards.length, requested.cards)
        : "",
      preparedQuiz.items.length < requested.quiz
        ? shortfallFor("quiz", preparedQuiz.items.length, requested.quiz)
        : "",
      storedExams.length < requested.exams
        ? shortfallFor("exam", storedExams.length, requested.exams)
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    // If a section of the notes never made it into a card, question or exam
    // item, say so on the set page instead of dropping it silently.
    const coverage = sourceCoverage(set.notes, [
      ...contentCards.map((card) => `${card.front} ${card.back}`),
      ...preparedQuiz.items.map(
        (question) =>
          `${question.question} ${question.answer ?? ""} ${question.explanation}`,
      ),
      ...storedExams.map((question) => `${question.question} ${question.modelAnswer}`),
    ]);
    const summaryCoverage = sourceCoverage(set.notes, [
      summaryToStore.overview,
      ...summaryToStore.keyPoints,
    ]);

    await ctx.db.patch(setId, {
      summary: summaryToStore,
      // The generator's short topic title replaces a name derived from the
      // upload, and leaves a name the student typed alone.
      ...(named ? { title: generatedTitle, titleSource: "auto" as const } : {}),
      cardCount: contentCards.length,
      quizCount: preparedQuiz.items.length,
      examCount: storedExams.length,
      knownCount: 0,
      generationNote:
        final === false
          ? undefined
          : [generationNote, failureNote].filter(Boolean).join(" ") || undefined,
      coverageNote: syllabusOutline
        ? undefined
        : [
            coverage.note,
            summaryCoverage.omitted.length > 0
              ? `The summary does not name: ${summaryCoverage.omitted.slice(0, 4).join("; ")}${
                  summaryCoverage.omitted.length > 4
                    ? `; and ${summaryCoverage.omitted.length - 4} more`
                    : ""
                }. The cards still cover the parts they name.`
              : "",
          ]
            .filter(Boolean)
            .join(" ") || undefined,
      lastQuizScore: undefined,
      lastQuizTotal: undefined,
      ...(final === false
        ? {}
        : {
            status: "ready" as const,
            progress: undefined,
            errorMessage: undefined,
            processingStartedAt: undefined,
          }),
      updatedAt: now,
    });
    // The action's failure message uses these, not the generated lengths: a
    // card or question dropped by the filters above must not be promised to the
    // student as saved.
    return {
      stored: true,
      counts: {
        cards: contentCards.length,
        quiz: preparedQuiz.items.length,
        exams: storedExams.length,
      },
    };
  },
});

/**
 * One-time repair for sets saved before answers were bounded. It only touches
 * cards that are longer than a flashcard answer or end mid-word; every other
 * card is left byte-for-byte alone. Review scheduling is preserved, while the
 * recall units are rebuilt from the shortened answer.
 */
export const repairLegacyCards = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const all = await ctx.db.query("flashcards").collect();
    const candidates = all
      .filter(cardNeedsRepair)
      .slice(0, Math.max(1, limit ?? 500));
    const touched = new Set<Id<"studySets">>();

    for (const card of candidates) {
      const front = card.front.slice(0, MAX_CARD_FRONT_CHARS);
      const back = repairCardAnswer(card.back, MAX_CARD_BACK_CHARS);
      await ctx.db.patch(card._id, {
        front,
        back,
        recallUnits: deriveRecallUnits(back),
      });
      touched.add(card.setId);
    }

    for (const setId of touched) {
      const set = await ctx.db.get(setId);
      if (!set) continue;
      const cards = byOrder(
        await ctx.db
          .query("flashcards")
          .withIndex("by_set", (q) => q.eq("setId", setId))
          .collect(),
      );
      const keyPoints = keyPointsForCards(cards);
      const existingSummary = set.summary ?? {
        overview: "",
        examFocus: [],
        keyPoints: [],
      };
      const specPoints = set.specPoints ?? [];
      const linked =
        specPoints.length > 0
          ? linkKeyPointsToSpecs(keyPoints, specPoints)
          : null;
      await ctx.db.patch(setId, {
        summary: {
          ...existingSummary,
          overview: existingSummary.overview ?? "",
          examFocus: existingSummary.examFocus ?? [],
          keyPoints:
            linked && linked.links.length > 0
              ? linked.links.map((link) => link.text)
              : keyPoints,
          ...(linked ? { keyPointSpecs: linked.links } : {}),
        },
        updatedAt: Date.now(),
      });
    }

    return {
      scanned: all.length,
      repaired: candidates.length,
      sets: touched.size,
      stillNeedingRepair:
        all.filter(cardNeedsRepair).length - candidates.length,
    };
  },
});

export const failGeneration = internalMutation({
  args: { setId: v.id("studySets"), message: v.string() },
  handler: async (ctx, { setId, message }) => {
    const set = await ctx.db.get(setId);
    if (!set) return { written: false };
    // A run that fails before the summary named itself leaves the creation
    // placeholder. Name the set from its own notes so the library does not fill
    // with identical "Study set" rows.
    const fallbackTitle =
      set.title === "Study set" ? cleanTopicTitle("", set.notes) : "";
    await ctx.db.patch(setId, {
      ...(fallbackTitle && fallbackTitle !== "Study topic"
        ? { title: fallbackTitle, titleSource: "auto" as const }
        : {}),
      status: "error",
      errorMessage: message.slice(0, 600),
      progress: undefined,
      processingStartedAt: undefined,
      updatedAt: Date.now(),
    });
    return { written: true };
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

/**
 * Keeps a written answer that could not be marked. The student is told their
 * answer is saved, so a marking failure must not also lose what they wrote.
 */
export const saveExamDraft = internalMutation({
  args: { examId: v.id("examQuestions"), answer: v.string() },
  handler: async (ctx, { examId, answer }) => {
    const exam = await ctx.db.get(examId);
    if (!exam) return;
    await ctx.db.patch(examId, {
      userAnswer: normalizeStudyText(answer).slice(0, 5000),
    });
  },
});

export const saveExamResult = internalMutation({
  args: {
    examId: v.id("examQuestions"),
    answer: v.string(),
    awardedMarks: v.number(),
    feedback: v.string(),
    checklist: v.optional(v.array(markCheck)),
    // Set when the two marking passes disagreed; both totals are kept so the
    // disagreement can be reviewed rather than guessed at.
    lowConfidence: v.optional(v.boolean()),
    markPasses: v.optional(v.array(v.number())),
  },
  handler: async (
    ctx,
    { examId, answer, awardedMarks, feedback, checklist, lowConfidence, markPasses },
  ) => {
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
      lowConfidence,
      markPasses: markPasses?.slice(0, 4),
      gradedAt: now,
    });
    await ctx.db.patch(set._id, { lastStudiedAt: now, updatedAt: now });
    // A marked written question is still a question answered: it moves the
    // tiered streak and the daily goal like a card or a quiz question.
    await bumpStudyDay(ctx, exam.userId, { questions: 1 });
  },
});
