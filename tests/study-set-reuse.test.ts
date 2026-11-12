import { describe, expect, test } from "bun:test";

import type { MutationCtx } from "../src/convex/_generated/server";
import { completeGeneration } from "../src/convex/studySets";
import {
  copyCachedReuse,
  copyCachedStudySet,
  copyStudySetContent,
  findSimilarCachedStudySet,
  findSimilarOwnedStudySet,
  notesSimilarity,
  rememberStudySetForReuse,
  studySetReuseKey,
  studySetReuseKeyForSet,
} from "../src/convex/lib/studySetReuse";

type Row = Record<string, any> & { _id: string };
type Tables = Record<string, Row[]>;

function fakeContext(tables: Tables) {
  let nextId = 0;
  const allRows = () => Object.values(tables).flat();

  const db = {
    get: async (id: string) => allRows().find((row) => row._id === id) ?? null,
    insert: async (table: string, document: Record<string, any>) => {
      const row = { ...document, _id: `${table}:${++nextId}` };
      (tables[table] ??= []).push(row);
      return row._id;
    },
    patch: async (id: string, patch: Record<string, any>) => {
      const row = allRows().find((candidate) => candidate._id === id);
      if (!row) throw new Error(`Missing row ${id}`);
      Object.assign(row, patch);
    },
    delete: async (id: string) => {
      for (const [table, rows] of Object.entries(tables)) {
        const index = rows.findIndex((row) => row._id === id);
        if (index !== -1) {
          rows.splice(index, 1);
          return;
        }
        void table;
      }
    },
    query: (table: string) => {
      const matching = (build?: (query: any) => any) => {
        const filters: Array<[string, unknown]> = [];
        const query = {
          eq: (field: string, value: unknown) => {
            filters.push([field, value]);
            return query;
          },
        };
        build?.(query);
        return (tables[table] ?? []).filter((row) =>
          filters.every(([field, value]) => row[field] === value),
        );
      };
      return {
        withIndex: (_index: string, build: (query: any) => any) => ({
          first: async () => matching(build)[0] ?? null,
          collect: async () => matching(build),
        }),
        collect: async () => matching(),
      };
    },
  };

  return { ctx: { db } as unknown as MutationCtx, tables, db };
}

const NOTES =
  "Course: GCSE Biology\nExam board: AQA\nTopic: Cell structure\nCells contain organelles.";

function sourceSet(overrides: Record<string, any> = {}): Row {
  return {
    _id: "set:source",
    userId: "user:source",
    title: "Cell structure",
    titleSource: "auto",
    notes: NOTES,
    sourceType: "text",
    sourceLabel: "Course pathway",
    course: "Biology",
    examBoard: "AQA",
    level: "GCSE",
    courseId: "course:source",
    topicId: "cell-structure",
    topicIds: ["cell-structure"],
    sourceImageIds: [],
    status: "ready",
    summary: {
      overview: "Cells contain organelles.",
      keyPoints: ["Cells contain organelles."],
      examFocus: ["Cell structure"],
    },
    cardCount: 2,
    quizCount: 1,
    examCount: 1,
    targetCardCount: 10,
    targetQuizCount: 5,
    targetExamCount: 3,
    knownCount: 1,
    updatedAt: 100,
    ...overrides,
  };
}

function rowsForSource(setId: string): Tables {
  return {
    studySets: [sourceSet({ _id: setId })],
    flashcards: [
      {
        _id: "card:1",
        setId,
        userId: "user:source",
        front: "What do cells contain?",
        back: "Organelles.",
        order: 0,
        status: "known",
        reviewCount: 4,
        lastReviewedAt: 50,
        lastRating: 4,
        dueAt: 200,
        stability: 12,
        recallThreshold: 0.75,
        recallUnits: ["organelles"],
      },
      {
        _id: "card:2",
        setId,
        userId: "user:source",
        front: "What controls the cell?",
        back: "The membrane.",
        order: 1,
        status: "new",
        reviewCount: 0,
      },
    ],
    quizQuestions: [
      {
        _id: "quiz:1",
        setId,
        userId: "user:source",
        question: "Which organelle releases energy?",
        options: ["Mitochondria", "Nucleus", "Ribosome", "Vacuole"],
        correctIndex: 0,
        explanation: "Mitochondria release energy.",
        order: 0,
        sourceCardId: "card:1",
        missCount: 3,
        correctCount: 1,
        lastAnswer: "Nucleus",
        lastCorrect: false,
      },
    ],
    examQuestions: [
      {
        _id: "exam:1",
        setId,
        userId: "user:source",
        question: "Describe the function of the cell membrane.",
        marks: 2,
        modelAnswer: "It controls what enters and leaves the cell.",
        markingGuide: ["Controls entry", "Controls exit"],
        order: 0,
        userAnswer: "It is a barrier.",
        awardedMarks: 1,
        feedback: "Add control of exit.",
        gradedAt: 60,
        criteria: [
          { id: "1", marks: 1, text: "Controls entry" },
          { id: "2", marks: 1, text: "Controls exit" },
        ],
      },
    ],
    studySetCache: [],
  };
}

