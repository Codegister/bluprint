import { describe, expect, test } from "bun:test";

import { predictGrade, boundaryRow } from "../src/convex/lib/gradeBoundaries";
import { matchSpecPoint, specCoverage } from "../src/convex/lib/specMapping";
import { calibrationFor, calibrationSentence } from "../src/convex/lib/calibration";
import { assembleMock, parseMarkScheme, schemeIsUsable } from "../src/convex/lib/realPaper";
import {
  accountExportJson,
  cardsToAnkiText,
  cardsToCsv,
  csvField,
  exportSlug,
} from "../src/lib/studyExport";

describe("grade prediction", () => {
  test("a strong set predicts a high grade with a band, and says which series", () => {
    const prediction = predictGrade(78, "AQA");
    expect(prediction.grade).toBe(7);
    expect(prediction.bandLabel).toBe("6–8");
    expect(prediction.board).toBe("AQA");
    expect(prediction.series).toContain("2026");
    expect(prediction.updatedAt).toBe("2026-08-20");
  });

  test("the band widens by a grade either side, never below 1 or above 9", () => {
    const top = predictGrade(97, "OCR");
    expect(top.grade).toBe(9);
    expect(top.band.high).toBe(9);
    const bottom = predictGrade(5, "WJEC");
    expect(bottom.label).toBe("U");
    expect(bottom.band.low).toBeNull();
  });

  test("no marks means no prediction, not a grade 9", () => {
    const empty = predictGrade(null, "Edexcel");
    expect(empty.label).toBe("—");
    expect(empty.grade).toBeNull();
  });

  test("the next grade's distance is real arithmetic", () => {
    const prediction = predictGrade(70, "AQA");
    expect(prediction.nextGrade).toEqual({ grade: 7, percentAway: 4 });
  });

  test("every board has a table whose thresholds descend", () => {
    for (const board of ["AQA", "Edexcel", "OCR", "Eduqas", "WJEC", "CCEA", ""]) {
      const row = boundaryRow(board);
      expect(row.thresholds.length).toBe(9);
      const percents = row.thresholds.map((threshold) => threshold.percent);
      // Grade 9 needs the most marks and grade 1 the least, on every board.
      for (let index = 1; index < percents.length; index += 1) {
        expect(percents[index]!).toBeLessThan(percents[index - 1]!);
      }
    }
  });
});

describe("specification mapping", () => {
  const points = [
    { id: "t1:0", text: "4.1.1 the structure of a cell and its organelles" },
    { id: "t1:1", text: "4.1.2 diffusion, osmosis and active transport" },
    { id: "t2:0", text: "4.2.1 enzymes and the effect of temperature on rate" },
  ];

  test("a card is tagged to the statement it teaches", () => {
    const match = matchSpecPoint("What is osmosis and how does water move?", points);
    expect(match.id).toBe("t1:1");
    expect(match.score).toBeGreaterThanOrEqual(0.25);
  });

  test("an unrelated card is not forced onto a statement", () => {
    expect(matchSpecPoint("The dates of the French Revolution", points).id).toBeNull();
  });

  test("matching is deterministic", () => {
    const text = "How does temperature affect enzyme activity?";
    expect(matchSpecPoint(text, points)).toEqual(matchSpecPoint(text, points));
  });

  test("coverage counts a statement once however many items carry it", () => {
    const coverage = specCoverage(points, [
      { specRef: "t1:1" },
      { specRef: "t1:1" },
      { specRef: undefined },
    ]);
    expect(coverage.covered.length).toBe(1);
    expect(coverage.uncovered.length).toBe(2);
    expect(coverage.percent).toBe(33);
  });

  test("no specification gives zero coverage rather than a false claim", () => {
    expect(specCoverage([], [{ specRef: "t1:0" }])).toEqual({
      total: 0,
      covered: [],
      uncovered: [],
      percent: 0,
    });
  });
});

describe("calibration", () => {
  const cards = (ratings: number[]) =>
    ratings.map((lastRating) => ({ lastRating, reviewCount: 2 }));

  test("a confident student with poor quiz accuracy is called out", () => {
    const row = calibrationFor({
      setId: "s1",
      title: "Enzymes",
      cards: cards([4, 4, 3, 4, 3]),
      quiz: { answered: 6, correct: 2 },
    });
    expect(row?.confidence).toBe(100);
    expect(row?.accuracy).toBe(33);
    expect(row?.overstated).toBe(true);
    expect(
      calibrationSentence([row!]),
    ).toBe("You rate Enzymes as strong; your quiz accuracy there is 33%.");
  });

  test("too little data produces no claim at all", () => {
    expect(
      calibrationFor({
        setId: "s1",
        title: "Enzymes",
        cards: cards([4, 4]),
        quiz: { answered: 6, correct: 5 },
      }),
    ).toBeNull();
    expect(
      calibrationFor({
        setId: "s1",
        title: "Enzymes",
        cards: cards([4, 4, 4, 4, 4]),
        quiz: { answered: 2, correct: 2 },
      }),
    ).toBeNull();
  });

  test("an honest student is not nagged", () => {
    const row = calibrationFor({
      setId: "s1",
      title: "Osmosis",
      cards: cards([3, 2, 1, 2, 2]),
      quiz: { answered: 6, correct: 4 },
    });
    expect(row?.overstated).toBe(false);
    expect(calibrationSentence([row!])).toBeNull();
  });
});

