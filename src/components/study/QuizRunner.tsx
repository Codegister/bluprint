import { Pip } from "@/components/Pip";
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
      <div className="rounded-2xl border border-dashed border-brand-ink/15 bg-card p-10 text-center">
        <p className="text-sm font-semibold text-brand-ink/60">
          This set doesn't have a quiz yet.
        </p>
      </div>
    );
  }

  if (result) {
    const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-2xl rounded-[28px] border border-brand-ink/12 bg-card p-6 text-center sm:p-10"
      >
        <div
          className="mx-auto grid size-32 place-items-center rounded-full p-2"
          style={{
            background: `conic-gradient(var(--brand-mint) ${pct}%, var(--brand-cream) ${pct}% 100%)`,
          }}
        >
          <div className="grid size-full place-items-center rounded-full border border-brand-ink/10 bg-white">
            <div>
              <p className="font-display text-3xl font-bold leading-none text-brand-ink">
                {result.score}/{result.total}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-brand-ink/40">
                {pct}%
              </p>
            </div>
          </div>
        </div>

        <h3 className="mt-5 font-display text-2xl font-bold">
          {pct >= 80 ? "That's a strong recall." : pct >= 50 ? "Solid start." : "Worth another pass."}
        </h3>
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-brand-ink/55">
          Your score is saved to this set. The explanations below every question are the
          fastest way to close the gap.
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
            className="h-10 rounded-xl border-brand-ink/15 font-semibold"
          >
            <RotateCcw className="size-4" />
            Retake quiz
          </Button>
          {onReviewCards && (
            <Button
              onClick={onReviewCards}
              className="h-10 rounded-xl border-2 border-brand-ink bg-brand-ink font-bold text-brand-cream hover:bg-brand-pink hover:text-brand-ink"
            >
              Review flashcards
              <ArrowRight className="size-4" />
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
      <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-brand-ink/50">
        <span>
          Question {index + 1} of {quiz.length}
        </span>
        <span className="rounded-full bg-brand-lime/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-ink">
          Multiple choice
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-ink/10">
        <div
          className="h-full rounded-full bg-brand-mint transition-all duration-300"
          style={{ width: `${Math.max(4, progress)}%` }}
        />
      </div>

      <motion.div
        key={question._id}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="mt-4 rounded-[28px] border border-brand-ink/12 bg-card p-5 sm:p-7"
      >
        <p className="font-display text-xl font-semibold leading-snug text-brand-ink sm:text-[1.45rem]">
          {question.question}
        </p>

        <div className="mt-5 space-y-2">
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
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left text-[13px] font-medium transition-colors sm:text-sm",
                  !checked && "border-brand-ink/12 bg-brand-cream/40 hover:border-brand-ink/30 hover:bg-brand-cream",
                  !checked && isSelected && "border-brand-ink bg-brand-lime/40",
                  isCorrect && "border-brand-ink bg-brand-mint",
                  isWrongChoice && "border-destructive/30 bg-brand-peach",
                  checked && !isCorrect && !isWrongChoice && "border-brand-ink/10 bg-white opacity-60",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-lg border text-[10px] font-bold",
                    isCorrect
                      ? "border-brand-ink bg-brand-ink text-brand-cream"
                      : isWrongChoice
                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                        : isSelected
                          ? "border-brand-ink bg-brand-ink text-brand-cream"
                          : "border-brand-ink/15 bg-white text-brand-ink/50",
                  )}
                >
                  {isCorrect ? (
                    <Check className="size-3.5" />
                  ) : isWrongChoice ? (
                    <X className="size-3.5" />
                  ) : (
                    String.fromCharCode(65 + optionIndex)
                  )}
                </span>
                <span className="pt-0.5 text-brand-ink/80">{option}</span>
              </button>
            );
          })}
        </div>

        {checked && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "mt-4 rounded-xl border p-4",
              correct
                ? "border-brand-ink/10 bg-brand-mint/50"
                : "border-brand-ink/10 bg-brand-peach/50",
            )}
          >
            <p className="flex items-center gap-1.5 text-[12px] font-bold text-brand-ink">
              {correct ? <Check className="size-3.5" /> : <X className="size-3.5" />}
              {correct ? "Correct" : `Not quite — the answer is ${String.fromCharCode(65 + question.correctIndex)}`}
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-brand-ink/65">
              {question.explanation}
            </p>
          </motion.div>
        )}

        <div className="mt-5">
          {!checked ? (
            <Button
              onClick={handleCheck}
              disabled={selected === null}
              className="h-10 w-full rounded-xl border-2 border-brand-ink bg-brand-ink font-bold text-brand-cream hover:bg-brand-pink hover:text-brand-ink disabled:bg-brand-ink/30"
            >
              Check answer
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={submitting}
              className="h-10 w-full rounded-xl border-2 border-brand-ink bg-brand-pink font-bold text-brand-ink hover:bg-brand-pink-deep hover:text-brand-cream"
            >
              {submitting ? "Saving…" : isLast ? "Finish and save score" : "Next question"}
              {!submitting && <ArrowRight className="size-4" />}
            </Button>
          )}
        </div>
      </motion.div>

      <div className="mt-4 flex items-center justify-center gap-2">
        <Pip size={34} mood="happy" />
        <p className="text-[11px] text-brand-ink/40">
          Every answer comes with a short reason — read it even when you're right.
        </p>
      </div>
    </div>
  );
}
