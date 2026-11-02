import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { requireUserId } from "./lib/requireUser";
import {
  fetchSaveMyExamsPage,
  findSaveMyExamsNotesPages,
  parseSaveMyExamsNotePage,
  parseSaveMyExamsNotesIndex,
  parseSaveMyExamsPastPapers,
  resolveSaveMyExamsCourse,
  saveMyExamsSiteOrigin,
  type SaveMyExamsCourse,
  type SaveMyExamsNotesIndex,
} from "./lib/savemyexams";
import {
  cleanSections,
  topicNotesOriginValidator,
  type TopicNotesOrigin,
} from "./lib/topicNotes";

/**
 * Save My Exams content shown inside Bluprint, plus the notes Bluprint writes
 * when Save My Exams does not publish a matching course or topic.
 *
 * A course pathway comes from Cognito, but the notes and real past papers now
 * come from Save My Exams. Both are read on request and stored, so a topic is
 * only scraped once. Before anything is read, the Save My Exams course is
 * matched against the Bluprint course's level, subject, board and tier; a
 * wrong or ambiguous match is rejected rather than silently showing another
 * course's material.
 *
 * Some courses have no matching Save My Exams course (or no notes for a topic).
 * Those topics get notes written with NVIDIA instead, and the copy is marked so
 * the reader can say who wrote it. Papers are always the board's own PDFs,
 * indexed by Save My Exams.
 *
 * The table names still say "cognito" for compatibility with existing rows;
 * they are internal storage names, not the source the student is shown.
 */

/** Notes change rarely, so a cached copy is kept for a month. */
const NOTES_TTL = 30 * 24 * 60 * 60 * 1000;
/** Paper lists gain a new year once a year; a week is plenty. */
const PAPERS_TTL = 7 * 24 * 60 * 60 * 1000;
/** Subtopics are fetched in small parallel batches, politely. */
const NOTES_CONCURRENCY = 4;
const MAX_SECTIONS = 60;

const noteSection = v.object({
  heading: v.string(),
  blocks: v.array(v.string()),
});

const pastPaperRow = v.object({
  year: v.string(),
  label: v.string(),
  questionUrl: v.string(),
  markSchemeUrl: v.optional(v.string()),
});

/** The stored notes for one topic, or null before it has been read. */
export const getTopicNotes = query({
  args: { courseId: v.id("courses"), topicId: v.string() },
  handler: async (ctx, { courseId, topicId }) => {
    const userId = await requireUserId(ctx);
    const course = await ctx.db.get(courseId);
    if (!course || course.userId !== userId) return null;
    const rows = await ctx.db
      .query("cognitoTopicNotes")
      .withIndex("by_course_topic", (q) =>
        q.eq("courseId", courseId).eq("topicId", topicId),
      )
      .collect();
    // Rows read from Cognito before this source changed are not shown. The
    // action below sees them as stale and replaces them on the next visit.
    return (
      rows.find(
        (row) => row.origin === "savemyexams" || row.origin === "bluprint",
      ) ?? null
    );
  },
});

/** The stored real past-paper list for a course, or null. */
export const getPastPapers = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const userId = await requireUserId(ctx);
    const course = await ctx.db.get(courseId);
    if (!course || course.userId !== userId) return null;
    const rows = await ctx.db
      .query("cognitoPastPapers")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    return rows.find((row) => row.origin === "savemyexams") ?? null;
  },
});

export const readTopicNotes = internalQuery({
  args: { courseId: v.id("courses"), topicId: v.string() },
  handler: async (ctx, { courseId, topicId }) => {
    const rows = await ctx.db
      .query("cognitoTopicNotes")
      .withIndex("by_course_topic", (q) =>
        q.eq("courseId", courseId).eq("topicId", topicId),
      )
      .collect();
    return rows[0] ?? null;
  },
});

export const readPastPapers = internalQuery({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const rows = await ctx.db
      .query("cognitoPastPapers")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    return rows[0] ?? null;
  },
});

/** Replaces one topic's cached notes, however they were obtained. */
export const saveTopicNotes = internalMutation({
  args: {
    courseId: v.id("courses"),
    topicId: v.string(),
    sections: v.array(noteSection),
    sources: v.array(v.object({ title: v.string(), url: v.string() })),
    // Defaults to Save My Exams: every caller but the notes writer read a page.
    origin: v.optional(topicNotesOriginValidator),
  },
  handler: async (ctx, { courseId, topicId, sections, sources, origin }) => {
    const existing = await ctx.db
      .query("cognitoTopicNotes")
      .withIndex("by_course_topic", (q) =>
        q.eq("courseId", courseId).eq("topicId", topicId),
      )
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);
    await ctx.db.insert("cognitoTopicNotes", {
      courseId,
      topicId,
      sections,
      sources,
      origin: origin ?? "savemyexams",
      fetchedAt: Date.now(),
    });
  },
});

