import { boardFamily } from "./paperFormat";

/**
 * The question structure of a real paper, per subject.
 *
 * A paper is not a generic list of questions: Religious Studies is built from
 * 3, 4, 5 and 12-mark parts, English Literature is one long essay, and a maths
 * paper has no essays at all. The board's cover rubric in `paperFormat.ts`
 * describes how a paper looks; this module describes what is actually in it.
 *
 * The generation prompt is built from these slots, so the model cannot fall
 * back on a generic short-answer paper. The same blueprint also supplies the
 * summary shown on the course page, so the student knows the format before
 * building a paper.
 */

export type PaperMarking = "points" | "levels";

export type PaperSlot = {
  /** The marks printed for this question. */
  marks: number;
  /** The command word the question opens with. */
  command: string;
  /** Part letter for a question split into (a), (b), (c)… */
  part?: string;
  /** What the question must ask the student to do. */
  ask: string;
  /**
   * Point-marked questions have one bullet per mark. Levels-marked questions
   * have a descriptor for each level, which is how long answers are marked.
   */
  marking: PaperMarking;
};

export type PaperSection = {
  title: string;
  instruction: string;
  slots: PaperSlot[];
};

export type PaperBlueprint = {
  id: string;
  /** "8 questions · 3, 4, 5 and 12 marks" */
  summary: string;
  /** One sentence for the course page. */
  description: string;
  sections: PaperSection[];
  totalMarks: number;
  questionCount: number;
  /** Rules appended to the generation prompt. */
  rules: string[];
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
};

/** One flattened question, exactly as it will be stored and displayed. */
export type FlatPaperSlot = {
  label: string;
  section: string;
  sectionInstruction: string;
  marks: number;
  command: string;
  ask: string;
  marking: PaperMarking;
};

const POINT_RULE =
  "For every point-marked question, the marking guide must have one bullet per mark, written as '1 mark: …', and the bullets must add up to the marks available.";
const LEVEL_RULE =
  "For every levels-marked question, the marking guide must have one descriptor per level, from the lowest to the highest, with the level's mark range printed at the start (for example 'Level 4 (10-12 marks): …').";

function q(
  marks: number,
  command: string,
  ask: string,
  options: { part?: string; marking?: PaperMarking } = {},
): PaperSlot {
  return {
    marks,
    command,
    ask,
    marking: options.marking ?? "points",
    ...(options.part ? { part: options.part } : {}),
  };
}

function section(
  title: string,
  instruction: string,
  slots: PaperSlot[],
): PaperSection {
  return { title, instruction, slots };
}

/** "1 mark", "3 marks". */
function markLabel(marks: number): string {
  return `${marks} mark${marks === 1 ? "" : "s"}`;
}

/** "3, 4, 5 and 12 marks". */
function marksList(marks: number[]): string {
  const unique = [...new Set(marks)].sort((a, b) => a - b);
  if (unique.length === 1) return markLabel(unique[0]!);
  const last = unique.pop()!;
  return `${unique.join(", ")} and ${last} marks`;
}

function makeBlueprint(
  id: string,
  description: string,
  sections: PaperSection[],
  rules: string[],
): PaperBlueprint {
  const slots = sections.flatMap((item) => item.slots);
  const totalMarks = slots.reduce((sum, slot) => sum + slot.marks, 0);
  const questionCount = slots.length;
  return {
    id,
    description,
    sections,
    totalMarks,
    questionCount,
    summary: `${questionCount} question${questionCount === 1 ? "" : "s"} · ${marksList(slots.map((slot) => slot.marks))}`,
    rules,
  };
}

/**
 * Numbers a blueprint the way the board prints it. A question with parts keeps
 * its part letter ("1 (a)"); a paper without parts runs 1, 2, 3… across its
 * sections.
 */
export function flattenPaperBlueprint(
  blueprint: PaperBlueprint,
): FlatPaperSlot[] {
  const flat: FlatPaperSlot[] = [];
  let questionNumber = 0;
  blueprint.sections.forEach((item, sectionIndex) => {
    for (const slot of item.slots) {
      let label: string;
      if (slot.part) {
        label = `${sectionIndex + 1} (${slot.part})`;
      } else {
        questionNumber += 1;
        label = String(questionNumber);
      }
      flat.push({
        label,
        section: item.title,
        sectionInstruction: item.instruction,
        marks: slot.marks,
        command: slot.command,
        ask: slot.ask,
        marking: slot.marking,
      });
    }
  });
  return flat;
}

