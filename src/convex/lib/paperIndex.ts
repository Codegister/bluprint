/**
 * The paper index: the only source of a practice paper's shape.
 *
 * A row is loaded at build time and never edited at request time. The model
 * fills blueprint lines; it never chooses marks, question counts, sections,
 * numbering, cover text or mark-scheme totals. Pending rows deliberately carry
 * no ladder and no blueprint so a status flip cannot ship a plausible guess.
 */

export type PaperStatus = "ACTIVE" | "PENDING";
export type PaperEvidence = "V" | "S" | "P";
export type PaperBoard =
  | "AQA"
  | "EDX"
  | "OCR"
  | "WJEC"
  | "EDUQAS"
  | "CAIE"
  | "SQA"
  | "IB"
  | "AP"
  | "KS3"
  | "UG";
export type PaperQual = "GCSE" | "ALV" | "IB" | "AP" | "KS3" | "UG";
export type StimScope = "none" | "paper" | "section" | "question";
export type AnswerSpace = "lines-per-mark" | "boxed" | "grid" | "none";

export type TimeSpec =
  | string
  | {
      total: string;
      sections: Record<string, string>;
    };

export type PaperSectionSpec = {
  id: string;
  label: string | null;
  marks: number;
};

export type ExtraMarks = {
  label: "SPaG" | "AO4";
  marks: number;
};

export type IndexRow = {
  key: string;
  board: PaperBoard;
  qual: PaperQual;
  subject: string;
  code: string;
  paper: string;
  tiered: boolean;
  paperCode: string;
  marks: number;
  time: TimeSpec;
  minutes: number;
  sections: PaperSectionSpec[];
  qs: number;
  ladders: Record<string, number[]>;
  bp: string;
  cover: string;
  num: string;
  ms: string;
  voice: string;
  stimScope: StimScope;
  answerSpace: AnswerSpace;
  extraMarks: ExtraMarks | null;
  calculator: boolean;
  booklet: boolean;
  evidence: PaperEvidence;
  status: PaperStatus;
  evidenceSource: string;
  advice: string;
  maxTariff: number;
  pendingReason?: string;
};

export type BlueprintLine = {
  line: number;
  tariff: number;
  command: string;
  slot: string;
  stim: "DATA" | "REQ" | null;
  type: "mcq" | "structured" | "source" | "essay" | "writing";
  parts?: Array<{
    label: string;
    tariff: number;
    command: string;
    spag?: boolean;
  }>;
};

export type CoverProfile = {
  id: string;
  blocks: Array<{
    heading: string;
    fields: string[];
  }>;
};

const minutes = (value: TimeSpec): number => {
  if (typeof value !== "string") return 180;
  const hours = /(\d+)\s*hour/i.exec(value);
  const mins = /(\d+)\s*minute/i.exec(value);
  return (hours ? Number(hours[1]) * 60 : 0) + (mins ? Number(mins[1]) : 0);
};

const single = (marks: number): PaperSectionSpec[] => [
  { id: "single", label: null, marks },
];

const tiers = (base: string): string => `${base}{tier}`;

const repeat = (values: number[], count: number): number[] =>
  Array.from({ length: count }, () => values).flat();

const ones = (count: number): number[] => Array.from({ length: count }, () => 1);

const SCIENCE_A = [4, 6, 8, 9, 10, 11, 12, 13, 14, 13];
const SCIENCE_B = [8, 9, 10, 11, 11, 12, 13, 13, 13];
const SCIENCE_C = [5, 6, 7, 8, 9, 10, 10, 11, 11, 11, 12];
const COMBINED_A = [2, 4, 6, 8, 9, 10, 14, 17];
const COMBINED_B = [3, 5, 6, 7, 8, 9, 10, 10, 12];
const MATHS_A = [2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 5];
const MATHS_B = [2, 2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 7];
const MATHS_C = [
  2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 5, 6, 6, 6, 7,
];
const ALV_BIO_A = [4, 6, 7, 8, 9, 9, 10, 10, 14, 14];
const ALV_BIO_B = [5, 6, 8, 8, 10, 11, 13, 14, 16];
const ALV_BIO_C = [3, 5, 6, 7, 8, 9, 10, 10, 11, 11, 11];
const ALV_MATHS = [4, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11];
const OCR_MATHS_A = [
  3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 7,
];
const OCR_MATHS_B = [
  3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 5, 5, 6, 7, 7, 8, 8, 8,
];

const RS_LADDER = repeat([1, 2, 4, 5, 12], 4);
const RS_SECTIONS = ["A", "B", "C", "D"].map((id) => ({
  id,
  label: `Section ${id}`,
  marks: 24,
}));