/** Replaces a course's cached real past-paper list. */
export const savePastPapers = internalMutation({
  args: {
    courseId: v.id("courses"),
    sourceUrl: v.string(),
    papers: v.array(pastPaperRow),
  },
  handler: async (ctx, { courseId, sourceUrl, papers }) => {
    const existing = await ctx.db
      .query("cognitoPastPapers")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);
    await ctx.db.insert("cognitoPastPapers", {
      courseId,
      sourceUrl,
      papers,
      origin: "savemyexams",
      fetchedAt: Date.now(),
    });
  },
});

/** Runs async work over a list with a fixed number of parallel requests. */
async function inBatches<T, R>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await run(items[index]!);
    }
  }
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/** Finds one topic in a stored pathway. */
function findTopic(
  course: Doc<"courses">,
  topicId: string,
): { title: string; reference?: string } | null {
  for (const unit of course.pathway?.units ?? []) {
    for (const topic of unit.topics) {
      if (topic.id === topicId) {
        return {
          title: topic.title,
          ...(topic.specReference ? { reference: topic.specReference } : {}),
        };
      }
    }
  }
  return null;
}

function lastPathSegment(url: string): string | undefined {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    return segments[segments.length - 1];
  } catch {
    return undefined;
  }
}

/**
 * The notes a topic's own published pages hold. A topic is several subtopic
 * pages, so this reads them politely in small batches. Returns empty when the
 * course publishes nothing for this topic — the caller decides what to do then.
 */
async function readPublishedNotes(
  course: SaveMyExamsCourse,
  topic: { title: string; reference?: string },
): Promise<{
  sections: Array<{ heading: string; blocks: string[] }>;
  sources: Array<{ title: string; url: string }>;
}> {
  const indexes: SaveMyExamsNotesIndex[] = [];
  let reachedIndex = false;
  let indexError = false;
  for (const path of course.notesIndexPaths) {
    const response = await fetchSaveMyExamsPage(path);
    if (response.status === "ok") {
      reachedIndex = true;
      const parsed = parseSaveMyExamsNotesIndex(response.html);
      if (parsed) indexes.push(parsed);
    } else if (response.status === "error") {
      indexError = true;
    }
  }
  if (!reachedIndex && indexError) {
    throw new Error(
      "Save My Exams' notes could not be reached just now. Try again in a moment.",
    );
  }
  if (indexes.length === 0) return { sections: [], sources: [] };

  const pages = findSaveMyExamsNotesPages(indexes, topic);
  if (pages.length === 0) return { sections: [], sources: [] };

  let reachedPage = false;
  let pageError = false;
  const read = await inBatches(pages, NOTES_CONCURRENCY, async (page) => {
    const response = await fetchSaveMyExamsPage(page.url);
    if (response.status !== "ok") {
      if (response.status === "error") pageError = true;
      return null;
    }
    reachedPage = true;
    const sections = parseSaveMyExamsNotePage(
      response.html,
      page.indexBasePath,
      lastPathSegment(page.url),
    );
    return sections ? { page, sections } : null;
  });
  if (!reachedPage && pageError) {
    throw new Error(
      "Save My Exams' notes could not be reached just now. Try again in a moment.",
    );
  }

  const successful = read.filter(
    (result): result is NonNullable<typeof result> => result !== null,
  );
  const sections = cleanSections(
    successful.flatMap((result) => result.sections),
  ).slice(0, MAX_SECTIONS);
  // Pages that exist but carried no notes are not worth citing.
  if (sections.length === 0) return { sections: [], sources: [] };
  return {
    sections,
    sources: successful.map((result) => ({
      title: result.page.title,
      url: result.page.url,
    })),
  };
}

/**
 * The notes for one pathway topic, stored so the next visit is instant.
 *
 * Save My Exams' published notes are read first whenever the course has them.
 * When Save My Exams cannot be matched safely, or does not publish a note for
 * this topic, Bluprint writes the notes instead, so no course is left without
 * a notes tab. Either way the stored copy records who wrote it.
 */
