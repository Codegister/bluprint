import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SkeletonRows } from "@/components/Skeletons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { criteriaFor, feedbackSummary } from "@/convex/lib/markingCriteria";
import { parseMarkScheme } from "@/convex/lib/realPaper";
import { notifyError, readableError } from "@/lib/errors";
import { markLabel, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import { Check, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { useState } from "react";

/**
 * Real past-paper questions.
 *
 * The student brings the question and the board's own mark scheme — typed or
 * photographed — and Bluprint marks against that scheme, one criterion at a
 * time, quoting their words for each mark. Nothing here is generated: the
 * scheme on screen is the one they supplied.
 */
export default function RealPapers() {
  const saved = useQuery(api.realPapers.list);
  const create = useMutation(api.realPapers.create);
  const remove = useMutation(api.realPapers.remove);
  const generateUploadUrl = useMutation(api.studySets.generateUploadUrl);
  const transcribe = useAction(api.ai.transcribeAnswerPhoto);
  const mark = useAction(api.ai.markRealQuestion);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [marks, setMarks] = useState("4");
  const [scheme, setScheme] = useState("");
  const [imageId, setImageId] = useState<Id<"_storage"> | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // The criteria are parsed here as well as on the server, so the student can
  // see what their scheme turned into before saving it.
  const preview = parseMarkScheme(scheme, Number(marks) || 1);

  const readPhoto = async (file: File) => {
    setReading(true);
    setErrors((current) => ({ ...current, new: "" }));
    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "image/jpeg" },
        body: file,
      });
      if (!response.ok) throw new Error("Upload failed.");
      const payload = (await response.json()) as { storageId: string };
      const id = payload.storageId as Id<"_storage">;
      setImageId(id);
      const result = await transcribe({ storageId: id, kind: "scheme" });
      // The transcription is a draft: it is shown in the box to be corrected,
      // never saved behind the student's back.
      setScheme(result.text);
    } catch (error) {
      notifyError(error, "Could not read that photo. Type the scheme instead.");
    } finally {
      setReading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setErrors((current) => ({ ...current, new: "" }));
    try {
      await create({
        title,
        question,
        marks: Number(marks) || 1,
        schemeText: scheme,
        source: imageId ? "photo" : "text",
        ...(imageId ? { sourceImageId: imageId } : {}),
      });
      setTitle("");
      setQuestion("");
      setScheme("");
      setImageId(null);
      setOpen(false);
    } catch (error) {
      setErrors((current) => ({
        ...current,
        new: readableError(error, "Could not save that question."),
      }));
    } finally {
      setSaving(false);
    }
  };

  const markAnswer = async (questionId: Id<"realQuestions">, value: string) => {
    setGradingId(questionId);
    setErrors((current) => ({ ...current, [questionId]: "" }));
    try {
      await mark({ questionId, answer: value });
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [questionId]: readableError(error, "Could not mark that answer."),
      }));
    } finally {
      setGradingId(null);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6">
        <PageHeader
          title="Real past papers"
          description="Paste a question and the board's own mark scheme. Bluprint marks your answer against that scheme, point by point."
          actions={
            <Button
              onClick={() => setOpen((value) => !value)}
              className="h-10 rounded-full px-5 text-sm font-semibold"
            >
              <Plus className="size-4" aria-hidden />
              Add a question
            </Button>
          }
        />

        {open && (
          <section className="gizmo-card mt-5 p-5 sm:p-6">
            <div className="grid gap-3">
              <label className="text-[0.78rem] font-semibold text-brand-ink">
                What is it?
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="AQA Biology 2023 Paper 1, Q4"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-normal text-brand-ink outline-none focus-visible:border-chrome-6"
                />
              </label>

              <label className="text-[0.78rem] font-semibold text-brand-ink">
                The question
                <Textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Paste the question exactly as the paper prints it, including any data table."
                  rows={4}
                  className="mt-1 bg-white text-sm"
                />
              </label>

              <div className="flex flex-wrap items-end gap-3">
                <label className="text-[0.78rem] font-semibold text-brand-ink">
                  Marks
                  <input
                    value={marks}
                    onChange={(event) => setMarks(event.target.value.replace(/[^0-9]/g, ""))}
                    inputMode="numeric"
                    className="mt-1 w-20 rounded-xl border border-border bg-white px-3 py-2 text-sm font-normal text-brand-ink outline-none focus-visible:border-chrome-6"
                  />
                </label>
                <label className="text-[0.78rem] font-semibold text-brand-ink">
                  Mark scheme photo
                  <span className="ml-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-[0.74rem] font-semibold text-brand-ink/80 hover:bg-brand-panel">
                    {reading ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Upload className="size-3.5" aria-hidden />
                    )}
                    {reading ? "Reading the page…" : "Choose a photo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void readPhoto(file);
                      }}
                    />
                  </span>
                </label>
              </div>

              <label className="text-[0.78rem] font-semibold text-brand-ink">
                The official mark scheme
                <Textarea
                  value={scheme}
                  onChange={(event) => setScheme(event.target.value)}
                  placeholder={"One credit point per line, as the board prints it:\n1 mark: temperature increases kinetic energy\n1 mark: above the optimum the enzyme denatures"}
                  rows={6}
                  className="mt-1 bg-white text-sm"
                />
              </label>

              {preview.length > 0 && (
                <div className="rounded-xl bg-brand-panel/70 px-3 py-2.5">
                  <p className="text-[0.72rem] font-semibold text-brand-ink/70">
                    Read as {plural(preview.length, "criterion", "criteria")},{" "}
                    {plural(Number(marks) || 1, "mark")} total
                  </p>
                  <ul className="mt-1 space-y-0.5 text-[0.72rem] leading-relaxed text-brand-ink/70">
                    {preview.map((criterion) => (
                      <li key={criterion.id}>
                        {criterion.marks} · {criterion.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {errors.new && (
                <p role="alert" className="rounded-xl bg-[#FFEEF0] px-3 py-2 text-xs text-[#A81F28]">
                  {errors.new}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void save()}
                  disabled={saving || preview.length === 0 || question.trim().length < 10}
                  className="h-10 rounded-full px-5 text-sm font-semibold"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  Save question
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  className="h-10 rounded-full px-4 text-sm font-semibold"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </section>
        )}

        <div className="mt-5 space-y-4">
          {saved === undefined ? (
            <SkeletonRows rows={3} />
          ) : saved.length === 0 ? (
            <p className="gizmo-card p-6 text-sm leading-relaxed text-muted-foreground">
              No real questions yet. Add one with its mark scheme and Bluprint will
              mark your answer against the board's own points — the same strict
              marking it applies to generated questions.
            </p>
          ) : (
            saved.map((row) => {
              const answer = answers[row._id] ?? row.userAnswer ?? "";
              const graded = row.awardedMarks !== undefined && row.checklist;
              const criteria = criteriaFor({
                criteria: row.criteria,
                markingGuide: [],
                marks: row.marks,
              });
              const isGrading = gradingId === row._id;
              return (
                <article key={row._id} className="gizmo-card p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-display text-[1.05rem] font-bold text-brand-ink">
                        {row.title}
                      </p>
                      <p className="mt-0.5 text-[0.74rem] text-muted-foreground">
                        {plural(row.marks, "mark")} ·{" "}
                        {plural(criteria.length, "criterion", "criteria")}
                        {row.source === "photo" ? " · read from a photo" : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void remove({ questionId: row._id })}
                      aria-label={`Delete ${row.title}`}
                      className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground hover:bg-brand-panel hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-brand-ink">
                    {row.question}
                  </p>

                  <Textarea
                    value={answer}
                    onChange={(event) =>
                      setAnswers((current) => ({ ...current, [row._id]: event.target.value }))
                    }
                    placeholder="Write your answer here, or paste it from a photo you transcribed."
                    rows={5}
                    className="mt-3 bg-white text-sm"
                    disabled={isGrading}
                  />

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      onClick={() => void markAnswer(row._id, answer.trim())}
                      disabled={isGrading || answer.trim().length === 0}
                      className="h-10 rounded-full px-5 text-sm font-semibold"
                    >
                      {isGrading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                      {graded ? "Mark again" : "Mark my answer"}
                    </Button>
                    {graded && (
                      <p className="text-sm font-semibold text-brand-ink">
                        {row.awardedMarks} of {markLabel(row.marks)}
                      </p>
                    )}
                    {row.lowConfidence && (
                      <p className="rounded-xl bg-[#FFF7E6] px-3 py-1.5 text-[0.72rem] font-medium text-[#7A4B06]">
                        Two marks disagreed — treat this as guidance.
                      </p>
                    )}
                  </div>

                  {errors[row._id] && (
                    <p role="alert" className="mt-2 rounded-xl bg-[#FFEEF0] px-3 py-2 text-xs text-[#A81F28]">
                      {errors[row._id]}
                    </p>
                  )}

                  {graded && (
                    <div className="mt-4 space-y-1.5">
                      <p className="text-xs font-semibold text-brand-ink">
                        Against your mark scheme
                      </p>
                      {criteria.map((criterion, index) => {
                        const check = row.checklist?.[index];
                        const awarded = check?.awarded ?? 0;
                        const evidence = check?.evidence;
                        return (
                          <div
                            key={criterion.id}
                            className={cn(
                              "flex items-start gap-2 rounded-xl border p-3 text-[0.8rem] leading-relaxed",
                              awarded > 0 ? "border-[#CFE7DC] bg-[#F3FBF7]" : "border-border bg-white",
                            )}
                          >
                            {awarded > 0 ? (
                              <Check className="mt-0.5 size-4 shrink-0 text-[#0B6B45]" aria-hidden />
                            ) : (
                              <X className="mt-0.5 size-4 shrink-0 text-[#A81F28]" aria-hidden />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <p className="font-semibold text-brand-ink">{criterion.text}</p>
                                <span className="shrink-0 text-[0.68rem] font-semibold tabular-nums text-brand-ink/70">
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
                      {row.checklist === undefined && (
                        <p className="text-sm text-brand-ink/75">{feedbackSummary("")}</p>
                      )}
                    </div>
                  )}

                  <details className="mt-3 rounded-xl bg-brand-panel/60 px-3 py-2">
                    <summary className="cursor-pointer text-[0.74rem] font-semibold text-brand-ink/70">
                      Your mark scheme
                    </summary>
                    <ul className="mt-1.5 space-y-0.5 text-[0.78rem] leading-relaxed text-brand-ink/75">
                      {criteria.map((criterion) => (
                        <li key={criterion.id}>
                          {criterion.marks} · {criterion.text}
                        </li>
                      ))}
                    </ul>
                  </details>
                </article>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