const IB_HL_A = [...ones(40), 6, 7, 7, 8, 7];
const IB_HL_B = [...ones(40), 8, 9, 9, 9];
const IB_HL_C = [...ones(40), 5, 6, 6, 6, 6, 6];
const IB_SL_A = [...ones(30), 6, 6, 7, 6];
const IB_SL_B = [...ones(30), 7, 6, 6, 6];

const AP_A = [...ones(60), 10, 10, 8, 8, 7, 7];

const KS3_A = [3, 5, 6, 7, 8, 9, 10, 12];
const KS3_B = [4, 7, 8, 9, 10, 11, 11];
const KS3_C = [3, 4, 5, 6, 6, 7, 8, 10, 11];

const common = {
  calculator: true,
  booklet: false,
  extraMarks: null,
  answerSpace: "lines-per-mark" as AnswerSpace,
  stimScope: "question" as StimScope,
  advice: "Read each question carefully before you start to answer it.",
};

const row = (
  input: Omit<
    IndexRow,
    "time" | "minutes" | "status" | "evidence" | "evidenceSource" | "pendingReason"
  > & {
    time: TimeSpec;
    status?: PaperStatus;
    evidence: PaperEvidence;
    evidenceSource: string;
    statusReason?: string;
  },
): IndexRow => ({
  ...input,
  time: input.time,
  minutes: minutes(input.time),
  status: input.status ?? "ACTIVE",
  evidence: input.evidence,
  evidenceSource: input.evidenceSource,
  ...(input.statusReason ? { pendingReason: input.statusReason } : {}),
});

const AQA = "AQA" as const;
const EDX = "EDX" as const;
const OCR = "OCR" as const;

const aqaScience = (
  key: string,
  subject: string,
  code: string,
  paper: string,
  bp: string,
): IndexRow =>
  row({
    ...common,
    key,
    board: AQA,
    qual: "GCSE",
    subject,
    code,
    paper,
    tiered: true,
    paperCode: tiers(
      `${code === "BIO" ? "8461" : code === "CHE" ? "8462" : code === "PHY" ? "8463" : "8464"}/${paper}`,
    ),
    marks: subject === "Combined Science" ? 70 : 100,
    time: subject === "Combined Science" ? "1 hour 15 minutes" : "1 hour 45 minutes",
    sections: single(subject === "Combined Science" ? 70 : 100),
    qs: subject === "Combined Science" ? 8 : 10,
    ladders:
      subject === "Combined Science"
        ? { A: COMBINED_A, B: COMBINED_B }
        : { A: SCIENCE_A, B: SCIENCE_B, C: SCIENCE_C },
    bp,
    cover: "COVER-AQA-GCSE",
    num: "NUM-AQA-2DP",
    ms: "MS-AQA-POINTS",
    voice: "VOICE-AQA",
    evidence: "V",
    evidenceSource: `AQA ${code} specification, Paper ${paper}`,
    maxTariff: subject === "Combined Science" ? 17 : 14,
  });

const aqaMaths = (paper: string): IndexRow =>
  row({
    ...common,
    key: `AQA-GCSE-MAT-${paper}`,
    board: AQA,
    qual: "GCSE",
    subject: "Mathematics",
    code: "MAT",
    paper,
    tiered: true,
    paperCode: tiers(`8300/${paper}`),
    marks: 80,
    time: "1 hour 30 minutes",
    sections: single(80),
    qs: 20,
    ladders: { A: MATHS_A, B: MATHS_B, C: MATHS_C },
    bp: "BP-MAT-GCSE",
    cover: paper === "1" ? "COVER-AQA-GCSE-NOCALC" : "COVER-AQA-GCSE",
    num: "NUM-AQA-INT",
    ms: "MS-AQA-MATHS",
    voice: "VOICE-AQA",
    calculator: paper !== "1",
    evidence: "V",
    evidenceSource: "AQA 8300 specification, Papers 1-3, 80 marks, 1h30",
    advice: "You are advised to spend about 1 minute per mark.",
    maxTariff: 8,
  });

const edxMaths = (paper: string): IndexRow =>
  row({
    ...common,
    key: `EDX-GCSE-MAT-${paper}`,
    board: EDX,
    qual: "GCSE",
    subject: "Mathematics",
    code: "MAT",
    paper,
    tiered: true,
    paperCode: tiers(`1MA1/${paper}`),
    marks: 80,
    time: "1 hour 30 minutes",
    sections: single(80),
    qs: 20,
    ladders: { A: MATHS_A, B: MATHS_B, C: MATHS_C },
    bp: "BP-MAT-GCSE",
    cover: "COVER-EDX-GCSE",
    num: "NUM-EDX-INT",
    ms: "MS-EDX-POINTS",
    voice: "VOICE-EDX",
    calculator: paper !== "1",
    evidence: "S",
    evidenceSource: "Edexcel 1MA1 specification, 80 marks, 1h30; ladder constructed",
    advice: "You are advised to spend about 1 minute per mark.",
    maxTariff: 8,
  });

