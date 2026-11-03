/**
 * Render stage: the only code that turns a plan and filled lines into a paper.
 *
 * There is no path to a rendered paper without a passing gate report. Cover
 * text, numbering, marks and totals come from the plan; model-returned metadata
 * is ignored because `GeneratedLine` cannot carry it.
 */

import type { GateReport, GeneratedLine, RenderedCover } from "./paperGates";
import type { PaperSectionSpec } from "./paperIndex";
import type { PaperPlan } from "./paperPlan";

export type RenderedQuestion = {
  label: string;
  section: string;
  marks: number;
  stem: string;
  stimulus?: string;
  parts?: Array<{ label: string; tariff: number; stem: string }>;
  answerSpace: string;
  markScheme: string[];
};

export type RenderedSection = {
  id: string;
  label: string;
  marks: number;
  questions: RenderedQuestion[];
};

export type RenderedPaper = {
  key: string;
  paperCode: string;
  totalMarks: number;
  time: string;
  cover: RenderedCover;
  sections: RenderedSection[];
  markScheme: string;
  gateLog: string;
};

const materialsFor = (plan: PaperPlan): string[] => {
  const subject = plan.row.subject.toLowerCase();
  if (plan.row.board === "IB") return [];
  if (plan.row.board === "AP") return [];
  if (subject.includes("english language")) return ["a pen", "a highlighter"];
  if (subject.includes("english literature")) return ["a pen"];
  if (subject.includes("mathematics")) {
    return plan.calculator
      ? ["a scientific calculator", "mathematical instruments", "a ruler"]
      : ["mathematical instruments", "a ruler"];
  }
  if (subject.includes("biology") || subject.includes("chemistry") || subject.includes("physics")) {
    return plan.calculator ? ["a ruler", "a scientific calculator"] : ["a ruler"];
  }
  if (subject.includes("combined science")) return ["a ruler", "a scientific calculator"];
  return [];
};

const instructionsFor = (plan: PaperPlan): string[] => {
  const subject = plan.row.subject.toLowerCase();
  if (subject.includes("english language")) {
    return ["Answer all questions.", "You are advised to plan your answer to Question 5."];
  }
  if (plan.row.board === "AP") {
    return ["Answer all questions.", "Write your answers in the spaces provided."];
  }
  if (plan.row.qual === "KS3") return ["Answer all questions in the spaces provided."];
  return ["Answer all questions.", "Answer in the spaces provided."];
};

const informationFor = (plan: PaperPlan): string[] => {
  const rows = [`The maximum mark for this paper is ${plan.marks}.`];
  if (plan.row.subject === "English Language") {
    rows.push("There are 40 marks for Section A and 40 marks for Section B.");
  }
  if (plan.row.board === "AP") rows.push("Section I is multiple choice; Section II is free response.");
  return rows;
};

export function renderCover(plan: PaperPlan): RenderedCover {
  const time = typeof plan.time === "string" ? plan.time : plan.time.total;
  return {
    totalMarks: plan.marks,
    time,
    paperCode: plan.paperCode,
    ...(plan.paperCode ? { componentCode: plan.paperCode } : {}),
    advice: plan.row.advice ? [plan.row.advice] : [],
    materials: materialsFor(plan),
    instructions: instructionsFor(plan),
    information: informationFor(plan),
  };
}

export function numberLabel(plan: PaperPlan, index: number, partIndex?: number): string {
  const number = index + 1;
  const letter = partIndex === undefined ? undefined : String.fromCharCode(97 + partIndex);
  switch (plan.num) {
    case "NUM-AQA-2DP": {
      const padded = String(number).padStart(2, "0");
      return letter ? `${padded}.${partIndex! + 1}` : padded;
    }
    case "NUM-EDX-INT":
      return letter ? `${number}(${letter})` : String(number);
    case "NUM-OCR":
      return letter ? `${number}(${letter})` : String(number);
    case "NUM-IB":
      return letter ? `(${letter})` : `${number}.`;
    case "NUM-AP":
      return letter ? `(${letter})` : `${number}.`;
    default:
      return letter ? `${number}(${letter})` : String(number);
  }
}

const lineStart = (plan: PaperPlan, index: number): number =>
  plan.ladder.slice(0, index).reduce((sum, mark) => sum + mark, 0);

export function sectionForLine(plan: PaperPlan, index: number): PaperSectionSpec {
  const at = lineStart(plan, index);
  let start = 0;
  for (const section of plan.sections) {
    const end = start + section.marks;
    if (at < end || section === plan.sections[plan.sections.length - 1]) return section;
    start = end;
  }
  return plan.sections[0]!;
}

const answerSpace = (plan: PaperPlan, marks: number, label: string): string => {
  if (plan.answerSpace === "none") return "";
  if (plan.answerSpace === "boxed" || plan.answerSpace === "grid") {
    return `${label} answer box (${marks} marks)`;
  }
  return `${label} answer lines (${marks} ${marks === 1 ? "line" : "lines"})`;
};

const markSchemeRows = (plan: PaperPlan, question: GeneratedLine, index: number): string[] => {
  const rows: string[] = [];
  for (const point of question.markScheme ?? []) {
    if (point.bands && point.bands.length > 0) {
      for (const band of point.bands) {
        rows.push(`Level ${band.level} (${band.min}-${band.max} marks): ${band.descriptor}`);
      }
    } else {
      rows.push(`${point.mark} mark${point.mark === 1 ? "" : "s"}: ${point.point}${point.guidance ? ` — ${point.guidance}` : ""}`);
    }
  }
  if (plan.extraMarks) rows.push(`${plan.extraMarks.label}: ${plan.extraMarks.marks} marks (inside the total)`);
  rows.push(`Total for Question ${numberLabel(plan, index)}: ${plan.ladder[index]} marks`);
  return rows;
};

export function renderPaper(
  plan: PaperPlan,
  questions: GeneratedLine[],
  gates: GateReport,
): RenderedPaper {
  if (!gates.pass) {
    throw new Error(`${plan.key} has no passing gate result; refusing to render.`);
  }
  if (questions.length !== plan.qs) {
    throw new Error(`${plan.key} has ${questions.length} lines, not ${plan.qs}.`);
  }

  const sections: RenderedSection[] = plan.sections.map((section) => ({
    id: section.id,
    label: section.label ?? "",
    marks: section.marks,
    questions: [],
  }));

  const renderedQuestions: RenderedQuestion[] = questions.map((question, index) => {
    const section = sectionForLine(plan, index);
    const target = sections.find((entry) => entry.id === section.id) ?? sections[0]!;
    const label = numberLabel(plan, index);
    const rendered: RenderedQuestion = {
      label,
      section: section.id,
      marks: plan.ladder[index]!,
      stem: question.stem,
      ...(question.stimulus ? { stimulus: question.stimulus } : {}),
      ...(question.parts
        ? {
            parts: question.parts.map((part, partIndex) => ({
              label: part.label ?? numberLabel(plan, index, partIndex),
              tariff: part.tariff,
              stem: part.stem,
            })),
          }
        : {}),
      answerSpace: answerSpace(plan, plan.ladder[index]!, label),
      markScheme: markSchemeRows(plan, question, index),
    };
    target.questions.push(rendered);
    return rendered;
  });

  const markScheme = renderedQuestions.map((question) => `${question.label}\n${question.markScheme.join("\n")}`).join("\n\n");

  return {
    key: plan.key,
    paperCode: plan.paperCode,
    totalMarks: plan.marks,
    time: typeof plan.time === "string" ? plan.time : plan.time.total,
    cover: renderCover(plan),
    sections,
    markScheme,
    gateLog: gates.log,
  };
}
