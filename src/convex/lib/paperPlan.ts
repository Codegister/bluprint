/**
 * Plan stage: resolve a request to one index row and emit the immutable shape.
 *
 * This module never writes index data and never lets a request scale a paper.
 * A missing or pending row produces a refusal card naming the missing field.
 */

import {
  ACTIVE_ROWS,
  PAPER_ROWS,
  blueprintFor,
  type BlueprintLine,
  type IndexRow,
  type PaperEvidence,
  type PaperSectionSpec,
  type PaperStatus,
  type TimeSpec,
} from "./paperIndex";
import {
  coverageFor,
  isSelectable,
  qualFor,
  type CoverageBoard,
  type CoverageCell,
  type CoverageLevel,
} from "./coverageMatrix";

export type PlanTier = "H" | "F" | "HL" | "SL";

export type PaperPlan = {
  key: string;
  row: IndexRow;
  tier?: PlanTier;
  tierNeeded: boolean;
  coverage: CoverageCell;
  marks: number;
  time: TimeSpec;
  minutes: number;
  qs: number;
  sections: PaperSectionSpec[];
  ladder: number[];
  variant: string;
  instanceSeed: string;
  blueprint: BlueprintLine[];
  num: string;
  cover: string;
  ms: string;
  voice: string;
  stimScope: IndexRow["stimScope"];
  answerSpace: IndexRow["answerSpace"];
  extraMarks: IndexRow["extraMarks"];
  calculator: boolean;
  evidence: Exclude<PaperEvidence, "P">;
  paperCode: string;
  status: PaperStatus;
  log: string;
};

export type RefusalReason =
  | "KEY_NOT_IN_INDEX"
  | "ROW_UNUSABLE"
  | "TIER_REQUIRED"
  | "TIER_INVALID"
  | "KEY_AMBIGUOUS"
  | "KEY_MALFORMED"
  | "IDX_SUM"
  | "SHAPE_LOCKED"
  | "NOT_APPLICABLE"
  | "LEVEL_MAP_REQUIRED"
  | "NO_EXTERNAL_BOARD"
  | "BOARD_UNKNOWN"
  | "UNCONFIRMED"
  | "COVERAGE_HOLE"
  | `GATE_${string}`;

export type PlanRefusal = {
  ok: false;
  reason: RefusalReason;
  key: string;
  missing: string[];
  nearest: string[];
  toEnable: string;
  message: string;
};

export type PlanResult = { ok: true; plan: PaperPlan } | PlanRefusal;

export type PlanRequest = {
  key?: string;
  board?: string;
  level?: string;
  subject?: string;
  paper?: string;
  tier?: string;
  requestedMarks?: number;
  requestedQuestions?: number;
  instanceSeed?: string;
};

const BOARD_ALIASES: Record<string, CoverageBoard> = {
  aqa: "AQA",
  edx: "EDX",
  edexcel: "EDX",
  "pearson edexcel": "EDX",
  ocr: "OCR",
  wjec: "WJEC",
  eduqas: "WJEC",
  "wjec / eduqas": "WJEC",
  caie: "CAIE",
  "cambridge international": "CAIE",
  "cambridge international examinations": "CAIE",
  ib: "IB",
  sqa: "SQA",
  ap: "AP",
  "college board": "AP",
  "college board ap": "AP",
  ks3: "Other",
  ug: "Other",
  none: "Other",
  other: "Other",
};

const LEVEL_ALIASES: Record<string, CoverageLevel> = {
  gcse: "GCSE",
  "a-level": "A-Level",
  "a level": "A-Level",
  alevel: "A-Level",
  alv: "A-Level",
  as: "A-Level",
  ib: "IB",
  ap: "AP",
  ks3: "KS3",
  undergraduate: "Undergraduate",
  ug: "Undergraduate",
  "national 5": "GCSE",
  higher: "A-Level",
  igcse: "GCSE",
};

