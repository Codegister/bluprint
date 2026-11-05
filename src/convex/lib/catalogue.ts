/**
 * The one qualification catalogue for study sets and papers.
 *
 * The picker, the course mutation and the papers index all read qualification
 * facts from here instead of keeping their own lists. A qualification that has
 * no paper shape is still listed, with the reason recorded in data, so the two
 * flows cannot silently offer different registrations.
 */

import { COVERAGE_SUBJECTS } from "./coverageMatrix";

export const STUDY_LEVELS = [
  "GCSE",
  "IGCSE",
  "KS3",
  "AS",
  "A-Level",
  "IB",
  "AP",
  "National 5",
  "Higher",
  "Undergraduate",
] as const;

export type StudyLevel = (typeof STUDY_LEVELS)[number];

export type SubjectAvailability =
  | { state: "offered"; subject: string }
  | {
      state: "renamed";
      subject: string;
      /** The name the awarding body uses for the same qualification. */
      storedAs: string;
      note: string;
    }
  | { state: "not-offered"; subject: string; note: string };

export type Qualification = {
  level: StudyLevel;
  hint: string;
  /** Boards the picker may show. Empty means the qualification has one body. */
  boards: string[];
  /** The body stored when no board question is asked. */
  awardingBody: string;
  /** Whether the papers flow has an indexed shape for this qualification. */
  papers: "offered" | "not-built";
  paperReason?: string;
};

const COMMON_BOARDS = ["AQA", "Pearson Edexcel", "OCR", "WJEC / Eduqas"];

export const QUALIFICATIONS: Qualification[] = [
  {
    level: "GCSE",
    hint: "Years 10–11",
    boards: COMMON_BOARDS,
    awardingBody: "AQA",
    papers: "offered",
  },
  {
    level: "IGCSE",
    hint: "International GCSE",
    boards: ["Cambridge International", "Edexcel International"],
    awardingBody: "Cambridge International",
    papers: "not-built",
    paperReason:
      "The papers index has no IGCSE ladder; sets can still map an IGCSE course.",
  },
  {
    level: "KS3",
    hint: "Years 7–9",
    boards: ["None"],
    awardingBody: "None",
    papers: "offered",
  },
  {
    level: "AS",
    hint: "First year of A-level",
    boards: COMMON_BOARDS,
    awardingBody: "AQA",
    papers: "not-built",
    paperReason:
      "AS uses the A-Level subject content but the index records full A-Level papers, not AS papers.",
  },
  {
    level: "A-Level",
    hint: "Years 12–13",
    boards: COMMON_BOARDS,
    awardingBody: "AQA",
    papers: "offered",
  },
  {
    level: "IB",
    hint: "HL and SL",
    boards: ["IB"],
    awardingBody: "IB",
    papers: "offered",
  },
  {
    level: "AP",
    hint: "Advanced Placement",
    boards: ["College Board"],
    awardingBody: "College Board",
    papers: "offered",
  },
  {
    level: "National 5",
    hint: "SQA National 5",
    boards: ["SQA"],
    awardingBody: "SQA",
    papers: "not-built",
    paperReason:
      "The papers index records SQA only as a mapped A-Level route; no National 5 paper ladder exists.",
  },
  {
    level: "Higher",
    hint: "SQA Higher",
    boards: ["SQA"],
    awardingBody: "SQA",
    papers: "not-built",
    paperReason:
      "The papers index records SQA only as a mapped A-Level route; no Higher paper ladder exists.",
  },
  {
    level: "Undergraduate",
    hint: "University",
    boards: ["Other"],
    awardingBody: "Other",
    papers: "offered",
  },
];

export function qualificationFor(level: string): Qualification | undefined {
  return QUALIFICATIONS.find((entry) => entry.level === level.trim());
}

export function normaliseStudyLevel(level: string | undefined | null): StudyLevel | null {
  if (!level) return null;
  const clean = level.trim().toLowerCase();
  return (
    STUDY_LEVELS.find((entry) => entry.toLowerCase() === clean) ?? null
  );
}

const SCIENCE = [
  "Biology",
  "Chemistry",
  "Physics",
  "Combined Science",
  "Environmental Science",
];

const GCSE_SUBJECTS = new Set<string>([
  ...SCIENCE.filter((subject) => subject !== "Environmental Science"),
  "Mathematics",
  "Statistics",
  "Computer Science",
  "History",
  "Geography",
  "Economics",
  "Business Studies",
  "Psychology",
  "Sociology",
  "Religious Studies",
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
]);

const IGCSE_SUBJECTS = new Set<string>([
  ...GCSE_SUBJECTS,
  "Environmental Science",
  "Information Technology",
]);

