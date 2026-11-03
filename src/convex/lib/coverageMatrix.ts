/**
 * Coverage classification for every level × board × subject cell.
 *
 * The matrix is data, not a suggestion: an unclassified cell is a bug, and a
 * cell that is not BUILD cannot become a paper by substituting a neighbour.
 * The generated CSV beside this module is the human-readable mirror.
 */

import { ACTIVE_ROWS } from "./paperIndex";

export const COVERAGE_LEVELS = [
  "GCSE",
  "KS3",
  "A-Level",
  "IB",
  "AP",
  "Undergraduate",
] as const;

export const COVERAGE_BOARDS = [
  "AQA",
  "EDX",
  "OCR",
  "WJEC",
  "CAIE",
  "IB",
  "SQA",
  "AP",
  "Other",
] as const;

export const COVERAGE_SUBJECTS = [
  "Biology",
  "Chemistry",
  "Physics",
  "Combined Science",
  "Environmental Science",
  "Mathematics",
  "Further Mathematics",
  "Statistics",
  "Computer Science",
  "Information Technology",
  "History",
  "Geography",
  "Economics",
  "Business Studies",
  "Psychology",
  "Sociology",
  "Politics",
  "Law",
  "Religious Studies",
  "Philosophy",
  "English Language",
  "English Literature",
  "French",
  "Spanish",
  "German",
  "Mandarin",
  "Latin",
  "Art & Design",
  "Music",
  "Drama",
  "Media Studies",
  "Photography",
  "Design & Technology",
  "Food Preparation & Nutrition",
  "Physical Education",
  "Health & Social Care",
  "Engineering",
  "Accounting",
  "Theory of Knowledge",
] as const;

export type CoverageLevel = (typeof COVERAGE_LEVELS)[number];
export type CoverageBoard = (typeof COVERAGE_BOARDS)[number];
export type CoverageSubject = (typeof COVERAGE_SUBJECTS)[number];
export type CoverageState =
  | "BUILD"
  | "PENDING"
  | "LEVEL_MAP_REQUIRED"
  | "NOT_APPLICABLE"
  | "NO_EXTERNAL_BOARD"
  | "BOARD_UNKNOWN"
  | "UNCONFIRMED";

export type CoverageCell = {
  level: CoverageLevel;
  board: CoverageBoard;
  subject: CoverageSubject;
  tier: "F/H" | "none (untiered)" | "n/a" | "HL/SL";
  state: CoverageState;
  subjectAtLevel: "exists" | "map" | "none";
  reason: string;
};

const gcseSubjects = new Set<string>(COVERAGE_SUBJECTS.filter((subject) => ![
  "Environmental Science",
  "Politics",
  "Law",
  "Philosophy",
  "Engineering",
  "Accounting",
  "Theory of Knowledge",
].includes(subject)));

const aLevelSubjects = new Set<string>(COVERAGE_SUBJECTS.filter((subject) => ![
  "Combined Science",
  "Information Technology",
  "Health & Social Care",
  "Theory of Knowledge",
].includes(subject)));

const ibSubjects = new Set<string>([
  "Biology",
  "Chemistry",
  "Physics",
  "Environmental Science",
  "Mathematics",
  "Further Mathematics",
  "Statistics",
  "Computer Science",
  "History",
  "Geography",
  "Economics",
  "Business Studies",
  "Psychology",
  "Sociology",
  "Religious Studies",
  "Philosophy",
  "English Language",
  "English Literature",
  "French",
  "Spanish",
  "German",
  "Mandarin",
  "Latin",
  "Art & Design",
  "Music",
  "Drama",
  "Media Studies",
  "Physical Education",
  "Theory of Knowledge",
]);

const apSubjects = new Set<string>([
  "Biology",
  "Chemistry",
  "Physics",
  "Environmental Science",
  "Mathematics",
  "Statistics",
  "Computer Science",
  "History",
  "Geography",
  "Economics",
  "Psychology",
  "Politics",
  "English Language",
  "English Literature",
  "French",
  "Spanish",
  "German",
  "Mandarin",
  "Latin",
  "Art & Design",
  "Music",
  "Physical Education",
]);