const cacheArgs = (cacheKey: string) => ({
  cacheKey,
  userId: "user:new",
  courseId: "course:new",
  title: "Cell structure",
  notes: NOTES,
  sourceLabel: "Course pathway",
  course: "Biology",
  examBoard: "AQA",
  level: "GCSE",
  topicId: "cell-structure",
  topicIds: ["cell-structure"],
  specPoints: [],
  targetCardCount: 10,
  targetQuizCount: 5,
  targetExamCount: 3,
});

describe("study set reuse", () => {
  test("clones a finished course set into a clean private copy", async () => {
    const tables = rowsForSource("set:source");
    const source = tables.studySets[0]!;
    const key = studySetReuseKeyForSet(source as any);
    tables.studySetCache.push({
      _id: "cache:1",
      cacheKey: key,
      sourceSetId: source._id,
      createdAt: 1,
      lastUsedAt: 1,
      uses: 0,
    });
    const { ctx } = fakeContext(tables);

    const setId = await copyCachedStudySet(ctx, cacheArgs(key));

    expect(setId).not.toBeNull();
    const copy = tables.studySets.find((row) => row._id === setId)!;
    expect(copy.userId).toBe("user:new");
    expect(copy.courseId).toBe("course:new");
    expect(copy.status).toBe("ready");
    expect(copy.knownCount).toBe(0);
    expect(copy.cardCount).toBe(2);
    expect(copy.quizCount).toBe(1);
    expect(copy.examCount).toBe(1);

    const cards = tables.flashcards.filter((row) => row.setId === setId);
    expect(cards.map((card) => card.front)).toEqual([
      "What do cells contain?",
      "What controls the cell?",
    ]);
    expect(cards.every((card) => card.userId === "user:new")).toBe(true);
    expect(cards.every((card) => card.status === "new")).toBe(true);
    expect(cards.every((card) => card.reviewCount === 0)).toBe(true);
    expect(cards.every((card) => card.lastReviewedAt === undefined)).toBe(true);
    expect(cards[0]!.recallThreshold).toBe(0.75);

    const quiz = tables.quizQuestions.filter((row) => row.setId === setId);
    expect(quiz).toHaveLength(1);
    expect(quiz[0]!.userId).toBe("user:new");
    expect(quiz[0]!.missCount).toBe(0);
    expect(quiz[0]!.correctCount).toBe(0);
    expect(quiz[0]!.lastAnswer).toBeUndefined();
    expect(quiz[0]!.sourceCardId).toBeUndefined();

    const exams = tables.examQuestions.filter((row) => row.setId === setId);
    expect(exams).toHaveLength(1);
    expect(exams[0]!.userId).toBe("user:new");
    expect(exams[0]!.userAnswer).toBeUndefined();
    expect(exams[0]!.awardedMarks).toBeUndefined();
    expect(exams[0]!.gradedAt).toBeUndefined();
    expect(exams[0]!.criteria).toHaveLength(2);

    expect(tables.studySetCache[0]!.uses).toBe(1);
    expect(tables.studySets.find((row) => row._id === "set:source")!.knownCount).toBe(
      1,
    );
  });

  test("rejects a cache row whose source was rebuilt under different inputs", async () => {
    const tables = rowsForSource("set:source");
    const source = tables.studySets[0]!;
    const key = studySetReuseKeyForSet(source as any);
    tables.studySetCache.push({
      _id: "cache:1",
      cacheKey: key,
      sourceSetId: source._id,
      createdAt: 1,
      lastUsedAt: 1,
      uses: 0,
    });
    // The source now covers a different topic but still has the old cache key.
    tables.studySets[0]!.topicIds = ["cell-transport"];
    tables.studySets[0]!.notes = `${NOTES}\nTopic: Cell transport`;
    const { ctx } = fakeContext(tables);

    expect(await copyCachedStudySet(ctx, cacheArgs(key))).toBeNull();
    expect(tables.studySetCache).toHaveLength(0);
    expect(tables.studySets).toHaveLength(1);
  });

  test("keeps a reviewed set reusable after its counts grow past the target", async () => {
    const tables = rowsForSource("set:source");
    const source = tables.studySets[0]!;
    const cardTemplate = tables.flashcards[0]!;
    for (let index = 2; index < 13; index += 1) {
      tables.flashcards.push({
        ...cardTemplate,
        _id: `card:${index + 1}`,
        order: index,
        front: `Extra card ${index + 1}?`,
        back: `Extra answer ${index + 1}.`,
      });
    }
    const quizTemplate = tables.quizQuestions[0]!;
    for (let index = 1; index < 7; index += 1) {
      tables.quizQuestions.push({
        ...quizTemplate,
        _id: `quiz:${index + 1}`,
        order: index,
        question: `Extra quiz ${index + 1}?`,
      });
    }
    const examTemplate = tables.examQuestions[0]!;
    for (let index = 1; index < 4; index += 1) {
      tables.examQuestions.push({
        ...examTemplate,
        _id: `exam:${index + 1}`,
        order: index,
        question: `Extra exam ${index + 1}?`,
      });
    }
    source.cardCount = 13;
    source.quizCount = 7;
    source.examCount = 4;
    const key = studySetReuseKeyForSet(source as any);
    tables.studySetCache.push({
      _id: "cache:1",
      cacheKey: key,
      sourceSetId: source._id,
      createdAt: 1,
      lastUsedAt: 1,
      uses: 0,
    });
    const { ctx } = fakeContext(tables);

    const setId = await copyCachedStudySet(ctx, cacheArgs(key));

    expect(setId).not.toBeNull();
    const copy = tables.studySets.find((row) => row._id === setId)!;
    expect(copy.cardCount).toBe(13);
    expect(copy.quizCount).toBe(7);
    expect(copy.examCount).toBe(4);
  });

  test("remembers only completed course sets, never uploads", async () => {
    const tables = rowsForSource("set:source");
    const { ctx } = fakeContext(tables);
    await rememberStudySetForReuse(ctx, "set:source");
    expect(tables.studySetCache).toHaveLength(1);
    expect(tables.studySetCache[0]!.sourceSetId).toBe("set:source");

    const uploaded = sourceSet({
      _id: "set:upload",
      sourceImageIds: ["image:1"],
    });
    tables.studySets.push(uploaded);
    await rememberStudySetForReuse(ctx, "set:upload");
    expect(tables.studySetCache).toHaveLength(1);
  });

  test("reuses a course set whose counts differ, as long as it covers the topics", async () => {
    const tables = rowsForSource("set:source");
    const source = tables.studySets[0]!;
    tables.studySetCache.push({
      _id: "cache:1",
      cacheKey: "some-old-key",
      sourceSetId: source._id,
      createdAt: 1,
      lastUsedAt: 1,
      uses: 0,
    });
    const { ctx } = fakeContext(tables);

    const match = await findSimilarCachedStudySet(ctx, {
      course: "Biology",
      examBoard: "AQA",
      level: "GCSE",
      topicIds: ["cell-structure"],
      targetCardCount: 20,
      targetQuizCount: 10,
      targetExamCount: 5,
    });
    expect(match?.source._id).toBe("set:source");

    const setId = await copyCachedReuse(ctx, match!, {
      ...cacheArgs(""),
      targetCardCount: 20,
      targetQuizCount: 10,
      targetExamCount: 5,
    });
    expect(setId).not.toBeNull();
    const copy = tables.studySets.find((row) => row._id === setId)!;
    expect(copy.status).toBe("ready");
    expect(copy.cardCount).toBe(2);
    expect(copy.targetCardCount).toBe(20);
    expect(tables.studySetCache[0]!.uses).toBe(1);
  });

  test("reuses the overlapping topics when the selection is wider", async () => {
    const tables = rowsForSource("set:source");
    const source = tables.studySets[0]!;
    source.topicIds = ["cell-structure"];
    tables.studySetCache.push({
      _id: "cache:1",
      cacheKey: "some-old-key",
      sourceSetId: source._id,
      createdAt: 1,
      lastUsedAt: 1,
      uses: 0,
    });
    const { ctx } = fakeContext(tables);

    const match = await findSimilarCachedStudySet(ctx, {
      course: "Biology",
      examBoard: "AQA",
      level: "GCSE",
      topicIds: ["cell-structure", "cell-transport"],
      targetCardCount: 10,
      targetQuizCount: 5,
      targetExamCount: 3,
    });
    expect(match?.matchedTopicIds).toEqual(["cell-structure"]);
    expect(match?.missingTopicIds).toEqual(["cell-transport"]);

    const setId = await copyCachedReuse(ctx, match!, {
      ...cacheArgs(""),
      topicId: "cell-structure",
      topicIds: ["cell-structure", "cell-transport"],
      sourceTopicIds: match!.matchedTopicIds,
      generationNotes: `${NOTES}\nTopic: Cell transport`,
      titleSource: "user",
    });
    expect(setId).not.toBeNull();

    const copy = tables.studySets.find((row) => row._id === setId)!;
    expect(copy.status).toBe("queued");
    expect(copy.topicIds).toEqual(["cell-structure", "cell-transport"]);
    expect(copy.cardCount).toBe(2);
    expect(copy.quizCount).toBe(1);
    expect(copy.examCount).toBe(1);
    expect(copy.generationNotes).toContain("Cell transport");
    expect(copy.summary).toBeUndefined();
    expect(tables.flashcards.filter((row) => row.setId === setId)).toHaveLength(2);
    expect(tables.studySetCache[0]!.uses).toBe(1);
  });

  test("copies only rows tagged to the overlapping topics", async () => {
    const tables = rowsForSource("set:source");
    const source = tables.studySets[0]!;
    source.topicIds = ["cell-structure", "cell-transport"];
    source.specPoints = [
      { id: "cell-structure:0", text: "Cells contain organelles." },
      { id: "cell-transport:0", text: "Membranes control transport." },
    ];
    for (const row of [
      ...tables.flashcards,
      ...tables.quizQuestions,
      ...tables.examQuestions,
    ]) {
      row.specRef = "cell-structure:0";
    }
    tables.flashcards.push({
      ...tables.flashcards[0]!,
      _id: "card:transport",
      order: 2,
      front: "How does diffusion move particles?",
      back: "From high to low concentration.",
      specRef: "cell-transport:0",
    });
    tables.quizQuestions.push({
      ...tables.quizQuestions[0]!,
      _id: "quiz:transport",
      order: 1,
      question: "What is osmosis?",
      specRef: "cell-transport:0",
    });
    tables.examQuestions.push({
      ...tables.examQuestions[0]!,
      _id: "exam:transport",
      order: 1,
      question: "Describe diffusion.",
      specRef: "cell-transport:0",
    });
    source.cardCount = 3;
    source.quizCount = 2;
    source.examCount = 2;
    tables.studySetCache.push({
      _id: "cache:1",
      cacheKey: "some-old-key",
      sourceSetId: source._id,
      createdAt: 1,
      lastUsedAt: 1,
      uses: 0,
    });
    const { ctx } = fakeContext(tables);

    const match = await findSimilarCachedStudySet(ctx, {
      course: "Biology",
      examBoard: "AQA",
      level: "GCSE",
      topicIds: ["cell-structure", "cell-transport", "photosynthesis"],
      targetCardCount: 10,
      targetQuizCount: 5,
      targetExamCount: 3,
    });
    expect(match?.matchedTopicIds).toEqual(["cell-structure", "cell-transport"]);
    expect(match?.missingTopicIds).toEqual(["photosynthesis"]);

    const setId = await copyCachedReuse(ctx, match!, {
      ...cacheArgs(""),
      topicIds: ["cell-structure", "photosynthesis"],
      sourceTopicIds: ["cell-structure"],
      generationNotes: `${NOTES}\nTopic: Photosynthesis`,
      titleSource: "user",
    });
    expect(setId).not.toBeNull();

    const cards = tables.flashcards.filter((row) => row.setId === setId);
    expect(cards.map((card) => card.front)).toEqual([
      "What do cells contain?",
      "What controls the cell?",
    ]);
    expect(cards.some((card) => card.specRef === "cell-transport:0")).toBe(false);
    expect(tables.quizQuestions.filter((row) => row.setId === setId)).toHaveLength(1);
    expect(tables.examQuestions.filter((row) => row.setId === setId)).toHaveLength(1);
  });

  test("reuses a student's own set when their pasted notes overlap", async () => {
    const tables = rowsForSource("set:source");
    const { ctx } = fakeContext(tables);

    const source = await findSimilarOwnedStudySet(ctx, "user:source", {
      notes: `${NOTES}\nCells also have a membrane.`,
      targetCardCount: 10,
      targetQuizCount: 5,
      targetExamCount: 3,
    });
    expect(source).not.toBeNull();

    const setId = await copyStudySetContent(ctx, source!, {
      userId: "user:source",
      title: "My notes again",
      titleSource: "user",
      notes: `${NOTES}\nCells also have a membrane.`,
      targetCardCount: 10,
      targetQuizCount: 5,
      targetExamCount: 3,
      copyWarnings: false,
    });
    expect(setId).not.toBeNull();
    expect(tables.studySets.find((row) => row._id === setId)!.courseId).toBeUndefined();

    expect(
      await findSimilarOwnedStudySet(ctx, "user:other", {
        notes: NOTES,
        targetCardCount: 10,
        targetQuizCount: 5,
        targetExamCount: 3,
      }),
    ).toBeNull();

    expect(
      await findSimilarOwnedStudySet(ctx, "user:source", {
        notes: "Photosynthesis uses light energy to make glucose and oxygen.",
        targetCardCount: 10,
        targetQuizCount: 5,
        targetExamCount: 3,
      }),
    ).toBeNull();
  });

  test("notes similarity follows overlapping text, not exact wording", () => {
    const edited = NOTES.replace("Cells contain organelles.", "Cells contain many organelles.");
    expect(notesSimilarity(NOTES, edited)).toBeGreaterThan(0.55);
    expect(
      notesSimilarity(
        NOTES,
        "Photosynthesis uses light energy to make glucose and oxygen.",
      ),
    ).toBeLessThan(0.55);
  });

  test("merges generated topics into a partially reused set", async () => {
    const tables = rowsForSource("set:source");
    const source = tables.studySets[0]!;
    const targetId = "set:partial";
    tables.studySets.push({
      ...source,
      _id: targetId,
      userId: "user:new",
      status: "queued",
      summary: undefined,
      generationNotes: `${NOTES}\nTopic: Cell transport`,
      notes: `${NOTES}\nDiffusion moves particles from high to low concentration.`,
      topicId: "cell-structure",
      topicIds: ["cell-structure", "cell-transport"],
      cardCount: 1,
      quizCount: 1,
      examCount: 1,
      targetCardCount: 2,
      targetQuizCount: 1,
      targetExamCount: 1,
    });
    tables.flashcards.push({
      ...tables.flashcards[0]!,
      _id: "card:copied",
      setId: targetId,
      userId: "user:new",
      front: "What do cells contain?",
      back: "Organelles.",
      order: 0,
    });
    tables.quizQuestions.push({
      ...tables.quizQuestions[0]!,
      _id: "quiz:copied",
      setId: targetId,
      userId: "user:new",
      order: 0,
    });
    tables.examQuestions.push({
      ...tables.examQuestions[0]!,
      _id: "exam:copied",
      setId: targetId,
      userId: "user:new",
      order: 0,
    });
    const { ctx } = fakeContext(tables);
    const handler = (completeGeneration as unknown as {
      _handler: (ctx: unknown, args: Record<string, unknown>) => Promise<any>;
    })._handler;

    const result = await handler(ctx, {
      setId: targetId,
      summary: {
        title: "Cell transport",
        overview: "Cells move substances across membranes.",
        keyPoints: ["Diffusion moves particles."],
        examFocus: ["Diffusion"],
      },
      cards: [
        {
          front: "What is diffusion?",
          back: "Diffusion moves particles from high to low concentration.",
        },
      ],
      quiz: [],
      exams: [],
      title: "Cell transport",
      requested: { cards: 2, quiz: 1, exams: 1 },
      final: true,
      keepExisting: true,
    });

    expect(result.stored).toBe(true);
    const copy = tables.studySets.find((row) => row._id === targetId)!;
    expect(copy.status).toBe("ready");
    expect(copy.cardCount).toBe(2);
    expect(copy.quizCount).toBe(1);
    expect(copy.examCount).toBe(1);
    expect(copy.generationNotes).toBeUndefined();
    const cards = tables.flashcards.filter((row) => row.setId === targetId);
    expect(cards.map((card) => card.front)).toEqual([
      "What do cells contain?",
      "What is diffusion?",
    ]);
    expect(tables.quizQuestions.filter((row) => row.setId === targetId)).toHaveLength(1);
    expect(tables.examQuestions.filter((row) => row.setId === targetId)).toHaveLength(1);
  });
});
