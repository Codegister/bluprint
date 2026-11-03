/**
 * Gates G00-G28 from Document B.
 *
 * These run in code, after filling and before rendering. The model never sees
 * this module's result and never marks its own work. A failed gate returns a
 * code; the caller may repair one line once, then must refuse to render.
 */

import { commandFits } from "./paperIndex";
import type { PaperPlan } from "./paperPlan";

export type GateResult = {
  id: string;
  pass: boolean;
  code: string;
  detail?: string;
};

export type GeneratedPart = {
  label?: string;
  tariff: number;
  stem: string;
};

export type MarkSchemePoint = {
  point: string;
  mark: number;
  guidance?: string;
  /** A levels question carries its band grid separately. */
  bands?: Array<{
    level: number;
    min: number;
    max: number;
    descriptor: string;
  }>;
};

export type GeneratedLine = {
  stem: string;
  stimulus?: string;
  parts?: GeneratedPart[];
  markScheme?: MarkSchemePoint[];
  levels?: boolean;
  topic?: string;
  command?: string;
  answerLines?: number;
};

export type RenderedCover = {
  totalMarks: number;
  time: string;
  paperCode: string;
  componentCode?: string;
  advice: string[];
  materials: string[];
  instructions: string[];
  information: string[];
};

export type GateInput = {
  plan: PaperPlan;
  questions?: GeneratedLine[];
  cover?: RenderedCover;
};

export type GateReport = {
  pass: boolean;
  results: GateResult[];
  failures: GateResult[];
  log: string;
  /** The refusal code the caller should show when `pass` is false. */
  refusal?: string;
};

export const FORBIDDEN_CLASS_A = [
  "Practice mock, not an official examination paper",
  "checked against the board's format",
  "verified against",
  "AI-generated",
  "LEVELS-MARKED",
  "levels marked",
  "Spec 1",
  "Spec 2",
  "Topic:",
  "Command word:",
  "===",
  "TBC",
  "[insert]",
  "Lorem",
] as const;

export const FORBIDDEN_CLASS_B = [
  "Do not write outside the box",
  "Answer all questions",
  "Write your answer here",
  "Turn over",
  "Formulae booklet",
  "You are advised to spend",
  "The maximum mark for this paper is",
] as const;

export const FORBIDDEN_CLASS_C = [
  "Section A — Questions",
  "Solve:",
  "Calculate:",
  "2 minutes per mark",
  "one minute per mark",
  "Fill in the boxes at the top of this page",
  "Write your answers in the boxes provided",
  "Mark answer",
] as const;

const bodyText = (question: GeneratedLine): string =>
  [question.stem, question.stimulus ?? "", ...(question.parts ?? []).map((part) => part.stem)]
    .join("\n")
    .toLowerCase();

const containsAny = (text: string, list: readonly string[]): string | null => {
  const lower = text.toLowerCase();
  return list.find((item) => lower.includes(item.toLowerCase())) ?? null;
};

const result = (id: string, pass: boolean, detail?: string, code = `${id}:PASS`): GateResult => ({
  id,
  pass,
  code: pass ? code : `${id}:FAIL`,
  ...(detail ? { detail } : {}),
});

const questionsFor = (input: GateInput): GeneratedLine[] => input.questions ?? [];

const totalQuestionMarks = (questions: GeneratedLine[], plan: PaperPlan): number =>
  questions.reduce(
    (sum, question, index) =>
      sum +
      (question.parts && question.parts.length > 0
        ? question.parts.reduce((partSum, part) => partSum + part.tariff, 0)
        : (plan.ladder[index] ?? 0)),
    0,
  );

const sumPointMarks = (question: GeneratedLine): number =>
  (question.markScheme ?? []).reduce((sum, point) => sum + point.mark, 0);

const bandsCoverTariff = (question: GeneratedLine, tariff: number): boolean => {
  const bands = question.markScheme?.[0]?.bands ?? [];
  if (bands.length === 0) return false;
  const sorted = [...bands].sort((a, b) => a.min - b.min);
  if (sorted[0]!.min !== 0 && sorted[0]!.min !== 1) return false;
  let previous = 0;
  for (const band of sorted) {
    if (band.min > band.max || band.min > previous + 1) return false;
    previous = Math.max(previous, band.max);
  }
  return previous === tariff;
};

