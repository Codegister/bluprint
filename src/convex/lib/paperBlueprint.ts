import { boardFamily } from "./paperFormat";
import { literatureChoicesFor } from "./literatureChoices";

/**
 * The question structure of a real paper, per subject.
 *
 * A paper is not a generic list of questions: Religious Studies is built from
 * 1, 1, 4, 6 and 12-mark parts, AQA GCSE Biology is eight numbered questions
 * containing 48 parts, and an English Literature paper is a menu of essays.
 * The board's cover rubric in `paperFormat.ts` describes how a paper looks;
 * this module describes what is actually in it.
 *
 * The generation prompt is built from these slots, so the model cannot fall
 * back on a generic short-answer paper. The same blueprint also supplies the
 * summary shown on the course page, so the student knows the format before
 * building a paper.
 */

export type PaperMarking = "points" | "levels";

/** One printable part of a structured question. */
export type PaperPart = {
  /** The marks printed for this part. */
  marks: number;
  /** The command word the part opens with. */
  command: string;
  /** Part letter for a question split into (a), (b), (c)… */
  part?: string;
  /** An exact label supplied by the paper format, e.g. "0 1 . 1". */
  label?: string;
  /** What the part must ask the student to do. */
  ask: string;
  /**
   * Point-marked questions have one bullet per mark. Levels-marked questions
   * have a descriptor for each level, which is how long answers are marked.
   */
  marking: PaperMarking;
  /** The question must print an extract from the set text above the stem. */
  extract?: boolean;
  /** The named text, author and form for that extract. */
  extractSource?: string;
  extractAuthor?: string;
  extractKind?: "play" | "novel";
  /** Print line numbers beside the extract at five-line intervals. */
  lineNumbers?: boolean;
  /** A source, insert or booklet the question requires. */
  insert?: string;
  /** SPaG is assessed on this part, inside the paper's total. */
  spag?: boolean;
};

export type PaperSlot = PaperPart & {
  /**
   * A real question can contain several printed parts. When this is present,
   * `marks` is the question total and the parts carry the printed tariffs.
   */
  parts?: PaperPart[];
  /** The parent label, e.g. "1" or "0 1", for a structured question. */
  questionLabel?: string;
  /** Explicit parent total when the parts do not sum to it (choice menus). */
  questionMarks?: number;
  /** Marks this slot contributes to the paper total. Defaults to its own. */
  countedMarks?: number;
};

export type PaperSection = {
  title: string;
  instruction: string;
  slots: PaperSlot[];
  /** Marks the section contributes when it offers a choice of questions. */
  marks?: number;
};

export type PaperBlueprint = {
  id: string;
  /** "8 questions · 1, 2, 3, 4 and 6 marks" */
  summary: string;
  /** One sentence for the course page. */
  description: string;
  sections: PaperSection[];
  totalMarks: number;
  /** Printed questions, not the number of individual parts. */
  questionCount: number;
  /** Printed parts across every question. */
  partCount: number;
  /** Printed questions the candidate must answer when choice is offered. */
  candidateAnswers?: number;
  /** The real component code, e.g. "8461/1H". */
  componentCode?: string;
  /** Estimated printed page count for boards that state it. */
  pageCount?: number;
  /** Extra cover lines, e.g. the 40/40 split or a required insert. */
  coverNotes?: string[];
  /** Assessment-objective split, when the board publishes one. */
  aoSplit?: Record<string, number>;
  /** Rules appended to the generation prompt. */
  rules: string[];
  /** SPaG marks carried by the paper but not by a question slot. */
  spagMarks?: number;
  /** Real exam duration; every built blueprint sets this explicitly. */
  durationMinutes: number;
  /** Set for NEA/coursework qualifications that are not timed papers. */
  notAWrittenPaper?: boolean;
};

/** The course fields a blueprint is chosen from. */
export type BlueprintCourse = {
  subject: string;
  level: string;
  examBoard: string;
  tier?: string | null;
  variant?: string | null;
  rsRoute?: string | null;
  rsReligion?: string | null;
  rsReligion2?: string | null;
  /** Route A's third paper, or Route B's first Area of Study. */
  rsSpec?: string | null;
  /** Route B's second Area of Study. */
  rsSpec2?: string | null;
  poetryTheme?: string | null;
  /** GCSE English Literature set texts, when the student chose them. */
  litShakespeare?: string | null;
  litNovel?: string | null;
  litModern?: string | null;
  /** Used to recover the set text from older courses that predate the fields. */
  pathway?: {
    units: Array<{ title: string; topics: Array<{ title: string }> }>;
  } | null;
};

/** One flattened question, exactly as it will be stored and displayed. */
export type FlatPaperSlot = {
  label: string;
  /** The parent question label for a part, e.g. "1" or "0 1". */
  questionLabel?: string;
  section: string;
  sectionInstruction: string;
  marks: number;
  command: string;
  ask: string;
  marking: PaperMarking;
  extract?: boolean;
  extractSource?: string;
  extractAuthor?: string;
  extractKind?: "play" | "novel";
  lineNumbers?: boolean;
  insert?: string;
  spag?: boolean;
};

const POINT_RULE =
  "For every point-marked question, the marking guide must have one bullet per mark, written as '1 mark: …', and the bullets must add up to the marks available.";
const LEVEL_RULE =
  "For every levels-marked question, the marking guide must keep the board's bands: descriptors with mark ranges (for example 'Level 3 (5-6 marks): …'), marked best-fit, with indicative content separate. Never turn a band into a per-criterion mark.";

function q(
  marks: number,
  command: string,
  ask: string,
  options: {
    part?: string;
    marking?: PaperMarking;
    extract?: boolean;
    extractSource?: string;
    extractAuthor?: string;
    extractKind?: "play" | "novel";
    lineNumbers?: boolean;
    insert?: string;
    spag?: boolean;
  } = {},
): PaperSlot {
  return {
    marks,
    command,
    ask,
    marking: options.marking ?? "points",
    ...(options.part ? { part: options.part } : {}),
    ...(options.extract ? { extract: true } : {}),
    ...(options.extractSource ? { extractSource: options.extractSource } : {}),
    ...(options.extractAuthor ? { extractAuthor: options.extractAuthor } : {}),
    ...(options.extractKind ? { extractKind: options.extractKind } : {}),
    ...(options.lineNumbers ? { lineNumbers: true } : {}),
    ...(options.insert ? { insert: options.insert } : {}),
    ...(options.spag ? { spag: true } : {}),
  };
}

function p(
  label: string,
  marks: number,
  command: string,
  ask: string,
  options: {
    marking?: PaperMarking;
    extract?: boolean;
    extractSource?: string;
    extractAuthor?: string;
    extractKind?: "play" | "novel";
    lineNumbers?: boolean;
    insert?: string;
    spag?: boolean;
  } = {},
): PaperPart {
  return { label, ...q(marks, command, ask, options) };
}

function question(
  label: string,
  parts: PaperPart[],
  options: { questionMarks?: number; countedMarks?: number } = {},
): PaperSlot {
  const marks =
    options.questionMarks ?? parts.reduce((sum, part) => sum + part.marks, 0);
  return {
    label,
    parts,
    questionLabel: label,
    marks,
    questionMarks: marks,
    command: parts[0]?.command ?? "Answer",
    ask: parts[0]?.ask ?? "",
    marking: parts.some((part) => part.marking === "levels") ? "levels" : "points",
    ...(options.countedMarks !== undefined
      ? { countedMarks: options.countedMarks }
      : {}),
  };
}

function section(
  title: string,
  instruction: string,
  slots: PaperSlot[],
  marks?: number,
): PaperSection {
  return { title, instruction, slots, ...(marks !== undefined ? { marks } : {}) };
}

/** "1 mark", "3 marks". */
function markLabel(marks: number): string {
  return `${marks} mark${marks === 1 ? "" : "s"}`;
}

/** "3, 4, 5 and 12 marks". */
function marksList(marks: number[]): string {
  if (marks.length === 0) return "no marks";
  const unique = [...new Set(marks)].sort((a, b) => a - b);
  if (unique.length === 1) return markLabel(unique[0]!);
  const last = unique.pop()!;
  return `${unique.join(", ")} and ${last} marks`;
}

