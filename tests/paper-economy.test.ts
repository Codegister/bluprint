import { describe, expect, test } from "bun:test";

import {
  buildPaperBlueprint,
  flattenPaperBlueprint,
} from "../src/convex/lib/paperBlueprint";
import {
  buildPaperCover,
  markNotation,
  questionTotalLine,
} from "../src/convex/lib/paperFormat";
import {
  parseLevelsGuide,
  validateMarkingGuide,
} from "../src/convex/lib/markingCriteria";
import { displayPaperTitles } from "../src/convex/lib/paperTitles";
import { tierChoices } from "../src/lib/subjects";
import {
  isBoardLevelValid,
  validBoardsForLevel,
  validLevelsForBoard,
} from "../src/lib/examBoards";

const course = (over: Record<string, string>) => ({
  subject: "Biology",
  level: "GCSE",
  examBoard: "AQA",
  tier: "Higher",
  ...over,
});

describe("verified paper economies", () => {
  test("AQA GCSE Biology 8461/1H is 100 marks, 105 minutes, 8 questions and 48 parts", () => {
    const blueprint = buildPaperBlueprint(course({ subject: "Biology" }), "Paper 1");
    const slots = flattenPaperBlueprint(blueprint);

    expect(blueprint.totalMarks).toBe(100);
    expect(blueprint.durationMinutes).toBe(105);
    expect(blueprint.questionCount).toBe(8);
    expect(blueprint.partCount).toBe(48);
    expect(blueprint.componentCode).toBe("8461/1H");
    expect(blueprint.sections[0]!.title).toBe("");
    expect(slots).toHaveLength(48);
    expect(slots[0]!.label).toBe("0 1 . 1");
    expect(slots.filter((slot) => slot.section !== "")).toHaveLength(0);
  });

  test("AQA GCSE Trilogy Biology 8464/B/1H is 70 marks, 75 minutes, 6 questions and 28 parts", () => {
    const blueprint = buildPaperBlueprint(
      course({ subject: "Combined Science", examBoard: "AQA" }),
      "Paper 1",
    );
    expect(blueprint.totalMarks).toBe(70);
    expect(blueprint.durationMinutes).toBe(75);
    expect(blueprint.questionCount).toBe(6);
    expect(blueprint.partCount).toBe(28);
    expect(flattenPaperBlueprint(blueprint)).toHaveLength(28);
    expect(blueprint.componentCode).toBe("8464/B/1H");
  });

  test("AQA English Language 8700/1 has 4, 8, 8, 20 and 40-mark tasks and a source insert", () => {
    const blueprint = buildPaperBlueprint(
      course({ subject: "English Language", examBoard: "AQA" }),
      "Paper 1",
    );
    const slots = flattenPaperBlueprint(blueprint);
    expect(blueprint.totalMarks).toBe(80);
    expect(blueprint.durationMinutes).toBe(105);
    expect(blueprint.questionCount).toBe(5);
    expect(blueprint.partCount).toBe(5);
    expect(slots.map((slot) => slot.marks)).toEqual([4, 8, 8, 20, 40]);
    expect(blueprint.sections.map((section) => section.marks)).toEqual([40, 40]);
    expect(slots[0]!.insert).toContain("separate insert");
    expect(blueprint.aoSplit).toMatchObject({ reading: 40, writing: 40, AO5: 24, AO6: 16 });
    expect(blueprint.coverNotes!.join(" ")).toContain("15 minutes");
  });

  test("AQA English Language 8700/2 uses 4, 8, 12, 16 and 40 marks", () => {
    const blueprint = buildPaperBlueprint(
      course({ subject: "English Language", examBoard: "AQA" }),
      "Paper 2",
    );
    expect(flattenPaperBlueprint(blueprint).map((slot) => slot.marks)).toEqual([
      4, 8, 12, 16, 40,
    ]);
    expect(blueprint.componentCode).toBe("8700/2");
  });

  test("AQA English Literature 8702/1 prints 13 essays and the candidate answers 2", () => {
    const blueprint = buildPaperBlueprint(
      course({
        subject: "English Literature",
        examBoard: "AQA",
        litShakespeare: "Macbeth",
        litNovel: "A Christmas Carol",
      }),
      "Paper 1",
    );
    const slots = flattenPaperBlueprint(blueprint);
    expect(blueprint.totalMarks).toBe(64);
    expect(blueprint.durationMinutes).toBe(105);
    expect(blueprint.questionCount).toBe(13);
    expect(blueprint.partCount).toBe(13);
    expect(blueprint.candidateAnswers).toBe(2);
    expect(blueprint.spagMarks).toBe(4);
    expect(blueprint.sections[0]!.slots).toHaveLength(6);
    expect(blueprint.sections[1]!.slots).toHaveLength(7);
    expect(slots.every((slot) => slot.marks === 30)).toBe(true);
    expect(slots.every((slot) => slot.lineNumbers)).toBe(true);
    expect(slots[0]!.ask).toContain("Starting with this speech");
    expect(slots[0]!.ask).toContain("Write about:");
    expect(slots[0]!.ask).not.toContain("how does");
    expect(markNotation("aqa", 30, { literature: true, spag: true })).toBe(
      "[30 marks] AO4 [4 marks]",
    );
  });

  test("AQA GCSE Mathematics 8300/1H is 80 marks, 90 minutes and about 29 questions", () => {
    const blueprint = buildPaperBlueprint(
      course({ subject: "Mathematics", examBoard: "AQA" }),
      "Paper 1",
    );
    expect(blueprint.totalMarks).toBe(80);
    expect(blueprint.durationMinutes).toBe(90);
    expect(blueprint.questionCount).toBe(29);
    expect(blueprint.partCount).toBe(29);
    expect(blueprint.sections[0]!.title).toBe("");
    expect(blueprint.componentCode).toBe("8300/1H");
    expect(flattenPaperBlueprint(blueprint)[0]!.label).toBe("1");
  });

  test("Edexcel GCSE History 1HI0/1 is 52 marks, 80 minutes, 2 sections and 6 items", () => {
    const blueprint = buildPaperBlueprint(
      course({ subject: "History", examBoard: "Pearson Edexcel" }),
      "Paper 1",
    );
    const slots = flattenPaperBlueprint(blueprint);
    expect(blueprint.totalMarks).toBe(52);
    expect(blueprint.durationMinutes).toBe(80);
    expect(blueprint.questionCount).toBe(6);
    expect(blueprint.sections).toHaveLength(2);
    expect(blueprint.spagMarks).toBe(4);
    expect(slots.map((slot) => slot.label)).toContain("1 (a)");
    expect(slots.map((slot) => slot.label)).toContain("5");
    expect(slots.map((slot) => slot.label)).toContain("6");
    expect(blueprint.sections[1]!.instruction).toContain("EITHER Question 5 OR Question 6");
    expect(blueprint.coverNotes!.join(" ")).toContain("Sources Booklet");
  });

  test("AQA GCSE RS 8062/1 is four groups, 20 parts, 96 + 6 marks and 105 minutes", () => {
    const blueprint = buildPaperBlueprint(
      course({
        subject: "Religious Studies",
        examBoard: "AQA",
        rsReligion: "Christianity",
        rsReligion2: "Judaism",
      }),
      "Paper 1",
    );
    const slots = flattenPaperBlueprint(blueprint);
    expect(blueprint.totalMarks).toBe(102);
    expect(blueprint.spagMarks).toBe(6);
    expect(blueprint.durationMinutes).toBe(105);
    expect(blueprint.sections).toHaveLength(4);
    expect(blueprint.questionCount).toBe(4);
    expect(blueprint.partCount).toBe(20);
    expect(slots).toHaveLength(20);
    expect(slots.filter((slot) => slot.marks === 12)).toHaveLength(4);
    expect(slots.filter((slot) => slot.spag)).toHaveLength(4);
    expect(
      blueprint.sections.map((section) =>
        section.slots.map((slot) => slot.marks),
      ),
    ).toEqual([
      [1, 1, 4, 6, 12],
      [1, 1, 4, 6, 12],
      [1, 1, 4, 6, 12],
      [1, 1, 4, 6, 12],
    ]);
  });
});

