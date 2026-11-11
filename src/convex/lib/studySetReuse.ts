import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { BUILD_DEFAULTS } from "./buildDefaults";

/**
 * Reuse is deliberately limited to complete sets built from a course pathway.
 * Those briefs are assembled from the published pathway, never from a student's
 * pasted notes or photos, so one student's generated revision material can seed
 * another student's private copy without carrying any personal source material
 * or study history across.
 *
 * The key covers the exact brief, topic selection and requested lengths. A
 * pathway or generation change produces a different key, and an old cache row
 * is simply skipped.
 */

type SpecPoint = { id: string; text: string };

export type StudySetReuseKeyInput = {
  notes: string;
  course?: string;
  examBoard?: string;
  level?: string;
  topicIds: string[];
  specPoints?: SpecPoint[];
  targetCardCount: number;
  targetQuizCount: number;
  targetExamCount: number;
};

const CACHE_KEY_VERSION = 1;

function hash32(value: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  return hash >>> 0;
}

/** Stable, compact key for the exact build inputs. */
export function studySetReuseKey(input: StudySetReuseKeyInput): string {
  const payload = JSON.stringify({
    version: CACHE_KEY_VERSION,
    notes: input.notes.trim(),
    course: input.course ?? "",
    examBoard: input.examBoard ?? "",
    level: input.level ?? "",
    topicIds: input.topicIds,
    specPoints: (input.specPoints ?? []).map((point) => [point.id, point.text]),
    targetCardCount: input.targetCardCount,
    targetQuizCount: input.targetQuizCount,
    targetExamCount: input.targetExamCount,
  });
  // Two independent 32-bit hashes make an accidental collision negligible
  // without pulling a crypto dependency into the Convex mutation runtime.
  return `${hash32(payload, 0x811c9dc5).toString(36)}${hash32(
    payload,
    0x9e3779b9,
  ).toString(36)}`;
}

export function studySetReuseKeyForSet(set: Doc<"studySets">): string {
  return studySetReuseKey({
    notes: set.notes,
    course: set.course,
    examBoard: set.examBoard,
    level: set.level,
    topicIds: set.topicIds ?? (set.topicId ? [set.topicId] : []),
    specPoints: set.specPoints,
    targetCardCount: set.targetCardCount ?? BUILD_DEFAULTS.cards,
    targetQuizCount: set.targetQuizCount ?? BUILD_DEFAULTS.quiz,
    targetExamCount: set.targetExamCount ?? BUILD_DEFAULTS.exam,
  });
}

export function isReusableStudySet(set: Doc<"studySets">): boolean {
  return (
    set.status === "ready" &&
    set.courseId !== undefined &&
    set.sourceType === "text" &&
    set.sourceImageIds.length === 0 &&
    (set.topicIds?.length ?? 0) > 0 &&
    set.notes.trim().length > 0 &&
    set.summary !== undefined &&
    set.cardCount > 0 &&
    set.quizCount > 0 &&
    set.examCount > 0
  );
}

/**
 * Records a finished course-topic build as a source for future private copies.
 * Partial saves and failed builds are ignored. Best-effort callers should catch
 * around this; a cache write must never undo a completed set.
 */
export async function rememberStudySetForReuse(
  ctx: MutationCtx,
  setId: Id<"studySets">,
): Promise<void> {
  const set = await ctx.db.get(setId);
  if (!set || !isReusableStudySet(set)) return;

  const key = studySetReuseKeyForSet(set);
  const existing = await ctx.db
    .query("studySetCache")
    .withIndex("by_key", (q) => q.eq("cacheKey", key))
    .first();
  const now = Date.now();

  if (existing) {
    if (existing.sourceSetId !== setId) {
      await ctx.db.patch(existing._id, {
        sourceSetId: setId,
        lastUsedAt: now,
      });
    }
    return;
  }

  await ctx.db.insert("studySetCache", {
    cacheKey: key,
    sourceSetId: setId,
    createdAt: now,
    lastUsedAt: now,
    uses: 0,
  });
}

export type CachedStudySetArgs = {
  cacheKey: string;
  userId: Id<"users">;
  courseId: Id<"courses">;
  title: string;
  notes: string;
  sourceLabel: string;
  course?: string;
  examBoard?: string;
  level?: string;
  topicId: string;
  topicIds: string[];
  specPoints: SpecPoint[];
  targetCardCount: number;
  targetQuizCount: number;
  targetExamCount: number;
};

function byOrder<T extends { order: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.order - b.order);
}

/**
 * Creates a ready-to-study private copy from a cached source. Review counts,
 * due dates, quiz answers and marked exam answers are reset, so one student's
 * progress never appears in another student's set.
 *
 * Returns null when the cache row is missing or no longer usable, letting the
 * caller fall back to a normal queued build.
 */