function isAdvanced(level: string): boolean {
  return /^(a-level|ib|undergraduate)$/i.test(level.trim());
}

/** "Christianity and Judaism", or a neutral label when the course has none. */
function religionsLabel(course: BlueprintCourse): string {
  const list = religionPair(course);
  return list.length > 0 ? list.join(" and ") : "the religions you study";
}

/** The religions a GCSE RS course studies, in the order the student chose them. */
function religionPair(course: BlueprintCourse): string[] {
  return [course.rsReligion, course.rsReligion2]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

// ---------------------------------------------------------------------------
// Religious Studies
// ---------------------------------------------------------------------------

/**
 * One Edexcel RS question group: 3, 4, 5 and 12 marks, printed as 1 (a) to
 * 1 (d). A real paper repeats this group for each religion, so the blueprint
 * does too instead of mashing both religions into one four-question paper.
 */
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

/**
 * Edexcel: 1 (a) 3, 1 (b) 4, 1 (c) 5, 1 (d) 12 — once per religion. Route A
 * examines both religions through the Study of Religion, while Route B examines
 * one Area of Study through both religions.
 */
function edexcelRs(course: BlueprintCourse): PaperBlueprint {
  const routeB = /studies b|route b/i.test(course.rsRoute ?? "");
  const religions = religionPair(course);
  const list = religions.length > 0 ? religions : ["the religion you study"];
  const area = course.rsSpec?.trim();
  const sectionTitle = (religion: string, index: number) =>
    routeB
      ? `Section ${index + 1} — ${area ?? "Area of Study"} · ${religion}`
      : `Section ${index + 1} — Study of Religion · ${religion}`;

  const sections = list.map((religion, index) =>
    section(
      sectionTitle(religion, index),
      "Answer all questions. Answer in full sentences.",
      edexcelRsGroup(),
    ),
  );
  const groups = list.map((_, index) => `${index + 1} (a) to ${index + 1} (d)`);

  return makeBlueprint(
    routeB ? "rs-edexcel-b" : "rs-edexcel-a",
    routeB
      ? "Edexcel Route B format: 3, 4, 5 and 12-mark questions for each religion in one Area of Study."
      : "Edexcel Route A format: 3, 4, 5 and 12-mark questions for each religion.",
    sections,
    [
      `Write exactly ${sections.length * 4} questions, numbered ${groups.join(" and ")}.`,
      "Every group of four questions must be worth exactly 3, 4, 5 and 12 marks. Never change those marks.",
      routeB
        ? `Both sections examine ${area ?? "the same Area of Study"}: Section 1 through ${list[0]} and Section 2 through ${list[1] ?? "the second religion"}.`
        : `Section 1 is on ${list[0]}${list[1] ? ` and Section 2 is on ${list[1]}` : ""}. Keep each question to one religion, and do not invent a religion.`,
      "Each 12-mark question must be a statement to evaluate, not an explain question. It must ask for a justified conclusion and must refer to non-religious beliefs.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
  );
}

/**
 * One AQA RS question group. AQA's papers run 1, 1, 4, 6 and 12 marks from
 * summer 2026 (before that the second and fourth parts were worth 2 and 5).
 */
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
      { part: "e", marking: "levels" },
    ),
  ];
}