const SUBJECT_ALIASES: Record<string, string> = {
  biology: "BIO",
  bio: "BIO",
  chemistry: "CHE",
  chem: "CHE",
  physics: "PHY",
  phys: "PHY",
  "combined science": "SCI",
  trilogy: "SCI",
  "double science": "SCI",
  "science": "SCI",
  maths: "MAT",
  mathematics: "MAT",
  math: "MAT",
  "english language": "ENL",
  english: "ENL",
  lang: "ENL",
  "english literature": "ENLIT",
  literature: "ENLIT",
  lit: "ENLIT",
  "religious studies": "RS",
  "religious education": "RS",
  rs: "RS",
  re: "RS",
  history: "HIS",
  geography: "GEO",
  "computer science": "CST",
  cs: "CST",
  business: "BUS",
  "business studies": "BUS",
  psychology: "PSY",
  psych: "PSY",
  sociology: "SOC",
  soc: "SOC",
  spanish: "MFL-ES",
  french: "MFL-FR",
  german: "MFL-DE",
};

const PAPER_ALIASES: Record<string, string> = {
  "paper 1": "1",
  "paper 2": "2",
  "paper 3": "3",
  "paper 1a": "1A",
  "paper 1b": "1B",
  "paper 2a": "2A",
  "paper 2b": "2B",
  "paper 0": "0",
  "1": "1",
  "2": "2",
  "3": "3",
  "0": "0",
};

export function normaliseBoard(value: string | undefined): CoverageBoard | null {
  const key = (value ?? "").trim().toLowerCase();
  return BOARD_ALIASES[key] ?? null;
}

export function normaliseLevel(value: string | undefined): CoverageLevel | null {
  return LEVEL_ALIASES[(value ?? "").trim().toLowerCase()] ?? null;
}

export function normaliseSubjectCode(value: string | undefined): string | null {
  return SUBJECT_ALIASES[(value ?? "").trim().toLowerCase()] ?? null;
}

const qualFromLevel = (level: CoverageLevel): string => qualFor(level);

const coverageBoardFromRow = (row: IndexRow): CoverageBoard => {
  if (row.board === "EDX") return "EDX";
  if (row.board === "AP") return "AP";
  if (row.board === "EDUQAS") return "WJEC";
  if (row.board === "KS3" || row.board === "UG") return "Other";
  return row.board;
};

const coverageSubjectFromRow = (row: IndexRow): string =>
  row.subject === "Any" ? "Biology" : row.subject;

const planTier = (row: IndexRow, tier: string | undefined): PlanTier | undefined => {
  const value = (tier ?? "").trim().toUpperCase();
  if (!value) return undefined;
  if (value === "H" || value === "HIGHER") return "H";
  if (value === "F" || value === "FOUNDATION") return "F";
  if (value === "HL") return "HL";
  if (value === "SL") return "SL";
  return undefined;
};

const tierIsHigherFoundation = (tier: string | undefined): boolean =>
  /^(h|f|higher|foundation)$/i.test((tier ?? "").trim());

const paperCodeFor = (row: IndexRow, tier: PlanTier | undefined): string => {
  if (!row.paperCode.includes("{tier}")) return row.paperCode;
  return row.paperCode.replace("{tier}", tier === "F" ? "F" : tier === "H" ? "H" : "");
};

const keyFor = (row: IndexRow, tier: PlanTier | undefined): string => {
  if (row.key.includes("-HL") || row.key.includes("-SL")) return row.key;
  return row.tiered && tier ? `${row.key}-${tier}` : row.key;
};

const hash32 = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const variantFor = (row: IndexRow, seed: string): { variant: string; ladder: number[] } => {
  const names = Object.keys(row.ladders).sort();
  if (names.length === 0) throw new Error(`Row ${row.key} has no ladder.`);
  const variant = names[hash32(`${row.key}:${seed}`) % names.length]!;
  return { variant, ladder: row.ladders[variant]! };
};

