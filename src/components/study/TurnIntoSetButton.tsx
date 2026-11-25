import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { tutorReplyCounts } from "@/lib/tutorMaterial";
import { useMutation } from "convex/react";
import { ArrowRight, Layers3, Loader2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

/**
 * Turns the tutor's study material into a real set.
 *
 * The model writes the material in the reply; this button is the deliberate
 * step that spends a build. The reply itself is the source, so pasted notes
 * the student asked the tutor to organise reach the build even though no course
 * topic was named.
 */
export function TurnIntoSetButton({
  notes,
  onBuilt,
}: {
  notes: string;
  /** Saves the new set on the reply it came from, so the offer is not repeated. */
  onBuilt?: (setId: Id<"studySets">) => Promise<unknown>;
}) {
  const createSet = useMutation(api.studySets.create);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const build = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const counts = tutorReplyCounts(notes);
      const setId = await createSet({
        title: "",
        titleSource: "auto",
        notes,
        sourceType: "text",
        sourceLabel: "Tutor chat",
        sourceImageIds: [],
        targetCardCount: counts.cards,
        targetQuizCount: counts.quiz,
        targetExamCount: counts.exam,
      });
      // The set exists even if the link write fails, so a failure here must not
      // report a failed build; it only means the reply still shows the offer.
      try {
        await onBuilt?.(setId);
      } catch (linkError) {
        console.error("Could not link the set to its tutor reply", linkError);
      }
      navigate(`/sets/${setId}`);
    } catch (buildError) {
      setError(
        readableError(
          buildError,
          "The set could not be started. Please try again.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => void build()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full border border-brand-violet/35 bg-white px-3 py-1.5 text-[0.74rem] font-semibold text-brand-ink transition-colors hover:bg-brand-violet/10 disabled:cursor-wait disabled:opacity-70"
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Layers3 className="size-3.5 text-brand-violet" aria-hidden />
        )}
        {busy ? "Turning this into a set…" : "Turn into a study set"}
        {!busy && <ArrowRight className="size-3.5" aria-hidden />}
      </button>
      {error && (
        <span role="alert" className="max-w-sm text-[0.7rem] leading-relaxed text-[#A81F28]">
          {error}
        </span>
      )}
    </span>
  );
}
