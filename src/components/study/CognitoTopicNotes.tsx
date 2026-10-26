import { EASE } from "@/components/motion/Motion";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { useAction, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { BookOpen, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * The published notes for one pathway topic, read from Cognito and shown here
 * rather than linking out. A topic's notes are several subtopic pages, so the
 * first open reads them once and the copy is then served from the database.
 */
export function CognitoTopicNotes({
  courseId,
  topicId,
  onClose,
}: {
  courseId: Id<"courses">;
  topicId: string;
  onClose: () => void;
}) {
  const cached = useQuery(api.cognitoLibrary.getTopicNotes, { courseId, topicId });
  const load = useAction(api.cognitoLibrary.loadTopicNotes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await load({ courseId, topicId });
    } catch (cause) {
      setError(readableError(cause, "Cognito's notes could not be read just now."));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    // Open the notes immediately; only the first visit does the scraping.
    if (started.current || cached === undefined || cached !== null) return;
    started.current = true;
    void run();
  });

  const sections = cached?.sections ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="mt-2 rounded-2xl border border-border bg-white px-4 py-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-[#6B4EE6]">
            Topic notes
          </p>
          <p className="mt-0.5 text-[0.78rem] font-semibold text-brand-ink">
            Read here, from Cognito&apos;s published notes
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full px-2 py-1 text-[0.7rem] font-semibold text-muted-foreground hover:bg-white hover:text-brand-ink"
        >
          Close
        </button>
      </div>

      {(busy || cached === undefined) && (
        <p className="mt-3 flex items-center gap-2 text-[0.78rem] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Reading the published notes…
        </p>
      )}

      {error && (
        <motion.div
          key={error}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="mt-3 rounded-xl bg-[#FFF6E5] px-3 py-2.5"
        >
          <p className="text-[0.78rem] leading-relaxed text-[#8A5D00]">{error}</p>
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[0.72rem] font-semibold text-[#8A5D00]"
          >
            <RotateCcw className="size-3" aria-hidden />
            Try again
          </button>
        </motion.div>
      )}

      {!busy && !error && cached && sections.length === 0 && (
        <p className="mt-3 flex items-start gap-2 text-[0.78rem] leading-relaxed text-muted-foreground">
          <BookOpen className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Cognito does not publish separate notes for this topic, so there is
          nothing to read here yet. Use the topic summary and key points above.
        </p>
      )}

      {!busy && !error && sections.length > 0 && (
        <div className="rise-stagger mt-3 max-h-[26rem] space-y-4 overflow-y-auto pr-1">
          {sections.map((section, index) => (
            <div key={`${section.heading}-${index}`}>
              <h4 className="font-display text-[0.88rem] font-bold text-brand-ink">
                {section.heading}
              </h4>
              <div className="mt-1 space-y-1.5">
                {section.blocks.map((line, lineIndex) => (
                  <p
                    key={`${line.slice(0, 24)}-${lineIndex}`}
                    className="text-[0.8rem] leading-relaxed text-brand-ink/75"
                  >
                    {line}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {cached && cached.sources.length > 0 && (
        <p className="mt-3 text-[0.68rem] leading-relaxed text-muted-foreground">
          {cached.sections.length} note sections from Cognito ·{" "}
          {cached.sources.length} subtopic
          {cached.sources.length === 1 ? "" : "s"} · checked{" "}
          {new Date(cached.fetchedAt).toLocaleDateString()}
        </p>
      )}
    </motion.div>
  );
}