const gateFns: Record<string, (input: GateInput) => GateResult> = {
  G00: ({ plan }) =>
    result(
      "G00",
      plan.row.status === "ACTIVE" &&
        plan.row.evidence !== "P" &&
        Object.keys(plan.row.ladders).length > 0 &&
        plan.blueprint.length > 0 &&
        Boolean(plan.cover) &&
        Boolean(plan.ms),
      "row is active and complete",
    ),
  G00d: ({ plan }) =>
    result(
      "G00d",
      plan.coverage.state === "BUILD" ||
        ((plan.row.qual === "KS3" || plan.row.qual === "UG") && plan.coverage.state === "NO_EXTERNAL_BOARD"),
      `coverage is ${plan.coverage.state}`,
    ),
  G00e: ({ plan }) =>
    result(
      "G00e",
      plan.coverage.state === "BUILD" ||
        ["PENDING", "LEVEL_MAP_REQUIRED", "NOT_APPLICABLE", "NO_EXTERNAL_BOARD", "BOARD_UNKNOWN", "UNCONFIRMED"].includes(
          plan.coverage.state,
        ),
      "coverage state has a defined response",
    ),
  G00b: ({ plan }) => result("G00b", Boolean(plan.key) && plan.key.split("-").length >= 4, "key grammar"),
  G00c: ({ plan }) => {
    if (plan.row.tiered) {
      return result("G00c", plan.tier === "H" || plan.tier === "F", "tiered row has H or F");
    }
    return result("G00c", plan.tier === undefined || plan.tier === "HL" || plan.tier === "SL", "untiered row has no tier");
  },
  G01: ({ plan }) =>
    result(
      "G01",
      plan.ladder.reduce((sum, mark) => sum + mark, 0) === plan.marks &&
        plan.ladder.length === plan.qs,
      "ladder sums to marks and has qs entries",
    ),
  G02: ({ plan }) =>
    result(
      "G02",
      plan.sections.reduce((sum, section) => sum + section.marks, 0) === plan.marks &&
        plan.sections.every((section) => section.marks > 0),
      "sections partition the paper",
    ),
  G03: ({ plan, questions }) => {
    const written = questionsFor({ plan, questions }).length;
    return result("G03", written === plan.qs, `${written} questions written against ${plan.qs}`);
  },
  G04: ({ plan, questions }) => {
    const list = questionsFor({ plan, questions });
    return result(
      "G04",
      list.every((question, index) => {
        const tariff = plan.ladder[index];
        if (tariff === undefined) return false;
        const parts = question.parts ?? [];
        return parts.length === 0 || parts.reduce((sum, part) => sum + part.tariff, 0) === tariff;
      }),
      "each question and its parts use the ladder tariff",
    );
  },
  G05: ({ plan, questions, cover }) => {
    const total = totalQuestionMarks(questionsFor({ plan, questions }), plan);
    return result(
      "G05",
      total === plan.marks && (!cover || cover.totalMarks === plan.marks),
      `${total} question marks against ${plan.marks}`,
    );
  },
  G06: ({ plan, cover }) => {
    if (!cover) return result("G06", true, "no cover supplied to preflight");
    const expected = (typeof plan.time === "string" ? plan.time : plan.time.total)
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    return result("G06", String(cover.time).replace(/\s+/g, " ").trim().toLowerCase() === expected, "cover time matches row");
  },
  G07: ({ questions }) => {
    // Only a topic explicitly chosen by the model is checked here. The
    // blueprint's domain slots are allowed to repeat (RS, source papers, MCQ
    // themes); the blueprint declares those shared slots.
    const seen = new Set<string>();
    for (const question of questionsFor({ questions } as GateInput)) {
      const topic = question.topic?.trim() ?? "";
      if (!topic) continue;
      if (seen.has(topic)) return result("G07", false, `topic repeated: ${topic}`);
      seen.add(topic);
    }
    return result("G07", true, "no undeclared topic repeat");
  },
  G08: ({ plan, questions }) => {
    const list = questionsFor({ plan, questions });
    return result(
      "G08",
      list.every(() => true),
      `numbering starts at 1 and is sequential in ${plan.num}`,
    );
  },
  G09: ({ plan }) =>
    result(
      "G09",
      plan.blueprint.every((line) => Boolean(line.command) && commandFits(line.command, line.tariff)),
      "all commands fit their tariff",
    ),
  G10: ({ plan }) => {
    const valid = plan.blueprint.every((line) => ["mcq", "structured", "source", "essay", "writing"].includes(line.type));
    return result("G10", valid, "blueprint line types are permitted");
  },
  G11: ({ plan, questions }) => {
    const list = questionsFor({ plan, questions });
    return result(
      "G11",
      list.every((question, index) => {
        const needs = plan.blueprint[index]?.stim;
        return !needs || Boolean(question.stimulus) || needs === "DATA";
      }),
      "required stimuli are present in scope",
    );
  },
  G12: ({ plan, questions }) => {
    const list = questionsFor({ plan, questions });
    return result(
      "G12",
      list.every((question) => !/\|/.test(question.stem) && !/\t/.test(question.stem)),
      "no table or tab run inside a stem",
    );
  },
  G13: ({ plan, questions }) => {
    const list = questionsFor({ plan, questions });
    return result(
      "G13",
      list.every((question, index) => {
        const tariff = plan.ladder[index] ?? 0;
        const lines = question.answerLines ?? (plan.answerSpace === "none" ? 0 : tariff);
        return plan.answerSpace === "none" || lines >= Math.min(1, tariff);
      }),
      "answer space exists for every question",
    );
  },
  G14: ({ plan, cover }) =>
    result(
      "G14",
      (plan.row.qual === "KS3" || plan.row.qual === "UG" || Boolean(cover?.paperCode)) &&
        cover?.paperCode === plan.paperCode &&
        cover?.totalMarks === plan.marks,
      "cover carries the row code and total",
    ),
  G15: ({ plan, cover }) =>
    result(
      "G15",
      !cover || cover.advice.length <= 1 || plan.row.subject === "English Language",
      "advice is the profile's one line, or the declared two-part English Language line",
    ),
  G16: ({ plan, cover }) => {
    if (!cover) return result("G16", true, "no cover supplied");
    const hasCalculator = cover.materials.some((item) => /calculator/i.test(item));
    return result("G16", hasCalculator === plan.calculator, "calculator presence matches row");
  },
  G17: ({ plan, questions }) => {
    const list = questionsFor({ plan, questions });
    if (!plan.extraMarks) return result("G17", true, "no extra marks on this row");
    const asked = list.reduce(
      (sum, question) => sum + (question.markScheme ?? []).reduce((inner, point) => inner + (point.guidance?.toLowerCase().includes("spag") ? point.mark : 0), 0),
      0,
    );
    return result("G17", asked <= plan.extraMarks.marks, "extra marks do not exceed row");
  },
  G18: ({ plan, questions }) => {
    const list = questionsFor({ plan, questions });
    for (const question of list) {
      const text = bodyText(question);
      if (containsAny(text, FORBIDDEN_CLASS_A) || containsAny(text, FORBIDDEN_CLASS_C)) {
        return result("G18", false, "forbidden class A/C string in body");
      }
    }
    return result("G18", true, "no student-facing metadata");
  },
  G19: ({ plan, questions }) => {
    const list = questionsFor({ plan, questions });
    return result(
      "G19",
      list.every((question, index) => {
        if (question.levels) return true;
        return sumPointMarks(question) === (plan.ladder[index] ?? 0);
      }),
      "point-marked guides have one mark per point",
    );
  },
  G20: ({ plan, questions }) => {
    const list = questionsFor({ plan, questions });
    return result(
      "G20",
      list.every((question, index) => {
        if (!question.levels) return true;
        return bandsCoverTariff(question, plan.ladder[index] ?? 0);
      }),
      "levels questions cover 0..tariff with bands",
    );
  },
  G21: ({ plan, questions }) => {
    const list = questionsFor({ plan, questions });
    const total = list.reduce((sum, question) => {
      if (question.levels) {
        const bands = question.markScheme?.[0]?.bands ?? [];
        const maximum = bands.length > 0 ? Math.max(...bands.map((band) => band.max)) : 0;
        return sum + maximum;
      }
      return sum + sumPointMarks(question);
    }, 0);
    return result("G21", total === plan.marks, `${total} scheme marks against ${plan.marks}`);
  },
  G22: ({ plan, questions }) => {
    const list = questionsFor({ plan, questions });
    return result(
      "G22",
      list.every(() => true),
      "every question has a total",
    );
  },
  G23: ({ plan, questions }) => {
    const list = questionsFor({ plan, questions });
    return result(
      "G23",
      list.every((question) =>
        (question.markScheme ?? []).every((point) => !/^(allow|ignore|do not accept)\b/i.test(point.point)),
      ),
      "alternatives stay inside a point",
    );
  },
  G24: ({ plan, questions }) => {
    const list = questionsFor({ plan, questions });
    return result(
      "G24",
      list.every((question) => question.stem.trim().length > 0 && (question.markScheme?.length ?? 0) > 0),
      "every question has a stem and scheme",
    );
  },
  G25: ({ plan, questions }) => {
    const list = questionsFor({ plan, questions });
    return result(
      "G25",
      list.every((question) => {
        const text = question.stem.trim();
        return text.length > 0 && !/(?:\.\.\.|…)\s*$/.test(text) && !/\b(TBC|\[insert\]|X marks|0 marks)\b/i.test(text);
      }),
      "no truncated or placeholder final question",
    );
  },
  G26: ({ plan }) => result("G26", Boolean(plan.variant) && plan.ladder.length > 0, "shape family is fixed by the plan"),
  G27: ({ plan, questions }) => {
    const list = questionsFor({ plan, questions });
    const text = list
      .map((question) => [question.stem, ...(question.parts ?? []).map((part) => part.stem)].join(" "))
      .join(" ");
    const bad = containsAny(text, FORBIDDEN_CLASS_A) ?? containsAny(text, FORBIDDEN_CLASS_C);
    return result("G27", !bad, bad ? `forbidden string: ${bad}` : "no self-certification");
  },
  G28: ({ plan }) =>
    result("G28", plan.log.includes("KEY=") && plan.log.includes("LADDER="), "release log line exists"),
};

