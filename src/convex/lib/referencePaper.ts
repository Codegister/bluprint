/**
 * A real past paper used as the format reference for a generated practice
 * paper.
 *
 * Only the paper's structure is read: the question labels, their mark values,
 * command words and section breaks. The questions themselves are never stored
 * or sent to the model, because published papers are copyrighted. The model is
 * asked to write original questions in the same shape.
 */

export type ReferencePaper = {
  year: string;
  label: string;
  questionUrl: string;
  markSchemeUrl?: string;
};

export type ReferenceQuestion = {
  /** The label as printed in the paper, e.g. "0 1 . 1" or "1 (a)". */
  label: string;
  marks: number;
  command?: string;
  section?: string;
};

export type ReferenceFormat = {
  questions: ReferenceQuestion[];
  totalMarks: number;
};

const COMMAND_WORDS = new Set([
  "analyse",
  "analyze",
  "calculate",
  "choose",
  "compare",
  "complete",
  "contrast",
  "define",
  "describe",
  "determine",
  "discuss",
  "evaluate",
  "explain",
  "give",
  "identify",
  "justify",
  "name",
  "outline",
  "predict",
  "show",
  "state",
  "suggest",
  "use",
  "write",
]);

/**
 * The labels boards print at the start of a question or part. AQA's labels
 * can follow page furniture on the same line ("box0 1 . 4"), so they are
 * matched anywhere; a plain number is only accepted at the start of a line.
 */
const LABEL_RE =
  /((?<![0-9])0[ \t]+[1-9](?:[ \t]*\.[ \t]*[1-9])?|[0-9]{1,2}[ \t]*\([a-z]\)|(?:^|\n)[ \t]*[0-9]{1,2}[ \t]+(?=[A-Z(]))/g;

/** A mark printed as "(4 marks)" or "[4 marks]". */
const MARK_RE =
  /(?:\(\s*(\d{1,3})\s*marks?\s*\)|\[\s*(\d{1,3})\s*marks?\s*\])/gi;

function sectionAt(text: string, index: number): string | undefined {
  const headings = [
    ...text.slice(0, index).matchAll(/(?:^|\n)\s*(Section [A-Z])\b[^\n]*/g),
  ];
  const last = headings[headings.length - 1]?.[1];
  return last?.trim();
}

function commandAt(text: string, labelEnd: number, markIndex: number): string | undefined {
  const after = text.slice(labelEnd, markIndex).trimStart();
  const first = /^([A-Za-z]+)/.exec(after)?.[1]?.toLowerCase();
  return first && COMMAND_WORDS.has(first) ? first : undefined;
}

/**
 * Reads a question paper's shape from its extracted text.
 *
 * This deliberately ignores the question wording. Each mark notation is paired
 * with the nearest question label before it, which is how both AQA's
 * "0 1 . 1" numbering and Edexcel's "1 (a)" numbering are parsed. Returns null
 * when the file does not look like a question paper, so the caller can fall
 * back to the subject blueprint.
 */
export function parseReferencePaperFormat(text: string): ReferenceFormat | null {
  const clean = text.replace(/\r/g, "\n");
  if (clean.length < 80) return null;

  const questions: ReferenceQuestion[] = [];
  const seen = new Set<string>();
  const declared = /(?:maximum mark for this paper is|total mark for this paper is|total for this paper is|total number of marks available for this paper is)\s*(\d{1,3})/i.exec(
    clean,
  );
  const declaredTotal = declared ? Number(declared[1]) : undefined;

  for (const match of clean.matchAll(MARK_RE)) {
    const marks = Number(match[1] ?? match[2]);
    if (!Number.isFinite(marks) || marks < 1 || marks > 100) continue;
    const index = match.index ?? 0;
    const before = clean.slice(Math.max(0, index - 140), index);
    // A total line repeats a question's marks without being a question.
    if (/total for question|maximum mark|total mark|mark scheme/i.test(before)) {
      continue;
    }

    const start = Math.max(0, index - 1400);
    const nearby = clean.slice(start, index);
    const labels = [...nearby.matchAll(LABEL_RE)];
    const labelMatch = labels[labels.length - 1];
    if (!labelMatch) continue;

    const rawLabel = labelMatch[1];
    if (!rawLabel) continue;
    const label = rawLabel.replace(/\s+/g, " ").trim();
    if (seen.has(label)) continue;
    seen.add(label);

    const labelStart = start + (labelMatch.index ?? 0);
    const labelEnd = labelStart + labelMatch[0].length;
    const section = sectionAt(clean, labelStart);
    const command = commandAt(clean, labelEnd, index);

    questions.push({
      label,
      marks,
      ...(command ? { command } : {}),
      ...(section ? { section } : {}),
    });
  }

  if (questions.length < 2) return null;
  const totalMarks = questions.reduce((sum, question) => sum + question.marks, 0);
  if (totalMarks < 5 || totalMarks > 500) return null;
  // A real paper prints its own total. If the parser missed or double-counted
  // a part, the structure is wrong; the subject blueprint is safer than a
  // half-read reference.
  if (declaredTotal !== undefined && totalMarks !== declaredTotal) return null;

  // A PDF whose text repeats a paper's questions or rubric can produce an
  // implausible number of marks; a real GCSE/A-level paper is far below this.
  if (questions.length > 80) return null;

  return { questions, totalMarks };
}

/** A compact, non-copyright description of the reference for the model. */
export function referenceFormatBrief(
  reference: ReferencePaper,
  format: ReferenceFormat,
): string {
  const lines = [
    `REFERENCE PAPER — ${reference.year} · ${reference.label}`,
    `Source: ${reference.questionUrl}`,
    "Use this real paper only as a structural reference. Do not copy, quote or paraphrase its questions, data or wording.",
    "Mirror its question count, order, mark values, command words and section breaks exactly.",
    "STRUCTURE READ FROM THE REFERENCE:",
    ...format.questions.map(
      (question) =>
        `${question.label} — ${question.marks} mark${question.marks === 1 ? "" : "s"}${question.command ? ` — ${question.command}` : ""}${question.section ? ` — ${question.section}` : ""}`,
    ),
    `Total: ${format.totalMarks} marks across ${format.questions.length} questions.`,
  ];
  return lines.join("\n");
}

/**
 * Downloads a real paper and extracts its format. Returns null on any failure:
 * a missing or encrypted PDF must never stop a practice paper being built.
 */
export async function loadReferenceFormat(
  reference: ReferencePaper,
): Promise<ReferenceFormat | null> {
  let url: URL;
  try {
    url = new URL(reference.questionUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Bluprint revision paper reference" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return null;

    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > 25 * 1024 * 1024) return null;

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > 25 * 1024 * 1024) {
      return null;
    }

    // Loaded lazily so the browser bundle never includes the PDF parser.
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const extracted = await extractText(pdf, { mergePages: true });
    const text = Array.isArray(extracted.text)
      ? extracted.text.join("\n")
      : extracted.text;
    return parseReferencePaperFormat(text);
  } catch (error) {
    console.error("Could not read reference paper", reference.questionUrl, error);
    return null;
  }
}
