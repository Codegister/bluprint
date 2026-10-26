import { ExplainDialog } from "@/components/study/ExplainDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { EASE, SPRING } from "@/components/motion/Motion";
import { readableError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { Check, Keyboard, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type QuizResponse = {
  questionId: Id<"quizQuestions">;
  selectedIndex?: number;
  text?: string;
};

/** Score dial that fills from zero when the result appears. */
function ScoreRing({
  score,
  total,
  percent,
}: {
  score: number;
  total: number;
  percent: number;
}) {
  const reduce = useReducedMotion();
  const [animated, setAnimated] = useState(0);
  const shown = reduce ? percent : animated;

  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, percent, {
      duration: 1.1,
      ease: EASE,
      onUpdate: (value) => setAnimated(value),
    });
    return () => controls.stop();
  }, [percent, reduce]);

  return (
    <div
      className="mx-auto grid size-32 place-items-center rounded-full p-2"
      style={{
        background: `conic-gradient(var(--brand-mint) ${shown}%, #EDEDF3 ${shown}% 100%)`,
      }}
    >
      <div className="grid size-full place-items-center rounded-full bg-white">
        <div>
          <p className="font-display text-3xl font-bold leading-none tabular-nums text-brand-ink">
            {score}/{total}
          </p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-[#128A5B]">
            {Math.round(shown)}%
          </p>
        </div>
      </div>
    </div>
  );
}

