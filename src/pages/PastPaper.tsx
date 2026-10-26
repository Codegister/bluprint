import { AppShell } from "@/components/AppShell";
import { SkeletonPastPaperPage } from "@/components/Skeletons";
import { enter, reveal } from "@/components/motion/Motion";
import { PastPaperPractice } from "@/components/study/PastPaperPractice";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { buildPaperBlueprint } from "@/convex/lib/paperBlueprint";
import { readableError } from "@/lib/errors";
import { qualificationLabel } from "@/lib/examBoards";
import { courseSubtitle } from "@/lib/subjects";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

function MissingCard() {
  return (
    <div className="mx-auto mt-6 max-w-lg rounded-[2rem] border border-border bg-card p-8 text-center">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-brand-peach">
        Paper not found
      </p>
      <h1 className="mt-2 font-display text-[1.5rem] font-bold text-brand-ink">
        This paper isn't available
      </h1>
      <p className="mt-2 text-[0.9rem] leading-relaxed text-muted-foreground">
        It may have been removed, or it belongs to a different account.
      </p>
      <Button
        asChild
        className="mt-5 h-10 rounded-full bg-[#191B27] px-5 font-semibold text-white hover:bg-[#2A2D3E]"
      >
        <Link to="/dashboard">Back to home</Link>
      </Button>
    </div>
  );
}

/**
 * One saved past paper.
 *
 * The paper is generated once from the course specification and kept, so this
 * page reads the same every time. Answers are marked question by question and
 * saved, which is what the course page's progress bar reports.
 */
