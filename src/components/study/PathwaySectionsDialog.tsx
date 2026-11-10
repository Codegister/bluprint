import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BUILD_DEFAULTS,
  BUILD_MAX,
  BUILD_MIN,
} from "@/convex/lib/buildDefaults";
import type { SectionOption } from "@/lib/pathwaySections";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export type BuildCounts = {
  cards: number;
  quiz: number;
  exam: number;
};

/**
 * Builds a study set from one topic, or from a run of following pathway
 * topics. The student chooses both the scope and the number of flashcards,
 * quiz questions and exam-style questions before the build starts.
 *
 * The options are the real topics still ahead on the pathway, so a course with
 * ten topics offers ten, never the server's twelve-topic limit.
 *
 * The caller gives this a `key` per topic, so choosing a different topic starts
 * the count at one again without an effect resetting it after a render.
 */
export function PathwaySectionsDialog({
  open,
  onOpenChange,
  options,
  busy,
  onBuild,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: SectionOption[];
  busy: boolean;
  onBuild: (sections: number, counts: BuildCounts) => void;
}) {
  const [count, setCount] = useState(1);
  const [cards, setCards] = useState<number>(BUILD_DEFAULTS.cards);
  const [quiz, setQuiz] = useState<number>(BUILD_DEFAULTS.quiz);
  const [exam, setExam] = useState<number>(BUILD_DEFAULTS.exam);
  // Until the student edits a count, changing the number of topics keeps the
  // default per-topic coverage instead of leaving a ten-topic set at 10 cards.
  const [countsTouched, setCountsTouched] = useState(false);

  const total = options.length;
  const chosen = options.slice(0, Math.min(count, total));
  const oneTopic = total === 1;

  const chooseTopicCount = (value: number) => {
    setCount(value);
    if (countsTouched) return;
    setCards(Math.min(BUILD_MAX, BUILD_DEFAULTS.cards * value));
    setQuiz(Math.min(BUILD_MAX, BUILD_DEFAULTS.quiz * value));
    setExam(Math.min(BUILD_MAX, BUILD_DEFAULTS.exam * value));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto rounded-[1.75rem] border-border bg-white p-0 shadow-none sm:max-w-lg">
        <div className="px-6 pt-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold text-brand-ink">
              {oneTopic ? "Build a study set" : "Combine topics"}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              {oneTopic
                ? "Build one set from this topic. Choose how much Bluprint should make, then it writes the summary, flashcards, quiz and exam practice."
                : "Build one set from this topic onwards. Choose how many topics it should cover and how much Bluprint should make from them together."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6">
          <p className="mt-5 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-chrome-7">
            {oneTopic ? "Topic in this set" : "Topics in this set"}
          </p>

          {total > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Array.from({ length: total }, (_, index) => index + 1).map((value) => {
                const selected = value === Math.min(count, total);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    disabled={busy}
                    onClick={() => chooseTopicCount(value)}
                    className={cn(
                      "grid size-9 place-items-center rounded-full border text-sm font-semibold tabular-nums transition-colors",
                      selected
                        ? "border-[#191B27] bg-[#191B27] text-white"
                        : "border-border bg-white text-brand-ink/70 hover:bg-brand-panel",
                    )}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          )}

          <ul className="mt-4 space-y-1.5">
            {chosen.map((option, index) => (
              <li
                key={option.id}
                className="flex items-start gap-2.5 rounded-2xl bg-[#FCFCFD] px-3 py-2.5"
              >
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-panel text-[0.66rem] font-semibold tabular-nums text-chrome-7">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.82rem] font-semibold leading-snug text-brand-ink">
                    {option.title}
                  </span>
                  <span className="block text-[0.7rem] leading-snug text-muted-foreground">
                    {option.unit}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[0.68rem] leading-relaxed text-muted-foreground">
            {chosen.length === 1
              ? `One topic makes a normal set. This course has ${total} topic${total === 1 ? "" : "s"} from here.`
              : `${chosen.length} of ${total} topics from here are combined into one set, in pathway order.`}
            {total === 1 ? " This is the last topic on the pathway." : ""}
          </p>

          <div className="mt-5 rounded-2xl border border-border bg-[#FCFCFD] p-4">
            <p className="text-[0.72rem] font-semibold text-brand-ink">
              How much should Bluprint build?
            </p>
            <p className="mt-1 text-[0.68rem] leading-relaxed text-muted-foreground">
              {oneTopic
                ? "These are the totals for this set."
                : "These are totals for the whole combined set. A longer set is generated in batches and takes more time."}
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Flashcards",
                  value: cards,
                  onChange: setCards,
                  aria: "Number of flashcards",
                },
                {
                  label: "Quiz questions",
                  value: quiz,
                  onChange: setQuiz,
                  aria: "Number of quiz questions",
                },
                {
                  label: "Exam-style questions",
                  value: exam,
                  onChange: setExam,
                  aria: "Number of exam-style questions",
                },
              ].map((control) => (
                <label key={control.label} className="block">
                  <span className="flex items-center justify-between gap-2 text-[0.76rem] font-semibold text-brand-ink">
                    {control.label}
                    <span className="rounded-full bg-brand-panel px-2 py-0.5 text-[0.7rem] tabular-nums text-chrome-7">
                      {control.value}
                    </span>
                  </span>
                  <input
                    type="range"
                    min={BUILD_MIN}
                    max={BUILD_MAX}
                    step={1}
                    value={control.value}
                    disabled={busy}
                    onChange={(event) => {
                      setCountsTouched(true);
                      control.onChange(Number(event.target.value));
                    }}
                    aria-label={control.aria}
                    className="mt-2 w-full cursor-pointer accent-chrome-6"
                  />
                  <span className="flex justify-between text-[0.62rem] font-medium text-muted-foreground">
                    <span>{BUILD_MIN}</span>
                    <span>{BUILD_MAX}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <DialogFooter className="mt-5 flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
              className="h-11 rounded-full border-border bg-white px-5 text-sm font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => onBuild(chosen.length, { cards, quiz, exam })}
              disabled={busy || chosen.length === 0}
              className="h-11 rounded-full bg-[#191B27] px-5 text-sm font-semibold text-white hover:bg-[#2A2D3E]"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {chosen.length === 1
                ? "Build study set"
                : `Build set from ${chosen.length} topics`}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
