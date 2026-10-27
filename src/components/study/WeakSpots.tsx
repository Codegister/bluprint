import { FlashcardReview } from "@/components/study/FlashcardReview";
import { SkeletonStudySetPage } from "@/components/Skeletons";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowLeft, Play, Sparkles, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

/**
 * A dedicated weak-spot session: only the cards that have lapsed or never
 * settled, followed by the quiz questions that keep going wrong. It is short on
 * purpose — the point is a second pass, not another full deck review.
 */
export function WeakSpots({ setId }: { setId: Id<"studySets"> }) {
  const data = useQuery(api.studySets.weakSpots, { setId });
  const [started, setStarted] = useState(false);

  if (data === undefined) return <SkeletonStudySetPage />;

  if (data === null) {
    return (
      <div className="gizmo-card p-8 text-center text-sm text-muted-foreground">
        This set is not available.
      </div>
    );
  }

  if (started && data.cards.length > 0) {
    return (
      <>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.8rem] font-semibold text-brand-ink">
            Weak-spot session · {data.cards.length} cards
          </p>
          <Button
            variant="outline"
            onClick={() => setStarted(false)}
            className="h-8 rounded-full border-border bg-white px-3 text-[0.74rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
          >
            <ArrowLeft className="size-3.5" /> Back to the set
          </Button>
        </div>
        <FlashcardReview key={setId} cards={data.cards} />
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="gizmo-card p-6 sm:p-7"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mono-label text-[#C93C49]">Second pass</p>
            <h2 className="mt-1 font-display text-[1.3rem] font-bold text-brand-ink">
              Needs work in “{data.setTitle}”
            </h2>
            <p className="mt-1 max-w-md text-[0.85rem] leading-relaxed text-muted-foreground">
              Cards you rated Again, or that have never reached a stable memory,
              plus the quiz questions you keep getting wrong.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="rounded-2xl bg-[#FFEEF0] px-3 py-2 text-center">
              <p className="font-display text-xl font-bold tabular-nums text-[#C93C49]">
                {data.weakCardCount}
              </p>
              <p className="text-[0.64rem] font-medium text-[#C93C49]/80">cards</p>
            </div>
            <div className="rounded-2xl bg-[#FFF6E5] px-3 py-2 text-center">
              <p className="font-display text-xl font-bold tabular-nums text-[#96650A]">
                {data.weakQuizCount}
              </p>
              <p className="text-[0.64rem] font-medium text-[#96650A]/80">quiz</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setStarted(true)}
            disabled={data.cards.length === 0}
            className="h-11 rounded-full bg-[#191B27] px-5 text-sm font-semibold text-white hover:bg-[#2A2D3E] disabled:bg-[#191B27]/30"
          >
            <Play className="size-4" />
            {data.cards.length === 0
              ? "No weak cards"
              : `Start ${data.cards.length}-card session`}
          </Button>
          {data.weakQuizCount > 0 && (
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-full border-border bg-white px-5 text-sm font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
            >
              <Link to={`/sets/${setId}/quiz`}>Retry the quiz</Link>
            </Button>
          )}
        </div>

        {data.cards.length === 0 && (
          <p className="mt-3 flex items-start gap-2 rounded-2xl bg-[#E9FBF3] p-3 text-[0.78rem] leading-relaxed text-[#0F7A50]">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Nothing has lapsed. A normal review keeps it that way.
          </p>
        )}
      </motion.div>

      {data.quiz.length > 0 && (
        <section className="mt-4 overflow-hidden rounded-[1.6rem] border border-border bg-white">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
            <TriangleAlert className="size-4 text-[#D24350]" aria-hidden />
            <h3 className="font-display text-[0.98rem] font-bold text-brand-ink">
              Questions you have missed
            </h3>
          </div>
          <ul>
            {data.quiz.map((question) => (
              <li
                key={question._id}
                className="border-b border-border/70 px-5 py-3.5 last:border-b-0"
              >
                <p className="text-[0.85rem] font-medium leading-snug text-brand-ink">
                  {question.question}
                </p>
                <p className="mt-1 text-[0.76rem] leading-relaxed text-muted-foreground">
                  {question.explanation}
                </p>
                <p className="mt-1.5 text-[0.68rem] font-semibold text-[#C93C49]">
                  Missed {question.missCount ?? 0}×
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
