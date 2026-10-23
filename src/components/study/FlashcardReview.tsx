import { Mascot } from "@/components/Mascot";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import { ArrowRight, Check, RotateCcw, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function FlashcardReview({
  cards,
  onTakeQuiz,
}: {
  cards: Doc<"flashcards">[];
  onTakeQuiz?: () => void;
}) {
  const reviewCard = useMutation(api.studySets.reviewCard);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(false);
  const [session, setSession] = useState({ known: 0, again: 0 });

  const current = cards[index];
  const mastered = cards.filter((card) => card.status === "known").length;
  const answered = session.known + session.again;

  const handleOutcome = (outcome: "known" | "again") => {
    if (!current) return;
    void reviewCard({ cardId: current._id, outcome }).catch((error) => {
      toast.error(readableError(error, "Could not save that review."));
    });

    setSession((value) => ({
      known: value.known + (outcome === "known" ? 1 : 0),
      again: value.again + (outcome === "again" ? 1 : 0),
    }));
    setFlipped(false);

    if (index + 1 >= cards.length) {
      setFinished(true);
    } else {
      setIndex((value) => value + 1);
    }
  };

  const restart = () => {
    setIndex(0);
    setFlipped(false);
    setFinished(false);
    setSession({ known: 0, again: 0 });
  };

  if (cards.length === 0) {
    return (
      <div className="gizmo-card p-10 text-center">
        <p className="text-sm text-muted-foreground">
          This set has no flashcards yet.
        </p>
      </div>
    );
  }

  if (finished) {
    const sessionTotal = session.known + session.again;
    const recall = sessionTotal ? Math.round((session.known / sessionTotal) * 100) : 0;
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="gizmo-card mx-auto w-full max-w-2xl p-6 text-center sm:p-9"
      >
        <div className="mx-auto flex size-28 items-center justify-center">
          <Mascot size={112} float={false} />
        </div>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#E9FBF3] px-3 py-1 text-xs font-semibold text-[#128A5B]">
          <Check className="size-3.5" />
          Session complete
        </p>
        <h3 className="mt-3 font-display text-2xl font-bold text-brand-ink">
          Nice work — {sessionTotal} cards reviewed
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          You marked {recall}% of this round as known. Anything you flagged “Again”
          stays in the deck for next time.
        </p>

        <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#E9FBF3] p-4">
            <p className="font-display text-2xl font-bold text-[#128A5B]">
              {session.known}
            </p>
            <p className="mt-0.5 text-xs font-medium text-[#128A5B]/80">Known</p>
          </div>
          <div className="rounded-2xl bg-[#FFEEF0] p-4">
            <p className="font-display text-2xl font-bold text-[#D24350]">
              {session.again}
            </p>
            <p className="mt-0.5 text-xs font-medium text-[#D24350]/80">Again</p>
          </div>
        </div>

        <p className="mt-4 text-xs font-medium text-muted-foreground">
          Overall mastery: {mastered} of {cards.length} cards
        </p>

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={restart}
            className="h-11 rounded-full border-border bg-white px-6 font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
          >
            <RotateCcw className="size-4" />
            Review again
          </Button>
          {onTakeQuiz && (
            <Button
              onClick={onTakeQuiz}
              className="h-11 rounded-full bg-[#191B27] px-6 font-semibold text-white hover:bg-[#2A2D3E]"
            >
              Take quiz
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-brand-ink">
          Card {index + 1} of {cards.length}
        </p>
        <p className="text-xs font-medium text-muted-foreground">
          {mastered} of {cards.length} known
        </p>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#E7E7EF]">
        <div
          className="h-full rounded-full bg-brand-pink transition-all duration-300"
          style={{ width: `${Math.max(4, ((index + 1) / cards.length) * 100)}%` }}
        />
      </div>

      <motion.div
        key={current._id}
        initial={{ opacity: 0, x: 18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="flip-scene mt-4"
      >
        <button
          type="button"
          onClick={() => setFlipped((value) => !value)}
          aria-label={flipped ? "Hide the answer" : "Reveal the answer"}
          className="block w-full text-left"
        >
          <div
            className={cn(
              "flip-inner relative h-[340px] transition-transform duration-500 sm:h-[380px]",
              flipped && "[transform:rotateY(180deg)]",
            )}
          >
            <div className="flip-face soft-shadow absolute inset-0 flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-card p-7 sm:p-9">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[#F3ECFF] px-3 py-1 text-xs font-semibold text-[#5B3DF5]">
                  Question
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Sparkles className="size-3.5" />
                  Tap to reveal
                </span>
              </div>
              <p className="overflow-y-auto py-4 font-display text-[1.5rem] font-bold leading-snug text-brand-ink sm:text-[1.8rem]">
                {current.front}
              </p>
              <div className="flex items-center justify-between border-t border-border pt-4 text-xs font-medium text-muted-foreground">
                <span>
                  {current.reviewCount > 0
                    ? `Reviewed ${current.reviewCount}×`
                    : "First pass"}
                </span>
                <span>{current.status === "known" ? "Known" : "In deck"}</span>
              </div>
            </div>

            <div className="flip-face flip-back soft-shadow absolute inset-0 flex flex-col justify-between overflow-hidden rounded-3xl border border-[#C9EFDC] bg-[#F3FBF7] p-7 sm:p-9">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[#DCF5E8] px-3 py-1 text-xs font-semibold text-[#128A5B]">
                  Answer
                </span>
                <span className="text-xs font-medium text-[#128A5B]/80">
                  How close were you?
                </span>
              </div>
              <p className="overflow-y-auto py-4 text-[1.05rem] leading-relaxed text-brand-ink sm:text-[1.15rem]">
                {current.back}
              </p>
              <div className="flex items-center gap-1.5 border-t border-[#D7F0E3] pt-4 text-xs font-medium text-[#128A5B]">
                <Check className="size-3.5" />
                Compare with your own wording
              </div>
            </div>
          </div>
        </button>
      </motion.div>

      <div className="mt-4">
        {!flipped ? (
          <Button
            onClick={() => setFlipped(true)}
            className="h-12 w-full rounded-full bg-[#191B27] text-sm font-semibold text-white hover:bg-[#2A2D3E]"
          >
            Show answer
          </Button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-3"
          >
            <Button
              variant="outline"
              onClick={() => handleOutcome("again")}
              className="h-12 rounded-full border-[#F6D2D6] bg-[#FFEEF0] text-sm font-semibold text-[#D24350] hover:bg-[#FFE3E6]"
            >
              <X className="size-4" />
              Again
            </Button>
            <Button
              onClick={() => handleOutcome("known")}
              className="h-12 rounded-full border border-[#BDEBD3] bg-[#E9FBF3] text-sm font-semibold text-[#128A5B] hover:bg-[#DDF7EB]"
            >
              <Check className="size-4" />
              Got it
            </Button>
          </motion.div>
        )}
      </div>

      <p className="mt-3 text-center text-xs font-medium text-muted-foreground">
        {answered} answered this session · ratings are saved
      </p>
    </div>
  );
}
