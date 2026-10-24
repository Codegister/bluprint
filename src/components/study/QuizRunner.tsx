import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
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
      <div className="gizmo-card p-10 text-center">
        <p className="text-sm text-muted-foreground">This set has no quiz yet.</p>
      </div>
    );
  }

  if (result) {
    const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="gizmo-card mx-auto w-full max-w-2xl p-6 text-center sm:p-9"
      >
        <div
          className="mx-auto grid size-32 place-items-center rounded-full p-2"
          style={{
            background: `conic-gradient(var(--brand-mint) ${pct}%, #EDEDF3 ${pct}% 100%)`,
          }}
        >
          <div className="grid size-full place-items-center rounded-full bg-white">
            <div>
              <p className="font-display text-3xl font-bold leading-none text-brand-ink">
                {result.score}/{result.total}
              </p>
              <p className="mt-1 text-sm font-semibold text-[#128A5B]">{pct}%</p>
            </div>
          </div>
        </div>

        <h3 className="mt-5 font-display text-2xl font-bold text-brand-ink">
          {pct >= 80 ? "Strong recall." : pct >= 50 ? "Useful baseline." : "Run it again."}
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Your score is saved to this set. Read the explanations you missed — they're the
          shortest path to closing the gap.
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
            className="h-11 rounded-full border-border bg-white px-6 font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
          >
            Retake
          </Button>
          {onReviewCards && (
            <Button
              onClick={onReviewCards}
              className="h-11 rounded-full bg-[#191B27] px-6 font-semibold text-white hover:bg-[#2A2D3E]"
            >
              Review cards
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
      <p className="text-sm font-semibold text-brand-ink">
        Question {index + 1} of {quiz.length}
      </p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#E7E7EF]">
        <div
          className="h-full rounded-full bg-brand-pink transition-all duration-300"
          style={{ width: `${Math.max(4, progress)}%` }}
        />
      </div>

      <motion.div
        key={question._id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="gizmo-card mt-4 p-5 sm:p-7"
      >
        <p className="font-display text-lg font-bold leading-snug text-brand-ink sm:text-xl">
          {question.question}
        </p>

        <div className="mt-5 space-y-2.5">
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
                  "flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left text-sm font-medium transition-colors",
                  !checked &&
                    "border-border bg-white text-brand-ink/85 hover:border-[#CFC4FF] hover:bg-[#FAF8FF]",
                  !checked &&
                    isSelected &&
                    "border-[#B9A6FF] bg-[#F5F1FF] text-brand-ink",
                  isCorrect && "border-[#BDEBD3] bg-[#E9FBF3] text-[#0F7A50]",
                  isWrongChoice && "border-[#F6D2D6] bg-[#FFEEF0] text-[#C93C49]",
                  checked &&
                    !isCorrect &&
                    !isWrongChoice &&
                    "border-border bg-brand-panel/40 text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                    isCorrect
                      ? "bg-[#CFF3E2] text-[#0F7A50]"
                      : isWrongChoice
                        ? "bg-[#FBDDE0] text-[#C93C49]"
                        : isSelected
                          ? "bg-[#E4DBFF] text-[#5B3DF5]"
                          : "bg-brand-panel text-muted-foreground",
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
                <span className="pt-1">{option}</span>
              </button>
            );
          })}
        </div>

        {checked && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "mt-4 rounded-2xl p-4",
              correct ? "bg-[#E9FBF3]" : "bg-[#FFEEF0]",
            )}
          >
            <p
              className={cn(
                "text-xs font-semibold",
                correct ? "text-[#0F7A50]" : "text-[#C93C49]",
              )}
            >
              {correct
                ? "Correct"
                : `Not quite — the answer is ${String.fromCharCode(
                    65 + question.correctIndex,
                  )}`}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-brand-ink/80">
              {question.explanation}
            </p>
          </motion.div>
        )}

        <div className="mt-5">
          {!checked ? (
            <Button
              onClick={handleCheck}
              disabled={selected === null}
              className="h-11 w-full rounded-full bg-[#191B27] text-sm font-semibold text-white hover:bg-[#2A2D3E] disabled:bg-[#191B27]/30"
            >
              Check answer
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={submitting}
              className="h-11 w-full rounded-full bg-[#191B27] text-sm font-semibold text-white hover:bg-[#2A2D3E]"
            >
              {submitting
                ? "Saving…"
                : isLast
                  ? "Finish and save score"
                  : "Next question"}

            </Button>
          )}
        </div>
      </motion.div>

      <p className="mt-3 text-center text-xs font-medium text-muted-foreground">
        Every answer comes with an explanation
      </p>
    </div>
  );
}
