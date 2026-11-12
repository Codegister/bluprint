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
 * A set does not have to match the same requested counts to be useful. A
 * finished set that covers the requested topics can seed a copy even when the
 * student asked for a different number of cards or questions; the copy keeps
 * what exists and the review can add more later.
 *
 * It also does not have to cover every requested topic. When only some topics
 * overlap, the reusable rows for those topics are copied into a queued set and
 * generation fills the remaining topics. This is why one cache entry can seed
 * a build for a wider or narrower topic selection without cloning unrelated
 * subject content.
 *
 * A student's own pasted sets are also reusable, but only for that same
 * student. Their notes never enter the shared cache.
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

/** A complete set whose rows can be cloned, whether course-based or personal. */
export function isCopyableStudySet(set: Doc<"studySets">): boolean {
  return (
    set.status === "ready" &&
    set.sourceType === "text" &&
    set.sourceImageIds.length === 0 &&
    set.notes.trim().length > 0 &&
    set.summary !== undefined &&
    set.cardCount > 0 &&
    set.quizCount > 0 &&
    set.examCount > 0
  );
}

export function isReusableStudySet(set: Doc<"studySets">): boolean {
  return (
    isCopyableStudySet(set) &&
    set.courseId !== undefined &&
    (set.topicIds?.length ?? 0) > 0
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

export type StudySetCopyArgs = {
  userId: Id<"users">;
  courseId?: Id<"courses">;
  title: string;
  titleSource?: "auto" | "user";
  notes: string;
  sourceLabel?: string;
  course?: string;
  examBoard?: string;
  level?: string;
  topicId?: string;
  topicIds?: string[];
  specPoints?: SpecPoint[];
  targetCardCount: number;
  targetQuizCount: number;
  targetExamCount: number;
  /**
   * Topic ids whose rows should be copied from the source. Set only for a
   * partial reuse: the new set stays queued and `generationNotes` describes
   * the topics that still need generating. Undefined copies the whole set.
   */
  sourceTopicIds?: string[];
  /** The AI brief for the topics not covered by `sourceTopicIds`. */
  generationNotes?: string;
  /**
   * Warnings in the source were written for its notes. An exact copy can keep
   * them; a similar notes match should generate its own warning later.
   */
  copyWarnings?: boolean;
};

/** The original exact-cache call shape, kept for existing callers. */
export type CachedStudySetArgs = StudySetCopyArgs & {
  cacheKey: string;
  courseId: Id<"courses">;
  topicId: string;
  topicIds: string[];
  specPoints: SpecPoint[];
};

function byOrder<T extends { order: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.order - b.order);
}

function topicIdsFor(set: Doc<"studySets">): string[] {
  return set.topicIds ?? (set.topicId ? [set.topicId] : []);
}

/**
 * The topic a stored row belongs to. Course rows are tagged with the spec point
 * id (`{topicId}:{index}`), and a single-topic source can safely treat its older
 * untagged rows as belonging to that one topic.
 */
function sourceTopicForRow(
  source: Doc<"studySets">,
  specRef?: string,
): string | undefined {
  const topics = topicIdsFor(source);
  if (specRef) {
    return topics.find(
      (topicId) => specRef === topicId || specRef.startsWith(`${topicId}:`),
    );
  }
  return topics.length === 1 ? topics[0] : undefined;
}

function rowsForSourceTopics<T extends { specRef?: string }>(
  source: Doc<"studySets">,
  rows: T[],
  topicIds: string[],
): T[] {
  const wanted = new Set(topicIds);
  return rows.filter((row) => {
    const topicId = sourceTopicForRow(source, row.specRef);
    return topicId !== undefined && wanted.has(topicId);
  });
}

/** Lowercase, punctuation-free words, used only for similarity matching. */
function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function shingles(tokens: string[], width = 3): Set<string> {
  const result = new Set<string>();
  if (tokens.length === 0) return result;
  const size = Math.min(width, tokens.length);
  for (let index = 0; index + size <= tokens.length; index += 1) {
    result.add(tokens.slice(index, index + size).join(" "));
  }
  return result;
}

/**
 * How much of the smaller note set appears in the larger one. The overlap
 * coefficient (rather than Jaccard) is deliberate: a pasted handout that
 * contains an earlier page should still reuse that page even though the new
 * target has extra material.
 */
export function notesSimilarity(left: string, right: string): number {
  const leftWords = words(left);
  const rightWords = words(right);
  if (leftWords.length === 0 || rightWords.length === 0) return 0;
  if (
    leftWords.join(" ") === rightWords.join(" ") ||
    left.trim() === right.trim()
  ) {
    return 1;
  }

  const leftShingles = shingles(leftWords);
  const rightShingles = shingles(rightWords);
  const smaller = Math.min(leftShingles.size, rightShingles.size);
  if (smaller < 4) return 0;

  let shared = 0;
  for (const shingle of leftShingles) {
    if (rightShingles.has(shingle)) shared += 1;
  }
  return shared / smaller;
}

export const MIN_NOTES_SIMILARITY = 0.55;

function sameLabel(left?: string, right?: string): boolean {
  return (left ?? "").trim().toLowerCase() === (right ?? "").trim().toLowerCase();
}

function labelsConflict(left?: string, right?: string): boolean {
  return Boolean(left && right && !sameLabel(left, right));
}

export type CourseReuseQuery = {
  course?: string;
  examBoard?: string;
  level?: string;
  topicIds: string[];
  targetCardCount: number;
  targetQuizCount: number;
  targetExamCount: number;
};

function topicOverlap(
  source: Doc<"studySets">,
  wanted: string[],
): { matched: string[]; missing: string[] } {
  const sourceTopics = new Set(topicIdsFor(source));
  return {
    matched: wanted.filter((topicId) => sourceTopics.has(topicId)),
    missing: wanted.filter((topicId) => !sourceTopics.has(topicId)),
  };
}

/**
 * Scores a finished course set as a source for a new topic selection. A source
 * no longer has to cover every requested topic: the overlapping topics are
 * worth reusing, and the caller generates the rest. More overlap wins, then a
 * source with fewer unrelated topics, then one closer to the requested counts.
 *
 * Returns null when the set is not a safe course match or shares no topic.
 */
export function similarCourseSetScore(
  source: Doc<"studySets">,
  query: CourseReuseQuery,
): number | null {
  if (!isReusableStudySet(source)) return null;
  if (!query.course || !query.examBoard || !query.level) return null;
  if (
    !sameLabel(source.course, query.course) ||
    !sameLabel(source.examBoard, query.examBoard) ||
    !sameLabel(source.level, query.level)
  ) {
    return null;
  }

  const wanted = [...new Set(query.topicIds.filter(Boolean))];
  if (wanted.length === 0) return null;
  const { matched, missing } = topicOverlap(source, wanted);
  if (matched.length === 0) return null;

  const extraTopics = new Set(topicIdsFor(source)).size - matched.length;
  const countDelta =
    Math.abs(source.cardCount - query.targetCardCount) +
    Math.abs(source.quizCount - query.targetQuizCount) +
    Math.abs(source.examCount - query.targetExamCount);

  return matched.length * 1_000 - missing.length * 100 - extraTopics * 25 - countDelta;
}

export type CachedReuseMatch = {
  entry: Doc<"studySetCache">;
  source: Doc<"studySets">;
  score: number;
  /** Requested topics the source can supply. */
  matchedTopicIds: string[];
  /** Requested topics still needing generation. */
  missingTopicIds: string[];
};

/**
 * Finds a finished course set with overlapping coverage when no exact cache
 * entry exists. The cache table is small (one row per completed brief), so a
 * scan is cheaper than maintaining a second topic index that can drift.
 */
export async function findSimilarCachedStudySet(
  ctx: MutationCtx,
  query: CourseReuseQuery,
): Promise<CachedReuseMatch | null> {
  const entries = await ctx.db.query("studySetCache").collect();
  let best: CachedReuseMatch | null = null;

  const wanted = [...new Set(query.topicIds.filter(Boolean))];
  for (const entry of entries) {
    const source = await ctx.db.get(entry.sourceSetId);
    if (!source) continue;
    const score = similarCourseSetScore(source, query);
    if (score === null) continue;
    const { matched, missing } = topicOverlap(source, wanted);
    if (
      !best ||
      score > best.score ||
      (score === best.score && entry.lastUsedAt > best.entry.lastUsedAt)
    ) {
      best = {
        entry,
        source,
        score,
        matchedTopicIds: matched,
        missingTopicIds: missing,
      };
    }
  }

  return best;
}

/**
 * Creates a private copy from a cached source. A full copy is ready to study;
 * a partial copy contains only the rows for `sourceTopicIds` and stays queued
 * so the caller can generate `generationNotes`. Review counts, due dates, quiz
 * answers and marked exam answers are reset, so one student's progress never
 * appears in another student's set.
 *
 * Returns null when the source is no longer usable, letting the caller fall
 * back to a normal queued build.
 */
export async function copyStudySetContent(
  ctx: MutationCtx,
  source: Doc<"studySets">,
  args: StudySetCopyArgs,
): Promise<Id<"studySets"> | null> {
  if (!isCopyableStudySet(source) || !source.summary) return null;

  const partial = args.sourceTopicIds !== undefined;
  if (
    partial &&
    (args.sourceTopicIds!.length === 0 || !args.generationNotes?.trim())
  ) {
    return null;
  }

  const [sourceCards, sourceQuiz, sourceExams] = await Promise.all([
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

  const cards = partial
    ? rowsForSourceTopics(source, sourceCards, args.sourceTopicIds!)
    : sourceCards;
  const quiz = partial
    ? rowsForSourceTopics(source, sourceQuiz, args.sourceTopicIds!)
    : sourceQuiz;
  const exams = partial
    ? rowsForSourceTopics(source, sourceExams, args.sourceTopicIds!)
    : sourceExams;

  if (partial) {
    const covered = new Set(
      [...cards, ...quiz, ...exams]
        .map((row) => sourceTopicForRow(source, row.specRef))
        .filter((topicId): topicId is string => topicId !== undefined),
    );
    // Never claim a topic is reused when its tagged rows are missing. Falling
    // back to a normal build is safer than a copy with a silent hole.
    if (
      cards.length + quiz.length + exams.length === 0 ||
      args.sourceTopicIds!.some((topicId) => !covered.has(topicId))
    ) {
      return null;
    }
  } else if (
    // A row that was being rebuilt, or an old cache entry left after a partial
    // write, must not produce a short deck that looks finished.
    cards.length === 0 ||
    quiz.length === 0 ||
    exams.length === 0 ||
    cards.length !== source.cardCount ||
    quiz.length !== source.quizCount ||
    exams.length !== source.examCount
  ) {
    return null;
  }

  const now = Date.now();
  const setId = await ctx.db.insert("studySets", {
    userId: args.userId,
    title: args.title,
    titleSource: args.titleSource ?? "auto",
    notes: args.notes,
    sourceType: "text",
    ...(args.sourceLabel !== undefined ? { sourceLabel: args.sourceLabel } : {}),
    ...(args.course !== undefined ? { course: args.course } : {}),
    ...(args.examBoard !== undefined ? { examBoard: args.examBoard } : {}),
    ...(args.level !== undefined ? { level: args.level } : {}),
    ...(args.courseId !== undefined ? { courseId: args.courseId } : {}),
    ...(args.topicId !== undefined ? { topicId: args.topicId } : {}),
    ...(args.topicIds !== undefined ? { topicIds: args.topicIds } : {}),
    ...(args.specPoints !== undefined ? { specPoints: args.specPoints } : {}),
    ...(args.generationNotes !== undefined
      ? { generationNotes: args.generationNotes }
      : {}),
    sourceImageIds: [],
    status: partial ? "queued" : "ready",
    ...(partial ? { progress: "Queued" } : {}),
    // The generator's warnings are about the material, not the source student,
    // and remain true for an exact copy. A similar-source or partial copy omits
    // them because its target notes or missing topics may differ.
    ...(args.copyWarnings === false || partial
      ? {}
      : {
          ...(source.generationNote !== undefined
            ? { generationNote: source.generationNote }
            : {}),
          ...(source.coverageNote !== undefined
            ? { coverageNote: source.coverageNote }
            : {}),
        }),
    ...(partial ? {} : { summary: source.summary }),
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

  return setId;
}

/** Marks a cache row as used after a successful exact copy. */
async function markCacheUsed(
  ctx: MutationCtx,
  entry: Doc<"studySetCache">,
  now: number,
): Promise<void> {
  await ctx.db.patch(entry._id, {
    lastUsedAt: now,
    uses: entry.uses + 1,
  });
}

/** Copies a cache match found by `findSimilarCachedStudySet`. */
export async function copyCachedReuse(
  ctx: MutationCtx,
  match: CachedReuseMatch,
  args: StudySetCopyArgs,
): Promise<Id<"studySets"> | null> {
  const setId = await copyStudySetContent(ctx, match.source, args);
  if (!setId) return null;
  await markCacheUsed(ctx, match.entry, Date.now());
  return setId;
}

/**
 * Creates a ready copy from an exact cache key. The source is revalidated
 * against the key because a rebuild can leave the old row behind.
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

  const setId = await copyStudySetContent(ctx, source, args);
  if (!setId) {
    await ctx.db.delete(entry._id);
    return null;
  }

  await markCacheUsed(ctx, entry, Date.now());
  return setId;
}

/**
 * Finds one of the student's own finished pasted sets with overlapping notes.
 * Personal source material is never mixed into the shared cache, so this scan
 * is scoped to the caller's rows.
 */
export async function findSimilarOwnedStudySet(
  ctx: MutationCtx,
  userId: Id<"users">,
  query: {
    notes: string;
    course?: string;
    examBoard?: string;
    level?: string;
    targetCardCount: number;
    targetQuizCount: number;
    targetExamCount: number;
  },
): Promise<Doc<"studySets"> | null> {
  const candidates = await ctx.db
    .query("studySets")
    .withIndex("by_user_updated", (q) => q.eq("userId", userId))
    .collect();

  let best: { source: Doc<"studySets">; score: number } | null = null;

  for (const source of candidates) {
    if (!isCopyableStudySet(source) || source.sourceType !== "text") continue;
    if (
      labelsConflict(query.course, source.course) ||
      labelsConflict(query.examBoard, source.examBoard) ||
      labelsConflict(query.level, source.level)
    ) {
      continue;
    }

    const similarity = notesSimilarity(query.notes, source.notes);
    if (similarity < MIN_NOTES_SIMILARITY) continue;

    const countDelta =
      Math.abs(source.cardCount - query.targetCardCount) +
      Math.abs(source.quizCount - query.targetQuizCount) +
      Math.abs(source.examCount - query.targetExamCount);
    const score = similarity * 1_000 - countDelta * 0.5;

    if (
      !best ||
      score > best.score ||
      (score === best.score && source.updatedAt > best.source.updatedAt)
    ) {
      best = { source, score };
    }
  }

  return best?.source ?? null;
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