const ks3Subjects = new Set<string>([
  "Art & Design",
  "Computer Science",
  "Design & Technology",
  "Drama",
  "English Language",
  "English Literature",
  "Food Preparation & Nutrition",
  "French",
  "Geography",
  "German",
  "History",
  "Information Technology",
  "Mandarin",
  "Mathematics",
  "Music",
  "Physical Education",
  "Religious Studies",
  "Spanish",
]);

const buildCells = new Set(
  ACTIVE_ROWS.map((row) => `${row.qual}|${row.board}|${row.subject}`),
);

const mappedAtGcse = new Set(["Photography", "Health & Social Care", "Information Technology"]);
const mappedAtALevel = new Set(["Environmental Science", "Photography", "Food Preparation & Nutrition"]);
const mappedAtIb = new Set([
  "Environmental Science",
  "Business Studies",
  "English Language",
  "English Literature",
  "Drama",
  "Physical Education",
]);
const mappedAtAp = new Set([
  "Politics",
  "English Language",
  "English Literature",
  "Art & Design",
  "Music",
  "Latin",
]);

const unconfirmed = new Set([
  "A-Level|AQA|Engineering",
  "A-Level|EDX|Engineering",
  "A-Level|OCR|Engineering",
  "A-Level|WJEC|Engineering",
  "A-Level|CAIE|Engineering",
  "IB|IB|Statistics",
  "IB|IB|Media Studies",
]);

const award = (level: CoverageLevel, board: CoverageBoard): boolean => {
  if (board === "AQA" || board === "EDX" || board === "OCR" || board === "WJEC") {
    return level === "GCSE" || level === "A-Level";
  }
  if (board === "CAIE") return level === "A-Level";
  if (board === "SQA") return level === "A-Level";
  if (board === "IB") return level === "IB";
  if (board === "AP") return level === "AP";
  return false;
};

const subjectExists = (level: CoverageLevel, subject: CoverageSubject): boolean => {
  switch (level) {
    case "GCSE":
      return gcseSubjects.has(subject);
    case "A-Level":
      return aLevelSubjects.has(subject);
    case "IB":
      return ibSubjects.has(subject);
    case "AP":
      return apSubjects.has(subject);
    case "KS3":
      return ks3Subjects.has(subject) || ["Biology", "Chemistry", "Physics", "Combined Science"].includes(subject);
    case "Undergraduate":
      return subject !== "Combined Science" && subject !== "Theory of Knowledge";
  }
};

const mapped = (level: CoverageLevel, subject: CoverageSubject): boolean => {
  if (level === "GCSE") return mappedAtGcse.has(subject);
  if (level === "A-Level") return mappedAtALevel.has(subject);
  if (level === "IB") return mappedAtIb.has(subject);
  if (level === "AP") return mappedAtAp.has(subject);
  return false;
};

