/**
 * Export formats.
 *
 * The privacy page promises the student owns their content, so every format is
 * generated from the same data the app shows and nothing is held back. CSV is
 * for spreadsheets; the Anki file is Anki's own tab-separated import format,
 * which imports directly through File → Import (a binary .apkg would need a
 * SQLite writer on the server for no extra data). The account export is JSON so
 * nothing is lost to formatting.
 */

export type ExportCard = { front: string; back: string };

/** Quotes a CSV field only when it needs it, doubling any inner quote. */
export function csvField(value: string): string {
  const clean = value.replace(/\r\n/g, "\n");
  return /[",\n]/.test(clean) ? `"${clean.replace(/"/g, '""')}"` : clean;
}

export function cardsToCsv(cards: ExportCard[]): string {
  const rows = [["Front", "Back"], ...cards.map((card) => [card.front, card.back])];
  return rows.map((row) => row.map(csvField).join(",")).join("\r\n");
}

/** Removes the characters that would break Anki's line-based import. */
function ankiField(value: string): string {
  return value.replace(/\t/g, " ").replace(/\r?\n/g, "<br>").trim();
}

/**
 * Anki's plain-text import file. The header lines are Anki's own directives, so
 * front/back map to the first two fields of a Basic note.
 */
export function cardsToAnkiText(cards: ExportCard[]): string {
  const header = ["#separator:tab", "#html:true", "#columns:Front\tBack", "#tags column:3"];
  const rows = cards.map((card) => `${ankiField(card.front)}\t${ankiField(card.back)}\tbluprint`);
  return [...header, ...rows].join("\n");
}

export type AccountExportSet = {
  title: string;
  course?: string;
  examBoard?: string;
  level?: string;
  notes?: string;
  createdAt: number;
  summary?: unknown;
  cards: ExportCard[];
  quiz: Array<{
    question: string;
    options?: string[];
    answer?: string;
    explanation?: string;
    lastAnswer?: string;
    lastCorrect?: boolean;
  }>;
  exam: Array<{
    question: string;
    marks: number;
    modelAnswer: string;
    criteria?: Array<{ marks: number; text: string }>;
    answer?: string;
    awardedMarks?: number;
    checklist?: Array<{ point: string; marks: number; awarded: number; evidence: string }>;
  }>;
};

/**
 * The full account export. The wrapper carries the date and the schema version
 * so an import written later knows what it is reading.
 */
export function accountExportJson(input: {
  email?: string | null;
  name?: string | null;
  exportedAt: number;
  sets: AccountExportSet[];
  streak?: { current: number; activeDays: number } | null;
  shares?: number;
}): string {
  return JSON.stringify(
    {
      app: "Bluprint",
      format: "bluprint-account",
      version: 1,
      exportedAt: new Date(input.exportedAt).toISOString(),
      account: { email: input.email ?? null, name: input.name ?? null },
      streak: input.streak ?? null,
      studySets: input.sets,
    },
    null,
    2,
  );
}

/** Triggers a browser download without leaving the page. */
export function downloadTextFile(
  filename: string,
  content: string,
  mime = "text/plain;charset=utf-8",
): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** `Photosynthesis and active transport` → `photosynthesis-and-active-transport`. */
export function exportSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "bluprint"
  );
}
