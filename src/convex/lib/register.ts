/**
 * Per-qualification register and terminology.
 *
 * A GCSE deck must not drift into A-Level wording, and one item must not switch
 * from "selectively permeable membrane" to "partially permeable membrane" in its
 * explanation. These replacements run over generated text before it is stored.
 */

export type RegisterRule = {
  pattern: RegExp;
  replacement: string;
  reason: string;
};

const GCSE_BIOLOGY_RULES: RegisterRule[] = [
  {
    pattern: /\bwater potential\b/gi,
    replacement: "concentration of water",
    reason: "AQA GCSE uses concentration of water, not water potential.",
  },
  {
    pattern: /\bgene expression(?: changes?)?\b/gi,
    replacement: "differentiation",
    reason: "AQA GCSE uses differentiation, not gene expression.",
  },
  {
    pattern: /\bpartially permeable membrane\b/gi,
    replacement: "selectively permeable membrane",
    reason: "One preferred term per concept.",
  },
  {
    pattern: /\bcell surface membrane\b/gi,
    replacement: "cell membrane",
    reason: "One preferred term per concept.",
  },
];

const GLOSSARY: RegisterRule[] = [
  {
    pattern: /\bpartially permeable membrane\b/gi,
    replacement: "selectively permeable membrane",
    reason: "Use the course's preferred term in stems and explanations.",
  },
  {
    pattern: /\bcell surface membrane\b/gi,
    replacement: "cell membrane",
    reason: "Use the course's preferred term in stems and explanations.",
  },
];

const BIOLOGY = /biology|combined science/i;

/**
 * Terms that belong to a later qualification, even if a student's own notes
 * happen to mention them. The quiz may not test these at GCSE.
 */
const OFF_SPEC_TERMS: Partial<Record<string, Record<string, string[]>>> = {
  GCSE: {
    Biology: ["centriole", "centrioles"],
    "Combined Science": ["centriole", "centrioles"],
  },
};

/** The first off-spec term in an answer, or null when it is in register. */
export function findOffSpecTerm(
  text: string,
  level?: string,
  subject?: string,
): string | null {
  if (!level || !subject) return null;
  const terms = OFF_SPEC_TERMS[level]?.[subject] ?? [];
  for (const term of terms) {
    const pattern = new RegExp(`\\b${term}\\b`, "i");
    if (pattern.test(text)) return term;
  }
  return null;
}

/** Rules that apply to this course. */
export function registerRulesFor(level?: string, subject?: string): RegisterRule[] {
  if (level === "GCSE" && BIOLOGY.test(subject ?? "")) {
    return [...GCSE_BIOLOGY_RULES, ...GLOSSARY];
  }
  return GLOSSARY;
}

/** Applies the banned-term and glossary replacements to one string. */
export function applyRegister(
  text: string,
  level?: string,
  subject?: string,
): string {
  let next = text;
  for (const rule of registerRulesFor(level, subject)) {
    next = next.replace(rule.pattern, rule.replacement);
  }
  return next;
}

/** The banned terms still present in a text, for generation-time rejection. */
export function findRegisterLeaks(
  text: string,
  level?: string,
  subject?: string,
): string[] {
  const leaks: string[] = [];
  for (const rule of registerRulesFor(level, subject)) {
    const flags = rule.pattern.flags.includes("g")
      ? rule.pattern.flags
      : `${rule.pattern.flags}g`;
    const pattern = new RegExp(rule.pattern.source, flags);
    const match = pattern.exec(text);
    if (match) leaks.push(match[0]);
  }
  return [...new Set(leaks)];
}

/** Applies the same replacements to every string in a generated object. */
export function cleanGeneratedText<T>(
  value: T,
  level?: string,
  subject?: string,
): T {
  if (typeof value === "string") return applyRegister(value, level, subject) as T;
  if (Array.isArray(value)) {
    return value.map((entry) => cleanGeneratedText(entry, level, subject)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        cleanGeneratedText(entry, level, subject),
      ]),
    ) as T;
  }
  return value;
}