describe("marking guide shape", () => {
  test("a 6-mark levels question keeps three 2-mark bands", () => {
    const guide = [
      "Level 3 (5-6 marks): detailed, linked explanation",
      "Level 2 (3-4 marks): some linked explanation",
      "Level 1 (1-2 marks): isolated relevant points",
    ];
    const bands = parseLevelsGuide(guide, 6);
    expect(bands.map((band) => [band.minMarks, band.maxMarks])).toEqual([
      [5, 6],
      [3, 4],
      [1, 2],
    ]);
    expect(validateMarkingGuide("levels", guide, 6).ok).toBe(true);
  });

  test("a point guide with the wrong count is rejected instead of rescaled", () => {
    expect(
      validateMarkingGuide(
        "points",
        ["2 marks: temperature and pH", "2 marks: active site"],
        4,
      ).ok,
    ).toBe(false);
    expect(
      validateMarkingGuide(
        "points",
        ["1 mark: temperature", "1 mark: pH", "1 mark: enzyme", "1 mark: substrate"],
        4,
      ).ok,
    ).toBe(true);
  });
});

describe("catalogue and cover rules", () => {
  test("only maths, sciences and languages offer GCSE tiers", () => {
    expect(tierChoices("GCSE", "History").tiers).toEqual([]);
    expect(tierChoices("GCSE", "English Language").tiers).toEqual([]);
    expect(tierChoices("GCSE", "Religious Studies").tiers).toEqual([]);
    expect(tierChoices("GCSE", "Mathematics").tiers).toEqual(["Higher", "Foundation"]);
    expect(tierChoices("GCSE", "Biology").tiers).toEqual(["Higher", "Foundation"]);
    expect(tierChoices("IGCSE", "Mathematics").tiers).toEqual(["Core", "Extended"]);
  });

  test("board and level pairs are constrained", () => {
    expect(validBoardsForLevel("GCSE")).not.toContain("IB");
    expect(validBoardsForLevel("GCSE")).not.toContain("College Board AP");
    expect(validLevelsForBoard("IB")).toEqual(["IB"]);
    expect(isBoardLevelValid("AQA", "IB")).toBe(false);
    expect(isBoardLevelValid("AQA", "GCSE")).toBe(true);
  });

  test("NEA subjects are not turned into timed papers", () => {
    const art = buildPaperBlueprint(
      course({ subject: "Art & Design", examBoard: "AQA" }),
    );
    expect(art.notAWrittenPaper).toBe(true);
    expect(art.durationMinutes).toBe(0);
    expect(art.totalMarks).toBe(0);
  });

  test("humanities subjects use distinct 80- or 100-mark mixes", () => {
    const business = buildPaperBlueprint(
      course({ subject: "Business", examBoard: "AQA" }),
    );
    const psychology = buildPaperBlueprint(
      course({ subject: "Psychology", examBoard: "AQA" }),
    );
    expect(business.totalMarks).toBe(80);
    expect(psychology.totalMarks).toBe(100);
    expect(business.durationMinutes).toBe(105);
    expect(business.sections[0]!.slots.map((slot) => slot.marks)).not.toEqual(
      psychology.sections[0]!.slots.map((slot) => slot.marks),
    );
  });

  test("AP has its own longer free-response paper", () => {
    const ap = buildPaperBlueprint(course({ level: "AP", examBoard: "College Board AP" }));
    expect(ap.id).toBe("ap-free-response");
    expect(ap.durationMinutes).toBe(90);
    expect(ap.totalMarks).toBe(60);
  });

  test("AQA Biology cover has no Advice or minutes-per-mark and the right materials", () => {
    const cover = buildPaperCover(
      {
        subject: "Biology",
        level: "GCSE",
        examBoard: "AQA",
        paper: "Paper 1",
        componentCode: "8461/1H",
      },
      "Biology practice paper 1",
      100,
      105,
      { componentCode: "8461/1H" },
    );
    expect(cover.advice).toEqual([]);
    expect(cover.materials).toContain("a ruler");
    expect(cover.materials).toContain("a scientific calculator");
    expect(cover.instructions.join(" ")).toContain("Pencil should only be used for drawing.");
    expect(cover.instructions.join(" ")).toContain("show clearly how you work out your answer");
    expect(cover.instructions.join(" ")).not.toContain("Do not write outside the box");
    expect(cover.information.join(" ")).not.toContain("per mark");
    expect(cover.componentCode).toBe("8461/1H");
    expect(cover.materialsHeading).toBe("Materials / For this paper you must have:");
  });

  test("AQA Maths Paper 1 is non-calculator and uses mathematical instruments", () => {
    const cover = buildPaperCover(
      {
        subject: "Mathematics",
        level: "GCSE",
        examBoard: "AQA",
        paper: "Paper 1",
      },
      "Practice paper 1",
      80,
      90,
    );
    expect(cover.materials.join(" ")).toContain("mathematical instruments");
    expect(cover.materials.join(" ")).not.toContain("scientific calculator");
  });

  test("OCR states a real page count and Edexcel adds the SPaG asterisk only when assessed", () => {
    const ocr = buildPaperCover(
      { subject: "History", level: "GCSE", examBoard: "OCR" },
      "Practice paper 1",
      80,
      105,
    );
    expect(ocr.pageCount).toBeGreaterThan(2);
    expect(ocr.information.join(" ")).toContain(`${ocr.pageCount} pages`);
    expect(ocr.information.join(" ")).not.toContain("has 2 pages");

    const edexcel = buildPaperCover(
      { subject: "History", level: "GCSE", examBoard: "Pearson Edexcel" },
      "Practice paper 1",
      52,
      80,
      { hasSpag: true },
    );
    expect(edexcel.information.join(" ")).toContain("quality of your written communication");
    expect(questionTotalLine("edexcel", "2", 8)).toBe(
      "(Total for Question 2 is 8 marks)",
    );
  });
});

describe("saved-paper numbering", () => {
  test("titles renumber contiguously after a deletion", () => {
    const titles = displayPaperTitles([
      { paper: "Paper 1", title: "Paper 1 practice paper 1" },
      { paper: "Paper 1", title: "Paper 1 practice paper 3" },
      { title: "Practice paper 4" },
    ]);
    expect(titles).toEqual([
      "Paper 1 practice paper 1",
      "Paper 1 practice paper 2",
      "Practice paper 1",
    ]);
  });
});