export function refusal(
  key: string,
  reason: RefusalReason,
  missing: string[],
  nearest: string[] = [],
  toEnable = "Add the missing specification row; do not substitute a nearby qualification.",
): PlanRefusal {
  const message = [
    "PAPER NOT BUILT",
    `Key: ${key || "unresolved"}`,
    `Reason: ${reason}`,
    `Missing: ${missing.length > 0 ? missing.join(", ") : "none"}`,
    `Nearest valid requests: ${nearest.length > 0 ? nearest.join(" / ") : "none"}`,
    `To enable: ${toEnable}`,
  ].join("\n");
  return { ok: false, reason, key, missing, nearest, toEnable, message };
}

const nearestKeys = (row: IndexRow | undefined): string[] => {
  if (!row) return [];
  return PAPER_ROWS
    .filter(
      (candidate) =>
        candidate.status === "ACTIVE" &&
        candidate.qual === row.qual &&
        candidate.subject === row.subject &&
        candidate.board === row.board &&
        candidate.key !== row.key,
    )
    .slice(0, 2)
    .map((candidate) => candidate.key);
};

const parseDirectKey = (value: string): {
  board: CoverageBoard;
  level: CoverageLevel;
  code: string;
  paper: string;
  tier?: string;
} | null => {
  const parts = value.trim().toUpperCase().split("-");
  if (parts.length < 4) return null;
  const board = normaliseBoard(parts[0]);
  const level = normaliseLevel(parts[1]);
  if (!board || !level) return null;
  const code = parts[2]!;
  const paper = parts[3]!;
  const tier = parts[4];
  return { board, level, code, paper, ...(tier ? { tier } : {}) };
};

const rowForBase = (base: string): IndexRow | undefined =>
  PAPER_ROWS.find((row) => row.key === base || row.key === base.replace(/-HL$|-SL$/, ""));

const coverageForRow = (row: IndexRow): CoverageCell => {
  const level = row.qual === "ALV" ? "A-Level" : row.qual === "GCSE" ? "GCSE" : row.qual === "IB" ? "IB" : row.qual === "AP" ? "AP" : row.qual === "KS3" ? "KS3" : "Undergraduate";
  if (row.qual === "KS3" || row.qual === "UG") {
    return { level, board: "Other", subject: "Biology", tier: "n/a", state: "NO_EXTERNAL_BOARD", subjectAtLevel: "exists", reason: `${level} has no awarding body` };
  }
  const cell = coverageFor(
    level,
    coverageBoardFromRow(row),
    coverageSubjectFromRow(row) as never,
  );
  if (!cell) {
    return {
      level,
      board: coverageBoardFromRow(row),
      subject: coverageSubjectFromRow(row) as never,
      tier: row.tiered ? "F/H" : "none (untiered)",
      state: "PENDING",
      subjectAtLevel: "exists",
      reason: "no coverage cell",
    };
  }
  return cell;
};

const buildPlan = (row: IndexRow, tier: PlanTier | undefined, seed: string, tierNeeded: boolean, coverage: CoverageCell): PaperPlan => {
  const { variant, ladder } = variantFor(row, seed);
  const blueprint = blueprintFor(row, ladder);
  return {
    key: keyFor(row, tier),
    row,
    ...(tier ? { tier } : {}),
    tierNeeded,
    coverage,
    marks: row.marks,
    time: row.time,
    minutes: row.minutes,
    qs: ladder.length,
    sections: row.sections,
    ladder,
    variant,
    instanceSeed: seed,
    blueprint,
    num: row.num,
    cover: row.cover,
    ms: row.ms,
    voice: row.voice,
    stimScope: row.stimScope,
    answerSpace: row.answerSpace,
    extraMarks: row.extraMarks,
    calculator: row.calculator,
    evidence: row.evidence === "V" ? "V" : "S",
    paperCode: paperCodeFor(row, tier),
    status: row.status,
    log: `KEY=${keyFor(row, tier)} MARKS=${row.marks} QS=${ladder.length} LADDER=${ladder.join(",")} VARIANT=${variant} EVIDENCE=${row.evidence}`,
  };
};

