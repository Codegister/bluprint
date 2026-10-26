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
 *
 * The cover is built here on the server rather than by the model so the rubric
 * is exact and identical every time a paper is rebuilt.
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
};

export type PaperCover = {
  /** "Practice paper 1" — the app's own label, not a board paper number. */
  paperLabel: string;
  /** "GCSE Biology · AQA · Higher tier" */
  qualification: string;
  /** "1 hour" */
  timeAllowed: string;
  totalMarks: number;
  /** Shown only when the subject actually uses them. */
  materials: string[];
  instructions: string[];
  information: string[];
  advice: string[];
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

/** True when the subject's papers normally permit a calculator. */
function usesCalculator(subject: string): boolean {
  return /maths?|mathematic|physics|chemistry|biology|science|economic|account|business|statistic|geograph|psycholog|engineering|design|computing|computer/i.test(
    subject,
  );
}

/** True when the subject's papers normally call for a ruler or pencil. */
function usesRuler(subject: string): boolean {
  return /maths?|mathematic|physics|science|biology|chemistry|geograph|engineering|design|art/i.test(
    subject,
  );
}

function materialsFor(qualification: PaperQualification): string[] {
  const materials: string[] = [];
  if (usesRuler(qualification.subject)) materials.push("a ruler");
  if (usesCalculator(qualification.subject)) materials.push("a scientific calculator");
  return materials;
}

/** "GCSE Biology · AQA · Higher tier" — one line for the cover and the header. */
export function qualificationLine(qualification: PaperQualification): string {
  // Religious Studies papers name the religions they examine, because a paper
  // without them cannot be revised from.
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
 * prints on its own papers (Instructions / Information / Advice, or INSTRUCTIONS
 * / INFORMATION for OCR and Cambridge), because that is what makes a paper read
 * as genuine at a glance.
 */
function coverRubric(
  family: BoardFamily,
  qualification: PaperQualification,
  totalMarks: number,
  minutes: number,
): Pick<PaperCover, "instructions" | "information" | "advice" | "materials"> {
  const materials = materialsFor(qualification);
  const minutesPerMark = Math.max(1, Math.round(minutes / Math.max(1, totalMarks)));

  switch (family) {
    case "edexcel":
      return {
        materials,
        instructions: [
          "Use black ink or ball-point pen.",
          "Fill in the boxes at the top of this page with your name, centre number and candidate number.",
          "Answer all questions.",
          "Answer the questions in the spaces provided — there may be more space than you need.",
          ...(usesCalculator(qualification.subject)
            ? ["Calculators may be used."]
            : []),
        ],
        information: [
          `The total mark for this paper is ${totalMarks}.`,
          "The marks for each question are shown in brackets — use this as a guide as to how much time to spend on each question.",
          `You are advised to spend about ${minutesPerMark} minute${minutesPerMark === 1 ? "" : "s"} per mark.`,
          "Questions labelled with an asterisk (*) are ones where the quality of your written communication will be assessed.",
        ],
        advice: ["Read each question carefully before you start to answer it."],
      };

    case "ocr":
      return {
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
          "This document has 2 pages.",
        ],
        advice: ["Read each question carefully before you start your answer."],
      };

    case "cambridge":
      return {
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
        advice: [
          "The questions in this paper may use material from several topics.",
        ],
      };

    case "wjec":
      return {
        materials,
        instructions: [
          "Use black ink or black ball-point pen.",
          "Write your answers in the spaces provided in this booklet.",
          "Answer all questions.",
        ],
        information: [
          `The number of marks is given in brackets at the end of each question or part-question.`,
          `The total number of marks available for this paper is ${totalMarks}.`,
        ],
        advice: [
          "You are reminded of the need for good English and clear presentation in your answers.",
        ],
      };

    case "ib":
      return {
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
        advice: [
          "A clean copy of the formulae booklet is required for this paper.",
        ],
      };

    case "sqa":
      return {
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
        advice: [
          "You may use a calculator, unless the question states otherwise.",
        ],
      };

    case "ap":
      return {
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
        advice: [
          "Read each question completely before you begin to write your response.",
        ],
      };

    case "aqa":
    default:
      return {
        materials,
        instructions: [
          "Use black ink or black ball-point pen.",
          "Fill in the boxes at the top of this page.",
          "Answer all questions.",
          "You must answer the questions in the spaces provided. Do not write outside the box around each page or on blank pages.",
          "Do all rough work in this book. Cross through any work you do not want to be marked.",
        ],
        information: [
          "The marks for questions are shown in brackets.",
          `The maximum mark for this paper is ${totalMarks}.`,
          `You are advised to spend about ${minutesPerMark} minute${minutesPerMark === 1 ? "" : "s"} per mark.`,
        ],
        advice: usesCalculator(qualification.subject)
          ? ["In all calculations, show clearly how you work out your answer."]
          : ["You are advised to spend about one minute per mark."],
      };
  }
}

/**
 * The whole cover for one paper. Everything on it is derived from the course and
 * the paper's own marks, so two rebuilds of the same paper produce the same
 * cover.
 */
export function buildPaperCover(
  qualification: PaperQualification,
  paperLabel: string,
  totalMarks: number,
  minutes: number,
): PaperCover {
  const rubric = coverRubric(
    boardFamily(qualification.examBoard),
    qualification,
    totalMarks,
    minutes,
  );
  return {
    paperLabel,
    qualification: qualificationLine(qualification),
    timeAllowed: formatMinutes(minutes),
    totalMarks,
    ...rubric,
  };
}

/**
 * How each board prints the marks for a question. The UI applies this to every
 * question, so the model is told not to write the mark notation itself.
 */
export function markNotation(family: BoardFamily, marks: number): string {
  const plural = `${marks} mark${marks === 1 ? "" : "s"}`;
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
 * The line a board prints under the last part of a question. Edexcel and OCR
 * total each question; AQA and Cambridge do not, so this returns null for them.
 */
export function questionTotalLine(
  family: BoardFamily,
  questionNumber: string,
  marks: number,
): string | null {
  switch (family) {
    case "edexcel":
      return `(Total for Question ${questionNumber} = ${marks} mark${marks === 1 ? "" : "s"})`;
    case "ocr":
      return `(Total for Question ${questionNumber} = ${marks} mark${marks === 1 ? "" : "s"})`;
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
  const isScience =
    /biology|chemistry|physics|combined science/i.test(qualification.subject);
  // AQA's GCSE science papers number every part as "0 1 . 1", "0 1 . 2" and so
  // on. It is the single most recognisable thing about them.
  if (family === "aqa" && isScience && qualification.level === "GCSE") {
    return 'AQA GCSE science numbering: question 1 parts are labelled "0 1 . 1", "0 1 . 2"; question 2 parts are "0 2 . 1", "0 2 . 2", and so on.';
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
    case "aqa":
    case "wjec":
    case "generic":
    default:
      return "AQA command words: Calculate, Compare, Define, Describe, Determine, Evaluate, Explain, Give, Identify, Justify, Outline, Predict, Suggest, Use.";
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
  const lines: string[] = [
    cover.qualification.toUpperCase(),
    cover.paperLabel,
    `Time allowed: ${cover.timeAllowed}`,
  ];
  if (cover.materials.length > 0) {
    lines.push("", "Materials", ...cover.materials.map((item) => `  • ${item}`));
  }
  lines.push("", "Instructions", ...cover.instructions.map((item) => `  • ${item}`));
  lines.push("", "Information", ...cover.information.map((item) => `  • ${item}`));
  if (cover.advice.length > 0) {
    lines.push("", "Advice", ...cover.advice.map((item) => `  • ${item}`));
  }

  const firstLabel =
    family === "aqa" &&
    /biology|chemistry|physics|combined science/i.test(qualification.subject) &&
    qualification.level === "GCSE"
      ? "0 1 . 1"
      : "1 (a)";
  const secondLabel =
    family === "aqa" &&
    /biology|chemistry|physics|combined science/i.test(qualification.subject) &&
    qualification.level === "GCSE"
      ? "0 1 . 2"
      : "1 (b)";

  lines.push(
    "",
    "──────────────────────────────────────────",
    "Answer all questions in this section.",
    "",
    `${firstLabel}  [short recall question stem, ending in a command word] ${markNotation(family, 2)}`,
    "        " + "_".repeat(46),
    `        ${markNotation(family, 1)}`,
    "        " + "_".repeat(46),
    "",
    `${secondLabel}  [explain or calculate question stem] ${markNotation(family, 4)}`,
    "        " + "_".repeat(46),
    "        " + "_".repeat(46),
    "",
    "Turn over ▶",
    "",
    "──────────────────────────────────────────",
    "Section B — Extended response",
    "Answer the question in this section.",
    "",
    `2 (a)  *  [extended response stem] ${markNotation(family, 9)}`,
    "        " + "_".repeat(46),
  );

  const total = questionTotalLine(family, "2", 9);
  if (total) lines.push("", `        ${total}`);

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
    `The cover is rendered by the app and will read exactly like this:`,
    formatExemplar(qualification, cover),
    "",
    numberingStyle(qualification, family),
    commandWords(family),
    "Write the question stem only. Do not write the mark notation, do not write answer lines, and do not repeat the cover — the app adds all of those.",
    "Group questions into the sections this board's real paper uses (for example Section A for short answers and Section B for extended writing), and give each question a short section name. A paper that uses no sections should label every question with the same single section.",
    "Every question must carry the command word it opens with, and a specification reference from the specification above where one applies.",
    "An extended response worth 9 or more marks must be marked as a levels-of-response question in the marking guide.",
  ];
  return lines.join("\n");
}