const KS3_SUBJECTS = new Set<string>([
  "Biology",
  "Chemistry",
  "Physics",
  "Combined Science",
  "Mathematics",
  "Computer Science",
  "History",
  "Geography",
  "Religious Studies",
  "English Language",
  "English Literature",
  "French",
  "Spanish",
  "German",
  "Mandarin",
  "Art & Design",
  "Music",
  "Drama",
  "Design & Technology",
  "Food Preparation & Nutrition",
  "Physical Education",
]);

const A_LEVEL_SUBJECTS = new Set<string>([
  ...SCIENCE,
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
  "Accounting",
]);

const IB_SUBJECTS = new Set<string>([
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

const AP_SUBJECTS = new Set<string>([
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

const SQA_SUBJECTS = new Set<string>([
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
  "Business Studies",
  "Psychology",
  "Sociology",
  "Politics",
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
]);

const UNDERGRADUATE_SUBJECTS = new Set<string>(
  COVERAGE_SUBJECTS.filter(
    (subject) => subject !== "Combined Science" && subject !== "Theory of Knowledge",
  ),
);

// AS shares A-Level content, but Law and Accounting are full A-Level courses
// in this catalogue rather than AS qualifications.
const AS_SUBJECTS = new Set<string>(
  [...A_LEVEL_SUBJECTS].filter(
    (subject) => subject !== "Law" && subject !== "Accounting",
  ),
);

const SUBJECTS_BY_LEVEL: Record<StudyLevel, Set<string>> = {
  GCSE: GCSE_SUBJECTS,
  IGCSE: IGCSE_SUBJECTS,
  KS3: KS3_SUBJECTS,
  AS: AS_SUBJECTS,
  "A-Level": A_LEVEL_SUBJECTS,
  IB: IB_SUBJECTS,
  AP: AP_SUBJECTS,
  "National 5": SQA_SUBJECTS,
  Higher: SQA_SUBJECTS,
  Undergraduate: UNDERGRADUATE_SUBJECTS,
};

/**
 * Subjects that exist at a level under a different awarding-body name. The
 * picker shows the familiar name and the note; the server stores `storedAs` so
 * the pathway prompt asks for the real qualification.
 */
const RENAMED: Partial<Record<StudyLevel, Record<string, { storedAs: string; note: string }>>> = {
  GCSE: {
    Photography: {
      storedAs: "Art & Design: Photography",
      note: "GCSE Art & Design: Photography",
    },
  },
  IGCSE: {
    Photography: {
      storedAs: "Art & Design: Photography",
      note: "Cambridge IGCSE Art & Design: Photography",
    },
  },
  "A-Level": {
    Photography: {
      storedAs: "Art & Design: Photography",
      note: "A-Level Art & Design: Photography",
    },
    "Food Preparation & Nutrition": {
      storedAs: "Food Science and Nutrition",
      note: "A-Level Food Science and Nutrition",
    },
  },
  IB: {
    "Environmental Science": {
      storedAs: "Environmental Systems and Societies",
      note: "IB Environmental Systems and Societies",
    },
    "Business Studies": {
      storedAs: "Business Management",
      note: "IB Business Management",
    },
    "English Language": {
      storedAs: "English A: Language and Literature",
      note: "IB English A: Language and Literature",
    },
    "English Literature": {
      storedAs: "English A: Literature",
      note: "IB English A: Literature",
    },
    Drama: { storedAs: "Theatre", note: "IB Theatre" },
    "Physical Education": {
      storedAs: "Sports, Exercise and Health Science",
      note: "IB Sports, Exercise and Health Science",
    },
  },
  AP: {
    Politics: {
      storedAs: "U.S. Government and Politics",
      note: "AP U.S. Government and Politics",
    },
    "English Language": {
      storedAs: "English Language and Composition",
      note: "AP English Language and Composition",
    },
    "English Literature": {
      storedAs: "English Literature and Composition",
      note: "AP English Literature and Composition",
    },
    "Art & Design": { storedAs: "Studio Art", note: "AP Studio Art" },
    Music: { storedAs: "Music Theory", note: "AP Music Theory" },
    Latin: { storedAs: "Latin", note: "AP Latin" },
  },
  "National 5": {
    "Business Studies": { storedAs: "Business Management", note: "SQA Business Management" },
    Photography: { storedAs: "Art and Design: Photography", note: "SQA Art and Design: Photography" },
  },
  Higher: {
    "Business Studies": { storedAs: "Business Management", note: "SQA Business Management" },
    Photography: { storedAs: "Art and Design: Photography", note: "SQA Art and Design: Photography" },
  },
};

const NOT_OFFERED_REASONS: Partial<Record<StudyLevel, Record<string, string>>> = {
  GCSE: {
    "Theory of Knowledge": "Theory of Knowledge is an IB Diploma core subject.",
    Law: "Law is an A-Level subject, not a GCSE.",
    Accounting: "Accounting is an A-Level subject, not a GCSE.",
    Engineering: "Engineering is not offered as a GCSE in this catalogue.",
    "Health & Social Care": "Health & Social Care is not offered as a GCSE.",
    Philosophy: "Philosophy is studied through GCSE Religious Studies.",
    "Information Technology": "Information Technology is not offered as a GCSE.",
    "Further Mathematics": "Further Mathematics is not a GCSE subject.",
    "Environmental Science": "Environmental Science is not offered as a GCSE.",
    Politics: "Politics is not offered as a GCSE.",
  },
  IGCSE: {
    "Theory of Knowledge": "Theory of Knowledge is an IB Diploma core subject.",
    Law: "Law is not offered as an IGCSE in this catalogue.",
    Accounting: "Accounting is not offered as an IGCSE in this catalogue.",
    Engineering: "Engineering is not offered as an IGCSE in this catalogue.",
    "Health & Social Care": "Health & Social Care is not offered as an IGCSE.",
    Philosophy: "Philosophy is not offered as an IGCSE.",
    "Further Mathematics": "Use IGCSE Mathematics; Further Mathematics is not offered here.",
    Politics: "Politics is not offered as an IGCSE.",
  },
  KS3: {
    "Theory of Knowledge": "Theory of Knowledge is an IB Diploma core subject.",
    Law: "Law is not a KS3 subject.",
    Accounting: "Accounting is not a KS3 subject.",
    Engineering: "Engineering is not a KS3 subject in this catalogue.",
    "Health & Social Care": "Health & Social Care is not a KS3 subject.",
    Philosophy: "Philosophy is not a KS3 subject.",
    "Information Technology": "Use KS3 Computer Science for this curriculum.",
  },
  AS: {
    Law: "Law is a full A-Level course, not an AS qualification in this catalogue.",
    Accounting:
      "Accounting is a full A-Level course, not an AS qualification in this catalogue.",
    "Theory of Knowledge": "Theory of Knowledge is an IB Diploma core subject.",
  },
  "A-Level": {
    "Theory of Knowledge": "Theory of Knowledge is an IB Diploma core subject.",
    "Combined Science": "A-Level sciences are separate subjects.",
    "Information Technology": "A-Level Computer Science covers this curriculum.",
    "Health & Social Care": "Health & Social Care is not an A-Level subject here.",
    Engineering: "Engineering is not offered as an A-Level in this catalogue.",
  },
  IB: {
    Law: "Law is not an IB Diploma subject in this catalogue.",
    Accounting: "Accounting is not an IB Diploma subject in this catalogue.",
    Engineering: "Engineering is not an IB Diploma subject in this catalogue.",
    "Health & Social Care": "Health & Social Care is not an IB Diploma subject.",
    "Information Technology": "Use IB Computer Science for this curriculum.",
    "Combined Science": "IB sciences are separate subjects.",
  },
  AP: {
    "Theory of Knowledge": "Theory of Knowledge is an IB Diploma core subject.",
    Law: "AP does not offer Law in this catalogue.",
    Accounting: "AP does not offer Accounting in this catalogue.",
    Engineering: "AP does not offer Engineering in this catalogue.",
    "Health & Social Care": "AP does not offer Health & Social Care.",
    "Information Technology": "Use AP Computer Science for this curriculum.",
    "Combined Science": "AP sciences are separate subjects.",
    "Business Studies": "AP does not offer Business Studies.",
    Sociology: "AP does not offer Sociology in this catalogue.",
    "Further Mathematics": "Use AP Mathematics; Further Mathematics is not offered here.",
  },
  "National 5": {
    "Theory of Knowledge": "Theory of Knowledge is an IB Diploma core subject.",
    Law: "Law is not offered at National 5 in this catalogue.",
    Accounting: "Accounting is not offered at National 5 in this catalogue.",
    Engineering: "Engineering is not offered at National 5 in this catalogue.",
    "Health & Social Care": "Health & Social Care is not offered at National 5.",
    "Information Technology": "Use National 5 Computing Science.",
    "Combined Science": "SQA sciences are separate subjects.",
    "Further Mathematics": "Use National 5 Mathematics; Further Mathematics is not offered here.",
  },
  Higher: {
    "Theory of Knowledge": "Theory of Knowledge is an IB Diploma core subject.",
    Law: "Law is not offered at Higher in this catalogue.",
    Accounting: "Accounting is not offered at Higher in this catalogue.",
    Engineering: "Engineering is not offered at Higher in this catalogue.",
    "Health & Social Care": "Health & Social Care is not offered at Higher.",
    "Information Technology": "Use Higher Computing Science.",
    "Combined Science": "SQA sciences are separate subjects.",
    "Further Mathematics": "Use Higher Mathematics; Further Mathematics is not offered here.",
  },
};

export function subjectAvailability(
  level: string,
  subject: string,
): SubjectAvailability {
  const clean = subject.trim();
  const resolved = normaliseStudyLevel(level);
  if (!resolved) {
    return {
      state: "not-offered",
      subject: clean,
      note: "Choose a qualification from the catalogue first.",
    };
  }
  if (SUBJECTS_BY_LEVEL[resolved].has(clean)) {
    return { state: "offered", subject: clean };
  }
  const renamed = RENAMED[resolved]?.[clean];
  if (renamed) return { state: "renamed", subject: clean, ...renamed };
  // Accept the awarding body's stored name as well as the picker label, so a
  // course already saved as "Art & Design: Photography" stays valid on edit.
  const storedRename = Object.values(RENAMED[resolved] ?? {}).find(
    (entry) => entry.storedAs === clean,
  );
  if (storedRename) {
    return {
      state: "renamed",
      subject: clean,
      storedAs: storedRename.storedAs,
      note: storedRename.note,
    };
  }
  return {
    state: "not-offered",
    subject: clean,
    note:
      NOT_OFFERED_REASONS[resolved]?.[clean] ??
      `${clean} is not offered at ${resolved} in this catalogue.`,
  };
}

export function allSubjectsForLevel(level: string): SubjectAvailability[] {
  return COVERAGE_SUBJECTS.map((subject) => subjectAvailability(level, subject));
}

export function isSubjectOffered(level: string, subject: string): boolean {
  return subjectAvailability(level, subject).state !== "not-offered";
}

/** The name a course should store, which differs for renamed qualifications. */
export function canonicalSubject(level: string, subject: string): string {
  const availability = subjectAvailability(level, subject);
  return availability.state === "renamed" ? availability.storedAs : availability.subject;
}

const GCSE_TIERED_SUBJECTS = new Set([
  "mathematics",
  "maths",
  "statistics",
  "biology",
  "chemistry",
  "physics",
  "combined science",
  "french",
  "spanish",
  "german",
  "mandarin",
  "latin",
]);

export function tierChoicesFor(
  level: string,
  subject: string,
): { variants: string[]; tiers: string[] } {
  const cleanLevel = normaliseStudyLevel(level);
  const key = subject.trim().toLowerCase();
  if (cleanLevel === "GCSE") {
    return {
      variants: [],
      tiers: GCSE_TIERED_SUBJECTS.has(key) ? ["Higher", "Foundation"] : [],
    };
  }
  if (cleanLevel === "IGCSE") {
    return {
      variants: [],
      tiers: /mathematics|maths|biology|chemistry|physics/.test(key)
        ? ["Core", "Extended"]
        : [],
    };
  }
  if (cleanLevel === "IB") return { variants: ["HL", "SL"], tiers: [] };
  return { variants: [], tiers: [] };
}

export function boardsForLevel(level: string): string[] {
  return qualificationFor(level)?.boards ?? [];
}

export function defaultBoardFor(level: string): string {
  const qualification = qualificationFor(level);
  if (!qualification) return "AQA";
  return qualification.boards[0] ?? qualification.awardingBody;
}

export function requiresBoardQuestion(level: string): boolean {
  return boardsForLevel(level).length > 1;
}

/**
 * Server-side validation for everything the picker can send. The UI disables
 * impossible combinations; this is the boundary that makes that true even for
 * a direct mutation.
 */
export function validateStudySelection(input: {
  level: string;
  subject: string;
  examBoard?: string;
  tier?: string;
  variant?: string;
}): { level: StudyLevel; subject: string; examBoard: string } {
  const level = normaliseStudyLevel(input.level);
  if (!level) throw new Error("Choose a qualification from the catalogue first.");

  const subject = input.subject.trim();
  const availability = subjectAvailability(level, subject);
  if (availability.state === "not-offered") {
    throw new Error(availability.note);
  }

  const boards = boardsForLevel(level);
  const fallback = defaultBoardFor(level);
  // A qualification with one body ignores a stale board field; the body the
  // qualification actually uses is the one that gets stored.
  const examBoard =
    boards.length === 1 ? boards[0]! : input.examBoard?.trim() || fallback;
  if (boards.length > 1 && !boards.includes(examBoard)) {
    throw new Error(`${examBoard} does not award ${level}.`);
  }

  const choices = tierChoicesFor(level, subject);
  if (input.tier) {
    if (level === "IB") {
      throw new Error("IB uses HL and SL as separate courses, not tiers.");
    }
    if (!choices.tiers.includes(input.tier)) {
      throw new Error(`${subject} is not tiered at ${level}. Choose no tier.`);
    }
  }
  if (input.variant) {
    if (!choices.variants.includes(input.variant)) {
      throw new Error(`${input.variant} is not a route for ${subject} at ${level}.`);
    }
  }

  return { level, subject, examBoard };
}
