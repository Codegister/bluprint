import { Mascot } from "@/components/Mascot";
import { EASE, SPRING } from "@/components/motion/Motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { gradeRecall } from "@/convex/lib/recall";
import { useDictation } from "@/hooks/use-dictation";
import { readableError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import { Check, Keyboard, Mic, MicOff, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Rating = 1 | 2 | 3 | 4;

type StudyCard = Doc<"flashcards"> & { setTitle?: string };

/** Due cards first, then authored order. */
function sortCards(cards: StudyCard[]): StudyCard[] {
  return [...cards].sort(
    (a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0) || a.order - b.order,
  );
}

const RATINGS: Array<{
  rating: Rating;
  label: string;
  hint: string;
  className: string;
}> = [
  {
    rating: 1,
    label: "Again",
    hint: "Forgot it",
    className:
      "border-[#F6D2D6] bg-[#FFEEF0] text-[#D24350] hover:bg-[#FFE3E6]",
  },
  {
    rating: 2,
    label: "Hard",
    hint: "Struggled",
    className:
      "border-[#F3E2C8] bg-[#FFF7E8] text-[#A66A0A] hover:bg-[#FFF1D8]",
  },
  {
    rating: 3,
    label: "Good",
    hint: "Recalled it",
    className:
      "border-[#CFE7DC] bg-[#F1FAF6] text-[#128A5B] hover:bg-[#E5F6EE]",
  },
  {
    rating: 4,
    label: "Easy",
    hint: "Instant",
    className:
      "border-[#C9DDF6] bg-[#EFF6FF] text-[#1D5FA8] hover:bg-[#E3EFFD]",
  },
];

/**
 * Typed recall is the default flashcard mode. The student says the answer out
 * loud (the browser turns it into text) or types it, then Bluprint compares the
 * words with the model answer. The self-mark toggle skips the automatic
 * comparison for when speaking or listening is not possible.
 *
 * Every finished card is scheduled by FSRS with one of four ratings, so the
 * next review date follows the memory rather than a fixed interval.
 */
export function FlashcardReview({
  cards,
  onTakeQuiz,
  sprint = false,
}: {
  cards: StudyCard[];
  onTakeQuiz?: () => void;
  /** Sprint sessions mix sets and show each card's set name. */
  sprint?: boolean;
}) {
  const reviewCard = useMutation(api.studySets.reviewCard);
  const [selfMark, setSelfMark] = useState(false);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [checked, setChecked] = useState(false);
  const [grade, setGrade] = useState<{ correct: boolean; score: number } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const [session, setSession] = useState<Record<Rating, number>>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  });

  const dictation = useDictation(setTyped);

  // The session snapshots both order and cards. A live query re-sorts a card
  // when its dueAt changes, and a weak-spot or sprint query drops a card as
  // soon as it stops matching — either would skip the next card mid-session.
  const [sessionCards] = useState<StudyCard[]>(cards);
  const [queueIds, setQueueIds] = useState<string[]>(() =>
    sortCards(cards).map((card) => card._id),
  );
  const queue = useMemo(
    () =>
      queueIds
        .map((id) => sessionCards.find((card) => card._id === id))
        .filter((card): card is StudyCard => Boolean(card)),
    [queueIds, sessionCards],
  );
  const liveDue = useMemo(
    () => new Map(cards.map((card) => [card._id, card.dueAt ?? 0])),
    [cards],
  );
  // Reading the clock during render is impure; the session takes one snapshot
  // instead. Reviewed cards move past it as their new dueAt arrives.
  const [sessionStart] = useState(() => Date.now());
  const dueCount = useMemo(
    () =>
      queue.filter(
        // A card missing from the live list has already left this queue (a
        // weak-spot card that recovered, or a sprint card that is no longer
        // due), so it should not be counted as due.
        (card) => (liveDue.get(card._id) ?? Number.POSITIVE_INFINITY) <= sessionStart,
      ).length,
    [queue, liveDue, sessionStart],
  );

  const current = queue[index];
  const answered = session[1] + session[2] + session[3] + session[4];

  const resetCard = () => {
    dictation.stop();
    dictation.clear();
    setTyped("");
    setChecked(false);
    setGrade(null);
  };

  const handleCheck = () => {
    if (!current || checked) return;
    // Automatic marking needs an answer; self-mark only needs the answer shown.
    if (!selfMark && typed.trim().length === 0) return;
    dictation.stop();
    setChecked(true);
    if (selfMark) {
      // No automatic marking: the student compares their answer and rates it.
      setGrade(null);
      return;
    }
    setGrade(gradeRecall(current.back, typed));
  };

  const rate = async (rating: Rating) => {
    if (!current || saving) return;
    const card = current;
    setSaving(true);
    setSession((value) => ({ ...value, [rating]: value[rating] + 1 }));

    try {
      await reviewCard({ cardId: card._id, rating });
    } catch (error) {
      toast.error(readableError(error, "Could not save that review."));
    } finally {
      setSaving(false);
    }

    if (index + 1 >= queue.length) {
      setFinished(true);
      dictation.stop();
    } else {
      setIndex((value) => value + 1);
      resetCard();
    }
  };

  const restart = () => {
    setQueueIds(sortCards(sessionCards).map((card) => card._id));
    setIndex(0);
    setFinished(false);
    setSession({ 1: 0, 2: 0, 3: 0, 4: 0 });
    resetCard();
  };

  if (queue.length === 0) {
    return (
      <div className="gizmo-card p-10 text-center">
        <Mascot size={92} float={false} className="mx-auto" />
        <p className="mt-3 text-sm text-muted-foreground">
          This set has no flashcards yet.
        </p>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="gizmo-card p-10 text-center">
        <Mascot size={92} float={false} className="mx-auto" />
        <p className="mt-3 text-sm text-muted-foreground">
          These cards changed while you were reviewing. Reload to start a fresh
          session.
        </p>
      </div>
    );
  }

  if (finished) {
    const recall = answered
      ? Math.round(((session[2] + session[3] + session[4]) / answered) * 100)
      : 0;
    const strong = session[3] + session[4];
    return (
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="gizmo-card mx-auto w-full max-w-2xl p-6 text-center sm:p-9"
      >
        <div className="mx-auto flex size-28 items-center justify-center">
          <Mascot size={112} float={false} />
        </div>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#E9FBF3] px-3 py-1 text-xs font-semibold text-[#128A5B]">
          {sprint ? "Sprint complete" : "Session complete"}
        </p>
        <h3 className="mt-3 font-display text-2xl font-bold text-brand-ink">
          {answered} card{answered === 1 ? "" : "s"} recalled
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {recall}% came back without a stumble. FSRS has already set the next
          date for every card, so the ones you found hard will return first.
        </p>

        <div className="mx-auto mt-6 grid max-w-md grid-cols-4 gap-2">
          {RATINGS.map((entry) => (
            <div
              key={entry.rating}
              className="rounded-2xl border border-border bg-white p-3"
            >
              <p className="font-display text-xl font-bold tabular-nums text-brand-ink">
                {session[entry.rating]}
              </p>
              <p className="mt-0.5 text-[0.7rem] font-medium text-muted-foreground">
                {entry.label}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs font-medium text-muted-foreground">
          {strong} of {answered} answered Good or Easy
        </p>

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={restart}
            className="h-11 rounded-full border-border bg-white px-6 font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
          >
            Review again
          </Button>
          {onTakeQuiz && (
            <Button
              onClick={onTakeQuiz}
              className="h-11 rounded-full bg-[#191B27] px-6 font-semibold text-white hover:bg-[#2A2D3E]"
            >
              Take quiz
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3ECFF] px-2.5 py-1 text-[0.7rem] font-semibold text-[#5B3DF5]">
            {dictation.supported ? <Mic className="size-3" /> : <Keyboard className="size-3" />}
            Typed recall
          </span>
          <p className="text-sm font-semibold text-brand-ink">
            Card {index + 1} of {queue.length}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {dueCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-[#FFF3E8] px-2.5 py-1 text-[0.7rem] font-semibold text-[#C2660F]">
              {dueCount} due now
            </span>
          )}
          <button
            type="button"
            aria-pressed={selfMark}
            onClick={() => setSelfMark((value) => !value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold transition-colors",
              selfMark
                ? "border-[#B9A6FF] bg-[#F3ECFF] text-[#5B3DF5]"
                : "border-border bg-white text-brand-ink/60 hover:bg-brand-panel",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-2 rounded-full",
                selfMark ? "bg-[#5B3DF5]" : "bg-brand-ink/25",
              )}
            />
            Self-mark
          </button>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#E7E7EF]">
        <motion.div
          className="h-full rounded-full bg-brand-pink"
          animate={{ width: `${Math.max(4, ((index + 1) / queue.length) * 100)}%` }}
          transition={{ duration: 0.5, ease: EASE }}
        />
      </div>

      <motion.div
        key={current._id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
        className="gizmo-card mt-4 p-6 sm:p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {sprint && current.setTitle ? current.setTitle : "Question"}
          </p>
          <div className="flex items-center gap-1.5">
            {(current.lapses ?? 0) > 0 && (
              <span className="rounded-full bg-[#FFEEF0] px-2 py-0.5 text-[0.65rem] font-semibold text-[#C93C49]">
                Weak spot
              </span>
            )}
            <span className="text-[0.68rem] font-medium text-muted-foreground">
              {current.reviewCount > 0
                ? `Reviewed ${current.reviewCount}×`
                : "First pass"}
            </span>
          </div>
        </div>

        <p className="mt-3 font-display text-[1.35rem] font-bold leading-snug text-brand-ink sm:text-[1.55rem]">
          {current.front}
        </p>

        {!checked ? (
          <>
            <div className="relative mt-5">
              <Textarea
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                placeholder={
                  dictation.listening
                    ? "Listening… speak your answer"
                    : selfMark
                      ? "Optional: type your answer, or reveal it and mark yourself"
                      : "Say your answer, or type it here"
                }
                rows={3}
                aria-label="Your answer"
                className="min-h-[104px] resize-none rounded-2xl border-border bg-white text-[0.95rem] leading-relaxed text-brand-ink shadow-none placeholder:text-muted-foreground/60 focus-visible:border-[#B9A6FF] focus-visible:ring-[#7C5CFF]/15"
              />
              {dictation.listening && (
                <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#FFEEF0] px-2 py-0.5 text-[0.65rem] font-semibold text-[#C93C49]">
                  <span className="size-1.5 animate-pulse rounded-full bg-[#D24350]" />
                  Recording
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {dictation.supported ? (
                <Button
                  type="button"
                  onClick={dictation.toggle}
                  variant="outline"
                  className={cn(
                    "h-9 rounded-full px-3 text-[0.78rem] font-semibold shadow-none",
                    dictation.listening
                      ? "border-[#F6D2D6] bg-[#FFEEF0] text-[#C93C49] hover:bg-[#FFE3E6]"
                      : "border-border bg-white text-brand-ink hover:bg-brand-panel",
                  )}
                >
                  {dictation.listening ? (
                    <MicOff className="size-3.5" />
                  ) : (
                    <Mic className="size-3.5 text-[#5B3DF5]" />
                  )}
                  {dictation.listening ? "Stop dictation" : "Speak your answer"}
                </Button>
              ) : (
                <p className="text-[0.72rem] font-medium text-muted-foreground">
                  Dictation is not available in this browser — type instead.
                </p>
              )}
              <span className="ml-auto text-[0.7rem] font-medium tabular-nums text-muted-foreground">
                {typed.trim() ? `${typed.trim().split(/\s+/).length} words` : "No answer yet"}
              </span>
            </div>

            {dictation.error && (
              <p className="mt-2 rounded-xl bg-[#FFF6E5] px-3 py-2 text-[0.72rem] leading-relaxed text-[#96650A]">
                {dictation.error}
              </p>
            )}

            <Button
              onClick={handleCheck}
              disabled={!selfMark && typed.trim().length === 0}
              className="mt-4 h-12 w-full rounded-full bg-[#191B27] text-sm font-semibold text-white hover:bg-[#2A2D3E] disabled:bg-[#191B27]/30"
            >
              {selfMark ? "Reveal answer" : "Check answer"}
            </Button>

            <p className="mt-2 text-center text-[0.7rem] font-medium text-muted-foreground">
              {selfMark
                ? "Self-mark is on: compare with the answer, then rate yourself."
                : "Bluprint compares your words with the model answer."}
            </p>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <div className="mt-5 rounded-2xl border border-border bg-[#FCFBF8] p-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#128A5B]">
                Model answer
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-brand-ink/85">
                {current.back}
              </p>
            </div>

            {grade && (
              <div
                className={cn(
                  "mt-3 flex items-start gap-2 rounded-2xl p-3 text-[0.8rem] leading-relaxed",
                  grade.correct
                    ? "bg-[#E9FBF3] text-[#0F7A50]"
                    : "bg-[#FFEEF0] text-[#C93C49]",
                )}
              >
                {grade.correct ? (
                  <Check className="mt-0.5 size-4 shrink-0" />
                ) : (
                  <X className="mt-0.5 size-4 shrink-0" />
                )}
                <p>
                  {grade.correct
                    ? "That matches the answer. Say it once more in your own words to lock it in."
                    : `Not quite — you recalled ${Math.round(grade.score * 100)}% of the key words. Read the model answer, then rate how it felt.`}
                </p>
              </div>
            )}

            <div className="mt-4">
              <p className="text-[0.72rem] font-semibold text-brand-ink/60">
                {grade
                  ? grade.correct
                    ? "Bluprint suggests Good. Rate how it actually felt."
                    : "Not quite. Rate how it felt, then the model answer comes back sooner."
                  : "Compare with the answer, then rate yourself."}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {RATINGS.map((entry) => {
                  const suggested =
                    grade !== null &&
                    entry.rating === (grade.correct ? 3 : 1);
                  return (
                    <button
                      key={entry.rating}
                      type="button"
                      disabled={saving}
                      onClick={() => void rate(entry.rating)}
                      aria-label={`${entry.label}: ${entry.hint}`}
                      className={cn(
                        "rounded-2xl border px-2 py-2.5 text-[0.8rem] font-semibold transition-colors disabled:opacity-60",
                        entry.className,
                        suggested && "ring-2 ring-[#5B3DF5]/45 ring-offset-1",
                      )}
                    >
                      {entry.label}
                      <span className="mt-0.5 block text-[0.65rem] font-medium opacity-70">
                        {suggested ? "Suggested" : entry.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-[0.7rem] font-medium text-muted-foreground">
              <Sparkles className="size-3 text-[#5B3DF5]" aria-hidden />
              Your rating sets the next review with FSRS.
            </p>
          </motion.div>
        )}
      </motion.div>

      <p className="mt-3 text-center text-xs font-medium text-muted-foreground">
        {answered} answered this session · every rating is saved
      </p>
    </div>
  );
}
