/**
 * Paper layout conventions for real exam papers.
 *
 * A real past paper is a document with a fixed shape: a cover with the board's
 * rubric, a numbering scheme, a mark notation and a command-word vocabulary.
 * AQA, Pearson Edexcel, OCR, WJEC, Cambridge, IB, SQA and College Board each
 * do this differently and repeat it on every paper they publish.
 *
 * This module encodes those conventions so a generated practice paper is laid
 * out the way the real paper is — same cover wording, same numbering, same
 * "(4 marks)" notation, same advice lines. The questions inside it come from
 * the subject blueprint in `paperBlueprint.ts`, which fixes the real question
 * types and marks; this module only fixes the document's layout.
 */

export type PaperQualification = {
  subject: string;
  level: string;
  examBoard: string;
  tier?: string;
  variant?: string;
  poetryTheme?: string;
  rsRoute?: string;
  rsReligion?: string;
  rsReligion2?: string;
  /** The component label, e.g. "Paper 1". */
  paper?: string;
  /** The real component code, e.g. "8461/1H". */
  componentCode?: string;
  /** SPaG marks inside the paper total. */
  spagMarks?: number;
  /** Printed question count, for a real page-count estimate. */
  questionCount?: number;
};

export type PaperCover = {
  /** "Practice paper 1" — the app's own label, not a board paper number. */
  paperLabel: string;
  /** "GCSE Biology · AQA · Higher tier" */
  qualification: string;
  /** The real component code, when known. */
  componentCode?: string;
  /** The exam series, when the app knows it. */
  series?: string;
  /** "1 hour" */
  timeAllowed: string;
  totalMarks: number;
  /** "Materials / For this paper you must have:" for boards that use it. */
  materialsHeading?: string;
  /** Shown only when the subject actually uses them. */
  materials: string[];
  instructions: string[];
  information: string[];
  advice: string[];
  /** Number of printed pages for boards that state it. */
  pageCount?: number;
};

export type PaperCoverOptions = {
  componentCode?: string;
  series?: string;
  pageCount?: number;
  hasSpag?: boolean;
  notes?: string[];
  durationEstimated?: boolean;
};

export type BoardFamily =
  | "aqa"
  | "edexcel"
  | "ocr"
  | "wjec"
  | "cambridge"
  | "ib"
  | "sqa"
  | "ap"
  | "generic";

/** Collapses the board label the picker stores into one convention family. */
export function boardFamily(board?: string): BoardFamily {
  const value = (board ?? "").toLowerCase();
  if (value.includes("aqa")) return "aqa";
  if (value.includes("edexcel") || value.includes("pearson")) return "edexcel";
  if (value.includes("ocr")) return "ocr";
  if (value.includes("wjec") || value.includes("eduqas")) return "wjec";
  if (value.includes("cambridge") || value.includes("cie") || value.includes("caie")) {
    return "cambridge";
  }
  if (value.startsWith("ib") || value.includes("baccalaureate")) return "ib";
  if (value.includes("sqa")) return "sqa";
  if (value.includes("college board") || value.trim() === "ap") return "ap";
  return "generic";
}