const ocrMaths = (paper: string): IndexRow =>
  row({
    ...common,
    key: `OCR-GCSE-MAT-${paper}`,
    board: OCR,
    qual: "GCSE",
    subject: "Mathematics",
    code: "MAT",
    paper,
    tiered: false,
    paperCode: `J560/0${paper}`,
    marks: 100,
    time: "1 hour 30 minutes",
    sections: single(100),
    qs: 22,
    ladders: { A: OCR_MATHS_A, B: OCR_MATHS_B },
    bp: "BP-MAT-GCSE",
    cover: "COVER-OCR-GCSE",
    num: "NUM-OCR",
    ms: "MS-OCR-POINTS",
    voice: "VOICE-OCR",
    evidence: "S",
    evidenceSource: "OCR J560 specification, 100 marks, 1h30; ladder constructed",
    advice: "You are advised to spend about 1 minute per mark.",
    maxTariff: 8,
  });

const aqaEnglishLanguage = (paper: "1" | "2"): IndexRow =>
  row({
    ...common,
    key: `AQA-GCSE-ENL-${paper}`,
    board: AQA,
    qual: "GCSE",
    subject: "English Language",
    code: "ENL",
    paper,
    tiered: false,
    paperCode: `8700/${paper}`,
    marks: 80,
    time: "1 hour 45 minutes",
    sections: [
      { id: "A", label: "Section A", marks: 40 },
      { id: "B", label: "Section B", marks: 40 },
    ],
    qs: 5,
    ladders: { A: [4, 8, 8, 20, 40] },
    bp: `BP-ENL-${paper}`,
    cover: "COVER-AQA-ENL",
    num: "NUM-AQA-INT",
    ms: "MS-AQA-BANDS",
    voice: "VOICE-AQA",
    stimScope: "section",
    booklet: true,
    calculator: false,
    evidence: "V",
    evidenceSource: `AQA 8700/${paper} specification, 80 marks, 1h45`,
    advice:
      "You are advised to spend about 15 minutes reading the source and 1 hour 30 minutes answering the questions.",
    maxTariff: 40,
  });

const aqaLiterature = (): IndexRow =>
  row({
    ...common,
    key: "AQA-GCSE-ENLIT-1",
    board: AQA,
    qual: "GCSE",
    subject: "English Literature",
    code: "ENLIT",
    paper: "1",
    tiered: false,
    paperCode: "8702/1",
    marks: 64,
    time: "1 hour 45 minutes",
    sections: [
      { id: "A", label: "Section A", marks: 34 },
      { id: "B", label: "Section B", marks: 30 },
    ],
    qs: 2,
    ladders: { A: [34, 30] },
    bp: "BP-ENLIT-1",
    cover: "COVER-AQA-GCSE",
    num: "NUM-AQA-INT",
    ms: "MS-AQA-BANDS",
    voice: "VOICE-AQA",
    stimScope: "question",
    booklet: true,
    calculator: false,
    evidence: "S",
    evidenceSource:
      "AQA 8702/1: 30 + 4 AO4 and 30; block presentation declared inference C8.2",
    advice: "You are advised to spend about 15 minutes reading the extract.",
    maxTariff: 34,
  });

const aqaRs = (paper: string): IndexRow =>
  row({
    ...common,
    key: `AQA-GCSE-RS-${paper}`,
    board: AQA,
    qual: "GCSE",
    subject: "Religious Studies",
    code: "RS",
    paper,
    tiered: false,
    paperCode: `8062/${paper}`,
    marks: 96,
    time: "1 hour 45 minutes",
    sections: RS_SECTIONS,
    qs: 20,
    ladders: { A: RS_LADDER },
    bp: "BP-RS-AQA",
    cover: "COVER-AQA-GCSE",
    num: "NUM-AQA-2DP",
    ms: "MS-AQA-BANDS",
    voice: "VOICE-AQA",
    calculator: false,
    evidence: "S",
    evidenceSource:
      "AQA 8062: 96 marks, 20 five-part questions; 4 x 24 block arrangement is inference C8.1",
    advice: "You are advised to spend about 1 minute per mark.",
    maxTariff: 12,
  });