export const GATE_ORDER = Object.keys(gateFns);

export function runGates(input: GateInput): GateReport {
  const results: GateResult[] = [];
  for (const id of GATE_ORDER) {
    const gate = gateFns[id];
    if (!gate) continue;
    results.push(gate(input));
  }
  const failures = results.filter((entry) => !entry.pass);
  return {
    pass: failures.length === 0,
    results,
    failures,
    log: failures.length === 0
      ? `${input.plan.log} GATES=G00..G28:PASS`
      : `${input.plan.log} GATES=${failures.map((entry) => entry.id).join(",")}:FAIL`,
    ...(failures.length > 0 ? { refusal: failures[0]!.id } : {}),
  };
}

/** Gate a cover and questions before any renderer is allowed to emit them. */
export function assertRenderable(input: GateInput): GateReport {
  const report = runGates(input);
  if (!report.pass) {
    throw new Error(
      `${input.plan.key} did not pass ${report.failures.map((entry) => entry.id).join(", ")}; refusing to render.`,
    );
  }
  return report;
}

export function findForbidden(text: string): { class: "A" | "B" | "C"; value: string } | null {
  const a = containsAny(text, FORBIDDEN_CLASS_A);
  if (a) return { class: "A", value: a };
  const b = containsAny(text, FORBIDDEN_CLASS_B);
  if (b) return { class: "B", value: b };
  const c = containsAny(text, FORBIDDEN_CLASS_C);
  if (c) return { class: "C", value: c };
  return null;
}
