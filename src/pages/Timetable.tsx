import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { readableError } from "@/lib/errors";
import {
  daysUntilInput,
  formatDateInput,
} from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

type Plan = NonNullable<FunctionReturnType<typeof api.timetable.getMine>>;
type Entry = Plan["entries"][number];

export default function Timetable() {
  const navigate = useNavigate();
  const plan = useQuery(api.timetable.getMine);
  const openTopic = useMutation(api.courses.createTopicSet);
  const [busy, setBusy] = useState<string | null>(null);

  const groups = useMemo(() => {
    const byDate = new Map<string, Entry[]>();
    for (const entry of plan?.entries ?? []) {
      const existing = byDate.get(entry.date);
      if (existing) existing.push(entry);
      else byDate.set(entry.date, [entry]);
    }
    return [...byDate.entries()].map(([date, entries]) => ({ date, entries }));
  }, [plan]);

  const courses = useMemo(
    () => [...new Set((plan?.entries ?? []).map((entry) => entry.course))],
    [plan],
  );

  const handleOpen = async (entry: Entry) => {
    const key = `${entry.date}:${entry.topicId}`;
    setBusy(key);
    try {
      const result = await openTopic({
        courseId: entry.courseId,
        topicId: entry.topicId,
      });
      navigate(`/sets/${result.setId}`);
    } catch (error) {
      toast.error(readableError(error, "Could not open that revision topic."));
    } finally {
      setBusy(null);
    }
  };

  if (plan === undefined) {
    return (
      <AppShell>
        <div className="flex min-h-[320px] items-center justify-center rounded-[2rem] border border-border bg-white">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (plan === null) {
    return (
      <AppShell>
        <header>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[#7C5CFF]">
            Revision timetable
          </p>
          <h1 className="mt-1 font-display text-[1.6rem] font-bold leading-tight text-brand-ink sm:text-[2rem]">
            Your revision timetable
          </h1>
          <p className="mt-2 max-w-2xl text-[0.92rem] leading-relaxed text-muted-foreground">
            Turn your courses into a day-by-day revision plan, then open a study
            set straight from any session.
          </p>
        </header>

        <section className="mt-6 rounded-[2rem] border border-dashed border-border bg-white p-7 sm:p-9">
          <h2 className="font-display text-[1.2rem] font-bold text-brand-ink">
            No timetable yet
          </h2>
          <p className="mt-2 max-w-xl text-[0.88rem] leading-relaxed text-muted-foreground">
            Tell Bluprint which courses you want to revise, how long your sessions
            should be, and when your first exam is. The plan will appear here and in
            the sidebar.
          </p>
          <Button
            asChild
            className="mt-5 h-11 rounded-full bg-[#191B27] px-6 font-semibold text-white hover:bg-[#2A2D3E]"
          >
            <Link to="/timetable/new">Build revision timetable</Link>
          </Button>
        </section>
      </AppShell>
    );
  }

  const daysLeft = daysUntilInput(plan.examDate);

  return (
    <AppShell>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[#7C5CFF]">
            Revision timetable
          </p>
          <h1 className="mt-1 font-display text-[1.6rem] font-bold leading-tight text-brand-ink sm:text-[2rem]">
            Your revision timetable
          </h1>
          <p className="mt-2 text-[0.9rem] text-muted-foreground">
            First exam {formatDateInput(plan.examDate)} ·{" "}
            {daysLeft > 0
              ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} to go`
              : "Exam date has passed"}
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="h-10 rounded-full border-border bg-white px-5 text-[0.82rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
        >
          <Link to="/timetable/new">Build new timetable</Link>
        </Button>
      </header>

      <section className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-border bg-white px-4 py-3 text-[0.78rem] text-muted-foreground">
        <span>
          <span className="font-semibold text-brand-ink">{plan.entries.length}</span>{" "}
          sessions
        </span>
        <span aria-hidden>·</span>
        <span>{plan.sessionMinutes} minutes each</span>
        <span aria-hidden>·</span>
        <span>{plan.daysPerWeek} days a week</span>
        <span aria-hidden>·</span>
        <span>
          {courses.length} course{courses.length === 1 ? "" : "s"}
        </span>
        {plan.scheduledTopics < plan.topicTotal && (
          <>
            <span aria-hidden>·</span>
            <span>
              Covers {plan.scheduledTopics} of {plan.topicTotal} topics
            </span>
          </>
        )}
      </section>

      {plan.truncated && (
        <p className="mt-3 rounded-2xl bg-[#FFF6E5] px-4 py-3 text-[0.8rem] leading-relaxed text-[#8A5D00]">
          This plan covers the first 60 sessions. Build it again nearer the exam to
          schedule the remaining topics.
        </p>
      )}

      <section className="mt-4 overflow-hidden rounded-[2rem] border border-border bg-white shadow-[0_18px_44px_-34px_rgba(22,24,31,0.35)]">
        {groups.map(({ date, entries }) => (
          <div key={date} className="border-b border-border last:border-b-0">
            <div className="bg-[#FCFCFD] px-4 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:px-5">
              {formatDateInput(date)}
            </div>
            {entries.map((entry) => {
              const key = `${entry.date}:${entry.topicId}`;
              const loading = busy === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => void handleOpen(entry)}
                  disabled={busy !== null}
                  aria-label={`Study ${entry.topic} from ${entry.course}`}
                  className="flex w-full items-center gap-3 border-t border-border/60 px-4 py-4 text-left transition-colors first:border-t-0 hover:bg-brand-panel/40 disabled:opacity-60 sm:px-5"
                >
                  <span className="w-14 shrink-0 text-[0.7rem] font-medium text-muted-foreground">
                    {entry.minutes} min
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.68rem] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                      {entry.course} · {entry.unit}
                    </span>
                    <span className="mt-0.5 block font-display text-[0.96rem] font-bold leading-snug text-brand-ink">
                      {entry.topic}
                    </span>
                  </span>
                  {loading ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                  ) : (
                    <span className="shrink-0 text-[0.72rem] font-semibold text-[#5B3DF5]">
                      Study topic
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </section>

      <p className="mt-4 text-[0.72rem] leading-relaxed text-muted-foreground">
        Each session opens the study set for that topic. If one does not exist yet,
        Bluprint builds it from the course pathway and takes you straight there.
      </p>
    </AppShell>
  );
}