const aqaAlvBio = (paper: "1" | "2" | "3"): IndexRow =>
  row({
    ...common,
    key: `AQA-ALV-BIO-${paper}`,
    board: AQA,
    qual: "ALV",
    subject: "Biology",
    code: "BIO",
    paper,
    tiered: false,
    paperCode: `7402/${paper}`,
    marks: paper === "3" ? 78 : 91,
    time: paper === "3" ? "2 hours 30 minutes" : "2 hours",
    sections:
      paper === "3"
        ? [
            { id: "A", label: "Section A", marks: 53 },
            { id: "B", label: "Section B", marks: 25 },
          ]
        : single(91),
    qs: paper === "3" ? 8 : 10,
    ladders:
      paper === "3"
        ? { A: [4, 5, 6, 7, 8, 11, 12, 25] }
        : { A: ALV_BIO_A, B: ALV_BIO_B, C: ALV_BIO_C },
    bp: paper === "3" ? "BP-ALV-BIO-3" : "BP-ALV-BIO",
    cover: "COVER-AQA-GCSE",
    num: "NUM-AQA-INT",
    ms: "MS-AQA-POINTS+ESSAY",
    voice: "VOICE-AQA",
    evidence: "V",
    evidenceSource: `AQA 7402/${paper} specification, ${paper === "3" ? "78 marks, 2h30" : "91 marks, 2h"}`,
    advice: "You are advised to spend about 1 minute per mark.",
    maxTariff: 25,
  });

const aqaAlvMaths = (paper: string): IndexRow =>
  row({
    ...common,
    key: `AQA-ALV-MAT-${paper}`,
    board: AQA,
    qual: "ALV",
    subject: "Mathematics",
    code: "MAT",
    paper,
    tiered: false,
    paperCode: `7357/${paper}`,
    marks: 100,
    time: "2 hours",
    sections: single(100),
    qs: 13,
    ladders: { A: ALV_MATHS },
    bp: "BP-ALV-MAT",
    cover: "COVER-AQA-GCSE",
    num: "NUM-AQA-INT",
    ms: "MS-AQA-MATHS",
    voice: "VOICE-AQA",
    evidence: "S",
    evidenceSource:
      "AQA 7357: 100 marks, 2h; 13-question ladder constructed, inference C8.3",
    advice: "You are advised to spend about 1 minute per mark.",
    maxTariff: 11,
  });

const ibBio = (level: "HL" | "SL"): IndexRow =>
  row({
    ...common,
    key: `IB-IB-BIO-1-${level}`,
    board: "IB" as const,
    qual: "IB" as const,
    subject: "Biology",
    code: "BIO",
    paper: "1",
    tiered: false,
    paperCode: `IB-BIO-1-${level}`,
    marks: level === "HL" ? 75 : 55,
    time: level === "HL" ? "2 hours" : "1 hour 30 minutes",
    sections: [
      { id: "1A", label: "Part 1A", marks: level === "HL" ? 40 : 30 },
      { id: "1B", label: "Part 1B", marks: level === "HL" ? 35 : 25 },
    ],
    qs: level === "HL" ? 45 : 34,
    ladders: level === "HL" ? { A: IB_HL_A, B: IB_HL_B, C: IB_HL_C } : { A: IB_SL_A, B: IB_SL_B },
    bp: `BP-IB-P1-${level}`,
    cover: "COVER-IB",
    num: "NUM-IB",
    ms: "MS-IB-MARKS",
    voice: "VOICE-IB",
    stimScope: "question",
    answerSpace: "none",
    calculator: false,
    evidence: level === "HL" ? "V" : "S",
    evidenceSource: `IB Biology ${level} Paper 1`,
    advice: "",
    maxTariff: 15,
  });

const apBio = (): IndexRow =>
  row({
    ...common,
    key: "AP-AP-BIO-0",
    board: "AP" as const,
    qual: "AP" as const,
    subject: "Biology",
    code: "BIO",
    paper: "0",
    tiered: false,
    paperCode: "AP Biology",
    marks: 110,
    time: { total: "3 hours", sections: { I: "1 hour 30 minutes", II: "1 hour 30 minutes" } },
    sections: [
      { id: "I", label: "Section I: Multiple Choice", marks: 60 },
      { id: "II", label: "Section II: Free Response", marks: 50 },
    ],
    qs: 66,
    ladders: { A: AP_A },
    bp: "BP-AP-BIO",
    cover: "COVER-AP",
    num: "NUM-AP",
    ms: "MS-AP-POINTS",
    voice: "VOICE-AP",
    stimScope: "question",
    answerSpace: "none",
    calculator: false,
    evidence: "S",
    evidenceSource:
      "AP Biology: 60 MCQ + 50 FRQ = 110 points; per-FRQ split is inference C8.6",
    advice: "",
    maxTariff: 10,
  });

