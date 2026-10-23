import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function QuizRunner({
  quiz,
  setId,
  onReviewCards,
}: {
  quiz: Doc<"quizQuestions">[];
  setId: Id<"studySets">;
  onReviewCards?: () => void;
}) {
  const submitQuiz = useMutation(api.studySets.submitQuiz);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const question = quiz[index];
  const isLast = index + 1 >= quiz.length;

  if (quiz.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <p className="text-[12px] text-muted-foreground">This set has no quiz yet.</p>
      </div>
    );
  }

  if (result) {
    const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-2xl rounded-xl border border-border bg-card p-6 text-center sm:p-8"
      >
        <div
          className="mx-auto grid size-28 place-items-center rounded-full p-1.5"
          style={{
            background: `conic-gradient(var(--brand-mint) ${pct}%, rgba(230,237,243,0.09) ${pct}% 100%)`,
          }}
        >
          <div className="grid size-full place-items-center rounded-full border border-border bg-brand-panel">
            <div>
              <p className="font-display text-3xl font-semibold leading-none text-brand-ink">
                {result.score}/{result.total}
              </p>
              <p className="mt-1 font-mono text-[9px] tracking-wide text-brand-mint">
                {pct}%
              </p>
            </div>
          </div>
        </div>

        <p className="mt-4 mono-label text-brand-mint">QUIZ SAVED</p>
        <h3 className="mt-2 font-display text-2xl font-semibold">
          {pct >= 80 ? "Strong recall." : pct >= 50 ? "Useful baseline." : "Run it again."}
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
          Your score is attached to this set. Each explanation is the shortest path to
          closing the gap.
        </p>

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => {
              setIndex(0);
              setSelected(null);
              setChecked(false);
              setAnswers([]);
              setResult(null);
            }}
            className="h-9 rounded-md border-border bg-transparent font-mono text-[10px] tracking-wide"
          >
            <RotateCcw className="size-3.5" />
            RETAKE
          </Button>
          {onReviewCards && (
            <Button
              onClick={onReviewCards}
              className="h-9 rounded-md bg-brand-pink font-mono text-[10px] font-medium tracking-wide text-brand-void hover:bg-brand-pink-deep"
            >
              REVIEW CARDS
              <ArrowRight className="size-3.5" />
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  const handleCheck = () => {
    if (selected === null || checked) return;
    setAnswers((current) => [...current, selected]);
    setChecked(true);
  };

  const handleNext = async () => {
    if (!checked) return;
    if (!isLast) {
      setIndex((value) => value + 1);
      setSelected(null);
      setChecked(false);
      return;
    }

    setSubmitting(true);
    try {
      const saved = await submitQuiz({ setId, answers });
      setResult(saved);
      toast.success(`Quiz saved: ${saved.score}/${saved.total}`);
    } catch (error) {
      toast.error(readableError(error, "Could not save your quiz score."));
    } finally {
      setSubmitting(false);
    }
  };

  const correct = checked && selected === question.correctIndex;
  const progress = ((index + (checked ? 1 : 0)) / quiz.length) * 100;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex items-center justify-between gap-3 font-mono text-[9.5px] tracking-wide text-muted-foreground">
        <span>
          QUESTION {String(index + 1).padStart(2, "0")} /{" "}
          {String(quiz.length).padStart(2, "0")}
        </span>
        <span className="rounded border border-border bg-brand-panel px-1.5 py-0.5 text-[9px]">
          MULTIPLE CHOICE
        </span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-brand-mint transition-all duration-300"
          style={{ width: `${Math.max(4, progress)}%` }}
        />
      </div>

      <motion.div
        key={question._id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mt-3 rounded-xl border border-border bg-card p-5 sm:p-6"
      >
        <p className="font-display text-lg font-medium leading-snug text-brand-ink sm:text-xl">
          {question.question}
        </p>

        <div className="mt-4 space-y-1.5">
          {question.options.map((option, optionIndex) => {
            const isSelected = selected === optionIndex;
            const isCorrect = checked && optionIndex === question.correctIndex;
            const isWrongChoice = checked && isSelected && !isCorrect;

            return (
              <button
                key={option}
                type="button"
                disabled={checked}
                onClick={() => setSelected(optionIndex)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-md border p-2.5 text-left text-[12.5px] transition-colors",
                  !checked && "border-border bg-brand-panel/50 text-brand-ink/75 hover:border-brand-pink/30 hover:bg-brand-panel",
                  !checked && isSelected && "border-brand-pink/40 bg-brand-pink/10 text-brand-ink",
                  isCorrect && "border-brand-mint/30 bg-brand-mint/10 text-brand-mint",
                  isWrongChoice && "border-brand-peach/30 bg-brand-peach/10 text-brand-peach",
                  checked && !isCorrect && !isWrongChoice && "border-border bg-brand-panel/30 text-muted-foreground/60",
                )}
              >
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded border font-mono text-[9px]",
                    isCorrect
                      ? "border-brand-mint/40 bg-brand-mint/15 text-brand-mint"
                      : isWrongChoice
                        ? "border-brand-peach/40 bg-brand-peach/15 text-brand-peach"
                        : isSelected
                          ? "border-brand-pink/40 bg-brand-pink/15 text-brand-pink"
                          : "border-border text-muted-foreground",
                  )}
                >
                  {isCorrect ? (
                    <Check className="size-3" />
                  ) : isWrongChoice ? (
                    <X className="size-3" />
                  ) : (
                    String.fromCharCode(65 + optionIndex)
                  )}
                </span>
                <span className="pt-0.5">{option}</span>
              </button>
            );
          })}
        </div>

        {checked && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "mt-3 rounded-md border p-3",
              correct
                ? "border-brand-mint/25 bg-brand-mint/[0.06]"
                : "border-brand-peach/25 bg-brand-peach/[0.06]",
            )}
          >
            <p
              className={cn(
                "flex items-center gap-1.5 font-mono text-[9.5px] tracking-wide",
                correct ? "text-brand-mint" : "text-brand-peach",
              )}
            >
              {correct ? <Check className="size-3" /> : <X className="size-3" />}
              {correct
                ? "CORRECT"
                : `INCORRECT / ANSWER ${String.fromCharCode(65 + question.correctIndex)}`}
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-brand-ink/70">
              {question.explanation}
            </p>
          </motion.div>
        )}

        <div className="mt-4">
          {!checked ? (
            <Button
              onClick={handleCheck}
              disabled={selected === null}
              className="h-9 w-full rounded-md bg-brand-pink font-mono text-[10.5px] font-medium tracking-wide text-brand-void hover:bg-brand-pink-deep disabled:bg-brand-pink/30"
            >
              CHECK ANSWER
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={submitting}
              className="h-9 w-full rounded-md border border-brand-mint/30 bg-brand-mint/10 font-mono text-[10.5px] font-medium tracking-wide text-brand-mint hover:bg-brand-mint/15"
            >
              {submitting
                ? "SAVING…"
                : isLast
                  ? "FINISH AND SAVE SCORE"
                  : "NEXT QUESTION"}
              {!submitting && <ArrowRight className="size-3.5" />}
            </Button>
          )}
        </div>
      </motion.div>

      <p className="mt-3 text-center font-mono text-[9px] tracking-wide text-muted-foreground/70">
        EVERY ANSWER INCLUDES AN EXPLANATION
      </p>
    </div>
  );
}