export async function copyCachedStudySet(
  ctx: MutationCtx,
  args: CachedStudySetArgs,
): Promise<Id<"studySets"> | null> {
  const entry = await ctx.db
    .query("studySetCache")
    .withIndex("by_key", (q) => q.eq("cacheKey", args.cacheKey))
    .first();
  if (!entry) return null;

  const source = await ctx.db.get(entry.sourceSetId);
  if (
    !source ||
    !isReusableStudySet(source) ||
    !source.summary ||
    // A rebuild can change the source's brief while leaving the old cache key
    // behind. Never clone content that no longer belongs to the requested set.
    studySetReuseKeyForSet(source) !== args.cacheKey
  ) {
    await ctx.db.delete(entry._id);
    return null;
  }

  const [cards, quiz, exams] = await Promise.all([
    ctx.db
      .query("flashcards")
      .withIndex("by_set", (q) => q.eq("setId", source._id))
      .collect(),
    ctx.db
      .query("quizQuestions")
      .withIndex("by_set", (q) => q.eq("setId", source._id))
      .collect(),
    ctx.db
      .query("examQuestions")
      .withIndex("by_set", (q) => q.eq("setId", source._id))
      .collect(),
  ]);

  // A row that was being rebuilt, or an old cache entry left after a partial
  // write, must not produce a short deck that looks finished.
  if (
    cards.length === 0 ||
    quiz.length === 0 ||
    exams.length === 0 ||
    cards.length !== source.cardCount ||
    quiz.length !== source.quizCount ||
    exams.length !== source.examCount
  ) {
    await ctx.db.delete(entry._id);
    return null;
  }

  const now = Date.now();
  const setId = await ctx.db.insert("studySets", {
    userId: args.userId,
    title: args.title,
    titleSource: "auto",
    notes: args.notes,
    sourceType: "text",
    sourceLabel: args.sourceLabel,
    course: args.course,
    examBoard: args.examBoard,
    level: args.level,
    courseId: args.courseId,
    topicId: args.topicId,
    topicIds: args.topicIds,
    specPoints: args.specPoints,
    sourceImageIds: [],
    status: "ready",
    // The generator's warnings are about the material, not the source student,
    // and remain true for this copy.
    ...(source.generationNote !== undefined
      ? { generationNote: source.generationNote }
      : {}),
    ...(source.coverageNote !== undefined
      ? { coverageNote: source.coverageNote }
      : {}),
    summary: source.summary,
    cardCount: cards.length,
    quizCount: quiz.length,
    examCount: exams.length,
    targetCardCount: args.targetCardCount,
    targetQuizCount: args.targetQuizCount,
    targetExamCount: args.targetExamCount,
    knownCount: 0,
    updatedAt: now,
  });

  for (const [index, card] of byOrder(cards).entries()) {
    await ctx.db.insert("flashcards", {
      setId,
      userId: args.userId,
      front: card.front,
      back: card.back,
      order: index,
      ...(card.beyondNotes !== undefined
        ? { beyondNotes: card.beyondNotes }
        : {}),
      ...(card.specRef !== undefined ? { specRef: card.specRef } : {}),
      status: "new",
      reviewCount: 0,
      dueAt: now,
      intervalDays: 0,
      fsrsState: "new",
      lapses: 0,
      reps: 0,
      ...(card.recallThreshold !== undefined
        ? { recallThreshold: card.recallThreshold }
        : {}),
      ...(card.recallUnits !== undefined
        ? { recallUnits: card.recallUnits }
        : {}),
    });
  }

  for (const [index, question] of byOrder(quiz).entries()) {
    await ctx.db.insert("quizQuestions", {
      setId,
      userId: args.userId,
      question: question.question,
      options: question.options,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
      ...(question.type !== undefined ? { type: question.type } : {}),
      ...(question.answer !== undefined ? { answer: question.answer } : {}),
      ...(question.acceptedAnswers !== undefined
        ? { acceptedAnswers: question.acceptedAnswers }
        : {}),
      order: index,
      ...(question.beyondNotes !== undefined
        ? { beyondNotes: question.beyondNotes }
        : {}),
      ...(question.specRef !== undefined ? { specRef: question.specRef } : {}),
      missCount: 0,
      correctCount: 0,
    });
  }

  for (const [index, question] of byOrder(exams).entries()) {
    await ctx.db.insert("examQuestions", {
      setId,
      userId: args.userId,
      question: question.question,
      marks: question.marks,
      modelAnswer: question.modelAnswer,
      markingGuide: question.markingGuide,
      ...(question.beyondNotes !== undefined
        ? { beyondNotes: question.beyondNotes }
        : {}),
      ...(question.specRef !== undefined ? { specRef: question.specRef } : {}),
      ...(question.criteria !== undefined
        ? { criteria: question.criteria }
        : {}),
      order: index,
    });
  }

  await ctx.db.patch(entry._id, {
    lastUsedAt: now,
    uses: entry.uses + 1,
  });

  return setId;
}

/** Removes cache rows that point at a deleted source set. */
export async function forgetStudySetReuse(
  ctx: MutationCtx,
  setId: Id<"studySets">,
): Promise<void> {
  const entries = await ctx.db
    .query("studySetCache")
    .withIndex("by_source", (q) => q.eq("sourceSetId", setId))
    .collect();
  for (const entry of entries) await ctx.db.delete(entry._id);
}