/** Renders the cloze blank as a visible gap rather than underscores. */
function ClozePrompt({ text }: { text: string }) {
  return (
    <>
      {text.split(/(_{3,})/).map((part, index) =>
        /^_{3,}$/.test(part) ? (
          <span
            key={`blank-${index}`}
            className="mx-1 inline-block min-w-20 border-b-2 border-chrome-4 align-baseline"
          >
            &nbsp;
          </span>
        ) : (
          <span key={`text-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

/**
 * The quiz mixes three question kinds:
 *   - multiple choice, marked by option index;
 *   - cloze, where one term is blanked and typed back in;
 *   - typed short answer, marked on its content words.
 * Every answer is checked on the server with the same rules, and the result is
 * saved per question so the weak-spot session can find the ones that keep
 * going wrong.
 */
export function QuizRunner({
  quiz,
  setId,
  qualification,
  onReviewCards,
}: {
  quiz: Doc<"quizQuestions">[];
  setId: Id<"studySets">;
  qualification?: string;
  onReviewCards?: () => void;
}) {
  const checkAnswer = useMutation(api.studySets.checkQuizAnswer);
  const submitQuiz = useMutation(api.studySets.submitQuiz);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [checked, setChecked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; expected: string } | null>(
    null,
  );
  const [responses, setResponses] = useState<QuizResponse[]>([]);
  const [result, setResult] = useState<{ score: number; total: number } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  const question = quiz[index];
  const isLast = index + 1 >= quiz.length;
  const kind = question?.type ?? "mcq";

  const answeredCount = useMemo(() => responses.length, [responses]);

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
        <ScoreRing score={result.score} total={result.total} percent={pct} />

        <h3 className="mt-5 font-display text-2xl font-bold text-brand-ink">
          {pct >= 80 ? "Strong recall." : pct >= 50 ? "Useful baseline." : "Run it again."}
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Your score is saved to this set, and every question you missed now has a
          place in your weak spots. Read the explanations — they're the shortest
          path to closing the gap.
        </p>

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => {
              setIndex(0);
              setSelected(null);
              setTyped("");
              setChecked(false);
              setFeedback(null);
              setResponses([]);
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

  if (!question) return null;

  const handleCheck = async () => {
    if (checked || checking) return;
    if (kind === "mcq" && selected === null) return;
    if (kind !== "mcq" && typed.trim().length === 0) return;

    setChecking(true);
    try {
      const verdict = await checkAnswer({
        questionId: question._id,
        ...(kind === "mcq"
          ? { selectedIndex: selected ?? 0 }
          : { text: typed }),
      });
      setFeedback(verdict);
      setChecked(true);
      setResponses((current) => {
        const next = [...current];
        next[index] =
          kind === "mcq"
            ? { questionId: question._id, selectedIndex: selected ?? 0 }
            : { questionId: question._id, text: typed };
        return next;
      });
    } catch (error) {
      toast.error(readableError(error, "Could not check that answer."));
    } finally {
      setChecking(false);
    }
  };

  const handleNext = async () => {
    if (!checked) return;
    if (!isLast) {
      setIndex((value) => value + 1);
      setSelected(null);
      setTyped("");
      setChecked(false);
      setFeedback(null);
      return;
    }

    setSubmitting(true);
    try {
      // Every question was checked on the way through, so every response is
      // present. The fallback keeps an interrupted session submittable.
      const payload = quiz.map(
        (item, position): QuizResponse =>
          responses[position] ?? {
            questionId: item._id,
            ...(item.type && item.type !== "mcq" ? { text: "" } : { selectedIndex: 0 }),
          },
      );
      const saved = await submitQuiz({ setId, responses: payload });
      setResult(saved);
      toast.success(`Quiz saved: ${saved.score}/${saved.total}`);
    } catch (error) {
      toast.error(readableError(error, "Could not save your quiz score."));
    } finally {
      setSubmitting(false);
    }
  };

  const correct = checked && feedback?.correct === true;
  const progress = ((index + (checked ? 1 : 0)) / quiz.length) * 100;
  const correctAnswer = feedback?.expected ?? "";
  const canCheck = kind === "mcq" ? selected !== null : typed.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-brand-ink">
          Question {index + 1} of {quiz.length}
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-panel px-2.5 py-1 text-[0.68rem] font-semibold text-chrome-7">
          {kind === "mcq" ? "Multiple choice" : kind === "cloze" ? "Fill the gap" : (
            <>
              <Keyboard className="size-3" aria-hidden /> Typed answer
            </>
          )}
        </span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#E7E7EF]">
        <motion.div
          className="h-full rounded-full bg-brand-pink"
          animate={{ width: `${Math.max(4, progress)}%` }}
          transition={{ duration: 0.5, ease: EASE }}
        />
      </div>

      <motion.div
        key={question._id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="gizmo-card mt-4 p-5 sm:p-7"
      >
        <p className="font-display text-lg font-bold leading-snug text-brand-ink sm:text-xl">
          {kind === "cloze" ? <ClozePrompt text={question.question} /> : question.question}
        </p>

        {kind === "mcq" ? (
          <div className="mt-5 space-y-2.5">
            {question.options.map((option, optionIndex) => {
              const isSelected = selected === optionIndex;
              const isCorrect = checked && optionIndex === question.correctIndex;
              const isWrongChoice = checked && isSelected && !isCorrect;

              return (
                <motion.button
                  key={option}
                  type="button"
                  disabled={checked}
                  onClick={() => setSelected(optionIndex)}
                  whileHover={checked ? undefined : { x: 2 }}
                  whileTap={checked ? undefined : { scale: 0.995 }}
                  transition={SPRING}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left text-sm font-medium transition-colors",
                    !checked &&
                      "border-border bg-white text-brand-ink/85 hover:border-chrome-4 hover:bg-brand-panel",
                    !checked && isSelected && "border-chrome-4 bg-brand-panel text-brand-ink",
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
                            ? "bg-chrome-3 text-chrome-7"
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
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div className="mt-5">
            <Textarea
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              disabled={checked}
              rows={kind === "cloze" ? 2 : 3}
              aria-label="Your answer"
              placeholder={
                kind === "cloze"
                  ? "Type the missing word or phrase"
                  : "Type your answer in a few words"
              }
              className="resize-none rounded-2xl border-border bg-white text-[0.95rem] leading-relaxed text-brand-ink shadow-none placeholder:text-muted-foreground/60 focus-visible:border-chrome-4 focus-visible:ring-chrome-6/15"
            />
            <p className="mt-1.5 text-[0.7rem] font-medium text-muted-foreground">
              Marked on key words, so small spelling and wording differences
              are accepted.
            </p>
          </div>
        )}

        {checked && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className={cn("mt-4 rounded-2xl p-4", correct ? "bg-[#E9FBF3]" : "bg-[#FFEEF0]")}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p
                className={cn(
                  "text-xs font-semibold",
                  correct ? "text-[#0F7A50]" : "text-[#C93C49]",
                )}
              >
                {correct
                  ? "Correct"
                  : kind === "mcq"
                    ? `Not quite. The answer is ${String.fromCharCode(
                        65 + question.correctIndex,
                      )}`
                    : `Not quite. The answer is ${correctAnswer}`}
              </p>
              <ExplainDialog
                setId={setId}
                qualification={qualification}
                context={{
                  kind: "quiz",
                  question: question.question,
                  options: kind === "mcq" ? question.options : undefined,
                  correctAnswer:
                    kind === "mcq"
                      ? `${String.fromCharCode(65 + question.correctIndex)}. ${
                          question.options[question.correctIndex] ?? ""
                        }`
                      : correctAnswer,
                  explanation: question.explanation,
                  studentAnswer: kind === "mcq" ? undefined : typed,
                }}
              />
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-brand-ink/80">
              {question.explanation}
            </p>
          </motion.div>
        )}

        <div className="mt-5">
          {!checked ? (
            <Button
              onClick={() => void handleCheck()}
              disabled={!canCheck || checking}
              className="h-11 w-full rounded-full bg-[#191B27] text-sm font-semibold text-white hover:bg-[#2A2D3E] disabled:bg-[#191B27]/30"
            >
              {checking ? "Checking…" : "Check answer"}
            </Button>
          ) : (
            <Button
              onClick={() => void handleNext()}
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
        {answeredCount} of {quiz.length} answered · every answer comes with an
        explanation
      </p>
    </div>
  );
}
