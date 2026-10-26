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
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

/**
 * The past papers section of a course.
 *
 * A paper is generated once from the saved specification and then kept, so the
 * same paper is practised on every visit and can be scheduled as a one-hour
 * session in the revision timetable. Four papers per course is enough variety
 * without turning the section into an endless list.
 */
export function CoursePastPapers({
  courseId,
  formatSummary,
}: {
  courseId: Id<"courses">;
  /** The subject's real question structure, e.g. "4 questions · 3, 4, 5 and 12 marks". */
  formatSummary?: string;
}) {
  const navigate = useNavigate();
  const papers = useQuery(api.pastPapers.listForCourse, { courseId });
  const createPaper = useMutation(api.pastPapers.create);
  const removePaper = useMutation(api.pastPapers.remove);
  const [building, setBuilding] = useState(false);
  const [removal, setRemoval] = useState<{ id: Id<"pastPapers">; title: string } | null>(
    null,
  );
  const [removing, setRemoving] = useState(false);

  const list = papers ?? [];
  const inProgress = list.some(
    (paper) => paper.status === "queued" || paper.status === "processing",
  );

  const handleBuild = async () => {
    setBuilding(true);
    try {
      const result = await createPaper({ courseId });
      if (result.created) {
        toast.success("Writing a practice paper from your specification.");
      }
      navigate(`/papers/${result.paperId}`);
    } catch (error) {
      toast.error(readableError(error, "Could not build that past paper."));
    } finally {
      setBuilding(false);
    }
  };

  const handleRemove = async () => {
    if (!removal) return;
    setRemoving(true);
    try {
      await removePaper({ paperId: removal.id });
      toast.success(`Removed ${removal.title}.`);
      setRemoval(null);
    } catch (error) {
      toast.error(readableError(error, "Could not remove that paper."));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <section className="mt-4 rounded-[2rem] border border-[#EBD6AB] bg-[#FFFBF2] p-5 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#8A5A12]">
            Past papers
          </p>
          <h2 className="mt-1 font-display text-[1.1rem] font-bold text-brand-ink">
            Practise under exam conditions
          </h2>
          <p className="mt-1 max-w-2xl text-[0.84rem] leading-relaxed text-muted-foreground">
            A paper written in this subject's real question format, with a mark
            scheme for every question. Each paper is saved once, so it is the same
            paper every time you open it, and it can be scheduled in your timetable.
          </p>
          {formatSummary && (
            <p className="mt-2 inline-flex rounded-full bg-[#F1F0FB] px-3 py-1 text-[0.7rem] font-semibold text-[#5B3DF5]">
              {formatSummary}
            </p>
          )}
        </div>
        <Button
          type="button"
          onClick={() => void handleBuild()}
          disabled={building || inProgress || list.length >= 4}
          className="h-9 shrink-0 rounded-full bg-[#191B27] px-4 text-[0.8rem] font-semibold text-white hover:bg-[#2A2D3E]"
        >
          {building ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plus className="size-3.5" aria-hidden />
          )}
          Build a past paper
        </Button>
      </div>

      {papers === undefined ? (
        <div className="mt-5 flex items-center justify-center rounded-2xl border border-dashed border-[#EBD6AB] bg-white/70 px-4 py-8">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : list.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[#EBD6AB] bg-white/70 px-4 py-6 text-center">
          <FileText
            className="mx-auto size-6 text-[#B7791F]"
            aria-hidden
          />
          <p className="mt-2 font-display text-[0.98rem] font-bold text-brand-ink">
            No past papers yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-[0.8rem] leading-relaxed text-muted-foreground">
            Build one to see the question types and marks this subject uses,
            answer them under exam conditions, and get each marked against the
            guide.
          </p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-2.5">
          {list.map((paper) => {
            const ready = paper.status === "ready";
            const progress = Math.min(
              100,
              paper.questionCount > 0
                ? Math.round((paper.answeredCount / paper.questionCount) * 100)
                : 0,
            );
            return (
              <li
                key={paper._id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-white px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[0.9rem] font-semibold text-brand-ink">
                      {paper.title}
                    </h3>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[0.62rem] font-semibold",
                        ready
                          ? "bg-[#EAFBF0] text-[#128A4C]"
                          : paper.status === "error"
                            ? "bg-[#FFEEF0] text-[#C23B49]"
                            : "bg-[#FFF6E5] text-[#96650A]",
                      )}
                    >
                      {ready
                        ? "Ready"
                        : paper.status === "error"
                          ? "Build failed"
                          : "Building"}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.74rem] leading-relaxed text-muted-foreground">
                    {ready
                      ? `${paper.questionCount} question${paper.questionCount === 1 ? "" : "s"} · ${paper.totalMarks} marks · about ${paper.durationMinutes} minutes`
                      : paper.status === "error"
                        ? paper.errorMessage ?? "This paper could not be built."
                        : paper.progress ?? "Waiting to start"}
                  </p>
                  {ready && paper.questionCount > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 w-full max-w-[190px] overflow-hidden rounded-full bg-brand-panel">
                        <div
                          className="h-full rounded-full bg-[#128A4C] transition-[width] duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[0.66rem] font-semibold text-muted-foreground">
                        {paper.answeredCount}/{paper.questionCount} answered ·{" "}
                        {paper.earnedMarks}/{paper.totalMarks} marks
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/papers/${paper._id}`)}
                    className="h-8 rounded-full border-border bg-white px-3 text-[0.76rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
                  >
                    {ready ? "Open paper" : "View"}
                  </Button>
                  <button
                    type="button"
                    aria-label={`Remove ${paper.title}`}
                    onClick={() =>
                      setRemoval({ id: paper._id, title: paper.title })
                    }
                    className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-[#FFEEF0] hover:text-[#C23B49]"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-[0.7rem] leading-relaxed text-muted-foreground">
        Original questions written for this specification — not reproduced board
        papers. Marks and question types follow this subject's current paper
        format; always check the structure with your teacher.
      </p>

      <AlertDialog
        open={removal !== null}
        onOpenChange={(open) => {
          if (!open) setRemoval(null);
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Remove {removal?.title}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This deletes the paper, its questions and any answers you have
              written. You can build the paper again, but it will be a new paper.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing} className="rounded-full">
              Keep it
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              onClick={(event) => {
                event.preventDefault();
                void handleRemove();
              }}
              className="rounded-full bg-destructive text-white hover:bg-destructive/90"
            >
              {removing ? <Loader2 className="size-4 animate-spin" /> : null}
              Remove paper
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