const coverageRefusal = (key: string, cell: CoverageCell): PlanRefusal => {
  const state = cell.state;
  const reason: RefusalReason =
    state === "PENDING"
      ? "ROW_UNUSABLE"
      : state === "LEVEL_MAP_REQUIRED"
        ? "LEVEL_MAP_REQUIRED"
        : state === "NOT_APPLICABLE"
          ? "NOT_APPLICABLE"
          : state === "NO_EXTERNAL_BOARD"
            ? "NO_EXTERNAL_BOARD"
            : state === "BOARD_UNKNOWN"
              ? "BOARD_UNKNOWN"
              : state === "UNCONFIRMED"
                ? "UNCONFIRMED"
                : "COVERAGE_HOLE";
  return refusal(
    key,
    reason,
    [cell.reason, "marks", "time", "sections", "question count", "tariff ladder"],
    [],
    "Write the missing index row with paperCode, marks, time, sections, question count, ladder, blueprint, cover, numbering, mark scheme and voice.",
  );
};

export function resolvePaperRequest(request: PlanRequest): PlanResult {
  const key = request.key?.trim() ?? "";
  const parsed = key ? parseDirectKey(key) : null;
  const level = request.level ? normaliseLevel(request.level) : parsed?.level;
  const board = request.board ? normaliseBoard(request.board) : parsed?.board;
  const code = request.subject ? normaliseSubjectCode(request.subject) : parsed?.code;
  const paper = request.paper
    ? (PAPER_ALIASES[request.paper.trim().toLowerCase()] ?? request.paper.trim().toUpperCase())
    : parsed?.paper;

  if (!level || !board) {
    return refusal(key, "KEY_NOT_IN_INDEX", ["level", "board"]);
  }

  if (request.requestedMarks !== undefined || request.requestedQuestions !== undefined) {
    return refusal(key, "SHAPE_LOCKED", ["the shape belongs to the index row"], []);
  }

  const fullKey = key || [board, qualFromLevel(level), code, paper].filter(Boolean).join("-");
  const exact = PAPER_ROWS.find((row) => row.key.toUpperCase() === fullKey.toUpperCase());
  const base = fullKey.replace(/-(H|F|HL|SL)$/i, "");
  const row = exact ?? rowForBase(base);
  if (!row) {
    return refusal(fullKey, "KEY_NOT_IN_INDEX", ["key"], []);
  }

  const requestedTier = request.tier ?? parsed?.tier;
  let tier = planTier(row, requestedTier);
  const coverage = coverageForRow(row);
  if (!row.tiered && row.qual === "GCSE") tier = undefined;

  if (level === "A-Level" || level === "IB" || level === "AP" || level === "KS3" || level === "Undergraduate") {
    if (tierIsHigherFoundation(requestedTier)) {
      return refusal(fullKey, "TIER_INVALID", ["Higher/Foundation is not valid at this level"], nearestKeys(row));
    }
  }

  if (row.status === "PENDING" || row.evidence === "P") {
    return refusal(
      fullKey,
      "ROW_UNUSABLE",
      [row.pendingReason ?? "marks, time, sections, question count and tariff ladder"],
      nearestKeys(row),
      `Write ${row.key} with its paperCode, marks, time, sections, question count, ladder, blueprint and profiles.`,
    );
  }

  const boardless = row.qual === "KS3" || row.qual === "UG";
  if (!boardless && coverage.state !== "BUILD") return coverageRefusal(fullKey, coverage);
  if (boardless && coverage.state !== "NO_EXTERNAL_BOARD") return coverageRefusal(fullKey, coverage);
  if (!boardless && !isSelectable(coverage)) return coverageRefusal(fullKey, coverage);
  if (row.ladders && Object.keys(row.ladders).length === 0) {
    return refusal(fullKey, "ROW_UNUSABLE", ["ladder"], nearestKeys(row));
  }
  if (row.tiered && !tier) {
    return refusal(fullKey, "TIER_REQUIRED", ["Higher or Foundation"], nearestKeys(row));
  }
  if (row.tiered && tier !== "H" && tier !== "F") {
    return refusal(fullKey, "TIER_INVALID", ["H or F"], nearestKeys(row));
  }

  const selected = buildPlan(row, tier, request.instanceSeed ?? "default", row.tiered && !tier, coverage);
  return { ok: true, plan: selected };
}