const ks3 = (): IndexRow =>
  row({
    ...common,
    key: "KS3-KS3-ANY-0",
    board: "KS3" as const,
    qual: "KS3" as const,
    subject: "Any",
    code: "ANY",
    paper: "0",
    tiered: false,
    paperCode: "",
    marks: 60,
    time: "1 hour",
    sections: single(60),
    qs: 8,
    ladders: { A: KS3_A, B: KS3_B, C: KS3_C },
    bp: "BP-KS3",
    cover: "COVER-KS3",
    num: "NUM-AQA-INT",
    ms: "MS-SIMPLE-POINTS",
    voice: "VOICE-KS3",
    stimScope: "paper",
    calculator: false,
    evidence: "S",
    evidenceSource: "KS3 house style; no awarding body (C8.8)",
    advice: "Answer all questions in the spaces provided.",
    maxTariff: 12,
  });

const pending = (
  key: string,
  board: PaperBoard,
  qual: PaperQual,
  subject: string,
  code: string,
  paper: string,
  marks: number,
  time: TimeSpec,
  reason: string,
): IndexRow => ({
  ...common,
  key,
  board,
  qual,
  subject,
  code,
  paper,
  tiered: false,
  paperCode: "",
  marks,
  time,
  minutes: minutes(time),
  sections: [],
  qs: 0,
  ladders: {},
  bp: "",
  cover: "",
  num: "",
  ms: "",
  voice: "",
  evidence: "P",
  status: "PENDING",
  evidenceSource: "No current specification row loaded",
  maxTariff: 0,
  pendingReason: reason,
});

/**
 * The active index. Pending entries are retained so refusal tests can name the
 * exact missing row; they never carry a ladder or a blueprint.
 */
export const PAPER_ROWS: IndexRow[] = [
  // AQA GCSE sciences
  aqaScience("AQA-GCSE-BIO-1", "Biology", "BIO", "1", "BP-SCI-GCSE-1"),
  aqaScience("AQA-GCSE-BIO-2", "Biology", "BIO", "2", "BP-SCI-GCSE-2"),
  aqaScience("AQA-GCSE-CHE-1", "Chemistry", "CHE", "1", "BP-SCI-GCSE-1"),
  aqaScience("AQA-GCSE-CHE-2", "Chemistry", "CHE", "2", "BP-SCI-GCSE-2"),
  aqaScience("AQA-GCSE-PHY-1", "Physics", "PHY", "1", "BP-SCI-GCSE-1"),
  aqaScience("AQA-GCSE-PHY-2", "Physics", "PHY", "2", "BP-SCI-GCSE-2"),
  aqaScience("AQA-GCSE-SCI-B1", "Combined Science", "SCI", "B/1", "BP-SCI-COMB"),
  aqaScience("AQA-GCSE-SCI-B2", "Combined Science", "SCI", "B/2", "BP-SCI-COMB"),
  aqaScience("AQA-GCSE-SCI-C1", "Combined Science", "SCI", "C/1", "BP-SCI-COMB"),
  aqaScience("AQA-GCSE-SCI-C2", "Combined Science", "SCI", "C/2", "BP-SCI-COMB"),
  aqaScience("AQA-GCSE-SCI-P1", "Combined Science", "SCI", "P/1", "BP-SCI-COMB"),
  aqaScience("AQA-GCSE-SCI-P2", "Combined Science", "SCI", "P/2", "BP-SCI-COMB"),
  // AQA GCSE maths and English
  aqaMaths("1"),
  aqaMaths("2"),
  aqaMaths("3"),
  aqaEnglishLanguage("1"),
  aqaEnglishLanguage("2"),
  aqaLiterature(),
  aqaRs("1"),
  aqaRs("2"),
  // AQA A-level
  aqaAlvBio("1"),
  aqaAlvBio("2"),
  aqaAlvBio("3"),
  aqaAlvMaths("1"),
  aqaAlvMaths("2"),
  aqaAlvMaths("3"),
  // Edexcel and OCR maths
  edxMaths("1"),
  edxMaths("2"),
  edxMaths("3"),
  ocrMaths("1"),
  ocrMaths("2"),
  ocrMaths("3"),
  // IB, AP and KS3
  ibBio("HL"),
  ibBio("SL"),
  apBio(),
  ks3(),
  // Pending examples that the docs name explicitly.
  pending("AQA-GCSE-ENLIT-2", AQA, "GCSE", "English Literature", "ENLIT", "2", 96, "2 hours 15 minutes", "marks, sections, question count and tariff ladder"),
  pending("AQA-GCSE-HIS-1", AQA, "GCSE", "History", "HIS", "1", 52, "1 hour 45 minutes", "marks, sections, question count and tariff ladder"),
  pending("AQA-GCSE-GEO-1", AQA, "GCSE", "Geography", "GEO", "1", 88, "1 hour 30 minutes", "marks, sections, question count and tariff ladder"),
  pending("AQA-GCSE-CST-1", AQA, "GCSE", "Computer Science", "CST", "1", 90, "1 hour 30 minutes", "marks, sections, question count and tariff ladder"),
  pending("AQA-GCSE-BUS-1", AQA, "GCSE", "Business Studies", "BUS", "1", 80, "1 hour 45 minutes", "marks, sections, question count and tariff ladder"),
  pending("AQA-ALV-CHE-1", AQA, "ALV", "Chemistry", "CHE", "1", 105, "2 hours", "marks, sections, question count and tariff ladder"),
  pending("IB-IB-BIO-2-HL", "IB", "IB", "Biology", "BIO", "2", 80, "2 hours 30 minutes", "Section A/B split"),
  pending("IB-IB-BIO-2-SL", "IB", "IB", "Biology", "BIO", "2", 50, "1 hour 30 minutes", "marks, sections, question count and tariff ladder"),
  pending("UG-UG-BIO-0", "UG", "UG", "Biology", "BIO", "0", 0, "1 hour", "degree-level template"),
];