const stateFor = (
  level: CoverageLevel,
  board: CoverageBoard,
  subject: CoverageSubject,
): { state: CoverageState; subjectAtLevel: "exists" | "map" | "none"; reason: string } => {
  if (board === "Other") {
    return { state: "BOARD_UNKNOWN", subjectAtLevel: "exists", reason: "which board?" };
  }
  if (level === "KS3" || level === "Undergraduate") {
    // F3 classifies every non-Other cell at these levels as no-external-board.
    // The picker still hides subjects that do not exist at the level.
    return {
      state: "NO_EXTERNAL_BOARD",
      subjectAtLevel: subjectExists(level, subject) ? "exists" : "none",
      reason: `${level} has no awarding body`,
    };
  }
  if (!subjectExists(level, subject)) {
    return {
      state: "NOT_APPLICABLE",
      subjectAtLevel: "none",
      reason: `no ${subject} qualification at ${level}`,
    };
  }
  if (level === "GCSE" && (board === "CAIE" || board === "SQA")) {
    return {
      state: "LEVEL_MAP_REQUIRED",
      subjectAtLevel: "map",
      reason:
        board === "CAIE"
          ? "Cambridge International awards Cambridge IGCSE, not GCSE"
          : "SQA awards National 5/Higher, not GCSE",
    };
  }
  if (level === "A-Level" && board === "SQA") {
    return {
      state: "LEVEL_MAP_REQUIRED",
      subjectAtLevel: "map",
      reason: "SQA awards National 5/Higher, not A-Level",
    };
  }
  if (!award(level, board)) {
    return {
      state: "NOT_APPLICABLE",
      subjectAtLevel: "none",
      reason: `${board} does not award ${level}`,
    };
  }
  if (unconfirmed.has(`${level}|${board}|${subject}`)) {
    return {
      state: "UNCONFIRMED",
      subjectAtLevel: "exists",
      reason: "classification unverified",
    };
  }
  if (buildCells.has(`${qualFor(level)}|${board}|${subject}`)) {
    return { state: "BUILD", subjectAtLevel: "exists", reason: "index row present" };
  }
  if (mapped(level, subject)) {
    return {
      state: "LEVEL_MAP_REQUIRED",
      subjectAtLevel: "map",
      reason: `${subject} exists under another qualification name at ${level}`,
    };
  }
  return {
    state: "PENDING",
    subjectAtLevel: "exists",
    reason: "qualification exists; index row not written",
  };
};

export const qualFor = (level: CoverageLevel): "GCSE" | "ALV" | "IB" | "AP" | "KS3" | "UG" => {
  switch (level) {
    case "GCSE":
      return "GCSE";
    case "A-Level":
      return "ALV";
    case "IB":
      return "IB";
    case "AP":
      return "AP";
    case "KS3":
      return "KS3";
    case "Undergraduate":
      return "UG";
  }
};

const tierFor = (level: CoverageLevel, board: CoverageBoard, subject: CoverageSubject): CoverageCell["tier"] => {
  if (level === "IB") return "HL/SL";
  if (level === "GCSE" && board !== "CAIE" && board !== "SQA") {
    const tiered = new Set([
      "Biology",
      "Chemistry",
      "Physics",
      "Combined Science",
      "Mathematics",
      "Statistics",
      "French",
      "Spanish",
      "German",
      "Mandarin",
    ]);
    return tiered.has(subject) ? "F/H" : "none (untiered)";
  }
  return "n/a";
};

export const COVERAGE_CELLS: CoverageCell[] = COVERAGE_LEVELS.flatMap((level) =>
  COVERAGE_BOARDS.flatMap((board) =>
    COVERAGE_SUBJECTS.map((subject) => {
      const result = stateFor(level, board, subject);
      return {
        level,
        board,
        subject,
        tier: tierFor(level, board, subject),
        ...result,
      };
    }),
  ),
);

const cellIndex = new Map(
  COVERAGE_CELLS.map((cell) => [`${cell.level}|${cell.board}|${cell.subject}`, cell]),
);

export function coverageFor(
  level: CoverageLevel,
  board: CoverageBoard,
  subject: CoverageSubject,
): CoverageCell | null {
  return cellIndex.get(`${level}|${board}|${subject}`) ?? null;
}

/** Only a BUILD cell can produce a paper; every other state has a refusal. */
export function isSelectable(cell: CoverageCell): boolean {
  return cell.state === "BUILD";
}

export function coverageSummary(): Record<CoverageState, number> {
  const summary: Record<CoverageState, number> = {
    BUILD: 0,
    PENDING: 0,
    LEVEL_MAP_REQUIRED: 0,
    NOT_APPLICABLE: 0,
    NO_EXTERNAL_BOARD: 0,
    BOARD_UNKNOWN: 0,
    UNCONFIRMED: 0,
  };
  for (const cell of COVERAGE_CELLS) summary[cell.state] += 1;
  return summary;
}

export function coverageCsv(): string {
  const rows = [
    "level,board,subject,tier,state,subjectAtLevel,reason",
    ...COVERAGE_CELLS.map((cell) =>
      [cell.level, cell.board, cell.subject, cell.tier, cell.state, cell.subjectAtLevel, cell.reason]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    ),
  ];
  return rows.join("\n");
}
