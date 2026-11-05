import { describe, expect, test } from "bun:test";

import {
  STUDY_LEVELS,
  allSubjectsForLevel,
  boardsForLevel,
  requiresBoardQuestion,
  subjectAvailability,
  validateStudySelection,
} from "../src/convex/lib/catalogue";
import { applyRegister, findRegisterLeaks } from "../src/convex/lib/register";
import {
  deriveRecallUnits,
  gradeRecall,
  gradeShortAnswer,
} from "../src/convex/lib/recall";
import {
  alignQuizToCards,
  cardContainsAnswer,
  correctAnswerFor,
  gradeQuizResponse,
  keyPointCoverage,
  linkKeyPointsToSpecs,
} from "../src/convex/lib/studySetQuality";

const CARD_BACK =
  "Eukaryotic cells contain membrane-bound organelles, including a nucleus that houses genetic material, whereas prokaryotic cells lack a nucleus and membrane-bound organelles, with their DNA located in a nucleoid region.";

const card = (id: string, front: string, back: string) => ({ id, front, back });

describe("study set acceptance checks", () => {
  test("1. equipment check: availability is explicit and Theory of Knowledge is IB only", () => {
    for (const level of STUDY_LEVELS) {
      const subjects = allSubjectsForLevel(level);
      expect(subjects).toHaveLength(39);
      for (const subject of subjects) {
        expect(["offered", "renamed", "not-offered"]).toContain(subject.state);
      }
      expect(subjects.some((subject) => subject.state !== "offered")).toBe(true);
    }

    for (const level of STUDY_LEVELS) {
      const tok = subjectAvailability(level, "Theory of Knowledge");
      expect(tok.state).toBe(level === "IB" ? "offered" : "not-offered");
    }
    for (const level of ["GCSE", "IGCSE", "KS3", "AS", "IB", "AP", "National 5", "Higher"]) {
      expect(subjectAvailability(level, "Law").state).toBe("not-offered");
      expect(subjectAvailability(level, "Accounting").state).toBe("not-offered");
    }
    expect(subjectAvailability("A-Level", "Law").state).toBe("offered");
  });

  test("2. board check: IGCSE has its own boards and single-body qualifications ask no question", () => {
    expect(boardsForLevel("IGCSE")).toEqual([
      "Cambridge International",
      "Edexcel International",
    ]);
    for (const level of ["National 5", "Higher", "IB", "AP"]) {
      expect(requiresBoardQuestion(level)).toBe(false);
    }
    expect(boardsForLevel("AP")).toEqual(["College Board"]);
    expect(requiresBoardQuestion("GCSE")).toBe(true);
    expect(requiresBoardQuestion("A-Level")).toBe(true);
  });

  test("3. tier check: Foundation is rejected for GCSE History", () => {
    expect(() =>
      validateStudySelection({
        level: "GCSE",
        subject: "History",
        examBoard: "AQA",
        tier: "Foundation",
      }),
    ).toThrow();

    expect(() =>
      validateStudySelection({
        level: "GCSE",
        subject: "Biology",
        examBoard: "AQA",
        tier: "Foundation",
      }),
    ).not.toThrow();
  });

  test("4. alignment check: every saved item cites a card containing its answer", () => {
    const cards = [card("card-1", "Eukaryotic cell structure", CARD_BACK)];
    const quiz = [
      {
        question: "Which structure houses genetic material in a eukaryote?",
        options: ["nucleus", "mitochondria", "ribosome", "vacuole"],
        correctIndex: 0,
        explanation: "The nucleus houses the genetic material.",
        type: "mcq" as const,
        sourceCard: 0,
      },
      {
        question: "Where does aerobic respiration happen?",
        options: ["mitochondria", "nucleus", "cell wall", "chloroplast"],
        correctIndex: 0,
        explanation: "Mitochondria are the site of aerobic respiration.",
        type: "mcq" as const,
        sourceCard: 0,
      },
    ];

    const result = alignQuizToCards(quiz, cards);
    expect(result.dropped).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.sourceCardId).toBe("card-1");
    for (const item of result.items) {
      expect(cardContainsAnswer(cards[0]!, correctAnswerFor(item))).toBe(true);
    }

    const offSpec = alignQuizToCards(
      [
        {
          question: "Which structure is absent from plant cells?",
          options: ["centriole", "cell wall", "chloroplast", "vacuole"],
          correctIndex: 0,
          explanation: "",
          type: "mcq" as const,
          sourceCard: 0,
        },
      ],
      [card("card-2", "Cell structures", "Centrioles are absent from plant cells.")],
      [],
      { level: "GCSE", subject: "Biology" },
    );
    expect(offSpec.items).toHaveLength(0);
  });

  test("5. coverage check: key points link one-to-one and percentage is linked/total", () => {
    const points = [
      { id: "1.1.1", text: "Eukaryotic cells contain membrane-bound organelles" },
      { id: "1.1.2", text: "Prokaryotic cells lack a nucleus" },
      { id: "1.1.3", text: "Mitochondria are the site of aerobic respiration" },
    ];
    const keyPoints = points.map((point) => point.text);
    const linked = linkKeyPointsToSpecs(keyPoints, points);
    expect(linked.links).toHaveLength(3);
    expect(new Set(linked.links.map((link) => link.specRef)).size).toBe(3);
    expect(linked.missing).toHaveLength(0);

    const coverage = keyPointCoverage(points, linked.links);
    expect(coverage.percent).toBe(100);

    const partial = keyPointCoverage(points, linked.links.slice(0, 2));
    expect(partial.percent).toBe(67);
  });

  test("6. stuffing check: two words against a sentence card get zero credit", () => {
    const grade = gradeRecall(CARD_BACK, "nucleus organelles");
    expect(grade.correct).toBe(false);
    expect(grade.coveredUnits).toEqual([]);
    expect(grade.score).toBeLessThan(0.75);
  });

  test("7. full-answer check: the stored model answer credits every unit", () => {
    const units = deriveRecallUnits(CARD_BACK);
    const grade = gradeRecall(CARD_BACK, CARD_BACK);
    expect(grade.correct).toBe(true);
    expect(grade.coveredUnits).toHaveLength(units.length);
    expect(grade.missedUnits).toHaveLength(0);
  });

  test("8. numeric check: 0.5 and 1/2 both pass a card whose answer is 0.5", () => {
    expect(gradeRecall("0.5", "0.5").correct).toBe(true);
    expect(gradeRecall("0.5", "1/2").correct).toBe(true);
    expect(gradeShortAnswer("0.5", [], "1/2").correct).toBe(true);
  });

  test("9. skip check: every option order scores zero when all five are skipped", () => {
    for (const correctIndex of [0, 1, 2, 3]) {
      const quiz = Array.from({ length: 5 }, (_, index) => ({
        question: `Question ${index + 1}`,
        options: ["A", "B", "C", "D"],
        correctIndex,
        explanation: "",
        type: "mcq" as const,
      }));
      const graded = quiz.map((question) => gradeQuizResponse(question, {}));
      expect(graded.filter((result) => result.correct)).toHaveLength(0);
      expect(graded.every((result) => result.answered === false)).toBe(true);
    }
  });

  test("10. register check: GCSE Biology has no water potential or gene expression", () => {
    const text =
      "Water potential falls and gene expression changes; the partially permeable membrane controls it.";
    const cleaned = applyRegister(text, "GCSE", "Biology");
    expect(cleaned.toLowerCase()).not.toContain("water potential");
    expect(cleaned.toLowerCase()).not.toContain("gene expression");
    expect(findRegisterLeaks(cleaned, "GCSE", "Biology")).toEqual([]);
  });

  test("11. terminology check: one preferred term across stem and explanation", () => {
    const stem = applyRegister(
      "The partially permeable membrane controls entry.",
      "GCSE",
      "Biology",
    );
    const explanation = applyRegister(
      "The partially permeable membrane is selective.",
      "GCSE",
      "Biology",
    );
    expect(stem).toContain("selectively permeable membrane");
    expect(explanation).toContain("selectively permeable membrane");
    expect(`${stem} ${explanation}`).not.toContain("partially permeable membrane");
  });

  test("stopword-only answers compare exactly instead of always failing", () => {
    expect(gradeShortAnswer("the", [], "the").correct).toBe(true);
    expect(gradeShortAnswer("the", [], "a").correct).toBe(false);
  });
});
