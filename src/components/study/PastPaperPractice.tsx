import { EASE } from "@/components/motion/Motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { criteriaFor, feedbackSummary } from "@/convex/lib/markingCriteria";
import { boardFamily, markNotation, questionTotalLine } from "@/convex/lib/paperFormat";
import { readableError } from "@/lib/errors";
import { markLabel, pointLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAction } from "convex/react";
import { motion } from "framer-motion";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type PaperCover = NonNullable<Doc<"pastPapers">["cover"]>;
type PaperQuestion = Doc<"pastPaperQuestions">;

/**
 * Sits a saved past paper question by question.
 *
 * The paper is laid out to read like the real thing: the board's cover rubric at
 * the top, its section headings, its question numbering and its mark notation.
 * Each answer is marked against the paper's own mark scheme by the same examiner
 * prompt as a study set's exam questions, so the score is deliberately strict.
 * The model answer and marking guide stay hidden until grading, which keeps the
 * attempt honest.
 */
export function PastPaperPractice({
  questions,
  qualification,
  examBoard,
  cover,
}: {
  questions: PaperQuestion[];
  qualification?: string;
  examBoard?: string;
  cover?: PaperCover | null;
}) {
  const gradeAnswer = useAction(api.ai.gradePastPaperAnswer);
  const disputeMark = useAction(api.ai.disputePastPaperMark);
  const family = boardFamily(examBoard);
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((question) => [question._id, question.userAnswer ?? ""])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [disputingId, setDisputingId] = useState<string | null>(null);

  if (questions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="rounded-[2rem] border border-border bg-white p-10 text-center"
      >
        <p className="text-sm text-muted-foreground">
          This paper has no questions yet.
        </p>
      </motion.div>
    );
  }

  // Consecutive questions that share a section are rendered under one heading,
  // which is how a real paper groups Section A and Section B. Papers built
  // before the layout was stored have no section, and render as one flat list.
  const sections: Array<{
    title?: string;
    instruction?: string;
    items: PaperQuestion[];
  }> = [];
  for (const question of questions) {
    const title = question.section?.trim() || undefined;
    const last = sections[sections.length - 1];
    if (last && last.title === title) {
      last.items.push(question);
      if (!last.instruction && question.sectionInstruction) {
        last.instruction = question.sectionInstruction;
      }
      continue;
    }
    sections.push({
      title,
      instruction: question.sectionInstruction,
      items: [question],
    });
  }

  /**
   * Asks for a stored mark to be looked at again. The server re-grades the same
   * answer and keeps the old mark as a floor, so this can only help.
   */
  const handleDispute = async (question: PaperQuestion) => {
    setDisputingId(question._id);
    setErrors((current) => ({ ...current, [question._id]: "" }));
    toast.dismiss();
    try {
      const result = await disputeMark({ questionId: question._id });
      toast.success(
        result.changed
          ? `Re-marked: ${result.awardedMarks}/${result.marks} — the mark went up.`
          : `Checked again: the mark stands at ${result.awardedMarks}/${result.marks}.`,
      );
    } catch (error) {
      const message = readableError(error, "Could not re-mark that answer.");
      setErrors((current) => ({ ...current, [question._id]: message }));
      toast.error(message);
    } finally {
      setDisputingId(null);
    }
  };

  const handleMark = async (question: PaperQuestion) => {
    const answer = (answers[question._id] ?? "").trim();
    // An essay needs a few sentences before an examiner can place it in a
    // level, and a one-mark multiple-choice question can be answered with a
    // single letter.
    const minimum = question.marks >= 20 ? 120 : question.marks <= 2 ? 1 : 15;
    if (answer.length < minimum) {
      setErrors((current) => ({
        ...current,
        [question._id]:
          minimum > 15
            ? "Write a few sentences before sending this essay for marking."
            : "Write a fuller answer before sending it for grading.",
      }));
      return;
    }

    setErrors((current) => ({ ...current, [question._id]: "" }));
    setGradingId(question._id);
    // A failure from an earlier answer must not sit above a fresh success.
    toast.dismiss();
    try {
      const result = await gradeAnswer({ questionId: question._id, answer });
      setAnswers((current) => ({ ...current, [question._id]: answer }));
      toast.success(`Marked: ${result.awardedMarks}/${result.marks}`);
    } catch (error) {
      const message = readableError(error, "Could not mark that answer.");
      setErrors((current) => ({ ...current, [question._id]: message }));
      toast.error(message);
    } finally {
      setGradingId(null);
    }
  };

  let questionNumber = 0;

  return (
    <div className="rise-stagger mx-auto w-full max-w-3xl space-y-4">
      {cover && <PaperCoverPage cover={cover} />}

      <div className="rounded-[1.6rem] border border-border bg-white p-5">
        <p className="font-display text-base font-bold text-brand-ink">
          Attempt the paper, then mark each answer
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {qualification ? `Marked using ${qualification} conventions. ` : ""}
          Write a full answer for each question before marking it. The model
          answer and mark scheme unlock after marking, so the score is what an
          examiner would give, not what looks familiar.
        </p>
      </div>

      {sections.map((section, sectionIndex) => (
        <div key={section.title ?? `section-${sectionIndex}`} className="space-y-4">
          {section.title && (
            <div className="rounded-[1.4rem] border border-border bg-brand-panel px-5 py-4">
              <p className="font-display text-[0.95rem] font-bold uppercase tracking-[0.08em] text-brand-ink">
                {section.title}
              </p>
              {section.instruction && (
                <p className="mt-1 text-[0.82rem] leading-relaxed text-muted-foreground">
                  {section.instruction}
                </p>
              )}
            </div>
          )}

          {section.items.map((question) => {
            questionNumber += 1;
            const position = questionNumber;
            const answer = answers[question._id] ?? "";
            const isGrading = gradingId === question._id;
            const graded =
              question.awardedMarks !== undefined && Boolean(question.feedback);
            const score = question.awardedMarks ?? 0;
            const scorePercent = question.marks
              ? Math.round((score / question.marks) * 100)
              : 0;
            const wordCount = answer.trim()
              ? answer.trim().split(/\s+/).length
              : 0;
            // Essays and long responses need a bigger box and essay guidance;
            // a short-answer question keeps the compact layout.
            const criteria = criteriaFor(question);
            const isEssay = question.marking === "levels" && question.marks >= 20;
            const isExtended =
              question.marking === "levels" || question.marks >= 12;
            const totalLine = questionTotalLine(
              family,
              question.label?.replace(/\s*\(.*\)$/, "") || String(position),
              question.marks,
            );

            return (
              <article
                key={question._id}
                className="rounded-[1.6rem] border border-border bg-white p-5 sm:p-7"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Question {position} of {questions.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-brand-panel px-3 py-1 text-xs font-semibold text-brand-ink/70">
                      {markNotation(family, question.marks)}
                    </span>
                  </div>
                </div>

                {/* The number sits in its own column, the way a printed paper
                    sets the question number out in the margin. */}
                <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-4">
                  <span
                    aria-hidden
                    className="mt-0.5 grid h-8 w-14 place-items-center rounded-lg bg-brand-panel font-display text-[0.82rem] font-bold text-chrome-7"
                  >
                    {question.label?.trim() || position}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-[1.1rem] font-bold leading-snug text-brand-ink sm:text-[1.22rem]">
                      {question.question}
                    </p>

                    {(question.commandWord || question.specReference) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {question.commandWord && (
                          <span className="rounded-full bg-brand-panel px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-chrome-7">
                            {question.commandWord}
                          </span>
                        )}
                        {question.specReference && (
                          <span className="rounded-full bg-brand-panel px-2.5 py-1 text-[0.68rem] font-semibold text-muted-foreground">
                            Spec {question.specReference}
                          </span>
                        )}
                        {question.marking === "levels" && (
                          <span className="rounded-full bg-[#E9FBF3] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-[#0B6B45]">
                            Levels-marked
                          </span>
                        )}
                      </div>
                    )}

                    {/* The data the question is about. Without it a question
                        that says "the table below" cannot be answered. */}
                    {question.data && (
                      <figure className="mt-3 overflow-x-auto rounded-2xl border border-border">
                        {question.data.title && (
                          <figcaption className="border-b border-border bg-brand-panel px-3 py-2 text-[0.78rem] font-semibold text-brand-ink">
                            {question.data.title}
                          </figcaption>
                        )}
                        <table className="w-full border-collapse text-[0.8rem]">
                          <thead>
                            <tr>
                              {question.data.columns.map((column) => (
                                <th
                                  key={column}
                                  scope="col"
                                  className="border-b border-border bg-brand-panel/60 px-3 py-2 text-left font-semibold text-brand-ink"
                                >
                                  {column}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {question.data.rows.map((row, rowIndex) => (
                              <tr key={rowIndex}>
                                {row.map((cell, cellIndex) =>
                                  cellIndex === 0 ? (
                                    <th
                                      key={cellIndex}
                                      scope="row"
                                      className="border-b border-border px-3 py-2 text-left font-medium text-brand-ink"
                                    >
                                      {cell}
                                    </th>
                                  ) : (
                                    <td
                                      key={cellIndex}
                                      className="border-b border-border px-3 py-2 tabular-nums text-brand-ink/85"
                                    >
                                      {cell}
                                    </td>
                                  ),
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {question.data.note && (
                          <p className="px-3 py-2 text-[0.74rem] leading-relaxed text-muted-foreground">
                            {question.data.note}
                          </p>
                        )}
                      </figure>
                    )}
                  </div>
                </div>

                {/* Visible before writing, not only after marking: the target
                    is part of the question, not a surprise at the end. */}
                {criteria.length > 0 && (
                  <details
                    open
                    className="group mt-3 rounded-2xl border border-border bg-brand-panel/45 p-3"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-brand-ink">
                      What earns the marks
                      <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {criteria.map((criterion) => (
                        <li
                          key={criterion.id}
                          className="flex items-start gap-2 text-[0.78rem] leading-relaxed text-brand-ink/70"
                        >
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-lime" />
                          <span>
                            {criterion.text}
                            <span className="ml-1 text-[0.68rem] text-muted-foreground">
                              ({markLabel(criterion.marks)})
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                <Textarea
                  value={answer}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      [question._id]: event.target.value,
                    }))
                  }
                  placeholder={
                    isEssay
                      ? "Write your essay here…"
                      : "Write your answer here…"
                  }
                  rows={isEssay ? 16 : isExtended ? 10 : 6}
                  maxLength={12000}
                  disabled={isGrading}
                  className={cn(
                    "mt-4 resize-y rounded-2xl border-border bg-white text-sm leading-relaxed text-brand-ink shadow-none placeholder:text-muted-foreground/90 focus-visible:border-chrome-6 focus-visible:ring-chrome-6/15",
                    isEssay
                      ? "min-h-[320px]"
                      : isExtended
                        ? "min-h-[220px]"
                        : "min-h-[140px]",
                  )}
                />

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    {isEssay
                      ? `${wordCount} words · write a full essay with a clear argument`
                      : isExtended
                        ? `${wordCount} words · build a developed answer`
                        : question.marks <= 2
                          ? `${answer.trim().length} characters · a short answer is enough`
                          : `${answer.trim().length} characters · aim for ${pointLabel(question.marks)}`}
                  </p>
                  <Button
                    onClick={() => void handleMark(question)}
                    disabled={isGrading}
                    className={cn(
                      "h-10 rounded-full px-5 text-sm font-semibold sm:w-auto",
                      graded
                        ? "bg-[#E9FBF3] text-[#0B6B45] hover:bg-[#DDF7EB]"
                        : "bg-[#191B27] text-white hover:bg-[#2A2D3E]",
                    )}
                  >
                    {isGrading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Marking…
                      </>
                    ) : (
                      <>{graded ? "Mark again" : "Mark answer"}</>
                    )}
                  </Button>
                </div>

                {/* Edexcel, OCR and Cambridge print a running total after each
                    question; AQA does not, so this stays hidden for those. */}
                {totalLine && (
                  <p className="mt-3 border-t border-dashed border-border pt-2 text-right text-[0.72rem] font-semibold text-muted-foreground">
                    {totalLine}
                  </p>
                )}

                {errors[question._id] && (
                  <motion.div
                    key={errors[question._id]}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    role="alert"
                    className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#FFEEF0] px-3.5 py-2.5 text-xs leading-relaxed text-[#A81F28]"
                  >
                    <span>{errors[question._id]}</span>
                    {!isGrading && (
                      <button
                        type="button"
                        onClick={() => void handleMark(question)}
                        className="shrink-0 rounded-full bg-white/70 px-3 py-1 font-semibold text-[#A81F28] underline-offset-2 hover:underline"
                      >
                        Try marking again
                      </button>
                    )}
                  </motion.div>
                )}

                {graded && (
                  <motion.div
                    key={`${question._id}-${score}-${question.awardedMarks !== undefined}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: EASE }}
                    className="mt-4 rounded-2xl bg-[#F3FBF7] p-4 sm:p-5"
                  >
                    <div>
                      <p className="text-xs font-semibold text-[#0B6B45]">
                        Examiner marking
                      </p>
                      <p className="mt-1 font-display text-lg font-bold text-brand-ink">
                        {score} of {markLabel(question.marks)}
                      </p>
                    </div>
                    {question.lowConfidence && (
                      <p className="mt-2 rounded-xl bg-[#FFF7E6] px-3 py-2 text-[0.74rem] font-medium leading-relaxed text-[#7A4B06]">
                        Two marks disagreed — treat this as guidance. The lower
                        of the two was kept.
                      </p>
                    )}
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#D7F0E3]">
                      <motion.div
                        className="h-full rounded-full bg-brand-mint"
                        initial={{ width: 0 }}
                        animate={{ width: `${scorePercent}%` }}
                        transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
                      />
                    </div>
                    {(question.checklist?.length ?? 0) === 0 && (
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-brand-ink/80">
                        {feedbackSummary(question.feedback ?? "")}
                      </p>
                    )}

                    {/* The mark as a checklist: one row per criterion, its full
                        text, and the quoted words that earned it. */}
                    {criteria.length > 0 && (question.checklist?.length ?? 0) > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-brand-ink">
                          Awarded marks, criterion by criterion
                        </p>
                        <div className="mt-2 space-y-1.5">
                          {criteria.map((criterion, index) => {
                            const check = question.checklist?.[index];
                            const awarded = check?.awarded ?? 0;
                            const evidence = check?.evidence;
                            return (
                              <div
                                key={criterion.id}
                                className={cn(
                                  "flex items-start gap-2 rounded-2xl border p-3 text-[0.8rem] leading-relaxed",
                                  awarded > 0
                                    ? "border-[#CFE7DC] bg-white"
                                    : "border-border bg-[#FCFBF8]",
                                )}
                              >
                                {awarded > 0 ? (
                                  <Check
                                    className="mt-0.5 size-4 shrink-0 text-[#0B6B45]"
                                    aria-hidden
                                  />
                                ) : (
                                  <X
                                    className="mt-0.5 size-4 shrink-0 text-[#A81F28]"
                                    aria-hidden
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <p className="font-semibold text-brand-ink">
                                      {criterion.text}
                                    </p>
                                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[0.68rem] font-semibold tabular-nums text-brand-ink/70">
                                      {awarded}/{markLabel(criterion.marks)}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-muted-foreground">
                                    {awarded > 0
                                      ? evidence && evidence !== "absent"
                                        ? `“${evidence}”`
                                        : "Credited from your answer."
                                      : evidence && evidence !== "absent"
                                        ? `You wrote “${evidence}”, which does not state this point.`
                                        : "Absent"}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* A wrong mark is not the student's problem to work
                        around: they can ask for it to be looked at again. */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleDispute(question)}
                        disabled={disputingId === question._id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-[0.74rem] font-semibold text-brand-ink/75 transition-colors hover:bg-brand-panel disabled:opacity-60"
                      >
                        {disputingId === question._id ? (
                          <Loader2 className="size-3 animate-spin" aria-hidden />
                        ) : null}
                        {disputingId === question._id
                          ? "Looking again…"
                          : "Dispute this mark"}
                      </button>
                      {question.disputedAt && (
                        <span className="text-[0.72rem] text-muted-foreground">
                          Looked at again at your request — the mark cannot go
                          down.
                        </span>
                      )}
                    </div>

                    <div className="mt-4 space-y-2">
                      <details className="group rounded-2xl bg-white p-3.5">
                        <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-brand-ink">
                          Model answer
                          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-brand-ink/70">
                          {question.modelAnswer}
                        </p>
                      </details>

                      {(question.checklist?.length ?? 0) === 0 && (
                        <details className="group rounded-2xl bg-white p-3.5">
                          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-brand-ink">
                            Mark scheme
                            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                          </summary>
                          <ul className="mt-2 space-y-1.5">
                            {criteria.map((criterion) => (
                              <li
                                key={criterion.id}
                                className="flex items-start gap-2 text-sm leading-relaxed text-brand-ink/70"
                              >
                                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-lime" />
                                {criterion.text}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </motion.div>
                )}
              </article>
            );
          })}
        </div>
      ))}

      <p className="pb-2 text-center text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        End of paper
      </p>
    </div>
  );
}

/**
 * The cover, set out the way the board prints one: the qualification and paper
 * label at the top, then the Materials / Instructions / Information / Advice
 * blocks. It is kept visually distinct from the questions so it reads as a front
 * page rather than another question card.
 */
function PaperCoverPage({ cover }: { cover: PaperCover }) {
  const blocks: Array<{ title: string; items: string[] }> = [
    { title: "Materials", items: cover.materials },
    { title: "Instructions", items: cover.instructions },
    { title: "Information", items: cover.information },
    { title: "Advice", items: cover.advice },
  ].filter((block) => block.items.length > 0);

  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-border bg-white">
      <div className="border-b border-border bg-white px-5 py-6 text-center sm:px-8 sm:py-8">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-chrome-7">
          {cover.qualification}
        </p>
        <h2 className="mt-2 font-display text-[1.5rem] font-bold uppercase tracking-[0.02em] text-brand-ink sm:text-[1.8rem]">
          {cover.paperLabel}
        </h2>
        <p className="mt-1 text-[0.85rem] font-semibold text-brand-ink/70">
          Time allowed: {cover.timeAllowed}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[0.75rem] font-semibold text-muted-foreground">
          <span className="rounded-full bg-brand-panel px-3 py-1">
            Total marks: {cover.totalMarks}
          </span>
          <span className="rounded-full bg-brand-panel px-3 py-1">
            Answer all questions
          </span>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5 sm:px-8 sm:py-6">
        {blocks.map((block) => (
          <div key={block.title}>
            <p className="font-display text-[0.86rem] font-bold uppercase tracking-[0.08em] text-brand-ink">
              {block.title}
            </p>
            <ul className="mt-1.5 space-y-1">
              {block.items.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[0.84rem] leading-relaxed text-brand-ink/75"
                >
                  <span className="mt-[0.42rem] size-1.5 shrink-0 rounded-full bg-chrome-4" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <p className="rounded-2xl bg-[#FFFBF2] px-3.5 py-2.5 text-[0.75rem] leading-relaxed text-[#8A5A12]">
          Practice mock, not an official examination paper. Written from your
          course specification in this board's paper format.
        </p>
      </div>
    </section>
  );
}