export const BLUEPRINTS: Record<string, string> = {
  "BP-SCI-GCSE-1": "AQA GCSE Biology Paper 1: ten structured lines",
  "BP-SCI-GCSE-2": "AQA GCSE Biology Paper 2: ten structured lines",
  "BP-SCI-COMB": "AQA GCSE Combined Science: eight or nine structured lines",
  "BP-MAT-GCSE": "GCSE Mathematics: domain-ordered problem solving",
  "BP-ENL-1": "AQA 8700/1: reading 4, 8, 8, 20 then writing 40",
  "BP-ENL-2": "AQA 8700/2: reading 4, 8, 8, 20 then writing 40",
  "BP-ENLIT-1": "AQA 8702/1: Shakespeare 30 + 4 AO4, then novel 30",
  "BP-RS-AQA": "AQA 8062: four blocks of 1, 2, 4, 5, 12",
  "BP-ALV-BIO": "AQA 7402: structured data and practical questions",
  "BP-ALV-BIO-3": "AQA 7402/3: Section A 53, Section B essay 25",
  "BP-ALV-MAT": "AQA 7357: pure, mechanics, statistics",
  "BP-IB-P1-HL": "IB Biology HL Paper 1: 40 MCQ + five data questions",
  "BP-IB-P1-SL": "IB Biology SL Paper 1: 30 MCQ + four data questions",
  "BP-AP-BIO": "AP Biology: 60 MCQ + six free-response questions",
  "BP-KS3": "KS3: school-style assessment, no board branding",
};

