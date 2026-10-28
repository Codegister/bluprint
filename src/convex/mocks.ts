/**
 * Timed mocks.
 *
 * A mock is assembled from the set's own written questions up to the board's
 * tariff (one minute per mark), sat against a countdown, and reported with the
 * time each question took beside the marks it earned. Time per mark is often the
 * difference between a grade 6 and a grade 7, and it is invisible in an
 * untimed practice run.
 */

import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/requireUser";
import { assembleMock, DEFAULT_TARIFF } from "./lib/realPaper";

export const start = mutation({
  args: { setId: v.id("studySets"), tariff: v.optional(v.number()) },
  handler: async (ctx, { setId, tariff }) => {
    const userId = await requireUserId(ctx);
    const set = await ctx.db.get(setId);
    if (!set || set.userId !== userId) throw new Error("Study set not found.");

    const exams = await ctx.db
      .query("examQuestions")
      .withIndex("by_set", (q) => q.eq("setId", setId))
      .collect();
    if (exams.length === 0) {
      throw new Error("This set has no written questions, so there is nothing to sit as a mock.");
    }

    const ordered = [...exams].sort((a, b) => a.order - b.order);
    const assembly = assembleMock(
      ordered.map((exam) => ({ id: exam._id, marks: exam.marks })),
      tariff ?? DEFAULT_TARIFF,
    );
    if (assembly.items.length === 0) {
      throw new Error("No question in this set fits the paper tariff.");
    }

    const now = Date.now();
    const attemptId = await ctx.db.insert("mockAttempts", {
      userId,
      setId,
      tariff: assembly.tariff,
      totalMarks: assembly.totalMarks,
      secondsAllowed: assembly.seconds,
      items: assembly.items.map((item) => ({
        examId: item.id as Id<"examQuestions">,
        marks: item.marks,
      })),
      status: "running",
      startedAt: now,
    });

    return {
      attemptId,
      tariff: assembly.tariff,
      totalMarks: assembly.totalMarks,
      secondsAllowed: assembly.seconds,
      short: assembly.short,
    };
  },
});

/** The running attempt, with its questions, for the sitting screen. */
export const get = query({
  args: { attemptId: v.id("mockAttempts") },
  handler: async (ctx, { attemptId }) => {
    const userId = await requireUserId(ctx);
    const attempt = await ctx.db.get(attemptId);
    if (!attempt || attempt.userId !== userId) return null;
    const questions = [];
    for (const item of attempt.items) {
      const exam = await ctx.db.get(item.examId);
      if (!exam) continue;
      questions.push({
        examId: exam._id,
        question: exam.question,
        marks: item.marks,
        seconds: item.seconds ?? null,
        awardedMarks: exam.awardedMarks ?? null,
        userAnswer: exam.userAnswer ?? null,
        beyondNotes: exam.beyondNotes ?? false,
      });
    }
    const set = await ctx.db.get(attempt.setId);
    return { attempt, questions, setTitle: set?.title ?? "Mock paper" };
  },
});

export const finish = mutation({
  args: {
    attemptId: v.id("mockAttempts"),
    elapsedSeconds: v.number(),
    timings: v.array(
      v.object({ examId: v.id("examQuestions"), seconds: v.number() }),
    ),
  },
  handler: async (ctx, { attemptId, elapsedSeconds, timings }) => {
    const userId = await requireUserId(ctx);
    const attempt = await ctx.db.get(attemptId);
    if (!attempt || attempt.userId !== userId) throw new Error("Mock not found.");

    // Only this attempt's questions are timed; anything else in the payload is
    // ignored rather than trusted.
    const allowed = new Set(attempt.items.map((item) => item.examId));
    const timingMap = new Map(
      timings
        .filter((timing) => allowed.has(timing.examId))
        .map((timing) => [
          timing.examId,
          Math.max(0, Math.min(6 * 60 * 60, Math.round(timing.seconds))),
        ]),
    );

    const rows = [];
    let earned = 0;
    let marksSeen = 0;
    for (const item of attempt.items) {
      const exam = await ctx.db.get(item.examId);
      const awarded = exam?.awardedMarks ?? null;
      if (awarded !== null) {
        earned += awarded;
        marksSeen += item.marks;
      }
      rows.push({
        examId: item.examId,
        marks: item.marks,
        awardedMarks: awarded,
        seconds: timingMap.get(item.examId) ?? 0,
      });
    }

    const now = Date.now();
    await ctx.db.patch(attemptId, {
      status: "finished",
      finishedAt: now,
      elapsedSeconds: Math.max(0, Math.round(elapsedSeconds)),
      items: attempt.items.map((item) => ({
        ...item,
        seconds: timingMap.get(item.examId) ?? 0,
      })),
    });

    const secondsUsed = rows.reduce((sum, row) => sum + (row.seconds ?? 0), 0);
    return {
      totalMarks: attempt.totalMarks,
      earnedMarks: earned,
      marksSeen,
      secondsAllowed: attempt.secondsAllowed,
      secondsUsed,
      rows,
      // Seconds per mark, so a slow question is visible next to a lost mark.
      secondsPerMark: rows.map((row) => ({
        examId: row.examId,
        seconds: row.seconds ?? 0,
        marks: row.marks,
        perMark: Math.round((row.seconds ?? 0) / Math.max(1, row.marks)),
      })),
    };
  },
});

/** The last few mocks on a set, so the student can see time improving. */
export const recent = query({
  args: { setId: v.id("studySets") },
  handler: async (ctx, { setId }) => {
    const userId = await requireUserId(ctx);
    const set = await ctx.db.get(setId);
    if (!set || set.userId !== userId) return [];
    const rows = await ctx.db
      .query("mockAttempts")
      .withIndex("by_user_set", (q) => q.eq("userId", userId).eq("setId", setId))
      .order("desc")
      .take(5);
    const result = [];
    for (const row of rows) {
      result.push({
        _id: row._id,
        status: row.status,
        totalMarks: row.totalMarks,
        secondsAllowed: row.secondsAllowed,
        elapsedSeconds: row.elapsedSeconds ?? null,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt ?? null,
        earnedMarks:
          row.status === "finished" ? await earnedFor(ctx, row.items) : null,
      });
    }
    return result;
  },
});

/** The marks this attempt earned, read back from the graded questions. */
async function earnedFor(
  ctx: { db: { get: (id: Id<"examQuestions">) => Promise<{ awardedMarks?: number } | null> } },
  items: Array<{ examId: Id<"examQuestions"> }>,
): Promise<number> {
  let earned = 0;
  for (const item of items) {
    const exam = await ctx.db.get(item.examId);
    earned += exam?.awardedMarks ?? 0;
  }
  return earned;
}
