import { BlueprintGlyph } from "@/components/BlueprintMark";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
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
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <p className="text-[12px] text-muted-foreground">
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
        className="mx-auto w-full max-w-2xl rounded-xl border border-border bg-card p-6 text-center sm:p-8"
      >
        <div className="mx-auto grid size-24 place-items-center rounded-lg border border-border bg-brand-panel">
          <BlueprintGlyph size={84} className="opacity-80" />
        </div>
        <p className="mt-4 mono-label text-brand-mint">RUN COMPLETE</p>
        <h3 className="mt-2 font-display text-2xl font-semibold">Session closed.</h3>
        <p className="mx-auto mt-2 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
          You reviewed all {sessionTotal} cards. {recall}% were marked known this round;
          anything flagged “Again” stays in the deck.
        </p>

        <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-2">
          <div className="rounded-md border border-brand-mint/20 bg-brand-mint/[0.06] p-4">
            <p className="font-display text-2xl font-semibold text-brand-mint">
              {session.known}
            </p>
            <p className="mt-0.5 font-mono text-[9px] tracking-wide text-muted-foreground">
              KNOWN
            </p>
          </div>
          <div className="rounded-md border border-brand-peach/20 bg-brand-peach/[0.06] p-4">
            <p className="font-display text-2xl font-semibold text-brand-peach">
              {session.again}
            </p>
            <p className="mt-0.5 font-mono text-[9px] tracking-wide text-muted-foreground">
              AGAIN
            </p>
          </div>
        </div>

        <p className="mt-4 font-mono text-[9.5px] tracking-wide text-muted-foreground">
          OVERALL MASTERY: {mastered} / {cards.length} CARDS
        </p>

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={restart}
            className="h-9 rounded-md border-border bg-transparent font-mono text-[10px] tracking-wide"
          >
            <RotateCcw className="size-3.5" />
            REVIEW AGAIN
          </Button>
          {onTakeQuiz && (
            <Button
              onClick={onTakeQuiz}
              className="h-9 rounded-md bg-brand-pink font-mono text-[10px] font-medium tracking-wide text-brand-void hover:bg-brand-pink-deep"
            >
              TAKE QUIZ
              <ArrowRight className="size-3.5" />
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-[9.5px] tracking-wide text-muted-foreground">
          <span className="rounded border border-brand-pink/25 bg-brand-pink/10 px-1.5 py-0.5 text-brand-pink">
            {String(index + 1).padStart(2, "0")}
          </span>
          / {String(cards.length).padStart(2, "0")} CARDS
        </div>
        <div className="flex items-center gap-1">
          {cards.map((card, dotIndex) => (
            <span
              key={card._id}
              className={cn(
                "h-1 rounded-full transition-all",
                dotIndex === index && "w-4 bg-brand-pink",
                dotIndex !== index && card.status === "known" && "w-1 bg-brand-mint",
                dotIndex !== index && card.status === "again" && "w-1 bg-brand-peach",
                dotIndex !== index && card.status === "new" && "w-1 bg-border",
              )}
            />
          ))}
        </div>
        <span className="rounded border border-border bg-brand-panel px-2 py-0.5 font-mono text-[9px] tracking-wide text-muted-foreground">
          {mastered}/{cards.length} KNOWN
        </span>
      </div>

      <motion.div
        key={current._id}
        initial={{ opacity: 0, x: 18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="flip-scene mt-3"
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
            <div className="flip-face absolute inset-0 flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-brand-panel p-6 sm:p-7">
              <div className="flex items-center justify-between font-mono text-[9px] tracking-[0.14em] text-muted-foreground">
                <span className="text-brand-pink">PROMPT</span>
                <span>CLICK TO REVEAL</span>
              </div>
              <p className="overflow-y-auto py-4 font-display text-[1.45rem] font-medium leading-snug text-brand-ink sm:text-[1.7rem]">
                {current.front}
              </p>
              <div className="flex items-center justify-between border-t border-border pt-3 font-mono text-[9px] tracking-wide text-muted-foreground">
                <span>CARD {String(index + 1).padStart(2, "0")}</span>
                <span>
                  {current.reviewCount > 0
                    ? `REVIEWED ${current.reviewCount}×`
                    : "FIRST PASS"}
                </span>
              </div>
            </div>

            <div className="flip-face flip-back absolute inset-0 flex flex-col justify-between overflow-hidden rounded-xl border border-brand-mint/25 bg-[#0b1712] p-6 sm:p-7">
              <div className="flex items-center justify-between font-mono text-[9px] tracking-[0.14em] text-brand-mint/80">
                <span>ANSWER</span>
                <span>SELF-ASSESS</span>
              </div>
              <p className="overflow-y-auto py-4 text-[1.05rem] leading-relaxed text-brand-ink/90 sm:text-[1.15rem]">
                {current.back}
              </p>
              <div className="flex items-center gap-1.5 border-t border-brand-mint/15 pt-3 font-mono text-[9px] tracking-wide text-brand-mint/70">
                <Check className="size-3" /> COMPARE WITH YOUR OWN WORDING
              </div>
            </div>
          </div>
        </button>
      </motion.div>

      <div className="mt-3">
        {!flipped ? (
          <Button
            onClick={() => setFlipped(true)}
            className="h-10 w-full rounded-md bg-brand-pink font-mono text-[10.5px] font-medium tracking-wide text-brand-void hover:bg-brand-pink-deep"
          >
            REVEAL ANSWER
          </Button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-2"
          >
            <Button
              variant="outline"
              onClick={() => handleOutcome("again")}
              className="h-10 rounded-md border-brand-peach/30 bg-brand-peach/[0.06] font-mono text-[10.5px] tracking-wide text-brand-peach hover:bg-brand-peach/10"
            >
              <X className="size-3.5" />
              AGAIN
            </Button>
            <Button
              onClick={() => handleOutcome("known")}
              className="h-10 rounded-md border border-brand-mint/30 bg-brand-mint/10 font-mono text-[10.5px] font-medium tracking-wide text-brand-mint hover:bg-brand-mint/15"
            >
              <Check className="size-3.5" />
              GOT IT
            </Button>
          </motion.div>
        )}
      </div>

      <p className="mt-3 text-center font-mono text-[9px] tracking-wide text-muted-foreground/70">
        {answered} ANSWERED THIS SESSION / RATINGS ARE SAVED
      </p>
    </div>
  );
}