export const COVER_PROFILES: Record<string, CoverProfile> = {
  "COVER-AQA-GCSE": {
    id: "COVER-AQA-GCSE",
    blocks: [
      { heading: "Qualification", fields: ["GCSE <SUBJECT>", "Paper <N> <code>", "Time allowed: <time>"] },
      { heading: "Materials", fields: ["For this paper you must have:", "<materials>"] },
      { heading: "Instructions", fields: ["<instructions>"] },
      { heading: "Information", fields: ["The maximum mark for this paper is <marks>.", "<information>"] },
      { heading: "Advice", fields: ["<advice>"] },
    ],
  },
  "COVER-AQA-GCSE-NOCALC": {
    id: "COVER-AQA-GCSE-NOCALC",
    blocks: [
      { heading: "Qualification", fields: ["GCSE <SUBJECT>", "Paper <N> <code>", "Time allowed: <time>"] },
      { heading: "Materials", fields: ["For this paper you must have:", "mathematical instruments", "a ruler"] },
      { heading: "Instructions", fields: ["<instructions>"] },
      { heading: "Information", fields: ["The maximum mark for this paper is <marks>."] },
      { heading: "Advice", fields: ["<advice>"] },
    ],
  },
  "COVER-AQA-ENL": {
    id: "COVER-AQA-ENL",
    blocks: [
      { heading: "Qualification", fields: ["GCSE ENGLISH LANGUAGE", "Paper <N>", "Time allowed: 1 hour 45 minutes"] },
      { heading: "Materials", fields: ["a pen", "a highlighter"] },
      { heading: "Instructions", fields: ["Answer all questions.", "You are advised to plan your answer to Question 5."] },
      {
        heading: "Information",
        fields: [
          "The marks for questions are shown in brackets.",
          "The maximum mark for this paper is 80.",
          "There are 40 marks for Section A and 40 marks for Section B.",
        ],
      },
      { heading: "Advice", fields: ["You are advised to spend about 15 minutes reading the source and 1 hour 30 minutes answering the questions."] },
    ],
  },
  "COVER-EDX-GCSE": {
    id: "COVER-EDX-GCSE",
    blocks: [
      { heading: "Qualification", fields: ["Pearson Edexcel GCSE (9-1) <SUBJECT>", "Paper <N>", "Time: <time>"] },
      { heading: "Reference", fields: ["Paper Reference <code>"] },
      { heading: "Materials", fields: ["You must have:", "<materials>"] },
      { heading: "Instructions", fields: ["<instructions>"] },
      { heading: "Information", fields: ["The total mark for this paper is <marks>."] },
      { heading: "Advice", fields: ["<advice>"] },
    ],
  },
  "COVER-OCR-GCSE": {
    id: "COVER-OCR-GCSE",
    blocks: [
      { heading: "Qualification", fields: ["GCSE (9-1) <SUBJECT>", "<code>", "Time allowed: <time>"] },
      { heading: "Materials", fields: ["You must have:", "<materials>"] },
      { heading: "Instructions", fields: ["<instructions>"] },
      { heading: "Information", fields: ["The total mark for this paper is <marks>."] },
      { heading: "Advice", fields: ["<advice>"] },
    ],
  },
  "COVER-IB": {
    id: "COVER-IB",
    blocks: [
      { heading: "Qualification", fields: ["<SUBJECT>", "<level>", "Paper <N>"] },
      { heading: "Instructions", fields: ["Do not open this examination paper until instructed to do so.", "Answer all questions."] },
      { heading: "Information", fields: ["<duration>", "<marks> marks"] },
    ],
  },
  "COVER-AP": {
    id: "COVER-AP",
    blocks: [
      { heading: "Section", fields: ["<SUBJECT>", "<section>", "Time: <sectionTime>"] },
      { heading: "Directions", fields: ["<directions>"] },
    ],
  },
  "COVER-KS3": {
    id: "COVER-KS3",
    blocks: [
      { heading: "Assessment", fields: ["<SUBJECT>", "Assessment", "Time allowed: <time>", "Total marks: <marks>"] },
      { heading: "Instructions", fields: ["Answer all questions in the spaces provided."] },
    ],
  },
};

export const ACTIVE_ROWS = PAPER_ROWS.filter((entry) => entry.status === "ACTIVE");

/**
 * The command ranges from C7. A blueprint line outside these ranges is a data
 * bug, not a model failure.
 */
export const COMMAND_RANGES: Record<string, [number, number]> = {
  state: [1, 3],
  name: [1, 3],
  give: [1, 3],
  identify: [1, 3],
  list: [1, 8],
  choose: [1, 1],
  explore: [20, 40],
  "write down": [1, 3],
  describe: [2, 6],
  explain: [2, 9],
  suggest: [1, 6],
  outline: [1, 4],
  assess: [6, 25],
  find: [1, 4],
  complete: [1, 2],
  interpret: [2, 6],
  compare: [3, 8],
  contrast: [3, 8],
  calculate: [1, 6],
  "work out": [1, 6],
  analyse: [3, 10],
  deduce: [3, 10],
  evaluate: [6, 25],
  discuss: [6, 25],
  justify: [6, 25],
  prove: [2, 8],
  "show that": [2, 8],
  write: [24, 40],
};

export function commandFits(command: string, tariff: number): boolean {
  const range = COMMAND_RANGES[command.trim().toLowerCase()];
  return Boolean(range && tariff >= range[0] && tariff <= range[1]);
}

const legal = (tariff: number, preferred: string): string => {
  if (commandFits(preferred, tariff)) return preferred;
  if (commandFits("Explain", tariff)) return "Explain";
  if (commandFits("Describe", tariff)) return "Describe";
  if (commandFits("Evaluate", tariff)) return "Evaluate";
  if (commandFits("Analyse", tariff)) return "Analyse";
  if (commandFits("State", tariff)) return "State";
  return "Write";
};

