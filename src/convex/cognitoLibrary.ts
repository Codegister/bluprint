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
  fetchCognitoPage,
  parseCognitoPastPaperIndex,
  parseCognitoTopicLinks,
  parseCognitoTopicPage,
  topicNotesPages,
  type CognitoNoteSection,
} from "./lib/cognito";
import {
  topicNotesOriginValidator,
  type TopicNotesOrigin,
} from "./lib/topicNotes";

/**
 * Cognito content shown inside Bluprint, plus the notes Bluprint writes when
 * Cognito publishes none.
 *
 * A course pathway already comes from Cognito, and the same course page also
 * publishes the notes for each topic and the real past papers. Both are read on
 * request and stored, so the student reads them here rather than being sent to
 * another site, and a topic is only scraped once.
 *
 * Some courses have no published notes to read: Edexcel GCSE Religious Studies
 * is saved Pearson content with no Cognito page, and AQA GCSE Spanish has only
 * a specification page. Those topics get notes written with NVIDIA instead, and
 * the copy is marked so the reader can say who wrote it. Papers are always
 * Cognito's own list and PDF files.
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
    return rows[0] ?? null;
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
    return rows[0] ?? null;
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
    // Defaults to Cognito: every caller but the notes writer read a page.
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
      origin: origin ?? "cognito",
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

/**
 * The notes a topic's own published pages hold. A topic is several subtopic
 * pages, so this reads them politely in small batches. Returns empty when the
 * course publishes nothing for this topic — the caller decides what to do then.
 */
async function readPublishedNotes(
  notesUrl: string,
  topic: { title: string; reference?: string },
): Promise<{ sections: CognitoNoteSection[]; sources: Array<{ title: string; url: string }> }> {
  const index = await fetchCognitoPage(notesUrl);
  if (!index) {
    throw new Error(
      "Cognito's notes could not be reached just now. Try again in a moment.",
    );
  }

  const pages = topicNotesPages(parseCognitoTopicLinks(index.html), topic);
  if (pages.length === 0) return { sections: [], sources: [] };

  const read = await inBatches(pages, NOTES_CONCURRENCY, async (page) => {
    const html = await fetchCognitoPage(page.url);
    return html ? parseCognitoTopicPage(html.html) : [];
  });

  const sections: CognitoNoteSection[] = read
    .flat()
    .slice(0, MAX_SECTIONS)
    .map((section) => ({
      heading: section.heading,
      blocks: section.blocks,
    }));
  // Pages that exist but carried no notes are not worth citing.
  if (sections.length === 0) return { sections: [], sources: [] };
  return {
    sections,
    sources: pages.map((page) => ({ title: page.title, url: page.url })),
  };
}

/**
 * The notes for one pathway topic, stored so the next visit is instant.
 *
 * Cognito's published notes are read first whenever the course has them. A
 * topic with nothing published — Edexcel GCSE RS, AQA GCSE Spanish, or a note
 * page whose leaf pages do not match this topic — is written with NVIDIA
 * instead, so no course is left without a notes tab. Either way the stored copy
 * records who wrote it.
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
    // Cognito does not cover, so it is treated as missing and replaced.
    if (
      cached &&
      cached.sections.length > 0 &&
      Date.now() - cached.fetchedAt < NOTES_TTL
    ) {
      return {
        sections: cached.sections.length,
        cached: true,
        origin: cached.origin ?? "cognito",
      };
    }

    const topic = findTopic(course, topicId);
    if (!topic) throw new Error("That topic is not part of this pathway.");

    const notesUrl = course.pathway?.sourceUrl;
    const published = notesUrl
      ? await readPublishedNotes(notesUrl, topic)
      : { sections: [], sources: [] };

    if (published.sections.length > 0) {
      await ctx.runMutation(internal.cognitoLibrary.saveTopicNotes, {
        courseId,
        topicId,
        sections: published.sections,
        sources: published.sources,
        origin: "cognito",
      });
      return {
        sections: published.sections.length,
        cached: false,
        origin: "cognito",
      };
    }

    // Nothing published for this topic, so Bluprint writes the notes and stores
    // them under its own name.
    const written = await ctx.runAction(internal.ai.writeTopicNotes, {
      courseId,
      topicId,
      userId,
    });
    return { sections: written.sections, cached: false, origin: "bluprint" };
  },
});

/**
 * Reads the real past papers Cognito lists for a course and stores the list.
 * The list is shown in Bluprint; the files themselves are opened in the app's
 * own viewer rather than sending the student to the site.
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
    if (cached && Date.now() - cached.fetchedAt < PAPERS_TTL) {
      return {
        papers: cached.papers.length,
        cached: true,
        sourceUrl: cached.sourceUrl,
      };
    }

    const notesUrl = course.pathway?.sourceUrl;
    if (!notesUrl) {
      throw new Error(
        "Cognito does not publish papers for this course, so there is nothing to show here yet.",
      );
    }
    const baseUrl = notesUrl.replace(/\/notes\/?$/i, "");
    const sourceUrl = `${baseUrl}/past-papers/by-year`;
    const page = await fetchCognitoPage(sourceUrl);
    if (!page) {
      throw new Error(
        "Cognito's past-paper list could not be reached just now. Try again in a moment.",
      );
    }

    const papers = parseCognitoPastPaperIndex(page.html);
    await ctx.runMutation(internal.cognitoLibrary.savePastPapers, {
      courseId,
      sourceUrl,
      papers,
    });
    return { papers: papers.length, cached: false, sourceUrl };
  },
});