/** AQA: 1, 1, 4, 6 and 12 marks for each religion on the course. */
function aqaRs(course: BlueprintCourse): PaperBlueprint {
  const religions = religionPair(course);
  const list = religions.length > 0 ? religions : ["the religion you study"];
  const sections = list.map((religion, index) =>
    section(
      `Section ${index === 0 ? "A" : "B"} — ${religion}`,
      "Answer all questions. Answer in full sentences.",
      aqaRsGroup(),
    ),
  );
  const groups = list.map((_, index) => `${index + 1} (a) to ${index + 1} (e)`);

  return makeBlueprint(
    "rs-aqa",
    "AQA format: 1, 1, 4, 6 and 12-mark questions for each religion, ending with a 12-mark evaluation.",
    sections,
    [
      `Write exactly ${sections.length * 5} questions, numbered ${groups.join(" and ")}.`,
      "Every group of five questions must be worth exactly 1, 1, 4, 6 and 12 marks. Never change those marks.",
      `Keep each section to its own religion: ${list.join(" and ")}. Do not invent a religion.`,
      "Each 12-mark question must be a statement to evaluate, not an explain question. It must ask for a justified conclusion and must refer to non-religious beliefs.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
  );
}

/** Eduqas / WJEC: 2, 5, 8 and 15 marks. */
function eduqasRs(course: BlueprintCourse): PaperBlueprint {
  const religions = religionsLabel(course);
  return makeBlueprint(
    "rs-eduqas",
    "Eduqas format: 2, 5, 8 and 15-mark questions, ending with a 15-mark evaluation.",
    [
      section(
        `Section A — ${religions}`,
        "Answer all questions. Answer in full sentences.",
        [
          q(
            2,
            "Give",
            "Ask the student to give two beliefs, practices or examples. One mark for each.",
            { part: "a" },
          ),
          q(
            5,
            "Explain",
            "Ask the student to explain two beliefs or practices, giving a reason or example for each.",
            { part: "b" },
          ),
          q(
            8,
            "Explain",
            "Ask the student to explain how a belief or practice is shown in a source of authority, or to compare two views.",
            { part: "c", marking: "levels" },
          ),
          q(
            15,
            "Evaluate",
            "Give a statement students can agree or disagree with and ask them to evaluate it, reaching a justified conclusion and referring to non-religious beliefs.",
            { part: "d", marking: "levels" },
          ),
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
  );
}

/** OCR: 3, 6 and 15 marks. */
function ocrRs(course: BlueprintCourse): PaperBlueprint {
  const religions = religionsLabel(course);
  return makeBlueprint(
    "rs-ocr",
    "OCR format: 3, 6 and 15-mark questions, ending with a 15-mark discussion.",
    [
      section(
        `Section A — ${religions}`,
        "Answer all questions. Answer in full sentences.",
        [
          q(
            3,
            "Outline",
            "Ask the student to outline three beliefs, practices or teachings from the specification.",
            { part: "a" },
          ),
          q(
            6,
            "Explain",
            "Ask the student to explain two beliefs or practices, referring to a source of authority or a religious teaching.",
            { part: "b" },
          ),
          q(
            15,
            "Discuss",
            "Give a statement students can agree or disagree with and ask them to discuss it, reaching a justified conclusion and referring to non-religious beliefs.",
            { part: "c", marking: "levels" },
          ),
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
  );
}

/** A-level and IB RS: a short explanation followed by a full essay. */
function advancedRs(): PaperBlueprint {
  return makeBlueprint(
    "rs-advanced",
    "A-level format: one 10-mark explanation and one 25-mark essay.",
    [
      section("Section A — Explanation", "Answer all questions.", [
        q(
          10,
          "Explain",
          "Ask the student to explain two or three beliefs or arguments in depth, using technical vocabulary and sources of authority.",
          { marking: "levels" },
        ),
      ]),
      section("Section B — Essay", "Answer the essay question.", [
        q(
          25,
          "Evaluate",
          "Give a statement or claim and ask the student to evaluate it in a sustained essay, considering both sides and reaching a justified conclusion.",
          { marking: "levels" },
        ),
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
  );
}

/** A board not covered above still gets a sensible RS discussion paper. */
function genericRs(course: BlueprintCourse): PaperBlueprint {
  const religions = religionsLabel(course);
  return makeBlueprint(
    "rs-generic",
    "Religious Studies format: 3, 4, 5 and 12-mark questions.",
    [
      section(
        `Section A — ${religions}`,
        "Answer all questions. Answer in full sentences.",
        [
          q(3, "Outline", "Ask the student to outline three beliefs or practices.", {
            part: "a",
          }),
          q(
            4,
            "Explain",
            "Ask the student to explain two beliefs or practices, giving a reason for each.",
            { part: "b" },
          ),
          q(
            5,
            "Explain",
            "Ask the student to explain two beliefs or practices, referring to a source of authority.",
            { part: "c" },
          ),
          q(
            12,
            "Evaluate",
            "Give a statement to evaluate. Require a justified conclusion and reference to non-religious beliefs.",
            { part: "d", marking: "levels" },
          ),
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
  );
}

function religiousStudies(course: BlueprintCourse): PaperBlueprint {
  if (isAdvanced(course.level)) return advancedRs();
  switch (boardFamily(course.examBoard)) {
    case "aqa":
      return aqaRs(course);
    case "edexcel":
      return edexcelRs(course);
    case "wjec":
      return eduqasRs(course);
    case "ocr":
      return ocrRs(course);
    case "cambridge":
    case "ib":
    case "sqa":
    case "ap":
    case "generic":
    default:
      return genericRs(course);
  }
}

// ---------------------------------------------------------------------------
// English
// ---------------------------------------------------------------------------

/**
 * The two essay sections of this board's literature paper. Each section is one
 * long essay on a text the course actually studies, never an extract, unseen
 * text or short-answer question the student has not prepared for.
 */
function essaySections(
  course: BlueprintCourse,
): Array<{ title: string; focus: string }> {
  const family = boardFamily(course.examBoard);
  const poetry = course.poetryTheme?.trim();
  if (isAdvanced(course.level)) {
    return [
      { title: "Section A — Set text", focus: "the set text you have studied" },
      {
        title: poetry ? `Section B — Poetry: ${poetry}` : "Section B — Poetry or second text",
        focus: poetry
          ? `a poem from the ${poetry} anthology`
          : "a poem or second text you have studied",
      },
    ];
  }
  switch (family) {
    case "aqa":
      return [
        {
          title: "Section A — Shakespeare",
          focus: "the Shakespeare play you have studied",
        },
        {
          title: "Section B — 19th-century novel",
          focus: "the 19th-century novel you have studied",
        },
      ];
    case "edexcel":
      return [
        {
          title: "Section A — Shakespeare",
          focus: "the Shakespeare play you have studied",
        },
        {
          title: "Section B — Post-1914 literature",
          focus: "the post-1914 play or novel you have studied",
        },
      ];
    case "ocr":
      return [
        {
          title: "Section A — Modern prose or drama",
          focus: "the modern prose or drama text you have studied",
        },
        {
          title: "Section B — 19th-century prose",
          focus: "the 19th-century prose text you have studied",
        },
      ];
    case "wjec":
      return [
        {
          title: "Section A — Shakespeare",
          focus: "the Shakespeare play you have studied",
        },
        {
          title: poetry ? `Section B — Poetry anthology: ${poetry}` : "Section B — Poetry anthology",
          focus: poetry
            ? `a poem from the ${poetry} anthology`
            : "a poem from the anthology you have studied",
        },
      ];
    default:
      return [
        { title: "Section A — Set text", focus: "the set text you have studied" },
        {
          title: poetry ? `Section B — Poetry: ${poetry}` : "Section B — Poetry",
          focus: poetry
            ? `a poem from the ${poetry} anthology`
            : "a poem you have studied",
        },
      ];
  }
}

/**
 * English Literature is made of long essays, not short answers. AQA's essays
 * are 30 marks (plus 4 for SPaG on the real paper); Edexcel, OCR and Eduqas use
 * 40-mark essays; Cambridge and IB use 25. A practice paper carries one essay
 * for each of the two sections the board's paper examines.
 */
function englishLiterature(course: BlueprintCourse): PaperBlueprint {
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
          `Set one essay question on ${essay.focus}. If the specification names the text or poem, name it; otherwise say 'the text you have studied' and make the question work for any text in that unit. Use the board's essay wording (for example 'Explore how…', 'How does the writer…' or 'To what extent…'). Ask about a character, theme, relationship or the writer's methods, and require analysis of the writer's choices rather than plot summary.` +
            (twoPart
              ? " Combine close analysis of a key moment with the whole text in the same question."
              : ""),
          { marking: "levels" },
        ),
      ]),
    ),
    [
      `Write exactly two questions, worth ${marks} marks each. Each is an extended essay.`,
      "Do not write short-answer, recall, comprehension, multiple-choice, true/false or one-mark questions.",
      "Ask about a text or poem from the specification. Never invent a text, poem, character or scene; use 'the text you have studied' when the specification does not name one.",
      "Each question must ask the student to analyse the writer's methods and support a line of argument with evidence from the whole text.",
      "Do not reproduce an extract or a long quotation. Tell the student to use their own copy of the text.",
      LEVEL_RULE,
      "Each model answer must be a full essay with an introduction, developed paragraphs and a conclusion, not a list of points.",
      ...(family === "aqa" && !advanced
        ? [
            "On the real AQA paper 4 extra marks are awarded for AO4 (SPaG); each practice essay is marked out of 30 for the essay itself.",
          ]
        : []),
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
  );
  // Say "essay", not "question": the format is the point the student needs to
  // see before building.
  return { ...blueprint, summary: `2 essays · ${marks} marks each` };
}

/** English Language is one extended writing task, not a reading quiz. */
function englishLanguage(): PaperBlueprint {
  const blueprint = makeBlueprint(
    "english-language",
    "English Language format: one 40-mark extended writing task.",
    [
      section("Section A — Extended writing", "Answer the question.", [
        q(
          40,
          "Write",
          "Set one extended writing task: a descriptive or narrative piece, or a transactional piece such as an article, letter, speech or review. Give a short scenario and state the audience, purpose and form in the board's style. Do not ask comprehension or short-answer questions.",
          { marking: "levels" },
        ),
      ]),
    ],
    [
      "Write exactly one question, worth 40 marks. It is an extended writing task.",
      "Do not write reading-comprehension, recall, multiple-choice or short-answer questions.",
      "State the audience, purpose and form in the question, as the board does.",
      LEVEL_RULE,
      "The marking guide must cover content and organisation as well as technical accuracy, with mark ranges for each level.",
      "The model answer must be a complete piece of writing, not a plan or a list of points.",
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
  );
  return { ...blueprint, summary: "1 writing task · 40 marks" };
}

// ---------------------------------------------------------------------------
// Sciences, maths and computing
// ---------------------------------------------------------------------------

function science(course: BlueprintCourse): PaperBlueprint {
  const advanced = isAdvanced(course.level);
  const slots = advanced
    ? [
        q(2, "State", "Ask for two precise facts, definitions or units."),
        q(3, "Explain", "Ask the student to explain a process or relationship."),
        q(4, "Calculate", "Ask a calculation question; require working and the correct unit."),
        q(6, "Explain", "Ask an extended explanation question that links two ideas.", {
          marking: "levels",
        }),
        q(8, "Analyse", "Ask the student to analyse data, a graph or an experiment and draw a conclusion.", {
          marking: "levels",
        }),
        q(10, "Evaluate", "Ask an extended evaluation question that needs a justified judgement.", {
          marking: "levels",
        }),
      ]
    : [
        q(1, "State", "Ask for one precise fact, term, unit or definition."),
        q(2, "Give", "Ask the student to give two examples, features or readings."),
        q(3, "Explain", "Ask the student to explain a process, cause or relationship."),
        q(4, "Explain", "Ask the student to explain two ideas, linking cause and effect."),
        q(4, "Calculate", "Ask a calculation question; require working and the correct unit."),
        q(6, "Explain", "Ask an extended explanation question about a process or practical.", {
          marking: "levels",
        }),
        q(6, "Analyse", "Ask the student to analyse data, a graph or a required practical and draw a conclusion.", {
          marking: "levels",
        }),
        q(6, "Evaluate", "Ask an extended evaluation question that needs a justified judgement.", {
          marking: "levels",
        }),
      ];

  return makeBlueprint(
    advanced ? "science-advanced" : "science",
    advanced
      ? "Science format: short calculations, data analysis and extended explanations."
      : "Science format: 1-6 mark questions, including a calculation and 6-mark extended responses.",
    [
      section(
        "Section A — Questions",
        "Answer all questions. Show your working where a calculation is needed.",
        slots,
      ),
    ],
    [
      `Write exactly ${slots.length} questions with the marks shown. The paper must not contain essays.`,
      "Include at least one calculation or data-analysis question with a numerical answer and a unit.",
      "Use accurate scientific vocabulary, equations and units from the specification.",
      "The 6-mark and longer questions must be marked with level descriptors; shorter questions use one bullet per mark.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
  );
}

function maths(course: BlueprintCourse): PaperBlueprint {
  const advanced = isAdvanced(course.level);
  const slots = advanced
    ? [
        q(3, "Solve", "Ask a short problem that needs two or three steps of working."),
        q(4, "Solve", "Ask a multi-step problem; require full working."),
        q(5, "Solve", "Ask a problem involving algebra, calculus or proof; require full working."),
        q(6, "Solve", "Ask a multi-step problem that combines two topics."),
        q(8, "Prove", "Ask a proof or extended problem; require a complete argument.", {
          marking: "levels",
        }),
        q(8, "Solve", "Ask an extended modelling or problem-solving question.", {
          marking: "levels",
        }),
        q(10, "Solve", "Ask a full extended problem that tests several skills.", {
          marking: "levels",
        }),
      ]
    : [
        q(2, "Calculate", "Ask a one-step calculation."),
        q(3, "Calculate", "Ask a short problem that needs two steps of working."),
        q(3, "Solve", "Ask a short algebraic or geometric problem."),
        q(4, "Solve", "Ask a multi-step problem; require working."),
        q(4, "Solve", "Ask a problem involving fractions, ratio or proportion."),
        q(5, "Solve", "Ask a problem that combines two topics; require working."),
        q(5, "Solve", "Ask a geometry or trigonometry problem; require working."),
        q(5, "Solve", "Ask a statistical or probability problem."),
        q(6, "Solve", "Ask an extended problem that needs a chain of reasoning."),
        q(6, "Solve", "Ask a problem-solving question with a written justification."),
      ];

  return makeBlueprint(
    advanced ? "maths-advanced" : "maths",
    advanced
      ? "Maths format: multi-step problems and proofs, with method marks."
      : "Maths format: 2-6 mark calculations and problems, with method marks.",
    [
      section("Section A — Questions", "Answer all questions. Show your working.", slots),
    ],
    [
      `Write exactly ${slots.length} questions with the marks shown. There must be no essays or extended writing questions.`,
      "Every question must require mathematical working, not a recalled fact.",
      "The marking guide must name method marks (M1), accuracy marks (A1) and the final answer mark, as the board does.",
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
  );
}

function computerScience(): PaperBlueprint {
  const slots = [
    q(1, "State", "Ask for one precise fact, term or definition."),
    q(2, "Give", "Ask the student to give two examples or features."),
    q(3, "Explain", "Ask the student to explain a concept or the effect of a piece of code."),
    q(4, "Explain", "Ask the student to explain two ideas, linking cause and effect."),
    q(4, "Describe", "Ask the student to describe an algorithm, process or network in steps."),
    q(6, "Write", "Ask the student to write or complete a short program and explain what it does."),
    q(8, "Analyse", "Ask the student to analyse a scenario, algorithm or data set.", {
      marking: "levels",
    }),
    q(10, "Evaluate", "Ask an extended question about a computing approach, with a justified recommendation.", {
      marking: "levels",
    }),
  ];
  return makeBlueprint(
    "computer-science",
    "Computer Science format: short answers, code and an extended evaluation.",
    [
      section("Section A — Questions", "Answer all questions.", slots),
    ],
    [
      `Write exactly ${slots.length} questions with the marks shown. There must be no essays.`,
      "Include at least one question that requires reading, writing or correcting a short program.",
      "Use accurate technical vocabulary from the specification.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
  );
}

// ---------------------------------------------------------------------------
// Humanities
// ---------------------------------------------------------------------------

function history(course: BlueprintCourse): PaperBlueprint {
  const family = boardFamily(course.examBoard);
  const marks =
    family === "edexcel"
      ? [8, 12, 16, 20]
      : family === "ocr"
        ? [5, 10, 15, 20]
        : [4, 8, 12, 16];
  const [source, explain, essay, extended] = marks as [number, number, number, number];

  return makeBlueprint(
    "history",
    `History format: source analysis, explanation and essays (${marks.join(", ")} marks).`,
    [
      section("Section A — Source analysis", "Answer both questions.", [
        q(
          source,
          "Analyse",
          "Include a short, original historical source (three or four sentences) labelled Source A, then ask what the source shows or how useful it is. Do not copy a real source.",
          { marking: "points" },
        ),
        q(
          explain,
          "Explain",
          "Ask the student to explain why something happened, using two developed reasons. This is an explanation question, not an essay.",
          { marking: "points" },
        ),
      ]),
      section("Section B — Essay", "Answer both questions.", [
        q(
          essay,
          "Explain",
          "Ask an essay question about change, continuity, cause or consequence. Require a line of argument supported by specific historical detail.",
          { marking: "levels" },
        ),
        q(
          extended,
          "Evaluate",
          "Give a statement or interpretation and ask how far the student agrees. Require both sides and a justified conclusion.",
          { marking: "levels" },
        ),
      ]),
    ],
    [
      `Write exactly four questions, worth ${marks.join(", ")} marks.`,
      "The two source questions must include the source text in the question itself. The source must be original, short and labelled Source A; never reproduce a real source or a real exam paper.",
      "Do not write multiple-choice or one-word-answer questions.",
      "Use specific dates, events, people and terms from the specification.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
  );
}

function geography(): PaperBlueprint {
  const slots = [
    q(1, "State", "Ask for one precise fact, term or definition."),
    q(2, "Give", "Ask the student to give two examples or features."),
    q(4, "Explain", "Ask the student to explain two geographical processes or impacts."),
    q(6, "Analyse", "Ask the student to analyse data, a map, a graph or a photograph.", {
      marking: "levels",
    }),
    q(9, "Evaluate", "Ask an extended question that needs a justified decision or judgement, using a case study.", {
      marking: "levels",
    }),
    q(9, "Evaluate", "Ask a second extended question on a different topic, with a justified conclusion.", {
      marking: "levels",
    }),
  ];
  return makeBlueprint(
    "geography",
    "Geography format: 1-9 mark questions, including data analysis and 9-mark evaluations.",
    [
      section("Section A — Questions", "Answer all questions.", slots),
    ],
    [
      `Write exactly ${slots.length} questions with the marks shown.`,
      "Include at least one question that asks the student to interpret data, a map, a graph or a photograph.",
      "Named case studies must come from the specification; do not invent a case study.",
      "The 9-mark questions must be levels-marked and require a justified conclusion.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
  );
}

function language(course: BlueprintCourse): PaperBlueprint {
  const slots = [
    q(2, "Translate", "Ask the student to translate two short phrases into the target language."),
    q(4, "Describe", "Ask the student to describe a picture or a short scenario in the target language."),
    q(6, "Write", "Ask the student to write a short message or paragraph in the target language."),
    q(10, "Write", "Ask the student to write a longer piece in the target language, with a clear purpose and audience.", {
      marking: "levels",
    }),
    q(16, "Write", "Ask for an extended piece of writing in the target language, with a scenario, audience and purpose.", {
      marking: "levels",
    }),
  ];
  return makeBlueprint(
    "language",
    "Languages format: translation, short writing and extended writing in the target language.",
    [
      section("Section A — Questions", "Answer all questions.", slots),
    ],
    [
      `Write exactly ${slots.length} questions with the marks shown for ${course.subject}.`,
      "Write the question rubrics in English, but require answers in the target language where the task is a writing task.",
      "Use vocabulary and grammar from the specification, and give the English meaning of any unfamiliar instruction.",
      "Mark short answers point by point and extended writing with level descriptors covering content, range of language and accuracy.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
  );
}

function humanities(course: BlueprintCourse): PaperBlueprint {
  const slots = [
    q(1, "State", "Ask for one precise fact, term or definition."),
    q(2, "Give", "Ask the student to give two examples, features or reasons."),
    q(4, "Explain", "Ask the student to explain two ideas, each with a reason."),
    q(6, "Analyse", "Ask the student to analyse a short scenario, case or argument.", {
      marking: "levels",
    }),
    q(9, "Evaluate", "Ask an extended question that needs a justified judgement.", {
      marking: "levels",
    }),
    q(12, "Evaluate", "Give a statement and ask how far the student agrees, requiring both sides and a justified conclusion.", {
      marking: "levels",
    }),
  ];
  return makeBlueprint(
    "humanities",
    "Short answers plus extended evaluation questions in this subject's format.",
    [
      section("Section A — Questions", "Answer all questions.", slots),
    ],
    [
      `Write exactly ${slots.length} questions with the marks shown for ${course.subject}.`,
      "Use examples, theories and terminology from the specification.",
      "The 6-mark and longer questions must be levels-marked and require developed reasoning.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
  );
}

function generic(): PaperBlueprint {
  const slots = [
    q(2, "Define", "Ask for a precise definition or two key facts."),
    q(4, "Explain", "Ask the student to explain two ideas, each with a reason."),
    q(6, "Analyse", "Ask the student to analyse a short scenario or example.", {
      marking: "levels",
    }),
    q(9, "Evaluate", "Ask an extended question that needs a justified judgement.", {
      marking: "levels",
    }),
    q(12, "Evaluate", "Give a statement and ask how far the student agrees, requiring both sides and a conclusion.", {
      marking: "levels",
    }),
  ];
  return makeBlueprint(
    "generic",
    "Short answers followed by extended evaluation questions.",
    [section("Section A — Questions", "Answer all questions.", slots)],
    [
      `Write exactly ${slots.length} questions with the marks shown.`,
      "The longer questions must be levels-marked and require developed reasoning.",
      POINT_RULE,
      LEVEL_RULE,
      "Do not write a mark notation, answer lines or a cover page; the app adds those.",
    ],
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
): PaperBlueprint {
  const subject = course.subject.trim().toLowerCase();
  const level = course.level.trim();

  // Key stage 3 has no exam board format, so it gets a short, school-style
  // paper instead of a GCSE mark sequence.
  if (/^ks3$/i.test(level)) {
    return makeBlueprint(
      "ks3",
      "Key Stage 3 format: short answers and two extended questions.",
      [
        section("Section A — Questions", "Answer all questions.", [
          q(1, "State", "Ask for one precise fact, term or definition."),
          q(2, "Describe", "Ask the student to describe two features or give two examples."),
          q(3, "Explain", "Ask the student to explain one idea with a reason."),
          q(4, "Explain", "Ask the student to explain two ideas, each with a reason."),
          q(6, "Explain", "Ask an extended explanation that brings two ideas together.", {
            marking: "levels",
          }),
          q(8, "Evaluate", "Ask a 'How far…' question that needs a justified judgement.", {
            marking: "levels",
          }),
        ]),
      ],
      [
        "Write exactly six questions with the marks shown.",
        "Keep the language appropriate for key stage 3 and use only content from the specification.",
        POINT_RULE,
        LEVEL_RULE,
        "Do not write a mark notation, answer lines or a cover page; the app adds those.",
      ],
    );
  }

  if (/religious studies|religious education|\brs\b|philosophy and ethics/.test(subject)) {
    return religiousStudies(course);
  }
  if (/english literature|literature/.test(subject)) {
    return englishLiterature(course);
  }
  if (/english language|english\b/.test(subject)) {
    return englishLanguage();
  }
  if (/mathematics|maths|math\b|statistics|further maths/.test(subject)) {
    return maths(course);
  }
  // Computer Science must be tested before the science family: its name
  // contains "science" but its paper is nothing like a lab science paper.
  if (/computer science|information technology|computing|ict/.test(subject)) {
    return computerScience();
  }
  if (/biology|chemistry|physics|combined science|science|environmental/.test(subject)) {
    return science(course);
  }
  if (/history/.test(subject)) {
    return history(course);
  }
  if (/geography/.test(subject)) {
    return geography();
  }
  if (
    /french|spanish|german|mandarin|latin|italian|japanese|russian|arabic|language/.test(
      subject,
    )
  ) {
    return language(course);
  }
  if (
    /business|economic|psychology|sociology|politics|law|philosophy|health and social|accounting/.test(
      subject,
    )
  ) {
    return humanities(course);
  }
  return generic();
}

/** One line for the course page, e.g. "8 questions · 3, 4, 5 and 12 marks". */
export function paperFormatSummary(course: BlueprintCourse): string {
  return buildPaperBlueprint(course).summary;
}
