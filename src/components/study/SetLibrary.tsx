import { DeckGlyph, Mascot } from "@/components/Mascot";
import { SkeletonRows } from "@/components/Skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Meter, enter } from "@/components/motion/Motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { qualificationLabel } from "@/lib/examBoards";
import { plural, relativeDate } from "@/lib/format";
import { subjectMeta } from "@/lib/subjects";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight, Layers3, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

type SetSummary = FunctionReturnType<typeof api.studySets.listMine>[number];

function StatusText({ set }: { set: SetSummary }) {
  if (set.status === "processing" || set.status === "queued") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Building
      </span>
    );
  }
  if (set.status === "error") {
    return (
      <span className="text-[0.72rem] font-semibold text-[#C23B49]">
        Build interrupted
      </span>
    );
  }
  return <span className="text-[0.72rem] font-medium text-brand-sky">Ready</span>;
}

/** One saved set, shown as a single scannable row. */
function SetRow({ set }: { set: SetSummary }) {
  const readiness = set.readiness;
  const processing = set.status === "processing" || set.status === "queued";
  const context = qualificationLabel(set);
  const accent = subjectMeta(set.course ?? "").color;

  return (
    <Link
      to={`/sets/${set._id}`}
      className="group flex items-center gap-3.5 border-b border-border/70 px-4 py-4 transition-colors last:border-b-0 hover:bg-brand-panel sm:gap-4 sm:px-5"
    >
      <DeckGlyph className="size-9 shrink-0" color={accent} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 className="truncate font-display text-[0.98rem] font-bold text-brand-ink">
            {set.title}
          </h3>
          <StatusText set={set} />
          {set.status === "ready" && set.dueCount > 0 && (
            <span className="text-[0.72rem] font-semibold text-brand-ink/70">
              {set.dueCount} due
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-[0.76rem] text-muted-foreground">
          {context ? `${context} · ` : ""}
          {plural(set.cardCount, "card")} · {plural(set.quizCount, "quiz question")} ·{" "}
          {plural(set.examCount, "exam question")}
        </p>
        {processing ? (
          <p className="mt-1.5 text-[0.72rem] text-muted-foreground">
            {set.progress || "Waiting to start"}
          </p>
        ) : set.status === "error" ? (
          <p className="mt-1.5 text-[0.72rem] text-muted-foreground">
            Open to rebuild this set.
          </p>
        ) : (
          <div className="mt-2 flex items-center gap-2.5">
            <Meter
              value={readiness}
              className="h-1.5 w-full max-w-[180px]"
              barStyle={{ backgroundColor: accent }}
              label={`${set.title} exam readiness`}
            />
            <span className="shrink-0 text-[0.7rem] text-muted-foreground">
              {readiness}% exam-ready
            </span>
          </div>
        )}
      </div>

      <div className="hidden w-36 shrink-0 text-right text-[0.74rem] text-muted-foreground sm:block">
        {set.status === "ready" ? (
          <>
            <p className="font-medium text-brand-ink">
              {set.pace
                ? `${set.pace.daysLeft}d to exam`
                : set.quizTotal > 0
                  ? `${set.quizAnswered}/${set.quizTotal} quiz answered`
                  : "No quiz yet"}
            </p>
            <p className="mt-0.5">
              {set.pace
                ? `${plural(set.pace.perDay, "card")}/day`
                : set.lastStudiedAt
                  ? `Studied ${relativeDate(set.lastStudiedAt)}`
                  : "Not started"}
            </p>
          </>
        ) : (
          <p>{processing ? "In progress" : "Open to rebuild"}</p>
        )}
      </div>

      <ChevronRight className="size-4 shrink-0 text-brand-ink/30 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/**
 * The saved-set library.
 *
 * It lives on the tutor home, under the course list, so the same screen answers
 * a question and opens the material it is about. Rows open the set itself; the
 * set's own "Ask the tutor" button starts a scoped conversation.
 */
export function SetLibrary({ onCreate }: { onCreate: () => void }) {
  const sets = useQuery(api.studySets.listMine);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sets ?? [];
    return (sets ?? []).filter((set) =>
      [set.title, set.course ?? "", set.examBoard ?? "", set.level ?? ""].some(
        (value) => value.toLowerCase().includes(query),
      ),
    );
  }, [sets, search]);

  return (
    <section
      id="sets"
      aria-labelledby="sets-heading"
      className="mt-7 scroll-mt-6"
    >
      <motion.div
        className="flex flex-wrap items-end gap-x-3 gap-y-2"
        {...enter(0.14)}
      >
        <h2
          id="sets-heading"
          className="flex items-center gap-2 font-display text-[1.15rem] font-bold text-brand-ink"
        >
          <Layers3 className="size-4 text-brand-sky" aria-hidden />
          Your study sets
        </h2>
        {/* A count is never shown before it is known: the first paint shows a
            placeholder chip rather than a confident "0". */}
        {sets === undefined ? (
          <Skeleton
            aria-hidden
            className="h-3.5 w-6 rounded-full bg-border"
          />
        ) : (
          <span className="text-[0.74rem] font-semibold tabular-nums text-muted-foreground">
            {sets.length}
          </span>
        )}
        <span className="hidden h-px flex-1 border-t border-dashed border-border sm:block" />
        {(sets?.length ?? 0) > 0 && (
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search study sets"
            aria-label="Search study sets"
            className="h-9 w-full rounded-full border-border bg-card text-[0.8rem] shadow-none placeholder:text-muted-foreground/90 sm:ml-auto sm:w-56"
          />
        )}
      </motion.div>

      <div className="mt-3 overflow-hidden rounded-3xl border border-border bg-card">
        {sets === undefined ? (
          <div role="status" aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading your study sets</span>
            <SkeletonRows rows={5} withAvatar />
          </div>
        ) : sets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-7 text-center sm:flex-row sm:text-left">
            <Mascot size={64} float={false} className="shrink-0" />
            <div>
              <p className="font-display text-[1rem] font-bold text-brand-ink">
                Your first set starts with a page of notes
              </p>
              <p className="mt-1 text-[0.82rem] leading-relaxed text-muted-foreground">
                Upload photos or paste text, and Bluprint writes the summary,
                flashcards, quiz and exam questions.
              </p>
              <Button
                onClick={onCreate}
                variant="outline"
                className="mt-3 h-9 rounded-full px-4 text-[0.8rem] font-semibold shadow-none"
              >
                Add your notes
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-6">
            <p className="text-[0.82rem] text-muted-foreground">
              No sets match “{search}”.
            </p>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-[0.8rem] font-semibold text-brand-ink underline-offset-2 hover:underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="rise-stagger">
            {filtered.map((set) => (
              <SetRow key={set._id} set={set} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