export default function PastPaper() {
  const { paperId } = useParams<{ paperId: string }>();
  const validId = Boolean(paperId && /^[a-z0-9]{20,40}$/i.test(paperId));
  const details = useQuery(
    api.pastPapers.getDetails,
    validId ? { paperId: paperId as Id<"pastPapers"> } : "skip",
  );
  const rebuild = useMutation(api.pastPapers.rebuild);
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (!validId) return;
    setRetrying(true);
    try {
      await rebuild({ paperId: paperId as Id<"pastPapers"> });
      toast.success("Building the paper again.");
    } catch (error) {
      toast.error(readableError(error, "Could not rebuild that paper."));
    } finally {
      setRetrying(false);
    }
  };

  const body = (() => {
    if (!validId) return <MissingCard />;
    if (details === undefined) return <SkeletonPastPaperPage />;
    if (details === null) return <MissingCard />;

    const { paper, course, questions } = details;
    const ready = paper.status === "ready";
    const qualification = course
      ? qualificationLabel({
          examBoard: course.examBoard,
          level: course.level,
          course: course.subject,
        })
      : undefined;
    // The structure the course uses now, shown on the paper and used to spot a
    // paper saved before that structure was corrected.
    const blueprint = course ? buildPaperBlueprint(course) : null;
    const outdated =
      ready && blueprint !== null && paper.formatId !== blueprint.id;

    return (
      <>
        <div className="chrome-plate flex flex-wrap items-center gap-3 rounded-[1.6rem] px-4 py-4">
          <Link
            to={course ? `/courses/${course._id}/papers` : "/dashboard"}
            className="text-[0.8rem] font-semibold text-muted-foreground hover:text-brand-ink"
          >
            {course ? `Back to ${course.subject} papers` : "Back to my sets"}
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#8A5A12]">
              Past paper
            </p>
            <motion.h1
              className="truncate font-display text-[1.6rem] font-bold leading-tight tracking-[-0.03em] text-brand-ink sm:text-[2rem]"
              {...enter(0.04)}
            >
              {paper.title}
            </motion.h1>
            <motion.p
              className="mt-0.5 text-[0.8rem] text-muted-foreground"
              {...enter(0.1)}
            >
              {course
                ? `${course.subject} · ${courseSubtitle(course)}`
                : "Course removed"}
            </motion.p>
          </div>
        </div>

        <motion.section
          className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border bg-[#FFFBF2] px-4 py-3 text-[0.78rem] text-muted-foreground"
          {...reveal(0.14, 10)}
        >
          <span>
            <span className="font-semibold text-brand-ink">
              {paper.questionCount}
            </span>{" "}
            question{paper.questionCount === 1 ? "" : "s"}
          </span>
          <span aria-hidden>·</span>
          <span>
            <span className="font-semibold text-brand-ink">{paper.totalMarks}</span>{" "}
            marks
          </span>
          <span aria-hidden>·</span>
          <span>{paper.durationMinutes} minutes, like a real paper</span>
          <span aria-hidden>·</span>
          <span>
            <span className="font-semibold text-brand-ink">
              {paper.answeredCount}
            </span>{" "}
            answered
            {paper.answeredCount > 0
              ? `, ${paper.earnedMarks} of ${paper.totalMarks} marks earned`
              : ""}
          </span>
          {blueprint && (
            <>
              <span aria-hidden>·</span>
              <span className="font-semibold text-brand-ink">
                {blueprint.summary}
              </span>
            </>
          )}
        </motion.section>

        {outdated && (
          <section className="mt-4 rounded-[2rem] border border-border bg-[#FFFBF2] p-5 sm:p-6">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[#8A5A12]">
              Older paper format
            </p>
            <h2 className="mt-1 font-display text-[1.05rem] font-bold text-brand-ink">
              This paper was saved before the {course?.subject ?? "subject"} format
              was updated
            </h2>
            <p className="mt-2 text-[0.85rem] leading-relaxed text-muted-foreground">
              Rebuild it to get this subject's current question types and marks.
              for example 3, 4, 5 and 12-mark Religious Studies questions, or two
              long English Literature essays. Rebuilding replaces this paper's
              questions and clears any answers on it.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleRetry()}
              disabled={retrying}
              className="mt-4 h-9 rounded-full border-border bg-white px-4 text-[0.8rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
            >
              {retrying ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Rebuild in the current format
            </Button>
          </section>
        )}

        {paper.status === "error" ? (
          <section className="mt-4 rounded-[2rem] border border-border bg-[#FFF7F9] p-6">
            <h2 className="font-display text-[1.05rem] font-bold text-brand-ink">
              This paper could not be built
            </h2>
            <p className="mt-2 text-[0.85rem] leading-relaxed text-[#C23B49]">
              {paper.errorMessage ??
                "NVIDIA did not return a usable paper. Try building it again."}
            </p>
            <Button
              type="button"
              onClick={() => void handleRetry()}
              disabled={retrying}
              className="mt-4 h-9 rounded-full bg-[#191B27] px-4 text-[0.8rem] font-semibold text-white hover:bg-[#2A2D3E]"
            >
              {retrying ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Build again
            </Button>
          </section>
        ) : !ready ? (
          <section className="mt-4 rounded-[2rem] border border-border bg-white p-6 sm:p-8">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[#B7791F]">
              Writing your paper
            </p>
            <h2 className="mt-1 font-display text-[1.3rem] font-bold text-brand-ink">
              Building questions and mark schemes
            </h2>
            <p className="mt-1 text-[0.84rem] text-muted-foreground">
              {paper.progress ?? "Waiting to start"}
            </p>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-brand-panel">
              <motion.div
                className="h-full w-1/3 rounded-full bg-[#B7791F]"
                animate={{ x: ["-110%", "310%"] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            <p className="mt-4 text-[0.78rem] leading-relaxed text-muted-foreground">
              This usually takes under a minute. You can leave the page. The paper
              keeps building and will be here when you come back.
            </p>
            {details.processingStale && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleRetry()}
                disabled={retrying}
                className="mt-4 h-9 rounded-full border-border bg-white px-4 text-[0.8rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
              >
                {retrying ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Take too long? Build again
              </Button>
            )}
          </section>
        ) : (
          <div className="mt-5 pb-10">
            <PastPaperPractice
              questions={questions}
              qualification={qualification}
              examBoard={course?.examBoard}
              cover={paper.cover}
            />
          </div>
        )}

        <p className="mt-4 text-[0.72rem] leading-relaxed text-muted-foreground">
          Written from the saved specification for this course and laid out in this
          subject's paper format, with the same question types and marks, cover rubric,
          numbering, mark notation and command words. Published board papers and
          mark schemes are copyrighted, so the questions are original and never
          reproduced from a real paper.
        </p>
      </>
    );
  })();

  return <AppShell>{body}</AppShell>;
}
