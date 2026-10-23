import { Pip } from "@/components/Pip";
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
      <div className="rounded-2xl border border-dashed border-brand-ink/15 bg-card p-10 text-center">
        <p className="text-sm font-semibold text-brand-ink/60">
          This set doesn't have any flashcards yet.
        </p>
      </div>
    );
  }

  if (finished) {
    const sessionTotal = session.known + session.again;
    const recall = sessionTotal ? Math.round((session.known / sessionTotal) * 100) : 0;
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-2xl rounded-[28px] border border-brand-ink/12 bg-card p-6 text-center sm:p-10"
      >
        <div className="mx-auto grid size-28 place-items-center rounded-[28px] border-2 border-brand-ink bg-brand-lime">
          <Pip size={94} cap />
        </div>
        <h3 className="mt-5 font-display text-2xl font-bold">Session done.</h3>
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-brand-ink/55">
          You reviewed all {sessionTotal} cards. {recall}% felt solid this round — the ones you
          flagged as “Again” will be waiting next time.
        </p>

        <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3">
          <div className="rounded-2xl border border-brand-ink/10 bg-brand-mint/50 p-4">
            <p className="font-display text-2xl font-bold">{session.known}</p>
            <p className="text-[11px] font-semibold text-brand-ink/55">Got it</p>
          </div>
          <div className="rounded-2xl border border-brand-ink/10 bg-brand-peach/60 p-4">
            <p className="font-display text-2xl font-bold">{session.again}</p>
            <p className="text-[11px] font-semibold text-brand-ink/55">Again</p>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-brand-ink/40">
          Overall mastery: {mastered} of {cards.length} cards marked known.
        </p>

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={restart}
            className="h-10 rounded-xl border-brand-ink/15 font-semibold"
          >
            <RotateCcw className="size-4" />
            Review again
          </Button>
          {onTakeQuiz && (
            <Button
              onClick={onTakeQuiz}
              className="h-10 rounded-xl border-2 border-brand-ink bg-brand-ink font-bold text-brand-cream hover:bg-brand-pink hover:text-brand-ink"
            >
              Take the quiz
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
        <div className="flex items-center gap-2 text-[11px] font-semibold text-brand-ink/50">
          <span className="grid size-6 place-items-center rounded-full bg-brand-pink/40 text-[10px] font-bold text-brand-ink">
            {index + 1}
          </span>
          of {cards.length} cards
        </div>
        <div className="flex items-center gap-1.5">
          {cards.map((card, dotIndex) => (
            <span
              key={card._id}
              className={cn(
                "h-1.5 rounded-full transition-all",
                dotIndex === index && "w-5 bg-brand-ink",
                dotIndex !== index && card.status === "known" && "w-1.5 bg-brand-mint",
                dotIndex !== index && card.status === "again" && "w-1.5 bg-brand-pink",
                dotIndex !== index && card.status === "new" && "w-1.5 bg-brand-ink/15",
              )}
            />
          ))}
        </div>
        <span className="rounded-full bg-brand-cream px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-ink/50">
          {mastered}/{cards.length} mastered
        </span>
      </div>

      <motion.div
        key={current._id}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
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
              "flip-inner relative h-[360px] transition-transform duration-500 sm:h-[400px]",
              flipped && "[transform:rotateY(180deg)]",
            )}
          >
            <div className="flip-face absolute inset-0 flex flex-col justify-between overflow-hidden rounded-[28px] border-2 border-brand-ink/12 bg-brand-cream p-6 sm:p-8">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-brand-ink/40">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="size-3" /> Prompt
                </span>
                <span className="normal-case tracking-normal">Tap to reveal</span>
              </div>
              <p className="overflow-y-auto py-4 font-display text-[1.55rem] font-semibold leading-snug text-brand-ink sm:text-[1.9rem]">
                {current.front}
              </p>
              <div className="flex items-center justify-between text-[11px] font-semibold text-brand-ink/40">
                <span>Card {index + 1}</span>
                <span className="rounded-full bg-white px-2.5 py-1">
                  {current.reviewCount > 0
                    ? `Reviewed ${current.reviewCount}×`
                    : "First look"}
                </span>
              </div>
            </div>

            <div className="flip-face flip-back absolute inset-0 flex flex-col justify-between overflow-hidden rounded-[28px] border-2 border-brand-ink/15 bg-brand-mint p-6 sm:p-8">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-brand-ink/45">
                <span>Answer</span>
                <span className="normal-case tracking-normal">How did that feel?</span>
              </div>
              <p className="overflow-y-auto py-4 text-[1.15rem] leading-relaxed text-brand-ink sm:text-[1.28rem]">
                {current.back}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-ink/45">
                <Check className="size-3.5" /> Compare against your own wording
              </div>
            </div>
          </div>
        </button>
      </motion.div>

      <div className="mt-4">
        {!flipped ? (
          <Button
            onClick={() => setFlipped(true)}
            className="h-11 w-full rounded-xl border-2 border-brand-ink bg-brand-ink font-bold text-brand-cream hover:bg-brand-pink hover:text-brand-ink"
          >
            Reveal answer
          </Button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-2.5"
          >
            <Button
              variant="outline"
              onClick={() => handleOutcome("again")}
              className="h-11 rounded-xl border-brand-ink/20 bg-white font-bold text-brand-ink hover:bg-brand-peach"
            >
              <X className="size-4" />
              Again
            </Button>
            <Button
              onClick={() => handleOutcome("known")}
              className="h-11 rounded-xl border-2 border-brand-ink bg-brand-mint font-bold text-brand-ink hover:bg-brand-pink"
            >
              <Check className="size-4" />
              Got it
            </Button>
          </motion.div>
        )}
      </div>

      <p className="mt-3 text-center text-[11px] text-brand-ink/35">
        {answered} answered this session. Ratings are saved to your set.
      </p>
    </div>
  );
}
