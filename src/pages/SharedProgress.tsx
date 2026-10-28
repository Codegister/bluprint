import { Brand } from "@/components/Brand";
import { Meter } from "@/components/motion/Motion";
import { SkeletonRows } from "@/components/Skeletons";
import { api } from "@/convex/_generated/api";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { Clock, Layers3, Link2Off, Target } from "lucide-react";
import { Link, useParams } from "react-router";

/**
 * The page a shared link opens.
 *
 * Read-only and aggregate: coverage, streak, readiness per topic and the weak
 * spots. No notes, no cards, no answers — the link can be revoked at any time
 * and then stops answering at all.
 */
export default function SharedProgress() {
  const { token } = useParams<{ token: string }>();
  const data = useQuery(
    api.progressShares.publicProgress,
    token ? { token } : "skip",
  );

  if (token === undefined) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <SkeletonRows rows={4} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <Brand />
        <Link
          to="/"
          className="rounded-full px-3 py-1.5 text-[0.82rem] font-semibold text-muted-foreground hover:bg-brand-panel hover:text-brand-ink"
        >
          Bluprint
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
        {data === undefined ? (
          <SkeletonRows rows={4} />
        ) : data === null ? (
          <div className="gizmo-card mt-6 p-8 text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-brand-panel text-muted-foreground">
              <Link2Off className="size-5" aria-hidden />
            </span>
            <p className="mt-3 font-display text-[1.1rem] font-bold text-brand-ink">
              This link is not active
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Progress links can be revoked by the student who made them. Ask for a
              fresh one if you still need it.
            </p>
          </div>
        ) : (
          <>
            <section className="gizmo-card mt-4 p-6">
              <p className="mono-label text-chrome-7">Shared progress</p>
              <h1 className="mt-1 font-display text-[1.5rem] font-extrabold text-brand-ink">
                {data.name ? `${data.name}'s revision` : "Revision progress"}
              </h1>
              <p className="mt-1 text-[0.8rem] leading-relaxed text-muted-foreground">
                Read-only. Notes, cards and answers are never included, and the
                student can revoke this page at any time.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-white p-4">
                  <p className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-muted-foreground">
                    <Clock className="size-3.5" aria-hidden /> Streak
                  </p>
                  <p className="mt-1 font-display text-[1.6rem] font-extrabold tabular-nums text-brand-ink">
                    {plural(data.streak, "day")}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-white p-4">
                  <p className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-muted-foreground">
                    <Layers3 className="size-3.5" aria-hidden /> Study sets
                  </p>
                  <p className="mt-1 font-display text-[1.6rem] font-extrabold tabular-nums text-brand-ink">
                    {data.sets}
                  </p>
                  <p className="text-[0.72rem] text-muted-foreground">
                    {data.known} of {plural(data.cards, "card")} known
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-white p-4">
                  <p className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-muted-foreground">
                    <Target className="size-3.5" aria-hidden /> Readiness
                  </p>
                  <p className="mt-1 font-display text-[1.6rem] font-extrabold tabular-nums text-brand-ink">
                    {data.averageReadiness}%
                  </p>
                  <p className="text-[0.72rem] text-muted-foreground">
                    average across sets
                  </p>
                </div>
              </div>

              {data.specification && (
                <div className="mt-4 rounded-2xl bg-brand-panel/70 px-4 py-3">
                  <p className="text-[0.74rem] font-semibold text-brand-ink">
                    Specification coverage: {data.specification.covered} of{" "}
                    {plural(data.specification.total, "point")}
                  </p>
                  <Meter
                    value={Math.round(
                      (data.specification.covered / Math.max(1, data.specification.total)) * 100,
                    )}
                    className="mt-1.5 h-1.5 w-full bg-white"
                    barClassName="bg-chrome-6"
                    label="Specification coverage"
                  />
                </div>
              )}
            </section>

            <section className="gizmo-card mt-4 p-6">
              <h2 className="font-display text-[1rem] font-bold text-brand-ink">
                Weak spots
              </h2>
              {data.weakest.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Nothing under 70% at the moment.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {data.weakest.map((topic) => (
                    <li
                      key={topic.title}
                      className="rounded-xl border border-border bg-white px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[0.85rem] font-semibold text-brand-ink">
                          {topic.title}
                        </p>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[0.68rem] font-bold tabular-nums",
                            topic.readiness < 40
                              ? "bg-[#FFEEF0] text-[#A81F28]"
                              : "bg-[#FFF6E5] text-[#96650A]",
                          )}
                        >
                          {topic.readiness}%
                        </span>
                      </div>
                      {topic.weakest.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-[0.72rem] leading-relaxed text-muted-foreground">
                          {topic.weakest.map((point) => (
                            <li key={point}>· {point}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="mt-4 text-center text-[0.72rem] text-muted-foreground">
              Shared from Bluprint · no notes or answers are exposed.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
