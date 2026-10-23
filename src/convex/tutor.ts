import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { requireUserId } from "./lib/requireUser";

/**
 * Saved AI tutor threads, one per study set.
 *
 * The browser only reads a thread through `listMessages`, which returns no
 * note text and nothing belonging to another account. The Node action in
 * `ai.ts` asks for a bounded slice of history before calling NVIDIA, then
 * saves the question and answer together so a failed call never leaves a
 * half-written conversation.
 */

/** How many previous turns are replayed as context for the next answer. */
const HISTORY_LIMIT = 10;

/**
 * `_creationTime` can tie for rows inserted in one transaction, so the saved
 * `createdAt` decides the order and the student's question always precedes the
 * reply.
 */
function inConversationOrder<
  T extends { createdAt: number; role: "user" | "assistant"; _creationTime: number },
>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      a.createdAt - b.createdAt ||
      a._creationTime - b._creationTime ||
      (a.role === "user" ? -1 : 1),
  );
}

export const listMessages = query({
  args: { setId: v.id("studySets") },
  handler: async (ctx, { setId }) => {
    const userId = await requireUserId(ctx);
    const set = await ctx.db.get(setId);
    // A set that belongs to someone else reads as an empty conversation
    // rather than an error, so an old link cannot confirm it exists.
    if (!set || set.userId !== userId) return [];

    const rows = await ctx.db
      .query("tutorMessages")
      .withIndex("by_set", (q) => q.eq("setId", setId))
      .order("asc")
      .collect();

    return inConversationOrder(rows).map((row) => ({
      _id: row._id,
      role: row.role,
      content: row.content,
      createdAt: row.createdAt,
    }));
  },
});

/** Everything the action needs: the set's material plus recent turns. */
export const getTutorContext = internalQuery({
  args: { setId: v.id("studySets"), userId: v.id("users") },
  handler: async (ctx, { setId, userId }) => {
    const set = await ctx.db.get(setId);
    if (!set || set.userId !== userId) return null;

    const rows = await ctx.db
      .query("tutorMessages")
      .withIndex("by_set", (q) => q.eq("setId", setId))
      .order("asc")
      .collect();

    return {
      set: {
        title: set.title,
        notes: set.notes,
        course: set.course,
        examBoard: set.examBoard,
        level: set.level,
      },
      messages: inConversationOrder(rows)
        .slice(-HISTORY_LIMIT)
        .map((row) => ({ role: row.role, content: row.content })),
    };
  },
});

/** Saves one completed exchange once the model has returned a usable answer. */
export const saveExchange = internalMutation({
  args: {
    setId: v.id("studySets"),
    userId: v.id("users"),
    question: v.string(),
    answer: v.string(),
  },
  handler: async (ctx, { setId, userId, question, answer }) => {
    const set = await ctx.db.get(setId);
    if (!set || set.userId !== userId) throw new Error("Study set not found.");

    const now = Date.now();
    await ctx.db.insert("tutorMessages", {
      setId,
      userId,
      role: "user",
      content: question.slice(0, 1200),
      createdAt: now,
    });
    await ctx.db.insert("tutorMessages", {
      setId,
      userId,
      role: "assistant",
      content: answer.slice(0, 8000),
      createdAt: now + 1,
    });
    // Keeps the deck near the top of "Jump back in" after a tutoring session.
    await ctx.db.patch(setId, { lastStudiedAt: now, updatedAt: now });
  },
});

