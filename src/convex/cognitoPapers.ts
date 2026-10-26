import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { requireOwner } from "./lib/authorization";
import { fetchCognitoPapers } from "./lib/cognitoPapers";
import { requireUserId } from "./lib/requireUser";

/**
 * The real past papers published for a course.
 *
 * Cognito publishes every course's board papers, sorted by year and again by
 * topic. That index is read once per course, stored under a course signature,
 * and shared: two friends studying the same qualification see the same list and
 * Cognito is only visited when the index is missing or months old.
 *
 * Only the index is stored — the paper titles, their series and the links to the
 * official PDFs. The papers and mark schemes themselves are the exam boards'
 * copyright, so the app opens them at the source instead of copying them.
 */

/** Re-read a course's index after this long, so newly released papers appear. */
const REFRESH_AFTER_MS = 30 * 86_400_000;
/** A read that has not moved in this long is treated as stalled. */
const STALE_MS = 5 * 60 * 1000;

/** The course fields the Cognito route depends on, and nothing else. */
const courseSignature = v.object({
  subject: v.string(),
  level: v.string(),
  examBoard: v.string(),
  tier: v.optional(v.string()),
  variant: v.optional(v.string()),
});

/** Course fields that decide which Cognito page a course maps to. */
function courseKey(course: Doc<"courses">): string {
  return [
    course.subject,
    course.level,
    course.examBoard,
    course.variant ?? "",
    course.tier ?? "",
  ]
    .join("|")
    .toLowerCase();
}

/** "GCSE Biology · AQA · Higher tier" — what the library section is labelled. */
function courseLabel(course: Doc<"courses">): string {
  return [
    `${course.level} ${course.subject}`.trim(),
    course.examBoard && course.examBoard !== "None" ? course.examBoard : null,
    course.variant,
    course.tier ? `${course.tier} tier` : null,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" · ");
}

function signatureOf(course: Doc<"courses">) {
  return {
    subject: course.subject,
    level: course.level,
    examBoard: course.examBoard,
    ...(course.tier ? { tier: course.tier } : {}),
    ...(course.variant ? { variant: course.variant } : {}),
  };
}

function stale(row: Doc<"cognitoPaperIndexes">): boolean {
  return (
    row.status === "processing" &&
    (row.processingStartedAt === undefined ||
      Date.now() - row.processingStartedAt > STALE_MS)
  );
}

/**
 * The stored index for one course. Returns null before the first read has been
 * requested, and a `ready` row with no papers when Cognito publishes none for
 * the course.
 */
export const getForCourse = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const userId = await requireUserId(ctx);
    const course = await ctx.db.get(courseId);
    if (!course || course.userId !== userId) return null;

    const row = await ctx.db
      .query("cognitoPaperIndexes")
      .withIndex("by_key", (q) => q.eq("key", courseKey(course)))
      .first();
    if (!row) return null;

    return {
      status: row.status,
      errorMessage: row.errorMessage,
      sourceUrl: row.sourceUrl,
      description: row.description,
      fetchedAt: row.fetchedAt,
      byYear: row.byYear,
      byTopic: row.byTopic,
      paperCount: row.byYear.length,
      topicCount: row.byTopic.length,
      processingStale: stale(row),
    };
  },
});

/**
 * Starts the first read for a course, or refreshes one that has gone old.
 * Called when the course's past-paper section opens, so a student never has to
 * ask for it. A read already in flight is never duplicated.
 */
