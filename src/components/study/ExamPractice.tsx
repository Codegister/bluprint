import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useAction } from "convex/react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ChevronDown,
  Loader2,
  PenLine,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ExamPractice({ exams }: { exams: Doc<"examQuestions">[] }) {
  const gradeAnswer = useAction(api.ai.gradeExamAnswer);
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(exams.map((exam) => [exam._id, exam.userAnswer ?? ""])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [gradingId, setGradingId] = useState<string | null>(null);

  if (exams.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-brand-ink/15 bg-card p-10 text-center">
        <p className="text-sm font-semibold text-brand-ink/60">
          This set doesn't have exam questions yet.
        </p>
      </div>
    );
  }

  const handleMark = async (exam: Doc<"examQuestions">) => {
    const answer = (answers[exam._id] ?? "").trim();
    if (answer.length < 15) {
      setErrors((current) => ({
        ...current,
        [exam._id]: "Write a fuller answer before asking Pip to mark it.",
      }));
      return;
    }

    setErrors((current) => ({ ...current, [exam._id]: "" }));
    setGradingId(exam._id);
    try {
      const result = await gradeAnswer({ examId: exam._id, answer });
      toast.success(`Marked: ${result.awardedMarks}/${result.marks}`);
    } catch (error) {
      const message = readableError(error, "Could not mark that answer.");
      setErrors((current) => ({ ...current, [exam._id]: message }));
      toast.error(message);
    } finally {
      setGradingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="flex items-start gap-3 rounded-2xl border border-brand-ink/10 bg-brand-sky/40 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-brand-ink/10 bg-white">
          <PenLine className="size-4 text-brand-ink" />
        </span>
        <div>
          <p className="text-[12.5px] font-bold text-brand-ink">
            Write like it's the real exam.
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-brand-ink/55">
            Pip marks each answer against the question's marking guide and saves the marks
            to this set. Model answers stay hidden until after you've been marked.
          </p>
        </div>
      </div>

      {exams.map((exam, index) => {
        const answer = answers[exam._id] ?? "";
        const isGrading = gradingId === exam._id;
        const graded = exam.awardedMarks !== undefined && exam.feedback;
        const score = exam.awardedMarks ?? 0;
        const scorePercent = exam.marks ? Math.round((score / exam.marks) * 100) : 0;

        return (
          <article
            key={exam._id}
            className="rounded-[26px] border border-brand-ink/12 bg-card p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-ink/40">
                Exam question {index + 1}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="rounded-full border border-brand-ink/10 bg-brand-cream px-2.5 py-1 text-[10px] font-bold text-brand-ink/60">
                  {exam.marks} marks
                </span>
                {graded && (
                  <span className="rounded-full border border-brand-ink/10 bg-brand-mint px-2.5 py-1 text-[10px] font-bold text-brand-ink">
                    Marked {score}/{exam.marks}
                  </span>
                )}
              </div>
            </div>

            <p className="mt-3 font-display text-[1.15rem] font-semibold leading-snug text-brand-ink sm:text-[1.3rem]">
              {exam.question}
            </p>

            <Textarea
              value={answer}
              onChange={(event) =>
                setAnswers((current) => ({ ...current, [exam._id]: event.target.value }))
              }
              placeholder="Plan it briefly, then write your answer here…"
              rows={6}
              maxLength={5000}
              disabled={isGrading}
              className="mt-4 min-h-[130px] resize-y rounded-xl border-brand-ink/15 bg-brand-cream/40 text-[13px] leading-relaxed"
            />

            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-brand-ink/35">
                {answer.trim().length} characters · aim for {exam.marks} clear points
              </p>
              <Button
                onClick={() => handleMark(exam)}
                disabled={isGrading}
                className={cn(
                  "h-9 rounded-xl border-2 border-brand-ink px-4 text-xs font-bold",
                  graded
                    ? "bg-white text-brand-ink hover:bg-brand-lime"
                    : "bg-brand-pink text-brand-ink hover:bg-brand-pink-deep hover:text-brand-cream",
                )}
              >
                {isGrading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Marking with NVIDIA…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5" />
                    {graded ? "Mark again" : "Mark my answer"}
                  </>
                )}
              </Button>
            </div>

            {errors[exam._id] && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-[11.5px] font-medium text-destructive">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                {errors[exam._id]}
              </p>
            )}

            {graded && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-2xl border border-brand-ink/10 bg-brand-cream/70 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-ink/40">
                      AI marking
                    </p>
                    <p className="font-display text-lg font-bold text-brand-ink">
                      {score} / {exam.marks} marks
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-brand-ink/55">
                    {scorePercent}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-ink/10">
                  <div
                    className="h-full rounded-full bg-brand-mint"
                    style={{ width: `${scorePercent}%` }}
                  />
                </div>
                <p className="mt-3 whitespace-pre-wrap text-[12.5px] leading-relaxed text-brand-ink/70">
                  {exam.feedback}
                </p>

                <div className="mt-4 space-y-2">
                  <details className="group rounded-xl border border-brand-ink/10 bg-white p-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-[11.5px] font-bold text-brand-ink">
                      Model answer
                      <ChevronDown className="size-3.5 text-brand-ink/40 transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-brand-ink/65">
                      {exam.modelAnswer}
                    </p>
                  </details>

                  <details className="group rounded-xl border border-brand-ink/10 bg-white p-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-[11.5px] font-bold text-brand-ink">
                      Marking guide
                      <ChevronDown className="size-3.5 text-brand-ink/40 transition-transform group-open:rotate-180" />
                    </summary>
                    <ul className="mt-2 space-y-1.5">
                      {exam.markingGuide.map((point) => (
                        <li
                          key={point}
                          className="flex items-start gap-2 text-[12px] leading-relaxed text-brand-ink/65"
                        >
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-pink-deep" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              </motion.div>
            )}
          </article>
        );
      })}
    </div>
  );
}