const slotsFor = (subject: string): string[] => {
  const lower = subject.toLowerCase();
  if (lower.includes("biology")) return ["Cell biology", "Organisation", "Infection and response", "Bioenergetics"];
  if (lower.includes("chemistry")) return ["Atomic structure", "Bonding", "Quantitative chemistry", "Chemical changes"];
  if (lower.includes("physics")) return ["Energy", "Electricity", "Particle model", "Forces"];
  if (lower.includes("mathematics")) return ["Number", "Ratio", "Algebra", "Geometry", "Probability", "Statistics", "Mixed problem solving"];
  if (lower.includes("english language")) return ["Reading", "Reading", "Reading", "Reading", "Writing"];
  if (lower.includes("english literature")) return ["Shakespeare", "19th-century novel"];
  if (lower.includes("religious")) return ["Beliefs and teachings", "Practices", "Beliefs and teachings", "Practices"];
  return ["Specification topic", "Specification topic", "Specification topic", "Specification topic"];
};

const lineType = (bp: string, index: number, tariff: number): BlueprintLine["type"] => {
  if (bp.includes("IB") || bp.includes("AP")) return tariff === 1 ? "mcq" : "structured";
  if (bp === "BP-ENLIT-1") return "essay";
  if (bp.startsWith("BP-ENL")) return index === 4 ? "writing" : "source";
  if (bp === "BP-ALV-BIO-3" && tariff === 25) return "essay";
  if (bp === "BP-KS3") return "structured";
  return "structured";
};

const stimFor = (bp: string, index: number, tariff: number): BlueprintLine["stim"] => {
  if (bp === "BP-ENLIT-1") return "REQ";
  if (bp.startsWith("BP-ENL")) return index < 4 ? "REQ" : null;
  if (bp.includes("IB") || bp.includes("AP")) return tariff > 1 ? "REQ" : null;
  if (bp.startsWith("BP-SCI") && [1, 4, 5, 7, 8].includes(index)) return "DATA";
  if (bp === "BP-ALV-BIO-3" && index >= 2 && index <= 5) return "DATA";
  if (bp === "BP-ALV-BIO" && [1, 3, 6, 8].includes(index)) return "DATA";
  return null;
};

const commandFor = (bp: string, index: number, tariff: number): string => {
  if (bp === "BP-ENL-1" || bp === "BP-ENL-2") {
    return ["List", "Analyse", "Analyse", "Evaluate", "Write"][index] ?? "Write";
  }
  if (bp === "BP-RS-AQA") {
    return ["Give", "Explain", "Explain", "Explain", "Evaluate"][index % 5]!;
  }
  if (bp === "BP-ENLIT-1") return "Explore";
  if (bp === "BP-IB-P1-HL" || bp === "BP-IB-P1-SL") {
    return tariff === 1 ? "Choose" : index % 2 ? "Explain" : "Analyse";
  }
  if (bp === "BP-AP-BIO") {
    if (tariff === 1) return "Choose";
    if (tariff === 10) return "Analyse";
    return index % 2 ? "Explain" : "Evaluate";
  }
  if (bp === "BP-ALV-BIO-3" && tariff === 25) return "Evaluate";
  if (bp === "BP-KS3") return legal(tariff, ["State", "Describe", "Explain", "Calculate", "Suggest", "Compare", "Explain", "Evaluate"][index] ?? "Explain");
  if (bp.startsWith("BP-MAT")) {
    if (index === 5) return legal(tariff, "Prove");
    if (index === 9) return legal(tariff, "Show that");
    return legal(tariff, "Calculate");
  }
  if (bp.startsWith("BP-SCI")) {
    return legal(tariff, index === 9 ? "Evaluate" : index === 7 ? "Compare" : index === 3 ? "Calculate" : "Explain");
  }
  if (bp.startsWith("BP-ALV")) {
    return legal(tariff, tariff >= 20 ? "Evaluate" : index % 3 === 0 ? "Explain" : index % 3 === 1 ? "Analyse" : "Evaluate");
  }
  return legal(tariff, "Explain");
};

export function blueprintFor(row: IndexRow, ladder: number[]): BlueprintLine[] {
  return ladder.map((tariff, index) => {
    const line: BlueprintLine = {
      line: index + 1,
      tariff,
      command: commandFor(row.bp, index, tariff),
      slot: slotsFor(row.subject)[index % slotsFor(row.subject).length]!,
      stim: stimFor(row.bp, index, tariff),
      type: lineType(row.bp, index, tariff),
    };
    if (row.bp === "BP-ENLIT-1" && index === 0) {
      line.parts = [
        { label: "a", tariff: 30, command: "Explore" },
        { label: "b", tariff: 4, command: "Write", spag: true },
      ];
    }
    return line;
  });
}

/** The top-level question count for a particular ladder variant. */
export function questionCountFor(row: IndexRow, ladder: number[]): number {
  return ladder.length;
}
