import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EASE, EASE_EXIT } from "@/components/motion/Motion";
import { BUILD_MAX, BUILD_MIN } from "@/convex/lib/buildDefaults";
import {
  buildCountLimits,
  initialBuildCounts,
} from "@/lib/buildCounts";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { AI_NOT_CONFIGURED_MESSAGE } from "@/lib/aiAvailability";
import { notifyError, readableError } from "@/lib/errors";
import { useAiAvailability } from "@/lib/useAiAvailability";
import { useAction, useMutation } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

/**
 * Sets the size of the next rebuild.
 *
 * Everything else about a set has a home elsewhere — the name is renamed on the
 * set page, and the course, board and level are chosen when it is built — so
 * this dialog is only the three count sliders.
 */
export function SetSettingsDialog({
  set,
  open,
  onOpenChange,
}: {
  set: Doc<"studySets">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto rounded-3xl border-border bg-card p-0 shadow-none sm:max-w-xl">
        <BuildCountsEditor set={set} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * The counts form. It lives inside the dialog's content, which unmounts when
 * the dialog closes, so every open starts from the set's stored targets without
 * a reset effect racing the first render.
 */
function BuildCountsEditor({
  set,
  onClose,
}: {
  set: Doc<"studySets">;
  onClose: () => void;
}) {
  const saveCounts = useMutation(api.studySets.setBuildCounts);
  const removeSet = useMutation(api.studySets.remove);
  const processSet = useAction(api.ai.processStudySet);
  const { unavailable: aiUnavailable } = useAiAvailability();
  const navigate = useNavigate();

  // Course sets are written from their pathway, so their ceiling is the
  // account maximum; notes-built sets stop at what the material can support.
  // See `buildCountLimits` for why the old one-size cap pinned tutor sliders.
  const pathway = set.courseId !== undefined;
  const limits = buildCountLimits(set);
  const maxCards = limits.cards;
  const maxQuiz = limits.quiz;
  const maxExam = limits.exam;
  const [initial] = useState(() => initialBuildCounts(set));

  const [cardCount, setCardCount] = useState(initial.cards);
  const [quizCount, setQuizCount] = useState(initial.quiz);
  const [examCount, setExamCount] = useState(initial.exam);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // A rebuild started here is fire-and-forget. If the set is deleted while it
  // is still running, its rejection must not pop an error beside "Set deleted."
  const deletedRef = useRef(false);

  const rebuild = async () => {
    if (aiUnavailable) {
      setError(AI_NOT_CONFIGURED_MESSAGE);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveCounts({
        setId: set._id,
        targetCardCount: cardCount,
        targetQuizCount: quizCount,
        targetExamCount: examCount,
      });

      // The rebuild is a long action. Start it, close the dialog, and let the
      // set page show live progress and any error panel.
      void processSet({ setId: set._id }).catch((rebuildError) => {
        if (deletedRef.current) return;
        toast.error(
          readableError(
            rebuildError,
            "The rebuild stopped. Open the set to retry.",
          ),
        );
      });
      toast.success("Rebuilding with the new counts.");
      onClose();
    } catch (saveError) {
      const message = readableError(saveError, "Could not save those changes.");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await removeSet({ setId: set._id });
      deletedRef.current = true;
      toast.success("Set deleted.");
      setConfirmingDelete(false);
      onClose();
      navigate("/tutor");
    } catch (deleteError) {
      deletedRef.current = false;
      notifyError(deleteError, "Could not delete that set.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="px-6 pb-4 pt-6 sm:px-7">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold text-brand-ink">
              Build counts
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Choose how large the next rebuild should be. Your notes, cards and
              review history are kept.
            </DialogDescription>
          </DialogHeader>
        </motion.div>
      </div>

      <div className="px-6 pb-6 sm:px-7">
        <div className="rounded-2xl border border-border bg-[#FCFCFD] p-3.5">
          <p className="text-xs font-semibold text-brand-ink">
            Counts for the next rebuild
          </p>
          <p className="mt-0.5 text-[0.7rem] leading-relaxed text-muted-foreground">
            {`${pathway ? `This course set is built from its pathway, so the sliders run to the account maximum of ${BUILD_MAX}.` : `These notes support up to ${maxCards} flashcards, ${maxQuiz} quiz questions and ${maxExam} exam questions; the account maximum is ${BUILD_MAX}. The sliders stop at the real ceiling.`} These are targets for the next rebuild, not the current set. It currently holds ${set.cardCount} flashcard${set.cardCount === 1 ? "" : "s"}, ${set.quizCount} quiz question${set.quizCount === 1 ? "" : "s"} and ${set.examCount} exam question${set.examCount === 1 ? "" : "s"}.`}
          </p>
          <div className="rise-stagger mt-3 grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "Flashcards",
                value: cardCount,
                max: maxCards,
                current: set.cardCount,
                onChange: setCardCount,
              },
              {
                label: "Quiz questions",
                value: quizCount,
                max: maxQuiz,
                current: set.quizCount,
                onChange: setQuizCount,
              },
              {
                label: "Exam-style questions",
                value: examCount,
                max: maxExam,
                current: set.examCount,
                onChange: setExamCount,
              },
            ].map((control) => (
              <label key={control.label} className="block">
                <span className="flex items-center justify-between gap-1.5 text-[0.7rem] font-semibold text-brand-ink">
                  {control.label}
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-[0.66rem] tabular-nums text-chrome-7">
                    {control.value}
                  </span>
                </span>
                <span className="mt-0.5 block text-[0.62rem] font-normal text-muted-foreground">
                  currently {control.current}
                </span>
                <input
                  type="range"
                  min={BUILD_MIN}
                  max={control.max}
                  step={1}
                  value={control.value}
                  disabled={saving}
                  onChange={(event) => control.onChange(Number(event.target.value))}
                  aria-label={control.label}
                  className="mt-1.5 w-full cursor-pointer accent-chrome-6"
                />
              </label>
            ))}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {error && (
            <motion.p
              key={error}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{
                opacity: 0,
                y: -4,
                transition: { duration: 0.22, ease: EASE_EXIT },
              }}
              transition={{ duration: 0.25, ease: EASE }}
              className="mt-4 rounded-2xl bg-[#FFEEF0] px-3.5 py-2.5 text-xs leading-relaxed text-[#A81F28]"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onClose}
            className="h-11 rounded-full border-border bg-white px-5 text-sm font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void rebuild()}
            className="h-11 rounded-full bg-[#191B27] px-5 text-sm font-semibold text-white hover:bg-[#2A2D3E]"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Rebuild with these counts
          </Button>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-[0.72rem] leading-relaxed text-muted-foreground">
            Deleting removes this set, its cards, quizzes and uploaded images.
          </p>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="text-[0.78rem] font-semibold text-destructive underline-offset-2 hover:underline"
          >
            Delete set
          </button>
        </div>
      </div>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Delete “{set.title}”?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This removes the extracted notes, flashcards, quiz, exam practice and
              uploaded images. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="rounded-full">
              Keep set
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              className="rounded-full bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
              Delete set
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