function slotQuestionMarks(slot: PaperSlot): number {
  return slot.parts && slot.parts.length > 0
    ? (slot.questionMarks ?? slot.parts.reduce((sum, part) => sum + part.marks, 0))
    : slot.marks;
}

function countedSlotMarks(slot: PaperSlot): number {
  return slot.countedMarks ?? slotQuestionMarks(slot);
}

function makeBlueprint(
  id: string,
  description: string,
  sections: PaperSection[],
  rules: string[],
  options: {
    spagMarks?: number;
    durationMinutes: number;
    totalMarks?: number;
    questionCount?: number;
    partCount?: number;
    candidateAnswers?: number;
    componentCode?: string;
    pageCount?: number;
    coverNotes?: string[];
    aoSplit?: Record<string, number>;
    expectedRatio?: number;
    notAWrittenPaper?: boolean;
  },
): PaperBlueprint {
  const slots = sections.flatMap((item) => item.slots);
  const contentMarks = sections.reduce(
    (sum, item) =>
      sum +
      (item.marks ??
        item.slots.reduce((inner, slot) => inner + countedSlotMarks(slot), 0)),
    0,
  );
  const spagMarks = options.spagMarks ?? 0;
  const totalMarks = options.totalMarks ?? contentMarks + spagMarks;

  // This is deliberately a build-time failure, not a quiet adjustment. A paper
  // whose cover total does not match its questions cannot be marked honestly.
  if (totalMarks !== contentMarks + spagMarks) {
    throw new Error(
      `Paper ${id} totals ${totalMarks} marks but its sections total ${contentMarks + spagMarks}.`,
    );
  }
  if (options.durationMinutes <= 0 && !options.notAWrittenPaper) {
    throw new Error(`Paper ${id} needs a real duration in minutes.`);
  }
  if (options.expectedRatio !== undefined && options.durationMinutes > 0) {
    const ratio = totalMarks / options.durationMinutes;
    if (Math.abs(ratio - options.expectedRatio) > 0.02) {
      throw new Error(
        `Paper ${id} has ${totalMarks} marks in ${options.durationMinutes} minutes (${ratio.toFixed(2)} marks/minute), not the expected ${options.expectedRatio.toFixed(2)}.`,
      );
    }
  }

  const printedMarks = slots.flatMap((slot) =>
    slot.parts && slot.parts.length > 0
      ? slot.parts.map((part) => part.marks)
      : [slot.marks],
  );
  const questionCount = options.questionCount ?? slots.length;
  const partCount =
    options.partCount ??
    slots.reduce((sum, slot) => sum + (slot.parts?.length ?? 1), 0);

  return {
    id,
    description,
    sections,
    totalMarks,
    questionCount,
    partCount,
    ...(options.candidateAnswers !== undefined
      ? { candidateAnswers: options.candidateAnswers }
      : {}),
    ...(options.componentCode ? { componentCode: options.componentCode } : {}),
    ...(options.pageCount !== undefined ? { pageCount: options.pageCount } : {}),
    ...(options.coverNotes ? { coverNotes: options.coverNotes } : {}),
    ...(options.aoSplit ? { aoSplit: options.aoSplit } : {}),
    summary: `${questionCount} question${questionCount === 1 ? "" : "s"} · ${marksList(printedMarks)}`,
    rules,
    ...(spagMarks ? { spagMarks } : {}),
    durationMinutes: options.durationMinutes,
    ...(options.notAWrittenPaper ? { notAWrittenPaper: true } : {}),
  };
}

/**
 * Numbers a blueprint the way the board prints it. A question with parts keeps
 * its part labels ("1 (a)", "0 1 . 1"); a paper without parts runs 1, 2, 3…
 * across its sections. Question numbering is global, not restarted per section.
 */
export function flattenPaperBlueprint(
  blueprint: PaperBlueprint,
): FlatPaperSlot[] {
  const flat: FlatPaperSlot[] = [];
  let questionNumber = 0;

  for (const item of blueprint.sections) {
    for (const slot of item.slots) {
      if (slot.parts && slot.parts.length > 0) {
        questionNumber += 1;
        const parent = slot.questionLabel ?? slot.label ?? String(questionNumber);
        slot.parts.forEach((part, partIndex) => {
          flat.push({
            label:
              part.label ??
              `${parent} (${part.part ?? String.fromCharCode(97 + partIndex)})`,
            questionLabel: parent,
            section: item.title,
            sectionInstruction: item.instruction,
            marks: part.marks,
            command: part.command,
            ask: part.ask,
            marking: part.marking,
            ...(part.extract ? { extract: true } : {}),
            ...(part.extractSource ? { extractSource: part.extractSource } : {}),
            ...(part.extractAuthor ? { extractAuthor: part.extractAuthor } : {}),
            ...(part.extractKind ? { extractKind: part.extractKind } : {}),
            ...(part.lineNumbers ? { lineNumbers: true } : {}),
            ...(part.insert ? { insert: part.insert } : {}),
            ...(part.spag ? { spag: true } : {}),
          });
        });
        continue;
      }

      if (!slot.part || slot.part === "a") {
        questionNumber += 1;
      } else if (questionNumber === 0) {
        questionNumber = 1;
      }
      const parent = String(questionNumber);
      flat.push({
        label: slot.label ?? (slot.part ? `${parent} (${slot.part})` : parent),
        ...(slot.part ? { questionLabel: parent } : {}),
        section: item.title,
        sectionInstruction: item.instruction,
        marks: slot.marks,
        command: slot.command,
        ask: slot.ask,
        marking: slot.marking,
        ...(slot.extract ? { extract: true } : {}),
        ...(slot.extractSource ? { extractSource: slot.extractSource } : {}),
        ...(slot.extractAuthor ? { extractAuthor: slot.extractAuthor } : {}),
        ...(slot.extractKind ? { extractKind: slot.extractKind } : {}),
        ...(slot.lineNumbers ? { lineNumbers: true } : {}),
        ...(slot.insert ? { insert: slot.insert } : {}),
        ...(slot.spag ? { spag: true } : {}),
      });
    }
  }
  return flat;
}

function isAdvanced(level: string): boolean {
  return /^(as|a-level|ib|undergraduate)$/i.test(level.trim());
}

function isAp(level: string): boolean {
  return /^ap$/i.test(level.trim());
}

function isGcse(level: string): boolean {
  return /^gcse$/i.test(level.trim());
}