export const loadTopicNotes = action({
  args: { courseId: v.id("courses"), topicId: v.string() },
  handler: async (
    ctx,
    { courseId, topicId },
  ): Promise<{ sections: number; cached: boolean; origin: TopicNotesOrigin }> => {
    const userId = await requireUserId(ctx);
    const course = await ctx.runQuery(internal.courses.getForBuild, { courseId });
    if (!course || course.userId !== userId) {
      throw new Error("That course was not found.");
    }

    const cached = await ctx.runQuery(internal.cognitoLibrary.readTopicNotes, {
      courseId,
      topicId,
    });
    // A copy with no sections was stored before notes were written for topics
    // Save My Exams does not cover, and a Cognito copy came from the old source;
    // both are treated as missing and replaced.
    const cacheable =
      cached?.origin === "savemyexams" || cached?.origin === "bluprint";
    if (
      cached &&
      cacheable &&
      cached.sections.length > 0 &&
      Date.now() - cached.fetchedAt < NOTES_TTL
    ) {
      return {
        sections: cached.sections.length,
        cached: true,
        origin: cached.origin === "bluprint" ? "bluprint" : "savemyexams",
      };
    }

    const topic = findTopic(course, topicId);
    if (!topic) throw new Error("That topic is not part of this pathway.");

    const resolved = await resolveSaveMyExamsCourse({
      level: course.level,
      subject: course.subject,
      examBoard: course.examBoard,
      ...(course.tier ? { tier: course.tier } : {}),
      ...(course.variant ? { variant: course.variant } : {}),
    });
    if (resolved.status === "unavailable") {
      throw new Error(
        "Save My Exams could not be reached just now. Try again in a moment.",
      );
    }

    if (resolved.status === "matched") {
      const published = await readPublishedNotes(resolved.course, topic);
      if (published.sections.length > 0) {
        await ctx.runMutation(internal.cognitoLibrary.saveTopicNotes, {
          courseId,
          topicId,
          sections: published.sections,
          sources: published.sources,
          origin: "savemyexams",
        });
        return {
          sections: published.sections.length,
          cached: false,
          origin: "savemyexams",
        };
      }
    }

    // No safe Save My Exams match for this topic, so Bluprint writes the notes
    // and stores them under its own name.
    const written = await ctx.runAction(internal.ai.writeTopicNotes, {
      courseId,
      topicId,
      userId,
    });
    return { sections: written.sections, cached: false, origin: "bluprint" };
  },
});

/**
 * Reads the real past papers Save My Exams indexes for a course and stores the
 * list. The list is shown in Bluprint; the files themselves are opened in the
 * board's own PDF viewer rather than sending the student to another index.
 */
export const loadPastPapers = action({
  args: { courseId: v.id("courses") },
  handler: async (
    ctx,
    { courseId },
  ): Promise<{ papers: number; cached: boolean; sourceUrl: string }> => {
    const userId = await requireUserId(ctx);
    const course = await ctx.runQuery(internal.courses.getForBuild, { courseId });
    if (!course || course.userId !== userId) {
      throw new Error("That course was not found.");
    }

    const cached = await ctx.runQuery(internal.cognitoLibrary.readPastPapers, {
      courseId,
    });
    if (
      cached?.origin === "savemyexams" &&
      Date.now() - cached.fetchedAt < PAPERS_TTL
    ) {
      return {
        papers: cached.papers.length,
        cached: true,
        sourceUrl: cached.sourceUrl,
      };
    }

    const resolved = await resolveSaveMyExamsCourse({
      level: course.level,
      subject: course.subject,
      examBoard: course.examBoard,
      ...(course.tier ? { tier: course.tier } : {}),
      ...(course.variant ? { variant: course.variant } : {}),
    });
    if (resolved.status === "unavailable") {
      throw new Error(
        "Save My Exams' past-paper list could not be reached just now. Try again in a moment.",
      );
    }

    // No matching course is a stable answer, not a temporary failure. Store an
    // empty list so the page can say so without retrying on every visit.
    if (resolved.status === "unmatched") {
      await ctx.runMutation(internal.cognitoLibrary.savePastPapers, {
        courseId,
        sourceUrl: saveMyExamsSiteOrigin(),
        papers: [],
      });
      return { papers: 0, cached: false, sourceUrl: "" };
    }

    const page = await fetchSaveMyExamsPage(resolved.course.pastPapersPath);
    if (page.status === "error") {
      throw new Error(
        "Save My Exams' past-paper list could not be reached just now. Try again in a moment.",
      );
    }

    const papers =
      page.status === "ok"
        ? parseSaveMyExamsPastPapers(page.html, {
            tier: course.tier,
            levelSlug: resolved.course.levelSlug,
            subjectSlug: resolved.course.subjectSlug,
            boardSlug: resolved.course.boardSlug,
          })
        : [];
    const sourceUrl = page.status === "ok" ? page.url : "";
    await ctx.runMutation(internal.cognitoLibrary.savePastPapers, {
      courseId,
      sourceUrl,
      papers,
    });
    return { papers: papers.length, cached: false, sourceUrl };
  },
});
