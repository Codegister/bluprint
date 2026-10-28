import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { notifyError } from "@/lib/errors";
import {
  cardsToAnkiText,
  cardsToCsv,
  downloadTextFile,
  exportSlug,
} from "@/lib/studyExport";
import { useQuery } from "convex/react";
import { Download, FileJson } from "lucide-react";
import { useState } from "react";

/**
 * Exports for one set: the cards as CSV, and as Anki's tab-separated import
 * file (Anki imports it directly from File → Import; a binary .apkg would need
 * a SQLite writer for the same data). The privacy page promises the content is
 * the student's, and this is where they get it.
 */
export function SetExportButtons({ setId }: { setId: Id<"studySets"> }) {
  const data = useQuery(api.exports.forSet, { setId });
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (kind: "csv" | "anki" | "json") => {
    if (!data) return;
    setBusy(kind);
    try {
      const slug = exportSlug(data.title);
      if (kind === "csv") {
        downloadTextFile(`${slug}-cards.csv`, cardsToCsv(data.cards), "text/csv;charset=utf-8");
      } else if (kind === "anki") {
        downloadTextFile(`${slug}-anki.txt`, cardsToAnkiText(data.cards));
      } else {
        downloadTextFile(
          `${slug}.json`,
          JSON.stringify(data, null, 2),
          "application/json",
        );
      }
    } catch (error) {
      notifyError(error, "Could not build that export.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <details className="rounded-2xl border border-border bg-card p-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[0.86rem] font-semibold text-brand-ink">
        <Download className="size-4 text-chrome-7" aria-hidden />
        Export this set
      </summary>
      <p className="mt-2 text-[0.76rem] leading-relaxed text-muted-foreground">
        CSV for a spreadsheet, an Anki import file for spaced repetition, or the
        full set as JSON including your answers and marks.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(
          [
            ["csv", "Cards (CSV)"],
            ["anki", "Anki file"],
            ["json", "Everything (JSON)"],
          ] as const
        ).map(([kind, label]) => (
          <button
            key={kind}
            type="button"
            onClick={() => void run(kind)}
            disabled={!data || busy !== null}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-[0.74rem] font-semibold text-brand-ink/80 transition-colors hover:bg-brand-panel disabled:opacity-60"
          >
            <FileJson className="size-3.5" aria-hidden />
            {busy === kind ? "Building…" : label}
          </button>
        ))}
      </div>
    </details>
  );
}