describe("real mark schemes", () => {
  const scheme = `1 mark: temperature increases the kinetic energy of particles
1 mark: more collisions between enzyme and substrate
1 mark: above the optimum the enzyme denatures
1 mark: the active site changes shape so the substrate no longer fits`;

  test("a pasted scheme becomes one criterion per point, adding up to the marks", () => {
    const criteria = parseMarkScheme(scheme, 4);
    expect(criteria.length).toBe(4);
    expect(criteria.reduce((sum, criterion) => sum + criterion.marks, 0)).toBe(4);
    expect(criteria[0]!.text).toContain("kinetic energy");
    expect(schemeIsUsable(criteria)).toBe(true);
  });

  test("a scheme with no marks stated is distributed to the question's total", () => {
    const criteria = parseMarkScheme("Osmosis; active transport; diffusion", 3);
    expect(criteria.reduce((sum, criterion) => sum + criterion.marks, 0)).toBe(3);
  });

  test("headings are not credit points", () => {
    const criteria = parseMarkScheme("Mark scheme\n1 mark: glucose is reabsorbed", 1);
    expect(criteria.length).toBe(1);
    expect(criteria[0]!.text).toBe("glucose is reabsorbed");
  });

  test("an empty scheme is refused rather than stored", () => {
    expect(schemeIsUsable(parseMarkScheme("", 4))).toBe(false);
    expect(schemeIsUsable(parseMarkScheme("Mark scheme", 4))).toBe(false);
  });
});

describe("mock assembly", () => {
  const questions = [
    { id: "a", marks: 4 },
    { id: "b", marks: 6 },
    { id: "c", marks: 10 },
    { id: "d", marks: 2 },
  ];

  test("a paper fills the tariff and allows a minute a mark", () => {
    const mock = assembleMock(questions, 20);
    expect(mock.totalMarks).toBe(20);
    expect(mock.seconds).toBe(1200);
    expect(mock.short).toBe(false);
  });

  test("a short set makes a short paper, never an invented question", () => {
    const mock = assembleMock([{ id: "a", marks: 3 }], 100);
    expect(mock.items.length).toBe(1);
    expect(mock.short).toBe(true);
    expect(mock.secondsAllowedFallback).toBeUndefined();
  });

  test("a question that would overshoot by more than two marks is skipped", () => {
    const mock = assembleMock(
      [
        { id: "a", marks: 10 },
        { id: "big", marks: 40 },
        { id: "b", marks: 10 },
      ],
      20,
    );
    expect(mock.items.map((item) => item.id)).toEqual(["a", "b"]);
  });
});

describe("exports", () => {
  const cards = [
    { front: "What is osmosis?", back: "Water moving down a water potential gradient" },
    { front: "Define, with a comma", back: 'A "quoted" answer\nwith a newline' },
  ];

  test("CSV quotes the fields that need it and doubles inner quotes", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField('a "b"')).toBe('"a ""b"""');
    const csv = cardsToCsv(cards);
    expect(csv.split("\r\n")[0]).toBe("Front,Back");
    expect(csv).toContain('"Define, with a comma"');
    expect(csv).toContain('"A ""quoted"" answer');
  });

  test("the Anki file carries its directives and no tabs inside a field", () => {
    const text = cardsToAnkiText(cards);
    expect(text.split("\n")[0]).toBe("#separator:tab");
    expect(text).toContain("#html:true");
    const row = text.split("\n")[5]!;
    expect(row.split("\t").length).toBe(3);
    expect(row).not.toContain("\n");
  });

  test("the account export is valid JSON and versioned", () => {
    const json = accountExportJson({
      email: "you@school.uk",
      name: "Sam",
      exportedAt: 1_700_000_000_000,
      sets: [],
      streak: { current: 3, activeDays: 9 },
    });
    const parsed = JSON.parse(json);
    expect(parsed.format).toBe("bluprint-account");
    expect(parsed.version).toBe(1);
    expect(parsed.streak.current).toBe(3);
  });

  test("filenames are safe and never empty", () => {
    expect(exportSlug("Osmosis & Active Transport!")).toBe("osmosis-active-transport");
    expect(exportSlug("£££")).toBe("bluprint");
  });
});