/** "1 hour", "1 hour 15 minutes", "45 minutes". */
export function formatMinutes(minutes: number): string {
  const total = Math.max(5, Math.round(minutes / 5) * 5);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} minutes`;
  if (rest === 0) return hours === 1 ? "1 hour" : `${hours} hours`;
  return `${hours} hour${hours === 1 ? "" : "s"} ${rest} minutes`;
}

type ComponentRules = {
  calculator: boolean;
  ruler: boolean;
  mathematicalInstruments: boolean;
  sourceBooklet: boolean;
  science: boolean;
  maths: boolean;
  english: boolean;
};

/**
 * Materials depend on the component, not the subject's name. Geography and
 * Psychology do not permit a calculator merely because the subject string
 * contains "graph" or "psych"; AQA Maths Paper 1 does not permit one either.
 */
function componentRules(qualification: PaperQualification): ComponentRules {
  const family = boardFamily(qualification.examBoard);
  const subject = qualification.subject.toLowerCase();
  const paper = (qualification.paper ?? "").toLowerCase();
  const gcse = /^gcse$/i.test(qualification.level);
  const science = /biology|chemistry|physics|combined science|science/.test(subject);
  const maths = /mathematics|maths|math\b|statistics|further maths/.test(subject);
  const english = /english/.test(subject);
  const history = /history/.test(subject);
  const geography = /geography/.test(subject);
  const paperOne = /paper\s*1/.test(paper);
  const nonCalculator = /non-calculator/i.test(paper);

  return {
    calculator:
      (family === "aqa" && gcse && science) ||
      (family === "aqa" && gcse && maths && !paperOne && !nonCalculator) ||
      (family !== "aqa" && (science || maths || /account|business|economic/.test(subject))),
    ruler: science || geography || maths,
    mathematicalInstruments: maths,
    sourceBooklet: history && (family === "edexcel" || /sources? booklet/i.test(paper)),
    science: science && gcse,
    maths: maths && gcse,
    english,
  };
}

function materialsFor(qualification: PaperQualification): string[] {
  const rules = componentRules(qualification);
  const materials: string[] = [];
  if (rules.mathematicalInstruments) {
    materials.push(rules.calculator ? "a scientific calculator" : "mathematical instruments");
    if (rules.calculator) materials.push("mathematical instruments");
  } else if (rules.calculator) {
    materials.push("a scientific calculator");
  }
  if (rules.ruler && !rules.mathematicalInstruments) materials.push("a ruler");
  if (rules.sourceBooklet) materials.push("the Sources Booklet");
  if (/english language/i.test(qualification.subject)) materials.push("the source insert");
  if (/religious studies/i.test(qualification.subject)) materials.push("a copy of the relevant specification text, if your school allows it");
  return [...new Set(materials)];
}

/** "GCSE Biology · AQA · Higher tier" — one line for the cover and the header. */
export function qualificationLine(qualification: PaperQualification): string {
  const religions = [qualification.rsReligion, qualification.rsReligion2]
    .map((religion) => religion?.trim())
    .filter((religion): religion is string => Boolean(religion));
  return [
    `${qualification.level} ${qualification.subject}`.trim(),
    religions.length > 0 ? religions.join(" and ") : null,
    qualification.examBoard && qualification.examBoard !== "None"
      ? qualification.examBoard
      : null,
    qualification.variant,
    qualification.tier ? `${qualification.tier} tier` : null,
    qualification.poetryTheme,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" · ");
}

/**
 * The cover rubric for one board. Wording follows the block headings the board
 * prints on its own papers. AQA sciences use Materials → Instructions →
 * Information only: Advice and the Edexcel minutes-per-mark line do not belong
 * on them.
 */
function coverRubric(
  family: BoardFamily,
  qualification: PaperQualification,
  totalMarks: number,
  minutes: number,
  hasSpag: boolean,
): Pick<
  PaperCover,
  "instructions" | "information" | "advice" | "materials" | "materialsHeading"
> {
  const rules = componentRules(qualification);
  const materials = materialsFor(qualification);
  const minutesPerMark = Math.max(1, Math.round(minutes / Math.max(1, totalMarks)));

  switch (family) {
    case "edexcel":
      return {
        materialsHeading: "Materials / For this paper you must have:",
        materials,
        instructions: [
          "Use black ink or ball-point pen.",
          "Fill in the boxes at the top of this page with your name, centre number and candidate number.",
          "Answer all questions.",
          "Answer the questions in the spaces provided — there may be more space than you need.",
          ...(rules.calculator ? ["Calculators may be used."] : []),
        ],
        information: [
          `The total mark for this paper is ${totalMarks}.`,
          "The marks for each question are shown in brackets — use this as a guide as to how much time to spend on each question.",
          `You are advised to spend about ${minutesPerMark} minute${minutesPerMark === 1 ? "" : "s"} per mark.`,
          ...(hasSpag
            ? ["Questions labelled with an asterisk (*) are ones where the quality of your written communication will be assessed."]
            : []),
        ],
        advice: ["Read each question carefully before you start to answer it."],
      };

    case "ocr": {
      const pageCount = Math.max(4, Math.ceil(totalMarks / 8) + 4);
      return {
        materialsHeading: "Materials / For this paper you must have:",
        materials,
        instructions: [
          "Use black ink. You can use an HB pencil, but only for graphs and diagrams.",
          "Write your answer to each question in the space provided.",
          "Answer all the questions.",
          "Do not write in the barcodes.",
        ],
        information: [
          `The total mark for this paper is ${totalMarks}.`,
          "The marks for each question are shown in brackets [ ].",
          `This document has ${pageCount} pages.`,
        ],
        advice: ["Read each question carefully before you start your answer."],
      };
    }

    case "cambridge":
      return {
        materialsHeading: "Materials / For this paper you must have:",
        materials: [
          ...materials,
          "a soft clean eraser",
          "a soft pencil (type B or HB is recommended)",
        ],
        instructions: [
          "Write in dark blue or black pen.",
          "You may use an HB pencil for any diagrams or graphs.",
          "Do not use staples, paper clips, glue or correction fluid.",
          "DO NOT WRITE IN ANY BARCODES.",
          "Answer all questions.",
          "If working is needed for any question it must be shown below that question.",
        ],
        information: [
          `The total mark for this paper is ${totalMarks}.`,
          "The number of marks is given in brackets [ ] at the end of each question or part question.",
          "The syllabus is published by Cambridge Assessment International Education.",
        ],
        advice: ["The questions in this paper may use material from several topics."],
      };

    case "wjec":
      return {
        materialsHeading: "Materials / For this paper you must have:",
        materials,
        instructions: [
          "Use black ink or black ball-point pen.",
          "Write your answers in the spaces provided in this booklet.",
          "Answer all questions.",
        ],
        information: [
          "The number of marks is given in brackets at the end of each question or part-question.",
          `The total number of marks available for this paper is ${totalMarks}.`,
        ],
        advice: ["You are reminded of the need for good English and clear presentation in your answers."],
      };

    case "ib":
      return {
        materialsHeading: "Materials / For this paper you must have:",
        materials,
        instructions: [
          "Do not open this examination paper until instructed to do so.",
          "Answer all questions.",
          "Write your answers in the boxes provided.",
          "The maximum mark for this examination paper is shown below.",
        ],
        information: [
          `The maximum mark for this examination paper is ${totalMarks} marks.`,
          "Unless otherwise stated in the question, all numerical answers should be given exactly or correct to three significant figures.",
        ],
        advice: ["A clean copy of the formulae booklet is required for this paper."],
      };

    case "sqa":
      return {
        materialsHeading: "Materials / For this paper you must have:",
        materials,
        instructions: [
          "Read each question carefully.",
          "Answer all questions.",
          "Write your answers in the answer booklet provided.",
        ],
        information: [
          `Total marks — ${totalMarks}.`,
          "Marks are shown in brackets at the end of each question.",
        ],
        advice: ["You may use a calculator, unless the question states otherwise."],
      };

    case "ap":
      return {
        materialsHeading: "Materials / For this paper you must have:",
        materials,
        instructions: [
          "Answer all questions.",
          "Write your answers in the spaces provided.",
          "Show all your work for questions that require it.",
        ],
        information: [
          `The total score for this section is ${totalMarks} points.`,
          "Points are shown after each question.",
        ],
        advice: ["Read each question completely before you begin to write your response."],
      };

    case "aqa": {
      const scienceInstructions = rules.science
        ? [
            "Use black ink or black ball-point pen.",
            "Pencil should only be used for drawing.",
            "Fill in the boxes at the top of this page.",
            "Answer all questions in the spaces provided.",
            "Do all rough work in this book. Cross through any work you do not want to be marked.",
            ...(rules.calculator
              ? ["In all calculations, show clearly how you work out your answer."]
              : []),
          ]
        : rules.maths
          ? [
              "Use black ink or black ball-point pen.",
              "Pencil should only be used for drawing.",
              "Fill in the boxes at the top of this page.",
              "Answer all questions in the spaces provided.",
              "You must answer the questions in the spaces provided. Do not write outside the box around each page or on blank pages.",
              "Do all rough work in this book. Cross through any work you do not want to be marked.",
              ...(rules.calculator ? ["Calculators may be used."] : []),
            ]
          : [
              "Use black ink or black ball-point pen.",
              "Fill in the boxes at the top of this page.",
              "Answer all questions.",
              "Answer the questions in the spaces provided.",
              ...(rules.calculator ? ["Calculators may be used."] : []),
            ];
      const information = [
        "The marks for questions are shown in brackets.",
        `The maximum mark for this paper is ${totalMarks}.`,
        ...(minutes > 0
          ? [`You are advised to spend about ${formatMinutes(minutes)} on this paper.`]
          : []),
      ];
      return {
        materialsHeading: "Materials / For this paper you must have:",
        materials,
        instructions: scienceInstructions,
        information,
        // AQA sciences have no Advice block.
        advice: rules.science
          ? []
          : rules.english
            ? ["You are advised to spend 15 minutes reading the source material before you start."]
            : [],
      };
    }

    case "generic":
    default:
      return {
        materialsHeading: "Materials / For this paper you must have:",
        materials,
        instructions: ["Answer all questions.", "Write your answers in the spaces provided."],
        information: [
          `The total mark for this paper is ${totalMarks}.`,
          "Marks are shown in brackets after each question.",
        ],
        advice: [],
      };
  }
}

/**
 * The whole cover for one paper. Everything on it is derived from the course,
 * the blueprint and the paper's own marks, so two rebuilds of the same paper
 * produce the same cover.
 */
export function buildPaperCover(
  qualification: PaperQualification,
  paperLabel: string,
  totalMarks: number,
  minutes: number,
  options: PaperCoverOptions = {},
): PaperCover {
  const family = boardFamily(qualification.examBoard);
  const hasSpag =
    options.hasSpag ??
    (qualification.spagMarks !== undefined && qualification.spagMarks > 0);
  const rubric = coverRubric(family, qualification, totalMarks, minutes, hasSpag);
  const information = [...rubric.information];
  if (options.notes && options.notes.length > 0) information.push(...options.notes);
  if (options.durationEstimated) {
    information.push("Duration and mark total are estimated for this practice paper; check them against your specification.");
  }
  const componentCode = options.componentCode ?? qualification.componentCode;
  const pageCount =
    options.pageCount ??
    (family === "ocr" ? Math.max(4, Math.ceil(totalMarks / 8) + 4) : undefined);
  return {
    paperLabel,
    qualification: qualificationLine(qualification),
    ...(componentCode ? { componentCode } : {}),
    ...(options.series ? { series: options.series } : {}),
    timeAllowed: formatMinutes(minutes),
    totalMarks,
    ...rubric,
    instructions: rubric.instructions,
    information,
    advice: rubric.advice,
    ...(pageCount !== undefined ? { pageCount } : {}),
  };
}

/**
 * How each board prints the marks for a question. The UI applies this to every
 * question, so the model is told not to write the mark notation itself.
 *
 * AQA English Literature is the exception: its two essays print
 * "[30 marks] AO4 [4 marks]", not "(30 marks)".
 */
export function markNotation(
  family: BoardFamily,
  marks: number,
  options: { literature?: boolean; spag?: boolean } = {},
): string {
  const plural = `${marks} mark${marks === 1 ? "" : "s"}`;
  if (family === "aqa" && options.literature) {
    return `[${plural}]${options.spag ? " AO4 [4 marks]" : ""}`;
  }
  switch (family) {
    case "edexcel":
      return `(${marks})`;
    case "ocr":
    case "cambridge":
      return `[${marks}]`;
    case "ap":
      return `(${marks} point${marks === 1 ? "" : "s"})`;
    case "ib":
      return `[${plural}]`;
    case "aqa":
    case "wjec":
    case "sqa":
    case "generic":
    default:
      return `(${plural})`;
  }
}

/**
 * The line a board prints under the last part of a question. Edexcel prints
 * "(Total for Question N is M marks)"; OCR totals use "=".
 */
export function questionTotalLine(
  family: BoardFamily,
  questionNumber: string,
  marks: number,
): string | null {
  const noun = `mark${marks === 1 ? "" : "s"}`;
  switch (family) {
    case "edexcel":
      return `(Total for Question ${questionNumber} is ${marks} ${noun})`;
    case "ocr":
      return `(Total for Question ${questionNumber} = ${marks} ${noun})`;
    case "cambridge":
      return `[Total: ${marks}]`;
    default:
      return null;
  }
}

/** The numbering style the board uses for question parts. */
export function numberingStyle(
  qualification: PaperQualification,
  family: BoardFamily,
): string {
  const subject = qualification.subject.toLowerCase();
  const isScience = /biology|chemistry|physics|combined science/.test(subject);
  if (family === "aqa" && isScience && /^gcse$/i.test(qualification.level)) {
    return 'AQA GCSE science numbering: question 1 parts are labelled "0 1 . 1", "0 1 . 2"; question 2 parts are "0 2 . 1", "0 2 . 2", and so on. There are no lettered sections.';
  }
  if (family === "aqa" && /mathematics|maths|math\b/.test(subject) && /^gcse$/i.test(qualification.level)) {
    return 'AQA GCSE maths numbering: whole questions run "1", "2", "3" with no lettered sections. Do not use the 0 1 . 1 style.';
  }
  return 'Numbering: whole questions are "1", "2", "3" and parts are "1 (a)", "1 (b)", "1 (c)". Do not use the 0 1 . 1 style.';
}

/** The command words the board publishes for this qualification. */
export function commandWords(family: BoardFamily): string {
  switch (family) {
    case "cambridge":
      return "Cambridge command words: Calculate, Compare, Contrast, Define, Describe, Determine, Discuss, Evaluate, Explain, Give, Identify, Justify, Outline, Predict, State, Suggest, Use.";
    case "ib":
      return "IB command terms: Define, Describe, Outline, State, Distinguish, Explain, Analyse, Compare and contrast, Discuss, Evaluate, Justify, To what extent.";
    case "edexcel":
      return "Pearson Edexcel command words: Calculate, Complete, Define, Describe, Determine, Evaluate, Explain, Give, Identify, Justify, Show that, State, Suggest.";
    case "ocr":
      return "OCR command words: Calculate, Describe, Determine, Explain, Give, Identify, Justify, Outline, State, Suggest, Use, Evaluate.";
    case "sqa":
      return "SQA command words: Calculate, Describe, Explain, Give, Identify, State.";
    case "ap":
      return "AP command words: Calculate, Describe, Explain, Identify, Justify, Predict, State.";
    case "wjec":
      return "WJEC / Eduqas command words: Analyse, Compare, Describe, Discuss, Evaluate, Explain, Give, Identify, Justify, Outline, State, Suggest.";
    case "aqa":
      return "AQA command words: Calculate, Compare, Define, Describe, Determine, Evaluate, Explain, Give, Identify, Justify, Outline, Predict, Suggest, Use.";
    case "generic":
    default:
      return "Use the command words your specification publishes; do not import another board's vocabulary.";
  }
}

/**
 * A compact specimen of the paper's layout. The model is told to write its
 * questions in exactly this shape, which is what makes a generated paper read
 * like a real one. The content is deliberately generic: only the structure of a
 * published paper is imitated, never its questions.
 */
export function formatExemplar(
  qualification: PaperQualification,
  cover: PaperCover,
): string {
  const family = boardFamily(qualification.examBoard);
  const rules = componentRules(qualification);
  const lines: string[] = [
    cover.qualification.toUpperCase(),
    ...(cover.componentCode ? [`Component: ${cover.componentCode}`] : []),
    cover.paperLabel,
    `Time allowed: ${cover.timeAllowed}`,
  ];
  if (cover.materials.length > 0) {
    lines.push("", cover.materialsHeading ?? "Materials / For this paper you must have:", ...cover.materials.map((item) => `  • ${item}`));
  }
  lines.push("", "Instructions", ...cover.instructions.map((item) => `  • ${item}`));
  lines.push("", "Information", ...cover.information.map((item) => `  • ${item}`));
  if (cover.advice.length > 0) {
    lines.push("", "Advice", ...cover.advice.map((item) => `  • ${item}`));
  }

  const science = family === "aqa" && rules.science;
  const firstLabel = science ? "0 1 . 1" : "1 (a)";
  const secondLabel = science ? "0 1 . 2" : "1 (b)";
  lines.push(
    "",
    "──────────────────────────────────────────",
    ...(science || rules.maths ? [] : ["Answer all questions in this section."]),
    "",
    `${firstLabel}  [short recall question stem, ending in a command word] ${markNotation(family, 2)}`,
    "        " + "_".repeat(46),
    "",
    `${secondLabel}  [explain or calculate question stem] ${markNotation(family, 4)}`,
    "        " + "_".repeat(46),
    "",
    "Turn over ▶",
  );

  return lines.join("\n");
}

/**
 * The instruction block appended to the paper-generation prompt. It carries the
 * board's cover shape, numbering, mark notation and command words, and explains
 * that the cover is rendered by the app so the model must not repeat it.
 */
export function paperFormatBrief(
  qualification: PaperQualification,
  cover: PaperCover,
): string {
  const family = boardFamily(qualification.examBoard);
  const lines = [
    "FORMAT — the finished paper must be laid out like a real paper from this board.",
    "The cover is rendered by the app and will read exactly like this:",
    formatExemplar(qualification, cover),
    "",
    numberingStyle(qualification, family),
    commandWords(family),
    "Write the question stem only. Do not write the mark notation, do not write answer lines, and do not repeat the cover — the app adds all of those.",
    "Follow the blueprint exactly. Where it gives a section title, use it; where the title is blank, print no section heading at all.",
    "Every question must carry the command word it opens with, and a specification reference from the specification above where one applies.",
    "A levels-marked question keeps its board bands and mark ranges; never convert a band into one mark per descriptor.",
  ];
  return lines.join("\n");
}