/** Resolve the paper shown on a course's paper tab. */
export function resolveCoursePaper(course: {
  subject: string;
  level: string;
  examBoard: string;
  tier?: string | null;
  variant?: string | null;
  paper?: string | null;
}): PlanResult {
  const level = normaliseLevel(course.level);
  const board = normaliseBoard(course.examBoard);
  if (!level || !board) {
    return refusal("", "KEY_NOT_IN_INDEX", ["level", "board"]);
  }
  const code = normaliseSubjectCode(course.subject);
  if (!code) {
    return refusal("", "KEY_NOT_IN_INDEX", ["subject code"], []);
  }
  const paper = course.paper ?? "1";
  const tier = course.tier?.toLowerCase().includes("foundation")
    ? "F"
    : course.tier?.toLowerCase().includes("higher")
      ? "H"
      : course.variant?.toUpperCase();
  return resolvePaperRequest({
    level,
    board,
    subject: course.subject,
    paper,
    tier,
  });
}

export function assertPlan(plan: PaperPlan): void {
  if (plan.ladder.some((mark) => !Number.isInteger(mark) || mark < 1)) {
    throw new Error(`${plan.key} ladder contains a non-integer mark.`);
  }
  if (plan.ladder.reduce((sum, mark) => sum + mark, 0) !== plan.marks) {
    throw new Error(`${plan.key} ladder does not sum to ${plan.marks}.`);
  }
  if (plan.ladder.length !== plan.blueprint.length) {
    throw new Error(`${plan.key} blueprint length ${plan.blueprint.length} does not match ladder ${plan.ladder.length}.`);
  }
  if (plan.sections.reduce((sum, section) => sum + section.marks, 0) !== plan.marks) {
    throw new Error(`${plan.key} sections do not partition ${plan.marks}.`);
  }
  if (!plan.row.paperCode.includes("{tier}") && plan.row.tiered) {
    throw new Error(`${plan.key} is tiered but its paperCode has no {tier}.`);
  }
  if (plan.row.paperCode.includes("{tier}") && !plan.row.tiered) {
    throw new Error(`${plan.key} has a tier placeholder but is not tiered.`);
  }
}

export function assertActiveIndex(): void {
  for (const row of ACTIVE_ROWS) assertRow(row);
  for (const row of PAPER_ROWS) {
    if (row.status === "PENDING" && (Object.keys(row.ladders).length > 0 || row.bp)) {
      throw new Error(`Pending row ${row.key} carries a ladder or blueprint.`);
    }
  }
}

export function assertRow(row: IndexRow): void {
  if (row.status === "PENDING") return;
  const names = Object.keys(row.ladders);
  if (names.length === 0) throw new Error(`${row.key} has no ladder.`);
  for (const name of names) {
    const ladder = row.ladders[name]!;
    if (ladder.some((mark) => !Number.isInteger(mark) || mark < 1)) {
      throw new Error(`${row.key}/${name} has a non-integer or zero mark.`);
    }
    if (ladder.reduce((sum, mark) => sum + mark, 0) !== row.marks) {
      throw new Error(`${row.key}/${name} sums to ${ladder.reduce((sum, mark) => sum + mark, 0)}, not ${row.marks}.`);
    }
    if (Math.max(...ladder) > row.maxTariff) {
      throw new Error(`${row.key}/${name} exceeds max tariff ${row.maxTariff}.`);
    }
    if (row.sections.reduce((sum, section) => sum + section.marks, 0) !== row.marks) {
      throw new Error(`${row.key} sections do not sum to ${row.marks}.`);
    }
    if (row.sections.some((section) => section.marks <= 0)) {
      throw new Error(`${row.key} has an empty section.`);
    }
    if (!row.paperCode.includes("{tier}") && row.tiered) {
      throw new Error(`${row.key} is tiered but has no {tier}.`);
    }
    if (row.paperCode.includes("{tier}") && !row.tiered) {
      throw new Error(`${row.key} has {tier} but is untiered.`);
    }
  }
}
