import { Mascot } from "@/components/Mascot";
import { EASE, SPRING } from "@/components/motion/Motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { useAiAvailability } from "@/lib/useAiAvailability";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  gradeRecall,
  gradeVocabularyRecall,
  normalizeAnswer,
} from "@/convex/lib/recall";
import { useDictation } from "@/hooks/use-dictation";
import { notifyError, readableError } from "@/lib/errors";
import { isConnectionFailure, queueReview } from "@/lib/offlineCache";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAction, useMutation } from "convex/react";
import { motion } from "framer-motion";
import { Check, Keyboard, Mic, MicOff, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";

type Rating = 1 | 2 | 3 | 4;

type StudyCard = Doc<"flashcards"> & { setTitle?: string };

/**
 * A review can be rejected by an older backend that does not know the optional
 * automatic-check fields. Scheduling the card only needs the card id and the
 * rating, so retrying without that metadata is safe when the first write was
 * rejected before it ran. Network failures are not retried immediately: the
 * first write may already have committed, and a second call would count the
 * card twice. The caller queues those locally instead.
 */
function canRetryRatingWithoutGrade(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  if (!message.trim()) return false;
  if (
    /Failed to fetch|NetworkError|fetch failed|timed out|timeout|offline|abort/i.test(
      message,
    )
  ) {
    return false;
  }
  // These are ownership or existence failures; omitting the grade cannot fix
  // them, and the original message is the useful one to show.
  if (
    /Flashcard not found|Study set not found|Please sign in|does not belong|not found|deleted|unauthenticated/i.test(
      message,
    )
  ) {
    return false;
  }
  return true;
}

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
      "border-[#CFE7DC] bg-[#F1FAF6] text-[#0B6B45] hover:bg-[#E5F6EE]",
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
 * Flashcards open on the question, like a physical card. The student can reveal
 * the answer and rate it, or type/dictate an answer first for the automatic
 * concept-unit check. The rating buttons schedule the next showing; they do
 * not replace the check.
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
  const checkByMeaning = useAction(api.ai.gradeRecallAnswer);
  const { unavailable: aiUnavailable } = useAiAvailability();
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [checked, setChecked] = useState(false);
  const [grade, setGrade] = useState<{
    correct: boolean;
    score: number;
    /** The check's one-line explanation, or why it was not used. */
    note?: string;
    coveredUnits: string[];
    missedUnits: string[];
  } | null>(null);
  // True while the answer is with the model, so the student sees that the card
  // is being marked instead of a rating row they might tap too early.
  const [grading, setGrading] = useState(false);
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
    setShowInput(false);
    setChecked(false);
    setGrade(null);
    setGrading(false);
  };

  const reveal = () => {
    if (!current || checked) return;
    dictation.stop();
    setChecked(true);
    setGrade(null);
    setGrading(false);
  };

  const handleCheck = async () => {
    if (!current || checked) return;
    if (typed.trim().length === 0) return;
    dictation.stop();
    setChecked(true);

    const card = current;
    const answer = typed;
    // Vocabulary backs can be full sentences ("The Spanish word ... is 'mi'").
    // Extract and check the quoted term before falling back to concept units.
    const vocabulary = gradeVocabularyRecall(card.front, card.back, answer);
    if (vocabulary.correct) {
      setGrade({
        correct: true,
        score: 1,
        note: "Matched the card answer.",
        coveredUnits: vocabulary.coveredUnits ?? [],
        missedUnits: [],
      });
      return;
    }
    const local = gradeRecall(card.back, answer, {
      threshold: card.recallThreshold ?? 0.75,
      units: card.recallUnits,
    });
    if (normalizeAnswer(answer) === normalizeAnswer(card.back)) {
      setGrade({
        correct: true,
        score: 1,
        note: "Matches the model answer.",
        coveredUnits: local.coveredUnits ?? card.recallUnits ?? [],
        missedUnits: [],
      });
      return;
    }

    // The local key-point check is a complete fallback, so a workspace with no
    // AI should use it immediately instead of waiting for a failed request.
    if (aiUnavailable) {
      setGrade({
        correct: local.correct,
        score: local.score,
        note: "Checked on key points — AI checking isn't connected in this workspace.",
        coveredUnits: local.coveredUnits ?? [],
        missedUnits: local.missedUnits ?? [],
      });
      return;
    }

    setGrading(true);
    try {
      const result = await checkByMeaning({ cardId: card._id, answer });
      setGrade({
        correct: result.correct,
        score: result.score,
        note: result.note,
        coveredUnits: result.coveredUnits,
        missedUnits: result.missedUnits,
      });
    } catch (error) {
      // The automatic check is unavailable: use the same unit-coverage rules
      // locally rather than blocking the session.
      const reason = readableError(error, "");
      setGrade({
        correct: local.correct,
        score: local.score,
        note: `Checked on key points — ${
          (reason || "the automatic check could not be reached.").slice(0, 140)
        }`,
        coveredUnits: local.coveredUnits ?? [],
        missedUnits: local.missedUnits ?? [],
      });
    } finally {
      setGrading(false);
    }
  };

  const rate = async (rating: Rating) => {
    if (!current || saving) return;
    const card = current;
    setSaving(true);

    const queueForSync = (error: unknown) => {
      if (!isConnectionFailure(error)) return false;
      if (!queueReview(card._id, rating)) return false;
      toast.info(
        "Connection dropped. This rating is saved on this device and will sync automatically.",
      );
      return true;
    };

    try {
      await reviewCard({
        cardId: card._id,
        rating,
        source: grade ? "automatic" : "self",
        ...(grade
          ? {
              correct: grade.correct,
              score: grade.score,
              coveredUnits: grade.coveredUnits,
              missedUnits: grade.missedUnits,
            }
          : {}),
      });
    } catch (error) {
      if (queueForSync(error)) {
        // The rating is safe on this device; let the app-shell syncer replay it
        // when the connection returns instead of holding the session open.
      } else if (!grade || !canRetryRatingWithoutGrade(error)) {
        notifyError(error, "Could not save that review. The card has not moved.");
        return;
      } else {
        // During a deploy the page can briefly reach an older backend that only
        // knows the rating. The FSRS write does not depend on the automatic-check
        // metadata, so retry with the fields every version supports rather than
        // losing the review.
        try {
          await reviewCard({ cardId: card._id, rating });
        } catch (retryError) {
          if (queueForSync(retryError)) {
            // Queued locally above; the session can move on.
          } else {
            // A failed write must not move the student past an unreviewed card or
            // count it in the session totals. Leave the card in place so they can
            // retry the rating instead of silently losing the review.
            notifyError(
              retryError,
              "Could not save that review. The card has not moved.",
            );
            return;
          }
        }
      }
    } finally {
      setSaving(false);
    }

    setSession((value) => ({ ...value, [rating]: value[rating] + 1 }));

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
      <div className="surface-card p-10 text-center">
        <Mascot size={92} float={false} className="mx-auto" />
        <p className="mt-3 text-sm text-muted-foreground">
          This set has no flashcards yet.
        </p>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="surface-card p-10 text-center">
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
        className="surface-card mx-auto w-full max-w-2xl p-6 text-center sm:p-9"
      >
        <div className="mx-auto flex size-28 items-center justify-center">
          <Mascot size={112} float={false} />
        </div>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#E9FBF3] px-3 py-1 text-xs font-semibold text-[#0B6B45]">
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-panel px-2.5 py-1 text-[0.7rem] font-semibold text-chrome-7">
            {dictation.supported ? <Mic className="size-3" /> : <Keyboard className="size-3" />}
            Flashcard
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
        className="surface-card mt-4 p-6 sm:p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {sprint && current.setTitle ? current.setTitle : "Question"}
          </p>
          <div className="flex items-center gap-1.5">
            {(current.lapses ?? 0) > 0 && (
              <span className="rounded-full bg-[#FFEEF0] px-2 py-0.5 text-[0.65rem] font-semibold text-[#A81F28]">
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

        {current.beyondNotes && (
          <span
            className="mt-3 inline-block rounded-full bg-brand-panel px-3 py-1 text-[0.7rem] font-semibold text-brand-ink/70"
            title="This card uses material from outside your notes. Check it against them."
          >
            Beyond your notes
          </span>
        )}
        <p className="mt-3 font-display text-[1.35rem] font-bold leading-snug text-brand-ink sm:text-[1.55rem]">
          {current.front}
        </p>

        {!checked && !showInput && (
          <div className="mt-5 rounded-2xl border border-border bg-[#FCFBF8] p-4">
            <p className="text-sm leading-relaxed text-brand-ink/75">
              Try to recall the answer first. Reveal it when you are ready, then
              rate how it felt — just like flipping a physical card.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={reveal}
                className="h-11 flex-1 rounded-full bg-[#191B27] text-sm font-semibold text-white hover:bg-[#2A2D3E]"
              >
                Show answer
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInput(true)}
                className="h-11 flex-1 rounded-full border-border bg-white text-sm font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
              >
                Type answer instead
              </Button>
            </div>
          </div>
        )}

        {!checked && showInput && (
          <>
            <div className="relative mt-5">
              <Textarea
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                placeholder={
                  dictation.listening
                    ? "Listening… speak your answer"
                    : "Say your answer, or type it here"
                }
                rows={3}
                aria-label="Your answer"
                className="min-h-[104px] resize-none rounded-2xl border-border bg-white text-[0.95rem] leading-relaxed text-brand-ink shadow-none placeholder:text-muted-foreground/90 focus-visible:border-chrome-6 focus-visible:ring-chrome-6/15"
              />
              {dictation.listening && (
                <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#FFEEF0] px-2 py-0.5 text-[0.65rem] font-semibold text-[#A81F28]">
                  <span className="size-1.5 animate-pulse rounded-full bg-[#D24350]" />
                  Recording
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {dictation.supported ? (
                <Button
                  type="button"
                  onClick={() => dictation.toggle(typed)}
                  variant="outline"
                  className={cn(
                    "h-9 rounded-full px-3 text-[0.78rem] font-semibold shadow-none",
                    dictation.listening
                      ? "border-[#F6D2D6] bg-[#FFEEF0] text-[#A81F28] hover:bg-[#FFE3E6]"
                      : "border-border bg-white text-brand-ink hover:bg-brand-panel",
                  )}
                >
                  {dictation.listening ? (
                    <MicOff className="size-3.5" />
                  ) : (
                    <Mic className="size-3.5 text-chrome-7" />
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
              disabled={typed.trim().length === 0}
              className="mt-4 h-12 w-full rounded-full bg-[#191B27] text-sm font-semibold text-white hover:bg-[#2A2D3E] disabled:bg-[#191B27]/30"
            >
              Check answer
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={reveal}
              className="mt-2 h-10 w-full rounded-full border-border bg-white text-[0.8rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
            >
              Show answer instead
            </Button>

            <p className="mt-2 text-center text-[0.7rem] font-medium text-muted-foreground">
              Bluprint checks the key points your answer included and shows what
              was credited and what was missed.
            </p>
          </>
        )}

        {checked && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <div className="mt-5 rounded-2xl border border-border bg-[#FCFBF8] p-4">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#0B6B45]">
                Model answer
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-brand-ink/85">
                {current.back}
              </p>
            </div>

            {grading && (
              <div className="mt-3 flex items-center gap-2 rounded-2xl bg-brand-panel p-3 text-[0.8rem] font-medium text-chrome-7">
                <span
                  aria-hidden
                  className="size-3.5 animate-spin rounded-full border-2 border-chrome-6/35 border-t-chrome-7"
                />
                Checking what your answer means…
              </div>
            )}

            {grade && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className={cn(
                  "mt-3 flex items-start gap-2 rounded-2xl p-3 text-[0.8rem] leading-relaxed",
                  grade.correct
                    ? "bg-[#E9FBF3] text-[#0F7A50]"
                    : "bg-[#FFEEF0] text-[#A81F28]",
                )}
              >
                {grade.correct ? (
                  <Check className="mt-0.5 size-4 shrink-0" />
                ) : (
                  <X className="mt-0.5 size-4 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">
                    {grade.correct ? "Key points credited" : "Not quite"}
                  </p>
                  <p className="mt-0.5">
                    {grade.note?.trim() ||
                      `You included ${grade.coveredUnits.length} key points.`}
                  </p>
                  {grade.coveredUnits.length > 0 && (
                    <p className="mt-1.5 text-[0.72rem] font-semibold">
                      Credited: {grade.coveredUnits.join(", ")}
                    </p>
                  )}
                  {grade.missedUnits.length > 0 && (
                    <p className="mt-1 text-[0.72rem] font-semibold opacity-80">
                      Missed: {grade.missedUnits.join(", ")}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            <div className="mt-4">
              <p className="text-[0.72rem] font-semibold text-brand-ink/60">
                {grading
                  ? "Rate how it felt once the check finishes."
                  : grade
                    ? grade.correct
                      ? "Bluprint suggests Good. Rate how it actually felt."
                      : "Rate how it felt, then the model answer comes back sooner."
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
                      disabled={saving || grading}
                      onClick={() => void rate(entry.rating)}
                      aria-label={`${entry.label}: ${entry.hint}`}
                      className={cn(
                        "rounded-2xl border px-2 py-2.5 text-[0.8rem] font-semibold transition-colors disabled:opacity-60",
                        entry.className,
                        suggested && "ring-2 ring-chrome-6/45 ring-offset-1",
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
              <Sparkles className="size-3 text-chrome-7" aria-hidden />
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
