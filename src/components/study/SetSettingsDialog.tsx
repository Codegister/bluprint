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
import { Input } from "@/components/ui/input";
import { EASE, EASE_EXIT } from "@/components/motion/Motion";
import {
  BUILD_DEFAULTS,
  BUILD_MAX,
  BUILD_MIN,
} from "@/convex/lib/buildDefaults";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { notifyError, readableError } from "@/lib/errors";
import { EXAM_BOARDS, STUDY_LEVELS, qualificationLabel } from "@/lib/examBoards";
import { cn } from "@/lib/utils";
import { useAction, useMutation } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

/**
 * Edits a set's name, course and exam context after it exists.
 *
 * The metadata alone does not change already-generated questions, so the
 * second action saves and rebuilds in one step. That is the only way to make
 * an existing set use a new board's mark-scheme conventions.
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
  const updateDetails = useMutation(api.studySets.updateDetails);
  const saveExamDate = useMutation(api.studySets.setExamDate);
  const removeSet = useMutation(api.studySets.remove);
  const processSet = useAction(api.ai.processStudySet);
  const navigate = useNavigate();

  const [title, setTitle] = useState(set.title);
  const [course, setCourse] = useState(set.course ?? "");
  const [examBoard, setExamBoard] = useState(set.examBoard ?? "");
  const [level, setLevel] = useState(set.level ?? "");
  const [cardCount, setCardCount] = useState(
    set.targetCardCount ?? BUILD_DEFAULTS.cards,
  );
  const [quizCount, setQuizCount] = useState(
    set.targetQuizCount ?? BUILD_DEFAULTS.quiz,
  );
  const [examCount, setExamCount] = useState(
    set.targetExamCount ?? BUILD_DEFAULTS.exam,
  );
  const [examDate, setExamDate] = useState(set.examDate ?? "");
  const [saving, setSaving] = useState<"save" | "rebuild" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // A rebuild started here is fire-and-forget. If the set is deleted while it
  // is still running, its rejection must not pop an error beside "Set deleted."
  const deletedRef = useRef(false);
  const countsChanged =
    cardCount !== (set.targetCardCount ?? BUILD_DEFAULTS.cards) ||
    quizCount !== (set.targetQuizCount ?? BUILD_DEFAULTS.quiz) ||
    examCount !== (set.targetExamCount ?? BUILD_DEFAULTS.exam);
  const contextChanged =
    examBoard !== (set.examBoard ?? "") || level !== (set.level ?? "");
  const rebuildNeeded = countsChanged || contextChanged;
  // The button names the decision it carries out. A count change and a board
  // change have different consequences, and "Save and rebuild" hid both.
  const rebuildLabel =
    countsChanged && contextChanged
      ? "Rebuild with these counts and board/level"
      : countsChanged
        ? "Rebuild with these counts"
        : contextChanged
          ? "Rebuild for the new board/level"
          : "Save and rebuild";

  // Re-sync every time the dialog opens so a cancelled edit is discarded.
  useEffect(() => {
    if (!open) return;
    setTitle(set.title);
    setCourse(set.course ?? "");
    setExamBoard(set.examBoard ?? "");
    setLevel(set.level ?? "");
    setCardCount(set.targetCardCount ?? BUILD_DEFAULTS.cards);
    setQuizCount(set.targetQuizCount ?? BUILD_DEFAULTS.quiz);
    setExamCount(set.targetExamCount ?? BUILD_DEFAULTS.exam);
    setExamDate(set.examDate ?? "");
    setError(null);
    deletedRef.current = false;
  }, [
    open,
    set.title,
    set.course,
    set.examBoard,
    set.level,
    set.targetCardCount,
    set.targetQuizCount,
    set.targetExamCount,
    set.examDate,
  ]);

  const save = async (rebuild: boolean) => {
    if (title.trim().length < 2) {
      setError("Give the set a name first.");
      return;
    }
    setSaving(rebuild ? "rebuild" : "save");
    setError(null);
    try {
      await updateDetails({
        setId: set._id,
        title: title.trim(),
        course: course.trim() || undefined,
        examBoard: examBoard || undefined,
        level: level || undefined,
        targetCardCount: cardCount,
        targetQuizCount: quizCount,
        targetExamCount: examCount,
      });

      // The exam date drives the goal and the pace plan, so it is saved even
      // when the material itself is not being rebuilt.
      await saveExamDate({
        setId: set._id,
        examDate: examDate.trim() || undefined,
      });

      if (rebuild) {
        // The rebuild is a long action. Start it, close the dialog, and let the
        // set page show live progress and any error panel.
        void processSet({ setId: set._id }).catch((rebuildError) => {
          if (deletedRef.current) return;
          toast.error(
            readableError(rebuildError, "The rebuild stopped. Open the set to retry."),
          );
        });
        toast.success("Rebuilding with the new settings.");
      } else {
        toast.success("Set details saved.");
      }
      onOpenChange(false);
    } catch (saveError) {
      const message = readableError(saveError, "Could not save those changes.");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(null);
    }
  };

  const qualification = qualificationLabel({ examBoard, level, course });

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await removeSet({ setId: set._id });
      deletedRef.current = true;
      toast.success("Set deleted.");
      setConfirmingDelete(false);
      onOpenChange(false);
      navigate("/tutor");
    } catch (deleteError) {
      deletedRef.current = false;
      notifyError(deleteError, "Could not delete that set.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto rounded-3xl border-border bg-card p-0 shadow-none sm:max-w-xl">
        <div className="px-6 pb-4 pt-6 sm:px-7">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold text-brand-ink">
              Set details
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Keep the name current and tell Bluprint which board and level this set is
              for, so exam questions and marking match that paper.
            </DialogDescription>
          </DialogHeader>
          </motion.div>
        </div>

        <div className="px-6 pb-6 sm:px-7">
          <div>
            <label htmlFor="set-settings-title" className="text-xs font-semibold text-brand-ink">
              Set name
            </label>
            <Input
              id="set-settings-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={80}
              disabled={saving !== null}
              className="mt-2 h-11 rounded-2xl border-border bg-white text-sm text-brand-ink shadow-none focus-visible:border-chrome-6 focus-visible:ring-chrome-6/15"
            />
          </div>

          <div className="mt-4">
            <label htmlFor="set-settings-course" className="text-xs font-semibold text-brand-ink">
              Course <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="set-settings-course"
              value={course}
              onChange={(event) => setCourse(event.target.value)}
              placeholder="e.g. Biology"
              maxLength={60}
              disabled={saving !== null}
              className="mt-2 h-10 rounded-2xl border-border bg-white text-sm text-brand-ink shadow-none placeholder:text-muted-foreground/90 focus-visible:border-chrome-6 focus-visible:ring-chrome-6/15"
            />
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold text-brand-ink">
              Exam board <span className="font-normal text-muted-foreground">(optional)</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAM_BOARDS.map((board) => {
                const selected = examBoard === board;
                return (
                  <motion.button
                    key={board}
                    type="button"
                    aria-pressed={selected}
                    disabled={saving !== null}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.18, ease: EASE }}
                    onClick={() => setExamBoard(selected ? "" : board)}
                    className={cn(
                      "rounded-full border px-2.5 py-1.5 text-[0.72rem] font-semibold transition-colors",
                      selected
                        ? "border-chrome-6 bg-brand-panel text-chrome-7"
                        : "border-border bg-white text-brand-ink/70 hover:bg-brand-panel",
                    )}
                  >
                    {board}
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="mt-3">
            <p className="text-xs font-semibold text-brand-ink">
              Level <span className="font-normal text-muted-foreground">(optional)</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {STUDY_LEVELS.map((option) => {
                const selected = level === option;
                return (
                  <motion.button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    disabled={saving !== null}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.18, ease: EASE }}
                    onClick={() => setLevel(selected ? "" : option)}
                    className={cn(
                      "rounded-full border px-2.5 py-1.5 text-[0.72rem] font-semibold transition-colors",
                      selected
                        ? "border-chrome-6 bg-chrome-3 text-chrome-8"
                        : "border-border bg-white text-brand-ink/70 hover:bg-brand-panel",
                    )}
                  >
                    {option}
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <label
              htmlFor="set-settings-exam-date"
              className="text-xs font-semibold text-brand-ink"
            >
              Exam date <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="set-settings-exam-date"
              type="date"
              value={examDate}
              onChange={(event) => setExamDate(event.target.value)}
              disabled={saving !== null}
              className="mt-2 h-10 rounded-2xl border-border bg-white text-sm text-brand-ink shadow-none focus-visible:border-chrome-6 focus-visible:ring-chrome-6/15"
            />
            <p className="mt-1 text-[0.7rem] leading-relaxed text-muted-foreground">
              Sets this set's pace plan, projected readiness and your daily
              question goal.
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-[#FCFCFD] p-3.5">
            <p className="text-xs font-semibold text-brand-ink">
              Counts for the next rebuild
            </p>
            <p className="mt-0.5 text-[0.7rem] leading-relaxed text-muted-foreground">
              {`${BUILD_MIN}–${BUILD_MAX} of each. These are targets for the next rebuild, not the current set. It currently holds ${set.cardCount} flashcard${set.cardCount === 1 ? "" : "s"}, ${set.quizCount} quiz question${set.quizCount === 1 ? "" : "s"} and ${set.examCount} exam question${set.examCount === 1 ? "" : "s"}.`}
            </p>
            <div className="rise-stagger mt-3 grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Flashcards",
                  value: cardCount,
                  current: set.cardCount,
                  onChange: setCardCount,
                },
                {
                  label: "Quiz questions",
                  value: quizCount,
                  current: set.quizCount,
                  onChange: setQuizCount,
                },
                {
                  label: "Exam-style questions",
                  value: examCount,
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
                    max={BUILD_MAX}
                    step={1}
                    value={control.value}
                    disabled={saving !== null}
                    onChange={(event) => control.onChange(Number(event.target.value))}
                    aria-label={control.label}
                    className="mt-1.5 w-full cursor-pointer accent-chrome-6"
                  />
                </label>
              ))}
            </div>
          </div>

          {qualification && (
            <p className="mt-4 inline-flex items-center rounded-full bg-brand-panel px-3 py-1.5 text-[0.75rem] font-semibold text-brand-ink/70">
              {qualification}
            </p>
          )}

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

          <p className="mt-4 text-[0.72rem] leading-relaxed text-muted-foreground">
            Rebuilding replaces the summary, flashcards, quiz and exam questions with
            versions written for the new board. Your notes and uploads are kept.
          </p>

          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={saving !== null}
              onClick={() => onOpenChange(false)}
              className="h-11 rounded-full border-border bg-white px-5 text-sm font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving !== null || rebuildNeeded}
              onClick={() => void save(false)}
              className="h-11 rounded-full border-border bg-white px-5 text-sm font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
              title={rebuildNeeded ? "These changes need a rebuild." : undefined}
            >
              {saving === "save" ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
            <Button
              type="button"
              disabled={saving !== null}
              onClick={() => void save(true)}
              className="h-11 rounded-full bg-[#191B27] px-5 text-sm font-semibold text-white hover:bg-[#2A2D3E]"
            >
              {saving === "rebuild" ? <Loader2 className="size-4 animate-spin" /> : null}
              {rebuildLabel}
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
      </DialogContent>
    </Dialog>
  );
}
