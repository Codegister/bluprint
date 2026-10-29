/**
 * Insights that compare two sources of truth: what the student thinks they know
 * (card self-ratings) and what the quiz says. One query, because the comparison
 * only means anything when both sides come from the same sets.
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import {
  calibrationFor,
  calibrationSentence,
  type CalibrationRow,
} from "./lib/calibration";

export const calibration = query({
  args: {},
  handler: async (ctx) => {
    // Signed out has no calibration to compare, not an internal failure. The
    // empty result keeps the public HTTP path returning JSON instead of a
    // redacted error while exposing nothing.
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { rows: [], sentence: null };
    const sets = await ctx.db
      .query("studySets")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .take(20);

    const rows: CalibrationRow[] = [];
    for (const set of sets) {
      if (set.status !== "ready") continue;
      const [cards, quiz] = await Promise.all([
        ctx.db.query("flashcards").withIndex("by_set", (q) => q.eq("setId", set._id)).collect(),
        ctx.db.query("quizQuestions").withIndex("by_set", (q) => q.eq("setId", set._id)).collect(),
      ]);
      const answered = quiz.filter((question) => question.lastCorrect !== undefined);
      const row = calibrationFor({
        setId: set._id,
        title: set.title,
        cards: cards.map((card) => ({
          lastRating: card.lastRating,
          reviewCount: card.reviewCount,
        })),
        quiz: {
          answered: answered.length,
          correct: answered.filter((question) => question.lastCorrect === true).length,
        },
      });
      if (row) rows.push(row);
    }

    rows.sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0));
    return { rows, sentence: calibrationSentence(rows) };
  },
});
