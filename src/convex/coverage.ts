/**
 * Specification coverage.
 *
 * Cards and questions are tagged at build time (lib/specMapping.ts); this module
 * turns those tags into "X of Y spec points covered" for a set and for a whole
 * course, and lists what has no material behind it yet. A course used to sit at
 * 0% with no content linked to it; this is the link.
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUserId } from "./lib/requireUser";
import { specCoverage, type SpecPoint } from "./lib/specMapping";

async function itemsForSet(
  ctx: { db: { query: (table: "flashcards" | "quizQuestions" | "examQuestions") => any } },
  setId: Parameters<typeof specCoverage>[1] extends Array<infer _> ? any : never,
) {
  // Typed loosely on purpose: three different tables, one shape of answer.
  const [cards, quiz, exam] = await Promise.all([
    ctx.db.query("flashcards").withIndex("by_set", (q: any) => q.eq("setId", setId)).collect(),
    ctx.db.query("quizQuestions").withIndex("by_set", (q: any) => q.eq("setId", setId)).collect(),
    ctx.db.query("examQuestions").withIndex("by_set", (q: any) => q.eq("setId", setId)).collect(),
  ]);
  return { cards, quiz, exam };
}

/** Coverage for one set, with the statements that have nothing behind them. */
export const forSet = query({
  args: { setId: v.id("studySets") },
  handler: async (ctx, { setId }) => {
    const userId = await requireUserId(ctx);
    const set = await ctx.db.get(setId);
    if (!set || set.userId !== userId) return null;

    const points = (set.specPoints ?? []) as SpecPoint[];
    const { cards, quiz, exam } = await itemsForSet(ctx, setId);
    const coverage = specCoverage(points, [...cards, ...quiz, ...exam]);
    const tagged = (rows: Array<{ specRef?: string }>) =>
      rows.filter((row) => (row.specRef ?? "").length > 0).length;

    return {
      points,
      coverage,
      tagged: {
        cards: tagged(cards),
        quiz: tagged(quiz),
        exam: tagged(exam),
        cardsTotal: cards.length,
        quizTotal: quiz.length,
        examTotal: exam.length,
      },
      // True when the set has no course specification to map to at all.
      unmapped: points.length === 0,
    };
  },
});

/**
 * Coverage across a whole course, counted per topic. Statements come from the
 * pathway, so a topic with no set is listed as uncovered rather than ignored.
 */
export const forCourse = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const userId = await requireUserId(ctx);
    const course = await ctx.db.get(courseId);
    if (!course || course.userId !== userId) return null;
    if (!course.pathway) {
      return { topics: [], totals: { covered: 0, total: 0, percent: 0 }, unmapped: true };
    }

    const sets = await ctx.db
      .query("studySets")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();

    // Every statement the course has, by id, and the tags that cover it.
    const coveredIds = new Set<string>();
    for (const set of sets) {
      if (set.status !== "ready") continue;
      const { cards, quiz, exam } = await itemsForSet(ctx, set._id);
      for (const row of [...cards, ...quiz, ...exam]) {
        if (row.specRef) coveredIds.add(row.specRef);
      }
    }

    const topics = course.pathway.units.flatMap((unit) =>
      unit.topics.map((topic) => {
        const points: SpecPoint[] = topic.keyPoints.map((text, index) => ({
          id: `${topic.id}:${index}`,
          text: `${topic.specReference ? `${topic.specReference} ` : ""}${text}`,
        }));
        const covered = points.filter((point) => coveredIds.has(point.id));
        return {
          id: topic.id,
          title: topic.title,
          unit: unit.title,
          covered: covered.length,
          total: points.length,
          percent: points.length > 0 ? Math.round((covered.length / points.length) * 100) : 0,
          uncovered: points
            .filter((point) => !coveredIds.has(point.id))
            .slice(0, 3)
            .map((point) => point.text),
        };
      }),
    );

    const covered = topics.reduce((sum, topic) => sum + topic.covered, 0);
    const total = topics.reduce((sum, topic) => sum + topic.total, 0);
    return {
      topics,
      totals: {
        covered,
        total,
        percent: total > 0 ? Math.round((covered / total) * 100) : 0,
      },
      unmapped: total === 0,
    };
  },
});