export const ensureForCourse = mutation({
  args: { courseId: v.id("courses"), force: v.optional(v.boolean()) },
  handler: async (ctx, { courseId, force }) => {
    const userId = await requireUserId(ctx);
    const course = (await requireOwner(
      await ctx.db.get(courseId),
      userId,
    )) as Doc<"courses">;

    // The Cognito route is derived from the finished pathway's course, so there
    // is nothing to read until that course is ready.
    if (course.status !== "ready") return { status: "pending" as const };

    const key = courseKey(course);
    const label = courseLabel(course);
    const courseFields = signatureOf(course);
    const now = Date.now();

    const existing = await ctx.db
      .query("cognitoPaperIndexes")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();

    if (existing) {
      const fresh =
        existing.status === "ready" &&
        (existing.fetchedAt ?? 0) + REFRESH_AFTER_MS > now;
      if (fresh && !force) return { status: "ready" as const };

      const running =
        existing.status === "processing" &&
        existing.processingStartedAt !== undefined &&
        now - existing.processingStartedAt < STALE_MS;
      if (running && !force) return { status: "processing" as const };

      await ctx.db.patch(existing._id, {
        status: "queued",
        label,
        errorMessage: undefined,
        processingStartedAt: undefined,
      });
      await ctx.scheduler.runAfter(0, internal.cognitoPapers.sync, {
        key,
        label,
        course: courseFields,
      });
      return { status: "queued" as const };
    }

    await ctx.db.insert("cognitoPaperIndexes", {
      key,
      label,
      sourceUrl: "",
      status: "queued",
      byYear: [],
      byTopic: [],
    });
    await ctx.scheduler.runAfter(0, internal.cognitoPapers.sync, {
      key,
      label,
      course: courseFields,
    });
    return { status: "queued" as const };
  },
});

/** Reads both Cognito views for one course and stores the index. */
export const sync = internalAction({
  args: {
    key: v.string(),
    label: v.string(),
    course: courseSignature,
  },
  handler: async (ctx, { key, label, course }): Promise<{ ok: boolean }> => {
    const claim = await ctx.runMutation(internal.cognitoPapers.claimSync, { key });
    if (!claim.claimed) return { ok: false };

    try {
      const index = await fetchCognitoPapers(course);
      await ctx.runMutation(internal.cognitoPapers.completeSync, {
        key,
        label,
        sourceUrl: index?.sourceUrl ?? "",
        description: index?.description,
        byYear: index?.byYear ?? [],
        byTopic: index?.byTopic ?? [],
      });
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Cognito's past papers could not be read. Try again in a moment.";
      await ctx.runMutation(internal.cognitoPapers.failSync, { key, message });
      return { ok: false };
    }
  },
});

/** Takes ownership of a read so two schedulers cannot fetch the same page. */
export const claimSync = internalMutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const row = await ctx.db
      .query("cognitoPaperIndexes")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (!row) return { claimed: false };

    const now = Date.now();
    const running =
      row.status === "processing" &&
      row.processingStartedAt !== undefined &&
      now - row.processingStartedAt < STALE_MS;
    if (running) return { claimed: false };

    await ctx.db.patch(row._id, {
      status: "processing",
      errorMessage: undefined,
      processingStartedAt: now,
    });
    return { claimed: true };
  },
});

/**
 * Stores the finished index. Empty lists are a valid result: Cognito simply
 * publishes no papers for that course, which is different from a failed read.
 */
export const completeSync = internalMutation({
  args: {
    key: v.string(),
    label: v.string(),
    sourceUrl: v.string(),
    description: v.optional(v.string()),
    byYear: v.array(
      v.object({
        label: v.string(),
        year: v.optional(v.string()),
        specification: v.optional(v.string()),
        questionPaperUrl: v.string(),
        markSchemeUrl: v.optional(v.string()),
      }),
    ),
    byTopic: v.array(
      v.object({
        topic: v.string(),
        unit: v.optional(v.string()),
        questionPaperUrl: v.string(),
        markSchemeUrl: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("cognitoPaperIndexes")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (!row) return;

    await ctx.db.patch(row._id, {
      label: args.label,
      sourceUrl: args.sourceUrl,
      description: args.description,
      byYear: args.byYear,
      byTopic: args.byTopic,
      status: "ready",
      errorMessage: undefined,
      processingStartedAt: undefined,
      fetchedAt: Date.now(),
    });
  },
});

export const failSync = internalMutation({
  args: { key: v.string(), message: v.string() },
  handler: async (ctx, { key, message }) => {
    const row = await ctx.db
      .query("cognitoPaperIndexes")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (!row) return;

    await ctx.db.patch(row._id, {
      status: "error",
      errorMessage: message.slice(0, 400),
      processingStartedAt: undefined,
    });
  },
});
