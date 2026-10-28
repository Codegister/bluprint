/**
 * Export data.
 *
 * Every format is built from the same rows the app shows, so an export is a
 * copy of the account rather than a summary of it. The client turns these into
 * CSV, Anki text and a JSON file (see src/lib/studyExport.ts).
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUserId } from "./lib/requireUser";
import { currentStreak } from "./lib/studyMetrics";

export const forSet = query({
  args: { setId: v.id("studySets") },
  handler: async (ctx, { setId }) => {
    const userId = await requireUserId(ctx);
    const set = await ctx.db.get(setId);
    if (!set || set.userId !== userId) return null;

    const [cards, quiz, exam] = await Promise.all([
      ctx.db.query("flashcards").withIndex("by_set", (q) => q.eq("setId", setId)).collect(),
      ctx.db.query("quizQuestions").withIndex("by_set", (q) => q.eq("setId", setId)).collect(),
      ctx.db.query("examQuestions").withIndex("by_set", (q) => q.eq("setId", setId)).collect(),
    ]);
    const byOrder = <T extends { order: number }>(rows: T[]) =>
      [...rows].sort((a, b) => a.order - b.order);

    return {
      title: set.title,
      course: set.course ?? null,
      examBoard: set.examBoard ?? null,
      level: set.level ?? null,
      notes: set.notes,
      summary: set.summary ?? null,
      createdAt: set._creationTime,
      cards: byOrder(cards).map((card) => ({
        front: card.front,
        back: card.back,
        status: card.status,
        lastRating: card.lastRating ?? null,
      })),
      quiz: byOrder(quiz).map((question) => ({
        question: question.question,
        options: question.options,
        answer: question.answer ?? question.options[question.correctIndex] ?? "",
        explanation: question.explanation,
        lastAnswer: question.lastAnswer ?? null,
        lastCorrect: question.lastCorrect ?? null,
      })),
      exam: byOrder(exam).map((row) => ({
        question: row.question,
        marks: row.marks,
        modelAnswer: row.modelAnswer,
        criteria: row.criteria ?? [],
        markingGuide: row.markingGuide,
        answer: row.userAnswer ?? null,
        awardedMarks: row.awardedMarks ?? null,
        checklist: row.checklist ?? [],
      })),
    };
  },
});

/** Everything in the account, for the JSON export. */
export const forAccount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    const sets = await ctx.db
      .query("studySets")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .collect();

    const exported = [];
    for (const set of sets) {
      const [cards, quiz, exam] = await Promise.all([
        ctx.db.query("flashcards").withIndex("by_set", (q) => q.eq("setId", set._id)).collect(),
        ctx.db.query("quizQuestions").withIndex("by_set", (q) => q.eq("setId", set._id)).collect(),
        ctx.db.query("examQuestions").withIndex("by_set", (q) => q.eq("setId", set._id)).collect(),
      ]);
      const byOrder = <T extends { order: number }>(rows: T[]) =>
        [...rows].sort((a, b) => a.order - b.order);
      exported.push({
        title: set.title,
        course: set.course ?? undefined,
        examBoard: set.examBoard ?? undefined,
        level: set.level ?? undefined,
        notes: set.notes,
        createdAt: set._creationTime,
        summary: set.summary ?? undefined,
        cards: byOrder(cards).map((card) => ({ front: card.front, back: card.back })),
        quiz: byOrder(quiz).map((question) => ({
          question: question.question,
          options: question.options,
          answer: question.answer ?? question.options[question.correctIndex] ?? "",
          explanation: question.explanation,
          lastAnswer: question.lastAnswer ?? undefined,
          lastCorrect: question.lastCorrect ?? undefined,
        })),
        exam: byOrder(exam).map((row) => ({
          question: row.question,
          marks: row.marks,
          modelAnswer: row.modelAnswer,
          criteria: (row.criteria ?? []).map((criterion) => ({
            marks: criterion.marks,
            text: criterion.text,
          })),
          answer: row.userAnswer ?? undefined,
          awardedMarks: row.awardedMarks ?? undefined,
          checklist: (row.checklist ?? []).map((check) => ({
            point: check.point,
            marks: check.marks,
            awarded: check.awarded,
            evidence: check.evidence,
          })),
        })),
      });
    }

    const days = await ctx.db
      .query("studyDays")
      .withIndex("by_user_day", (q) => q.eq("userId", userId))
      .order("desc")
      .take(365);
    const now = Date.now();
    const rows = days.map((row) => ({
      day: row.day,
      questions: row.questionsAnswered ?? row.cardsReviewed,
    }));

    return {
      email: user?.email ?? null,
      name: user?.name ?? null,
      exportedAt: now,
      streak: {
        current: currentStreak(rows, now),
        activeDays: rows.filter((row) => row.questions > 0).length,
      },
      sets: exported,
    };
  },
});
