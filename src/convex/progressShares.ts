/**
 * Read-only progress links.
 *
 * A teacher or parent gets a page showing coverage, streak and weak topics —
 * aggregates only. Notes, cards, answers and marks never cross the boundary,
 * and revoking the link stops it answering immediately.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/requireUser";
import { currentStreak, examReadiness } from "./lib/studyMetrics";
import { specCoverage } from "./lib/specMapping";

/** 32 hex characters from the platform's random source. */
function makeToken(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    // One live link per account keeps it easy to revoke and hard to lose track
    // of; an old one is revoked when a new one is made.
    const existing = await ctx.db
      .query("progressShares")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const row of existing) {
      if (row.revokedAt === undefined) {
        await ctx.db.patch(row._id, { revokedAt: now });
      }
    }
    const token = makeToken();
    await ctx.db.insert("progressShares", { userId, token, createdAt: now });
    return { token, path: `/share/${token}` };
  },
});

export const revoke = mutation({
  args: { shareId: v.id("progressShares") },
  handler: async (ctx, { shareId }) => {
    const userId = await requireUserId(ctx);
    const row = await ctx.db.get(shareId);
    if (!row || row.userId !== userId) throw new Error("Link not found.");
    await ctx.db.patch(shareId, { revokedAt: Date.now() });
  },
});

/** The account's own links, so a stale one can be revoked. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("progressShares")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(10);
    return rows.map((row) => ({
      _id: row._id,
      token: row.token,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt ?? null,
      active: row.revokedAt === undefined,
    }));
  },
});

/**
 * The public page. Returns null for an unknown or revoked token, so the route
 * can say the link has been retired without revealing whether it ever existed.
 */
export const publicProgress = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (token.length < 20) return null;
    const share = await ctx.db
      .query("progressShares")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!share || share.revokedAt !== undefined) return null;

    const user = await ctx.db.get(share.userId);
    const sets = await ctx.db
      .query("studySets")
      .withIndex("by_user_updated", (q) => q.eq("userId", share.userId))
      .collect();
    const ready = sets.filter((set) => set.status === "ready");

    const now = Date.now();
    const topics = [];
    let cards = 0;
    let known = 0;
    let readinessTotal = 0;
    let specCovered = 0;
    let specTotal = 0;

    for (const set of ready.slice(0, 40)) {
      const [cardRows, quizRows, examRows] = await Promise.all([
        ctx.db.query("flashcards").withIndex("by_set", (q) => q.eq("setId", set._id)).collect(),
        ctx.db.query("quizQuestions").withIndex("by_set", (q) => q.eq("setId", set._id)).collect(),
        ctx.db.query("examQuestions").withIndex("by_set", (q) => q.eq("setId", set._id)).collect(),
      ]);
      const graded = examRows.filter((exam) => exam.gradedAt !== undefined);
      const readiness = examReadiness({
        cards: cardRows,
        quiz: set.lastQuizTotal
          ? { score: set.lastQuizScore ?? 0, total: set.lastQuizTotal }
          : null,
        exam:
          graded.length > 0
            ? {
                earned: graded.reduce((sum, exam) => sum + (exam.awardedMarks ?? 0), 0),
                total: graded.reduce((sum, exam) => sum + exam.marks, 0),
              }
            : null,
        at: now,
      });

      cards += cardRows.length;
      known += cardRows.filter((card) => card.status === "known").length;
      readinessTotal += readiness.score;

      const coverage = specCoverage(set.specPoints ?? [], [
        ...cardRows,
        ...quizRows,
        ...examRows,
      ]);
      if (coverage.total > 0) {
        specCovered += coverage.covered.length;
        specTotal += coverage.total;
      }

      topics.push({
        title: set.title,
        subject: set.course ?? null,
        readiness: readiness.score,
        band: readiness.band,
        cards: cardRows.length,
        lastStudiedAt: set.lastStudiedAt ?? null,
        weakest: coverage.uncovered.slice(0, 2).map((point) => point.text),
      });
    }

    const days = await ctx.db
      .query("studyDays")
      .withIndex("by_user_day", (q) => q.eq("userId", share.userId))
      .order("desc")
      .take(120);
    const streak = currentStreak(
      days.map((row) => ({
        day: row.day,
        questions: row.questionsAnswered ?? row.cardsReviewed,
      })),
      now,
    );

    // Weakest first: that is what a teacher should look at.
    const weakest = [...topics]
      .filter((topic) => topic.readiness < 70)
      .sort((a, b) => a.readiness - b.readiness)
      .slice(0, 5);

    return {
      // A first name only: enough for a teacher to recognise, not an identity.
      name: (user?.name ?? "").trim().split(/\s+/)[0] || null,
      createdAt: share.createdAt,
      streak,
      sets: topics.length,
      cards,
      known,
      averageReadiness: topics.length > 0 ? Math.round(readinessTotal / topics.length) : 0,
      specification: specTotal > 0 ? { covered: specCovered, total: specTotal } : null,
      weakest,
      topics: topics.slice(0, 12),
    };
  },
});
