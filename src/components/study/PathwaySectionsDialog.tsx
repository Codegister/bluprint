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
import type { PathwayPartOption } from "@/lib/pathwaySections";
import { plural } from "@/lib/format";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { TopicPicker } from "@/components/study/TopicPicker";

export type BuildCounts = {
  cards: number;
  quiz: number;
  exam: number;
};

function defaultsFor(topicCount: number): BuildCounts {
  const scale = Math.max(1, topicCount);
  return {
    cards: Math.min(BUILD_MAX, BUILD_DEFAULTS.cards * scale),
    quiz: Math.min(BUILD_MAX, BUILD_DEFAULTS.quiz * scale),
    exam: Math.min(BUILD_MAX, BUILD_DEFAULTS.exam * scale),
  };
}

/**
 * Builds a study set from whole pathway parts, or from one topic when opened
 * from inside an expanded part. A part includes every topic it contains, so the
 * number of choices here matches the number of parts on the pathway instead of
 * flattening those parts into their individual topics.
 *
 * The caller gives this a `key` per opening, so the initial selection starts
 * cleanly without an effect resetting it after a render.
 */
export function PathwaySectionsDialog({
  open,
  onOpenChange,
  options,
  initialSelectedIds,
  busy,
  onBuild,
  noun = "part",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: PathwayPartOption[];
  initialSelectedIds: readonly string[];
  busy: boolean;
  onBuild: (topicIds: string[], counts: BuildCounts) => void;
  /** "topic" is used for the single-topic build opened from a part. */
  noun?: "part" | "topic";
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const available = new Set(options.map((option) => option.id));
    const chosen = initialSelectedIds.filter((id) => available.has(id));
    return chosen.length > 0
      ? chosen
      : options.slice(0, 1).map((option) => option.id);
  });
  const initialCounts = defaultsFor(
    options
      .filter((option) => selectedIds.includes(option.id))
      .reduce((sum, option) => sum + option.topicCount, 0),
  );
  const [cards, setCards] = useState<number>(initialCounts.cards);
  const [quiz, setQuiz] = useState<number>(initialCounts.quiz);
  const [exam, setExam] = useState<number>(initialCounts.exam);
  // Until the student edits a count, changing the selection keeps the default
  // per-topic coverage instead of leaving a longer set at one topic's totals.
  const [countsTouched, setCountsTouched] = useState(false);

  const selected = options.filter((option) => selectedIds.includes(option.id));
  const selectedCount = selected.length;
  const selectedTopicCount = selected.reduce(
    (sum, option) => sum + option.topicCount,
    0,
  );
  const totalTopicCount = options.reduce(
    (sum, option) => sum + option.topicCount,
    0,
  );
  const oneChoice = options.length === 1;
  const choicePlural = noun === "part" ? "parts" : "topics";

  const chooseOptions = (optionIds: string[]) => {
    setSelectedIds(optionIds);
    if (countsTouched) return;
    const topicCount = options
      .filter((option) => optionIds.includes(option.id))
      .reduce((sum, option) => sum + option.topicCount, 0);
    const next = defaultsFor(topicCount);
    setCards(next.cards);
    setQuiz(next.quiz);
    setExam(next.exam);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto rounded-[1.75rem] border-border bg-white p-0 shadow-none sm:max-w-xl">
        <div className="px-6 pt-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold text-brand-ink">
              {selectedCount > 1
                ? `Build a set from ${selectedCount} ${choicePlural}`
                : "Build a study set"}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              {noun === "part"
                ? "Choose any whole parts below. Bluprint builds one set from every topic in the parts you tick, in pathway order."
                : "Build one set from this topic. Choose how much Bluprint should make, then it writes the summary, flashcards, quiz and exam practice."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6">
          <p className="mt-5 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-chrome-7">
            {oneChoice
              ? noun === "part"
                ? "Part in this set"
                : "Topic in this set"
              : `Choose ${choicePlural}`}
          </p>

          <div className="mt-2">
            <TopicPicker
              options={options}
              selectedIds={selectedIds}
              onChange={chooseOptions}
              disabled={busy}
              noun={noun}
            />
          </div>

          <p className="mt-3 text-[0.68rem] leading-relaxed text-muted-foreground">
            {selectedCount === 0
              ? `Choose at least one ${noun} to build a set.`
              : noun === "topic"
                ? "One topic makes a normal set."
                : selectedCount === 1
                  ? `This part includes ${plural(selectedTopicCount, "topic")}.`
                  : `${selectedCount} parts include ${plural(selectedTopicCount, "topic")} in one set, in pathway order.`}
            {noun === "part" && selectedCount > 0
              ? ` This course has ${options.length} part${options.length === 1 ? "" : "s"}, covering ${plural(totalTopicCount, "topic")}.`
              : ""}
          </p>

          <div className="mt-5 rounded-2xl border border-border bg-[#FCFCFD] p-4">
            <p className="text-[0.72rem] font-semibold text-brand-ink">
              How much should Bluprint build?
            </p>
            <p className="mt-1 text-[0.68rem] leading-relaxed text-muted-foreground">
              {selectedTopicCount <= 1
                ? "These are the totals for this set."
                : "These are totals for the whole selected set. A longer set is generated in batches and takes more time."}
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
              onClick={() =>
                onBuild(
                  selected.flatMap((option) => option.topicIds),
                  { cards, quiz, exam },
                )
              }
              disabled={busy || selectedCount === 0}
              className="h-11 rounded-full bg-[#191B27] px-5 text-sm font-semibold text-white hover:bg-[#2A2D3E]"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {selectedCount === 0
                ? `Choose ${choicePlural}`
                : selectedCount === 1
                  ? "Build study set"
                  : `Build set from ${selectedCount} ${choicePlural}`}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