function religionPair(course: BlueprintCourse): string[] {
  return [course.rsReligion, course.rsReligion2]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function religionsLabel(course: BlueprintCourse): string {
  const list = religionPair(course);
  return list.length > 0 ? list.join(" and ") : "the religions you study";
}

function paperNumber(paper?: string): number {
  const match = paper?.match(/paper\s*(\d+)/i);
  return match ? Number(match[1]) : 1;
}

function tierCode(course: BlueprintCourse): "H" | "F" {
  return /foundation/i.test(course.tier ?? "") ? "F" : "H";
}

// ---------------------------------------------------------------------------
// Non-examined and AP qualifications
// ---------------------------------------------------------------------------

/**
 * NEA and portfolio subjects are not timed written papers. The app refuses to
 * generate one rather than dressing a coursework brief as an exam.
 */
function notAWrittenPaper(course: BlueprintCourse): PaperBlueprint {
  return makeBlueprint(
    "nea",
    `${course.subject} is assessed by non-examined assessment, not a timed paper.`,
    [],
    [
      "This qualification is assessed by coursework, a portfolio or an NEA brief.",
      "Do not generate a timed written paper.",
    ],
    {
      durationMinutes: 0,
      totalMarks: 0,
      questionCount: 0,
      partCount: 0,
      notAWrittenPaper: true,
    },
  );
}

/**
 * AP is a separate qualification from A-level: papers are 90–180 minutes and
 * mix multiple-choice with free response. The app stores one free-response
 * paper, so this is a 60-mark/90-minute free-response set rather than a GCSE
 * grid. (AP Biology 0610-style multiple choice is not reproduced.)
 */
function apPaper(): PaperBlueprint {
  const slots = Array.from({ length: 12 }, (_, index) =>
    q(
      index < 8 ? 4 : 7,
      index < 4 ? "Describe" : index < 8 ? "Explain" : "Evaluate",
      index < 4
        ? "Ask a short free-response question requiring a precise explanation."
        : index < 8
          ? "Ask a structured free-response question applying the concept to a new context."
          : "Ask an extended free-response question requiring a justified conclusion.",
      index >= 8 ? { marking: "levels" } : {},
    ),
  );
  return makeBlueprint(
    "ap-free-response",
    "AP format: 12 free-response questions in 90 minutes, with extended evaluation.",
    [section("Free response", "Answer all questions. Show your working where required.", slots)],
    [
      `Write exactly ${slots.length} questions with the marks shown.`,
      "Use AP command words and free-response wording; do not use GCSE tier language.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
    {
      durationMinutes: 90,
      expectedRatio: 0.67,
      componentCode: "AP",
      coverNotes: ["AP free-response practice; multiple-choice section not included."],
    },
  );
}

// ---------------------------------------------------------------------------
// Religious Studies
// ---------------------------------------------------------------------------

/** Edexcel RS: 3, 4, 5 and 12-mark parts. */
function edexcelRsGroup(): PaperSlot[] {
  return [
    q(
      3,
      "Outline",
      "Ask the student to outline three beliefs, practices or teachings from the specification. The answer needs three separate points.",
      { part: "a" },
    ),
    q(
      4,
      "Explain",
      "Ask the student to explain two beliefs or practices, giving a reason or example for each.",
      { part: "b" },
    ),
    q(
      5,
      "Explain",
      "Ask the student to explain two beliefs or practices, referring to a source of authority or a religious teaching.",
      { part: "c" },
    ),
    q(
      12,
      "Evaluate",
      "Give a statement students can agree or disagree with and ask 'Evaluate this statement.' Require a justified conclusion and reference to non-religious beliefs as well as religious ones.",
      { part: "d", marking: "levels" },
    ),
  ];
}

function edexcelRs(course: BlueprintCourse, paper?: string): PaperBlueprint {
  const routeB = /studies b|route b/i.test(course.rsRoute ?? "");
  const list = religionPair(course);
  const religions = list.length > 0 ? list : ["the religion you study"];
  const area = course.rsSpec?.trim();
  const area2 = course.rsSpec2?.trim();
  const number = paperNumber(paper);
  const onePaper = /paper\s*\d+/i.test(paper ?? "");
  const secondPaper = number === 2;
  const paperReligion = secondPaper
    ? (religions[1] ?? "the second religion")
    : religions[0]!;
  const paperArea = secondPaper ? (area2 ?? "Area of Study") : (area ?? "Area of Study");
  const paperTitle = routeB
    ? `Paper ${number} — ${paperArea} · ${paperReligion}`
    : `Paper ${number} — Study of Religion · ${paperReligion}`;
  const sections = onePaper
    ? [
        section(
          paperTitle,
          "Answer all questions. Answer in full sentences.",
          edexcelRsGroup(),
        ),
      ]
    : religions.map((religion, index) =>
        section(
          routeB
            ? `Section ${index + 1} — ${index === 0 ? (area ?? "Area of Study") : (area2 ?? "Area of Study")} · ${religion}`
            : `Section ${index + 1} — Study of Religion · ${religion}`,
          "Answer all questions. Answer in full sentences.",
          edexcelRsGroup(),
        ),
      );
  const groups = onePaper
    ? ["1 (a) to 1 (d)"]
    : religions.map((_, index) => `${index + 1} (a) to ${index + 1} (d)`);
  const baseId = routeB ? "rs-edexcel-b" : "rs-edexcel-a";
  const id = onePaper ? `${baseId}-p${number}` : baseId;

  return makeBlueprint(
    id,
    onePaper
      ? `Edexcel ${routeB ? "Route B" : "Route A"} Paper ${number}: 3, 4, 5 and 12-mark questions.`
      : `Edexcel ${routeB ? "Route B" : "Route A"} format: 3, 4, 5 and 12-mark questions for each religion.`,
    sections,
    [
      onePaper
        ? "Write exactly four questions, numbered 1 (a) to 1 (d)."
        : `Write exactly ${sections.length * 4} questions, numbered ${groups.join(" and ")}.`,
      "Every group of four questions must be worth exactly 3, 4, 5 and 12 marks. Never change those marks.",
      onePaper
        ? `Every question in this paper must be on ${paperReligion}. Do not use another religion.`
        : `Keep each section to its own religion: ${religions.join(" and ")}. Do not invent a religion.`,
      "Each 12-mark question must be a statement to evaluate, not an explain question. It must ask for a justified conclusion and must refer to non-religious beliefs.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
    { durationMinutes: onePaper ? 60 : 105, pageCount: onePaper ? 8 : 12 },
  );
}

/** AQA 8062/1: four five-part groups, 96 marks + 6 SPaG. */
function aqaRsGroup(): PaperSlot[] {
  return [
    q(
      1,
      "Choose",
      "Ask a one-mark multiple-choice question with four options labelled A, B, C and D. The student answers with the correct letter.",
      { part: "a" },
    ),
    q(
      1,
      "Give",
      "Ask for one belief, practice or example. There is exactly one mark for it.",
      { part: "b" },
    ),
    q(
      4,
      "Explain",
      "Ask the student to explain two beliefs or practices, giving a reason or example for each.",
      { part: "c" },
    ),
    q(
      6,
      "Explain",
      "Ask the student to explain two beliefs or practices, referring to a source of authority or a religious teaching.",
      { part: "d" },
    ),
    q(
      12,
      "Evaluate",
      "Give a statement students can agree or disagree with and ask them to evaluate it. Require a justified conclusion and reference to non-religious beliefs as well as religious ones.",
      { part: "e", marking: "levels", spag: true },
    ),
  ];
}

function aqaRs(course: BlueprintCourse): PaperBlueprint {
  const list = religionPair(course);
  const religions = list.length > 0 ? list : ["the religion you study"];
  const strands = ["Beliefs and teachings", "Practices"];
  const sections: PaperSection[] = [];
  const groups: string[] = [];
  let number = 0;
  for (const religion of religions) {
    for (const strand of strands) {
      number += 1;
      const letter = String.fromCharCode(64 + number);
      sections.push(
        section(
          `Section ${letter} — ${religion}: ${strand}`,
          "Answer all questions. Answer in full sentences.",
          aqaRsGroup(),
        ),
      );
      groups.push(`${number} (a) to ${number} (e)`);
    }
  }

  return makeBlueprint(
    "rs-aqa",
    "AQA 8062/1: four five-part groups (beliefs and practices for each religion), 96 marks plus 6 SPaG.",
    sections,
    [
      `Write exactly ${sections.length * 5} parts, numbered ${groups.join(", ")}.`,
      "Every group of five questions must be worth exactly 1, 1, 4, 6 and 12 marks. Never change those marks.",
      `Keep each religion's two groups to that religion: ${religions.join(" and ")}. Do not invent a religion.`,
      "Each 12-mark question must be a statement to evaluate, not an explain question. It must ask for a justified conclusion and must refer to non-religious beliefs.",
      "The paper carries 6 SPaG marks on the 12-mark questions. They are printed separately and included in the 102-mark total, never added on top.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
    {
      spagMarks: 6,
      durationMinutes: 105,
      expectedRatio: 0.96,
      componentCode: "8062/1",
      questionCount: 4,
      partCount: 20,
      pageCount: 16,
      coverNotes: ["96 marks plus 6 SPaG marks, included in the total."],
    },
  );
}

function eduqasRs(course: BlueprintCourse): PaperBlueprint {
  return makeBlueprint(
    "rs-eduqas",
    "Eduqas format: 2, 5, 8 and 15-mark questions, ending with a 15-mark evaluation.",
    [
      section(
        `Section A — ${religionsLabel(course)}`,
        "Answer all questions. Answer in full sentences.",
        [
          q(2, "Give", "Ask the student to give two beliefs, practices or examples. One mark for each.", { part: "a" }),
          q(5, "Explain", "Ask the student to explain two beliefs or practices, giving a reason or example for each.", { part: "b" }),
          q(8, "Explain", "Ask the student to explain how a belief or practice is shown in a source of authority, or to compare two views.", { part: "c", marking: "levels" }),
          q(15, "Evaluate", "Give a statement students can agree or disagree with and ask them to evaluate it, reaching a justified conclusion and referring to non-religious beliefs.", { part: "d", marking: "levels" }),
        ],
      ),
    ],
    [
      "Write exactly four questions, numbered 1 (a) to 1 (d).",
      "The marks must be exactly 2, 5, 8 and 15. Never write a question worth any other number of marks.",
      "Use only the religions on this course. Keep each question to one religion, and do not invent a religion.",
      "The 1 (d) question must be a statement to evaluate, not an explain question, and must ask for a justified conclusion.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
    { durationMinutes: 60, pageCount: 8 },
  );
}

function ocrRs(course: BlueprintCourse): PaperBlueprint {
  return makeBlueprint(
    "rs-ocr",
    "OCR format: 3, 6 and 15-mark questions, ending with a 15-mark discussion.",
    [
      section(
        `Section A — ${religionsLabel(course)}`,
        "Answer all questions. Answer in full sentences.",
        [
          q(3, "Outline", "Ask the student to outline three beliefs, practices or teachings from the specification.", { part: "a" }),
          q(6, "Explain", "Ask the student to explain two beliefs or practices, referring to a source of authority or a religious teaching.", { part: "b" }),
          q(15, "Discuss", "Give a statement students can agree or disagree with and ask them to discuss it, reaching a justified conclusion and referring to non-religious beliefs.", { part: "c", marking: "levels" }),
        ],
      ),
    ],
    [
      "Write exactly three questions, numbered 1 (a), 1 (b) and 1 (c).",
      "The marks must be exactly 3, 6 and 15. Never write a question worth any other number of marks.",
      "Use only the religions on this course. Keep each question to one religion, and do not invent a religion.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
    { durationMinutes: 60, pageCount: 8 },
  );
}

function advancedRs(): PaperBlueprint {
  return makeBlueprint(
    "rs-advanced",
    "A-level format: one 10-mark explanation and one 25-mark essay.",
    [
      section("Section A — Explanation", "Answer all questions.", [
        q(10, "Explain", "Ask the student to explain two or three beliefs or arguments in depth, using technical vocabulary and sources of authority.", { marking: "levels" }),
      ]),
      section("Section B — Essay", "Answer the essay question.", [
        q(25, "Evaluate", "Give a statement or claim and ask the student to evaluate it in a sustained essay, considering both sides and reaching a justified conclusion.", { marking: "levels" }),
      ]),
    ],
    [
      "Write exactly two questions, numbered 1 and 2.",
      "Question 1 is worth 10 marks and question 2 is worth 25 marks. No other mark values.",
      "There must be no one-mark, recall or multiple-choice questions at this level.",
      LEVEL_RULE,
      "The model answer for the 25-mark essay must be a full essay with an argument, not a list.",
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
    { durationMinutes: 60, pageCount: 8 },
  );
}

function genericRs(course: BlueprintCourse): PaperBlueprint {
  return makeBlueprint(
    "rs-generic",
    "Religious Studies format: 3, 4, 5 and 12-mark questions.",
    [
      section(
        `Section A — ${religionsLabel(course)}`,
        "Answer all questions. Answer in full sentences.",
        [
          q(3, "Outline", "Ask the student to outline three beliefs or practices.", { part: "a" }),
          q(4, "Explain", "Ask the student to explain two beliefs or practices, giving a reason for each.", { part: "b" }),
          q(5, "Explain", "Ask the student to explain two beliefs or practices, referring to a source of authority.", { part: "c" }),
          q(12, "Evaluate", "Give a statement to evaluate. Require a justified conclusion and reference to non-religious beliefs.", { part: "d", marking: "levels" }),
        ],
      ),
    ],
    [
      "Write exactly four questions, numbered 1 (a) to 1 (d), worth 3, 4, 5 and 12 marks.",
      "Use only the religions on this course.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
    { durationMinutes: 60, pageCount: 8 },
  );
}

function religiousStudies(course: BlueprintCourse, paper?: string): PaperBlueprint {
  if (isAdvanced(course.level)) return advancedRs();
  switch (boardFamily(course.examBoard)) {
    case "aqa":
      return aqaRs(course);
    case "edexcel":
      return edexcelRs(course, paper);
    case "wjec":
      return eduqasRs(course);
    case "ocr":
      return ocrRs(course);
    default:
      return genericRs(course);
  }
}

// ---------------------------------------------------------------------------
// English
// ---------------------------------------------------------------------------

type EssaySection = {
  title: string;
  focus: string;
  text?: string;
  author?: string;
  form: "play" | "novel" | "poetry" | "text";
  extract?: boolean;
};

function normalizedTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function literatureText(
  course: BlueprintCourse,
  kind: "shakespeare" | "novel",
): string | undefined {
  const direct = kind === "shakespeare" ? course.litShakespeare : course.litNovel;
  if (direct?.trim()) return direct.trim();
  const choices = literatureChoicesFor(course.examBoard)?.[kind] ?? [];
  const titles =
    course.pathway?.units.flatMap((unit) =>
      unit.topics.map((topic) => normalizedTitle(topic.title)),
    ) ?? [];
  return choices.find((choice) => {
    const wanted = normalizedTitle(choice);
    return titles.some((title) => title.includes(wanted) || wanted.includes(title));
  });
}

function authorForText(text?: string): string | undefined {
  if (!text) return undefined;
  const value = normalizedTitle(text);
  if (/macbeth|romeo|merchant|much ado|tempest|julius caesar|twelfth night/.test(value)) return "Shakespeare";
  if (/christmas carol|great expectations|oliver twist|hard times|tale of two cities/.test(value)) return "Dickens";
  if (/jekyll|hyde/.test(value)) return "Stevenson";
  if (/jane eyre/.test(value)) return "Brontë";
  if (/frankenstein/.test(value)) return "Shelley";
  if (/pride and prejudice/.test(value)) return "Austen";
  if (/sign of four/.test(value)) return "Conan Doyle";
  if (/silas marner/.test(value)) return "Eliot";
  if (/war of the worlds/.test(value)) return "Wells";
  return undefined;
}

function essaySections(course: BlueprintCourse): EssaySection[] {
  const family = boardFamily(course.examBoard);
  const poetry = course.poetryTheme?.trim();
  if (isAdvanced(course.level)) {
    return [
      { title: "Section A — Set text", focus: "the set text you have studied", form: "text" },
      {
        title: poetry ? `Section B — Poetry: ${poetry}` : "Section B — Poetry or second text",
        focus: poetry ? `a poem from the ${poetry} anthology` : "a poem or second text you have studied",
        form: "poetry",
      },
    ];
  }
  switch (family) {
    case "aqa": {
      const shakespeare = literatureText(course, "shakespeare");
      const novel = literatureText(course, "novel");
      return [
        {
          title: "Section A — Shakespeare",
          focus: shakespeare ?? "the Shakespeare play you have studied",
          text: shakespeare,
          author: authorForText(shakespeare),
          form: "play",
          extract: true,
        },
        {
          title: "Section B — 19th-century novel",
          focus: novel ?? "the 19th-century novel you have studied",
          text: novel,
          author: authorForText(novel),
          form: "novel",
          extract: true,
        },
      ];
    }
    case "edexcel":
      return [
        { title: "Section A — Shakespeare", focus: "the Shakespeare play you have studied", form: "play" },
        { title: "Section B — Post-1914 literature", focus: "the post-1914 play or novel you have studied", form: "text" },
      ];
    case "ocr":
      return [
        { title: "Section A — Modern prose or drama", focus: "the modern prose or drama text you have studied", form: "text" },
        { title: "Section B — 19th-century prose", focus: "the 19th-century prose text you have studied", form: "novel" },
      ];
    case "wjec":
      return [
        { title: "Section A — Shakespeare", focus: "the Shakespeare play you have studied", form: "play" },
        {
          title: poetry ? `Section B — Poetry anthology: ${poetry}` : "Section B — Poetry anthology",
          focus: poetry ? `a poem from the ${poetry} anthology` : "a poem from the anthology you have studied",
          form: "poetry",
        },
      ];
    default:
      return [
        { title: "Section A — Set text", focus: "the set text you have studied", form: "text" },
        {
          title: poetry ? `Section B — Poetry: ${poetry}` : "Section B — Poetry",
          focus: poetry ? `a poem from the ${poetry} anthology` : "a poem you have studied",
          form: "poetry",
        },
      ];
  }
}

/**
 * AQA 8702/1 prints a menu: six Shakespeare questions and seven 19th-century
 * novel questions. The candidate answers one from each section. The two-part
 * stem is Literature wording, not Language comprehension wording.
 */
function aqaEnglishLiterature(course: BlueprintCourse): PaperBlueprint {
  const shakespeare = literatureText(course, "shakespeare") ?? "the Shakespeare play you have studied";
  const novel = literatureText(course, "novel") ?? "the 19th-century novel you have studied";
  const shakespeareAuthor = authorForText(shakespeare) ?? "Shakespeare";
  const novelAuthor = authorForText(novel) ?? "the writer";
  const shakespeareFocuses = [
    "ambition",
    "guilt",
    "power",
    "loyalty",
    "appearance and reality",
    "fate",
  ];
  const novelFocuses = [
    "family",
    "social class",
    "childhood",
    "fear",
    "responsibility",
    "isolation",
    "redemption",
  ];
  const shakespeareSlots = shakespeareFocuses.map((focus) =>
    q(
      30,
      "Explore",
      `Starting with this speech from ${shakespeare}, explore how far ${shakespeareAuthor} presents ${focus} as a central concern. Write about: • how ${shakespeareAuthor} presents ${focus} in this speech • how ${shakespeareAuthor} presents ${focus} in the play as a whole.`,
      {
        marking: "levels",
        extract: true,
        extractSource: shakespeare,
        extractAuthor: shakespeareAuthor,
        extractKind: "play",
        lineNumbers: true,
        spag: true,
      },
    ),
  );
  const novelSlots = novelFocuses.map((focus) =>
    q(
      30,
      "Explore",
      `Starting with this extract from ${novel}, explore how far ${novelAuthor} presents ${focus} as a central concern. Write about: • how ${novelAuthor} presents ${focus} in this extract • how ${novelAuthor} presents ${focus} in the novel as a whole.`,
      {
        marking: "levels",
        extract: true,
        extractSource: novel,
        extractAuthor: novelAuthor,
        extractKind: "novel",
        lineNumbers: true,
      },
    ),
  );

  const blueprint = makeBlueprint(
    "english-literature-aqa-extract",
    "AQA 8702/1: a menu of six Shakespeare and seven 19th-century novel essays. Answer one from each section.",
    [
      section(
        "Section A — Shakespeare",
        "Answer one question from this section. This section carries 30 marks plus 4 marks for AO4 (SPaG).",
        shakespeareSlots,
        30,
      ),
      section(
        "Section B — 19th-century novel",
        "Answer one question from this section. This section carries 30 marks.",
        novelSlots,
        30,
      ),
    ],
    [
      "Write one entry for every printed question in both sections: six Shakespeare questions and seven novel questions.",
      "Each essay is worth 30 marks. Section A also carries the paper's 4 AO4 (SPaG) marks.",
      "Use the AQA Literature stem exactly: 'Starting with this speech/extract, explore how far [author] presents [focus] as [quality].' Then require 'Write about: … in this speech/extract; … in the play/novel as a whole.' Never use the Language stem 'how does the writer…'.",
      `Use ${shakespeare} and ${novel}; never invent a text, character or scene.`,
      "Every question must print an extract above the stem, with line numbers every five lines.",
      "Shakespeare extracts are 200-300 words; novel extracts are 300-400 words. Do not repeat a sentence or paragraph.",
      "Each model answer must be a full essay with an introduction, developed paragraphs and a conclusion.",
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
    {
      spagMarks: 4,
      durationMinutes: 105,
      expectedRatio: 0.61,
      componentCode: "8702/1",
      questionCount: 13,
      partCount: 13,
      candidateAnswers: 2,
      pageCount: 16,
      coverNotes: [
        "Section A: 30 marks + 4 AO4. Section B: 30 marks.",
        "Answer one question from each section.",
      ],
    },
  );
  return {
    ...blueprint,
    summary: "13 essay questions (choose 2) · 30 marks each + 4 SPaG",
  };
}

function englishLiterature(course: BlueprintCourse): PaperBlueprint {
  if (boardFamily(course.examBoard) === "aqa" && !isAdvanced(course.level)) {
    return aqaEnglishLiterature(course);
  }

  const family = boardFamily(course.examBoard);
  const advanced = isAdvanced(course.level);
  const marks = advanced
    ? 25
    : family === "edexcel" || family === "ocr" || family === "wjec"
      ? 40
      : family === "cambridge"
        ? 25
        : 30;
  const twoPart = family === "edexcel" || family === "ocr";
  const blueprint = makeBlueprint(
    "english-literature",
    "English Literature format: two full essay questions, marked against level descriptors.",
    essaySections(course).map((essay) =>
      section(essay.title, "Answer the question.", [
        q(
          marks,
          "Explore",
          `Set one essay question on ${essay.focus}. If the specification names the text or poem, name it; otherwise say 'the text you have studied'. Use the board's essay wording (for example 'Explore how…' or 'To what extent…'), and require analysis of the writer's choices rather than plot summary.` +
            (twoPart ? " Combine close analysis of a key moment with the whole text in the same question." : ""),
          { marking: "levels", extract: false },
        ),
      ]),
    ),
    [
      `Write exactly two questions, worth ${marks} marks each. Each is an extended essay.`,
      "Do not write short-answer, recall, comprehension, multiple-choice, true/false or one-mark questions.",
      "Ask about a text or poem from the specification. Never invent a text, poem, character or scene.",
      "Each model answer must be a full essay with an introduction, developed paragraphs and a conclusion.",
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
    { durationMinutes: 105, pageCount: 8 },
  );
  return { ...blueprint, summary: `2 essays · ${marks} marks each` };
}

/** AQA 8700/1 and 8700/2 have a reading section and a writing section. */
function englishLanguage(course: BlueprintCourse, paper?: string): PaperBlueprint {
  const number = paperNumber(paper);
  const paper1 = number === 1;
  const reading = paper1 ? [4, 8, 8, 20] : [4, 8, 12, 16];
  const insert = paper1
    ? "Source A — provided as a separate insert"
    : "Sources A and B — provided as a separate insert";
  const readingSlots = [
    q(reading[0]!, "List", "Ask students to list four things they learn from the source. One mark per correct point.", { insert }),
    q(reading[1]!, "Analyse", "Ask students to analyse how the writer uses language to describe a place, person or experience. Require quotations and analysis of word choices.", { marking: "levels", insert }),
    q(reading[2]!, "Analyse", "Ask students to analyse how the writer uses structure to interest the reader. Require analysis of the whole source, not just one paragraph.", { marking: "levels", insert }),
    q(reading[3]!, "Evaluate", "Ask students to evaluate a statement about the source, supporting a judgement with quotations and analysis.", { marking: "levels", insert }),
  ];
  const writing = q(
    40,
    "Write",
    paper1
      ? "Set one descriptive or narrative writing task based on a picture or scenario. State the audience, purpose and form."
      : "Set one transactional writing task (article, letter, speech or essay) on a stated issue. State the audience, purpose and form.",
    { marking: "levels" },
  );

  const blueprint = makeBlueprint(
    paper1 ? "english-language-aqa-p1" : "english-language-aqa-p2",
    paper1
      ? "AQA 8700/1: four reading questions on a fiction source (4, 8, 8, 20), then a 40-mark writing task."
      : "AQA 8700/2: four reading questions on two non-fiction sources (4, 8, 12, 16), then a 40-mark writing task.",
    [
      section(
        "Section A — Reading",
        `${insert}. Answer all four questions. You are advised to spend 15 minutes reading the source before you start.`,
        readingSlots,
        40,
      ),
      section(
        "Section B — Writing",
        "Answer the writing task. It is worth 24 marks for content and organisation and 16 marks for technical accuracy.",
        [writing],
        40,
      ),
    ],
    [
      "Write exactly five questions: four reading questions and one writing task.",
      "Section A is worth 40 marks and Section B is worth 40 marks; the total is 80.",
      paper1
        ? "Use the source as a separate insert labelled Source A. Do not print the source inside the question list."
        : "Use two non-fiction sources as a separate insert labelled Sources A and B. Do not print them inside the question list.",
      "The writing task must state audience, purpose and form. Mark content and organisation out of 24 and technical accuracy out of 16.",
      "The model answer for the writing task must be a complete piece, not a plan.",
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
    {
      durationMinutes: 105,
      expectedRatio: 0.76,
      componentCode: paper1 ? "8700/1" : "8700/2",
      questionCount: 5,
      partCount: 5,
      pageCount: 24,
      aoSplit: { reading: 40, writing: 40, AO5: 24, AO6: 16 },
      coverNotes: [
        "Section A: 40 marks. Section B: 40 marks.",
        "You are advised to spend 15 minutes reading the source material before you start.",
      ],
    },
  );
  return { ...blueprint, summary: `5 questions · ${paper1 ? "4, 8, 8, 20 and 40" : "4, 8, 12, 16 and 40"} marks` };
}

// ---------------------------------------------------------------------------
// Sciences, maths and computing
// ---------------------------------------------------------------------------

function sciencePart(marks: number): PaperPart {
  const command =
    marks >= 6 ? "Explain" : marks >= 5 ? "Analyse" : marks >= 3 ? "Explain" : marks >= 2 ? "Give" : "State";
  const ask =
    marks >= 6
      ? "Ask an extended explanation that links several scientific ideas or practical evidence."
      : marks >= 5
        ? "Ask the student to analyse data or a practical method and draw a supported conclusion."
        : marks >= 3
          ? "Ask the student to explain a process, cause or relationship in sequenced steps."
          : marks >= 2
            ? "Ask for two precise facts, examples or readings."
            : "Ask for one precise fact, term, unit or definition.";
  return {
    marks,
    command,
    ask,
    marking: marks >= 6 ? "levels" : "points",
  };
}

function aqaScienceQuestions(partTotals: number[][]): PaperSlot[] {
  return partTotals.map((parts, questionIndex) => {
    const number = questionIndex + 1;
    return question(
      `0 ${number}`,
      parts.map((marks, partIndex) =>
        p(
          `0 ${number} . ${partIndex + 1}`,
          marks,
          sciencePart(marks).command,
          sciencePart(marks).ask,
          { marking: sciencePart(marks).marking },
        ),
      ),
    );
  });
}

const AQA_BIOLOGY_PARTS = [
  [1, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 3, 3],
  [1, 1, 2, 2, 1, 1],
  [1, 2, 2, 3, 3, 5],
  [1, 2, 2, 2, 3, 6],
  [1, 1, 1, 2, 2, 2],
  [1, 2, 2, 2, 4, 6],
  [1, 1, 1, 2, 2, 2],
];

const AQA_TRILOGY_PARTS = [
  [2, 2, 2, 3, 3],
  [1, 2, 2, 3, 4],
  [2, 2, 2, 3, 3],
  [1, 2, 2, 3, 4],
  [2, 3, 3, 3],
  [2, 2, 3, 4],
];

function scienceCode(course: BlueprintCourse, paper?: string): string | undefined {
  if (boardFamily(course.examBoard) !== "aqa" || !isGcse(course.level)) return undefined;
  const subject = course.subject.toLowerCase();
  const base = /biology/.test(subject)
    ? "8461"
    : /chemistry/.test(subject)
      ? "8462"
      : /physics/.test(subject)
        ? "8463"
        : undefined;
  return base ? `${base}/${paperNumber(paper)}${tierCode(course)}` : undefined;
}

function gcseScience(
  course: BlueprintCourse,
  partTotals: number[][],
  options: {
    id: string;
    description: string;
    marks: number;
    minutes: number;
    ratio: number;
    componentCode?: string;
    questionCount: number;
    partCount: number;
    combined: boolean;
  },
): PaperBlueprint {
  const slots = aqaScienceQuestions(partTotals);
  return makeBlueprint(
    options.id,
    options.description,
    [
      section(
        "",
        "Answer all questions. Show your working where a calculation is needed.",
        slots,
      ),
    ],
    [
      `Write exactly ${options.partCount} parts across ${options.questionCount} numbered questions. The paper has no lettered sections.`,
      "Print AQA science numbering for every part: 0 1 . 1, 0 1 . 2, then 0 2 . 1.",
      "Include at least one calculation or data-analysis part with a numerical answer and a unit.",
      "Use accurate scientific vocabulary, equations and units from the specification.",
      "Six-mark parts use level descriptors; shorter parts use one bullet per mark.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
    {
      durationMinutes: options.minutes,
      totalMarks: options.marks,
      expectedRatio: options.ratio,
      componentCode: options.componentCode,
      questionCount: options.questionCount,
      partCount: options.partCount,
      pageCount: Math.max(20, Math.ceil(options.marks / 3)),
      ...(options.combined
        ? { coverNotes: ["Combined Science: Trilogy Biology paper."] }
        : {}),
    },
  );
}

function science(course: BlueprintCourse, paper?: string): PaperBlueprint {
  if (isAdvanced(course.level)) {
    const slots = [6, 8, 8, 10, 10, 10, 12, 12, 14].map((marks, index) =>
      q(
        marks,
        index < 3 ? "Explain" : index < 6 ? "Analyse" : "Evaluate",
        index < 3
          ? "Ask a structured explanation of a scientific process."
          : index < 6
            ? "Ask the student to analyse data, a graph or an experiment."
            : "Ask an extended evaluation question requiring a justified judgement.",
        index >= 3 ? { marking: "levels" } : {},
      ),
    );
    return makeBlueprint(
      "science-advanced",
      "A-level science format: structured explanations, data analysis and extended evaluation.",
      [section("", "Answer all questions. Show your working.", slots)],
      [
        "Write exactly nine questions with the marks shown.",
        "Include at least one calculation and one data-analysis question.",
        "Extended responses use level descriptors with mark ranges.",
        POINT_RULE,
        LEVEL_RULE,
        "Do not write a mark notation, answer lines or a cover page; the app adds those.",
      ],
      { durationMinutes: 120, pageCount: 20 },
    );
  }

  if (/combined science|trilogy|synergy/i.test(course.subject)) {
    return gcseScience(course, AQA_TRILOGY_PARTS, {
      id: "science-combined",
      description: "AQA GCSE Combined Science: 70 marks in 75 minutes, six questions and 28 parts.",
      marks: 70,
      minutes: 75,
      ratio: 0.93,
      componentCode:
        boardFamily(course.examBoard) === "aqa"
          ? `8464/B/1${tierCode(course)}`
          : undefined,
      questionCount: 6,
      partCount: 28,
      combined: true,
    });
  }

  return gcseScience(course, AQA_BIOLOGY_PARTS, {
    id: "science-gcse",
    description: "AQA GCSE science: 100 marks in 105 minutes, eight questions and 48 parts.",
    marks: 100,
    minutes: 105,
    ratio: 0.95,
    componentCode: scienceCode(course, paper),
    questionCount: 8,
    partCount: 48,
    combined: false,
  });
}

function maths(course: BlueprintCourse, paper?: string): PaperBlueprint {
  if (isAdvanced(course.level)) {
    const marks = [4, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 8, 9, 12];
    const slots = marks.map((value, index) =>
      q(
        value,
        index < 4 ? "Solve" : index < 10 ? "Solve" : "Prove",
        index < 4
          ? "Ask a short multi-step problem; require full working."
          : index < 10
            ? "Ask a problem combining two topics; require full working."
            : "Ask a proof or extended modelling problem; require a complete argument.",
        index >= 10 ? { marking: "levels" } : {},
      ),
    );
    return makeBlueprint(
      "maths-advanced",
      "A-level maths format: 100 marks of multi-step problems and proofs in 120 minutes.",
      [section("", "Answer all questions. Show your working.", slots)],
      [
        "Write exactly fourteen questions with the marks shown.",
        "Every question must require mathematical working, not a recalled fact.",
        "Mark with method (M1), accuracy (A1) and final answer marks.",
        "Do not write a mark notation, answer lines or a cover page; the app adds those.",
      ],
      { durationMinutes: 120, expectedRatio: 0.83, pageCount: 24 },
    );
  }

  // AQA 8300/1H has roughly 29 questions and 80 marks in 90 minutes.
  const tariffs = [
    1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4,
    4, 4, 4, 5, 5,
  ];
  const slots = tariffs.map((marks) =>
    q(
      marks,
      marks >= 4 ? "Solve" : marks >= 2 ? "Calculate" : "Write down",
      marks >= 4
        ? "Ask a multi-step problem; require full working."
        : marks >= 2
          ? "Ask a short calculation or problem; require working."
          : "Ask a one-step calculation or a short answer.",
    ),
  );
  const number = paperNumber(paper);
  const calculator = number !== 1;
  const component =
    boardFamily(course.examBoard) === "aqa"
      ? `8300/${number}${tierCode(course)}`
      : undefined;
  return makeBlueprint(
    "maths-gcse",
    "AQA GCSE Maths 8300/1: 80 marks in 90 minutes, about 29 questions and no lettered sections.",
    [section("", "Answer all questions. Show your working.", slots)],
    [
      `Write exactly ${slots.length} questions with the marks shown. There must be no essays.`,
      "Every question must require mathematical working, not a recalled fact.",
      "The marking guide must name method marks (M1), accuracy marks (A1) and the final answer mark.",
      calculator
        ? "Calculators may be used."
        : "This is the non-calculator paper; do not require a calculator.",
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
    {
      durationMinutes: 90,
      expectedRatio: 0.89,
      componentCode: component,
      questionCount: slots.length,
      partCount: slots.length,
      pageCount: 24,
    },
  );
}

function computerScience(): PaperBlueprint {
  const marks = [2, 3, 4, 4, 6, 6, 8, 8, 9, 10, 10, 20];
  const slots = marks.map((value, index) =>
    q(
      value,
      index < 5 ? "Explain" : index < 8 ? "Analyse" : "Evaluate",
      index < 5
        ? "Ask a question about a concept, algorithm or the effect of a piece of code."
        : index < 8
          ? "Ask the student to analyse a scenario, algorithm or data set."
          : "Ask an extended question about a computing approach, with a justified recommendation.",
      index >= 8 ? { marking: "levels" } : {},
    ),
  );
  return makeBlueprint(
    "computer-science",
    "Computer Science format: short answers, code and extended evaluation in 90 minutes.",
    [section("", "Answer all questions.", slots)],
    [
      `Write exactly ${slots.length} questions with the marks shown. There must be no essays.`,
      "Include at least one question that requires reading, writing or correcting a short program.",
      "Use accurate technical vocabulary from the specification.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
    { durationMinutes: 90, pageCount: 16 },
  );
}

// ---------------------------------------------------------------------------
// Humanities
// ---------------------------------------------------------------------------

function edexcelHistory(): PaperBlueprint {
  return makeBlueprint(
    "history-edexcel-p1",
    "Edexcel 1HI0/1: 52 marks in 80 minutes, two sections and a Q5-or-Q6 choice.",
    [
      section(
        "Section A — Thematic study and historic environment",
        "Answer Question 1 and Question 2. A separate Sources Booklet is provided.",
        [
          question("1", [
            p("1 (a)", 2, "Describe", "Ask students to describe two features of a specified period or theme."),
            p("1 (b)", 2, "Describe", "Ask students to describe two features of a specified event or development."),
          ]),
          question("2", [
            p("2 (a)", 8, "Explain", "Ask students to explain why a development happened, using two developed reasons."),
            p("2 (b)", 4, "Explain", "Ask students to explain the importance of a specified event or development."),
          ]),
        ],
        16,
      ),
      section(
        "Section B — Period study",
        "Answer Question 3, Question 4 and EITHER Question 5 OR Question 6. A separate Sources Booklet is provided.",
        [
          q(4, "Explain", "Ask students to explain one consequence of a specified event."),
          q(12, "Explain", "Ask an essay question about change, continuity, cause or consequence. Require a line of argument supported by specific historical detail.", { marking: "levels" }),
          q(16, "Evaluate", "Give an interpretation or statement and ask how far students agree. Require both sides and a justified conclusion.", { marking: "levels", spag: true }),
          q(16, "Evaluate", "Give a second interpretation or statement and ask how far students agree. Require both sides and a justified conclusion.", { marking: "levels", spag: true }),
        ],
        32,
      ),
    ],
    [
      "Write exactly six items: Q1 (a and b), Q2 (a and b), Q3, Q4, and Q5 or Q6.",
      "Section A is worth 16 marks; Section B is worth 36 marks including 4 SPaG marks.",
      "Offer a real choice between Q5 and Q6, both worth 16 marks plus the SPaG assessment.",
      "The Sources Booklet is a separate document; refer to it, but do not invent an inline Source A.",
      "Use specific dates, events, people and terms from the specification.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
    {
      spagMarks: 4,
      durationMinutes: 80,
      expectedRatio: 0.65,
      componentCode: "1HI0/1",
      questionCount: 6,
      partCount: 8,
      pageCount: 12,
      coverNotes: ["A separate Sources Booklet is required."],
    },
  );
}

function aqaHistory(): PaperBlueprint {
  return makeBlueprint(
    "history-aqa",
    "AQA 8145/1: 84 marks in 105 minutes, source work and extended essays.",
    [
      section("Section A — Source analysis", "Answer all questions in this section.", [
        q(4, "Analyse", "Ask what a short original source shows about a historical situation."),
        q(4, "Analyse", "Ask how useful a short original source is for an enquiry."),
        q(8, "Explain", "Ask students to explain why an event happened, using two developed reasons."),
      ], 16),
      section("Section B — Depth study", "Answer all questions in this section.", [
        q(8, "Explain", "Ask students to explain the significance of an event or development."),
        q(12, "Explain", "Ask an essay question about change, continuity, cause or consequence.", { marking: "levels" }),
        q(12, "Evaluate", "Give an interpretation and ask how far students agree.", { marking: "levels" }),
        q(16, "Evaluate", "Give a statement and ask how far students agree, requiring both sides and a conclusion.", { marking: "levels" }),
        q(20, "Evaluate", "Ask an extended judgement question on a second topic.", { marking: "levels" }),
      ], 68),
    ],
    [
      "Write exactly eight questions across two sections.",
      "Section A is source analysis; Section B is the depth study.",
      "Use specific dates, events, people and terms from the specification.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
    { durationMinutes: 105, componentCode: "8145/1", questionCount: 8, partCount: 8, pageCount: 16 },
  );
}

function ocrHistory(): PaperBlueprint {
  return makeBlueprint(
    "history-ocr",
    "OCR History: 80 marks in 105 minutes, source analysis and extended essays.",
    [
      section("Section A — Source analysis", "Answer all questions.", [
        q(4, "Analyse", "Ask what a short original source shows about a historical situation."),
        q(4, "Analyse", "Ask how useful a short original source is for an enquiry."),
        q(8, "Explain", "Ask students to explain why an event happened, using two developed reasons."),
        q(8, "Explain", "Ask students to explain the significance of an event or development."),
      ], 24),
      section("Section B — Essays", "Answer all questions.", [
        q(12, "Explain", "Ask an essay question about change, continuity, cause or consequence.", { marking: "levels" }),
        q(12, "Evaluate", "Give an interpretation and ask how far students agree.", { marking: "levels" }),
        q(16, "Evaluate", "Give a statement and ask how far students agree, requiring both sides and a conclusion.", { marking: "levels" }),
        q(16, "Evaluate", "Ask an extended judgement question on a second topic.", { marking: "levels" }),
      ], 56),
    ],
    [
      "Write exactly eight questions across two sections.",
      "Use source analysis in Section A and extended essays in Section B.",
      "Use specific dates, events, people and terms from the specification.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
    { durationMinutes: 105, questionCount: 8, partCount: 8, pageCount: 16 },
  );
}

function history(course: BlueprintCourse): PaperBlueprint {
  switch (boardFamily(course.examBoard)) {
    case "edexcel":
      return edexcelHistory();
    case "ocr":
      return ocrHistory();
    default:
      return aqaHistory();
  }
}

function geography(): PaperBlueprint {
  const marks = [4, 4, 6, 6, 8, 8, 9, 9, 9, 9, 16];
  const slots = marks.map((value) =>
    q(
      value,
      value >= 9 ? "Evaluate" : value >= 6 ? "Analyse" : "Explain",
      value >= 9
        ? "Ask an extended question that needs a justified decision or judgement, using a case study."
        : value >= 6
          ? "Ask the student to analyse data, a map, a graph or a photograph."
          : "Ask the student to explain geographical processes or impacts.",
      value >= 9 ? { marking: "levels" } : {},
    ),
  );
  return makeBlueprint(
    "geography",
    "Geography format: 88 marks in 90 minutes, with data response and extended judgements.",
    [section("", "Answer all questions.", slots)],
    [
      `Write exactly ${slots.length} questions with the marks shown.`,
      "Include at least one question that asks the student to interpret data, a map, a graph or a photograph.",
      "Named case studies must come from the specification; do not invent a case study.",
      "The 9-mark and 16-mark questions require a justified conclusion.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
    { durationMinutes: 90, questionCount: 11, partCount: 11, pageCount: 16 },
  );
}

function language(course: BlueprintCourse): PaperBlueprint {
  const marks = [4, 6, 8, 10, 12, 12, 14, 14];
  const slots = marks.map((value, index) =>
    q(
      value,
      index < 2 ? "Translate" : index < 4 ? "Describe" : "Write",
      index < 2
        ? "Ask the student to translate short phrases into the target language."
        : index < 4
          ? "Ask the student to describe a picture or short scenario in the target language."
          : "Ask the student to write in the target language with a clear purpose and audience.",
      index >= 5 ? { marking: "levels" } : {},
    ),
  );
  return makeBlueprint(
    "language",
    "Languages format: translation, short writing and extended writing in 90 minutes.",
    [section("", "Answer all questions.", slots)],
    [
      `Write exactly ${slots.length} questions with the marks shown for ${course.subject}.`,
      "Write the question rubrics in English, but require answers in the target language.",
      "Use vocabulary and grammar from the specification.",
      "Mark short answers point by point and extended writing with level descriptors.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
    { durationMinutes: 90, pageCount: 12 },
  );
}

/**
 * These subjects are not one paper. The brief gives their real range as 80-100
 * marks; each subject below has its own sequence rather than one scaled
 * template. Board-specific component codes remain unset until a verified code
 * is available, so the cover does not print an invented one.
 */
const HUMANITIES_MARKS: Record<string, number[]> = {
  business: [2, 2, 4, 4, 6, 6, 8, 12, 16, 20],
  "business studies": [2, 2, 4, 4, 6, 6, 8, 12, 16, 20],
  economics: [2, 4, 4, 6, 6, 8, 10, 12, 14, 14],
  psychology: [2, 4, 6, 6, 8, 10, 12, 14, 18, 20],
  sociology: [4, 4, 6, 8, 8, 10, 12, 14, 16, 18],
  politics: [2, 4, 4, 6, 8, 10, 10, 12, 12, 12],
  law: [4, 4, 6, 6, 8, 10, 12, 15, 15, 20],
  philosophy: [4, 6, 6, 8, 10, 12, 12, 14, 14, 14],
  accounting: [2, 2, 4, 6, 6, 8, 12, 16, 24],
  "health and social": [2, 4, 4, 6, 8, 8, 12, 16, 20],
  "health and social care": [2, 4, 4, 6, 8, 8, 12, 16, 20],
};

function humanities(course: BlueprintCourse): PaperBlueprint {
  const key = course.subject.trim().toLowerCase();
  const marks = HUMANITIES_MARKS[key] ?? [2, 4, 6, 8, 10, 12, 18, 20];
  const total = marks.reduce((sum, value) => sum + value, 0);
  const slots = marks.map((value, index) =>
    q(
      value,
      index < 2 ? "State" : index < 4 ? "Explain" : index < 6 ? "Analyse" : "Evaluate",
      index < 2
        ? "Ask for precise facts, terms or definitions."
        : index < 4
          ? "Ask the student to explain two ideas, each with a reason."
          : index < 6
            ? "Ask the student to analyse a short scenario, case or argument."
            : "Ask an extended evaluation question that needs a justified judgement.",
      index >= 4 ? { marking: "levels" } : {},
    ),
  );
  return makeBlueprint(
    "humanities",
    `Humanities format: ${total} marks in 105 minutes, short answers plus extended evaluation.`,
    [section("", "Answer all questions.", slots)],
    [
      `Write exactly ${slots.length} questions with the marks shown for ${course.subject}.`,
      "Use examples, theories and terminology from the specification.",
      "The 8-mark and longer questions must be levels-marked and require developed reasoning.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
    { durationMinutes: 105, pageCount: 12 },
  );
}

function generic(): PaperBlueprint {
  const marks = [2, 4, 4, 6, 8, 10, 12, 14];
  const slots = marks.map((value, index) =>
    q(
      value,
      index < 2 ? "Define" : index < 4 ? "Explain" : index < 6 ? "Analyse" : "Evaluate",
      index < 2
        ? "Ask for a precise definition or two key facts."
        : index < 4
          ? "Ask the student to explain two ideas, each with a reason."
          : "Ask a question that needs developed reasoning and a justified conclusion.",
      index >= 4 ? { marking: "levels" } : {},
    ),
  );
  return makeBlueprint(
    "generic",
    "Short answers followed by extended evaluation questions.",
    [section("", "Answer all questions.", slots)],
    [
      `Write exactly ${slots.length} questions with the marks shown.`,
      "The longer questions must be levels-marked and require developed reasoning.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
    { durationMinutes: 60, pageCount: 8 },
  );
}

function ks3(): PaperBlueprint {
  const marks = [1, 1, 2, 2, 3, 4, 6, 7, 10, 14];
  const slots = marks.map((value, index) =>
    q(
      value,
      index < 2 ? "State" : index < 5 ? "Describe" : "Explain",
      index < 2
        ? "Ask for one precise fact, term or definition."
        : index < 5
          ? "Ask the student to describe features or give examples."
          : "Ask an explanation or a 'How far…' question that needs a justified judgement.",
      index >= 7 ? { marking: "levels" } : {},
    ),
  );
  return makeBlueprint(
    "ks3",
    "Key Stage 3 format: 50 marks in 60 minutes, school-style short answers and extended questions.",
    [section("", "Answer all questions.", slots)],
    [
      `Write exactly ${slots.length} questions with the marks shown.`,
      "Keep the language appropriate for key stage 3 and use only content from the specification.",
      "There is no exam board branding on a KS3 paper.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
    { durationMinutes: 60, pageCount: 8 },
  );
}

// ---------------------------------------------------------------------------
// Choosing a blueprint
// ---------------------------------------------------------------------------

/**
 * The paper format this course uses. Subject comes first, because that is what
 * changes the questions most; the board then decides the exact mark sequence.
 */
export function buildPaperBlueprint(
  course: BlueprintCourse,
  paper?: string,
): PaperBlueprint {
  const subject = course.subject.trim().toLowerCase();
  const level = course.level.trim();

  // These are NEA/portfolio qualifications, not timed written papers.
  if (/art & design|art and design|photography|theory of knowledge/.test(subject)) {
    return notAWrittenPaper(course);
  }
  if (/^ks3$/i.test(level)) return ks3();
  if (isAp(level)) return apPaper();

  if (/religious studies|religious education|\brs\b|philosophy and ethics/.test(subject)) {
    return religiousStudies(course, paper);
  }
  if (/english literature|literature/.test(subject)) {
    return englishLiterature(course);
  }
  if (/english language|english\b/.test(subject)) {
    return englishLanguage(course, paper);
  }
  if (/mathematics|maths|math\b|statistics|further maths/.test(subject)) {
    return maths(course, paper);
  }
  // Computer Science must be tested before the science family.
  if (/computer science|information technology|computing|ict/.test(subject)) {
    return computerScience();
  }
  if (/biology|chemistry|physics|combined science|science|environmental/.test(subject)) {
    return science(course, paper);
  }
  if (/history/.test(subject)) return history(course);
  if (/geography/.test(subject)) return geography();
  if (/french|spanish|german|mandarin|latin|italian|japanese|russian|arabic|language/.test(subject)) {
    return language(course);
  }
  if (/business|economic|psychology|sociology|politics|law|philosophy|health and social|accounting/.test(subject)) {
    return humanities(course);
  }
  return generic();
}

/** One line for the course page, e.g. "8 questions · 1, 2, 3, 4 and 6 marks". */
export function paperFormatSummary(course: BlueprintCourse): string {
  return buildPaperBlueprint(course).summary;
}
