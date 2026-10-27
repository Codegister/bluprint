import { enter } from "@/components/motion/Motion";
import { api } from "@/convex/_generated/api";
import { subjectMeta } from "@/lib/subjects";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowRight, Flame, GraduationCap } from "lucide-react";
import { Link } from "react-router";

/**
 * The streak banner under the study sets.
 *
 * It answers two questions in one strip: did I show up today, and which course
 * should I practise next. The streak numbers come from the same server query
 * as the sidebar goal card, so the two can never disagree. Each course chip
 * opens that course's practice papers, so "practise" always lands somewhere
 * with paper content rather than an empty topic list.
 */
export function StreakBanner() {
  const study = useQuery(api.studySets.studyStats);
  const courses = useQuery(api.courses.listMine);

  const streak = study?.streak ?? 0;
  const today = study?.todayCount ?? 0;
  const goal = study?.goal ?? 20;
  const nextTier = study?.nextTier ?? null;
  const readyCourses = (courses ?? []).filter(
    (course) => course.status === "ready",
  );

  const status = study
    ? streak > 0
      ? `${today}/${goal} questions today · ${streak === 1 ? "day one" : `${streak} days running`}`
      : `${today}/${goal} questions today`
    : "Loading today's progress…";

  return (
    <motion.section
      aria-labelledby="streak-heading"
      className="chrome-plate relative overflow-hidden rounded-[1.6rem] px-4 py-4 sm:px-5"
      {...enter(0.18, 10)}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex items-start gap-3">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gizmo-peach text-[#B4720E] ring-1 ring-brand-ink/10"
            aria-hidden
          >
            <Flame className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="mono-label text-chrome-7">Your streak</p>
            <h2
              id="streak-heading"
              className="mt-0.5 font-display text-[1.2rem] font-extrabold leading-tight tracking-[-0.02em] text-brand-ink"
            >
              {study === undefined
                ? "Counting your days…"
                : streak > 0
                  ? `${streak}-day streak — keep it going`
                  : "No streak yet — today can start it"}
            </h2>
            <p className="mt-1 text-[0.78rem] leading-snug text-brand-ink/65">
              {status}
              {nextTier
                ? ` · ${nextTier.questions - today} more for ${nextTier.label}`
                : study
                  ? " · top tier reached today"
                  : ""}
            </p>
          </div>
        </div>

        <div className="min-w-0 lg:text-right">
          <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-brand-ink/45">
              Practise a course
            </span>
            <Link
              to="/courses"
              className="inline-flex items-center gap-1 text-[0.74rem] font-semibold text-brand-ink/70 underline-offset-2 hover:text-brand-ink hover:underline"
            >
              All courses
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5 lg:justify-end">
            {courses === undefined ? (
              <>
                <span className="h-8 w-28 animate-pulse rounded-full bg-brand-panel" />
                <span className="h-8 w-24 animate-pulse rounded-full bg-brand-panel" />
              </>
            ) : readyCourses.length === 0 ? (
              <Link
                to="/courses/new"
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[0.76rem] font-semibold text-brand-ink transition-colors hover:bg-brand-panel"
              >
                <GraduationCap className="size-3.5" aria-hidden />
                {courses.length === 0 ? "Add a course" : "Finish setting up a course"}
              </Link>
            ) : (
              readyCourses.slice(0, 3).map((course) => {
                const meta = subjectMeta(course.subject);
                const Icon = meta.icon;
                return (
                  <Link
                    key={course._id}
                    to={`/courses/${course._id}/papers`}
                    title={`Practise ${course.subject} past papers`}
                    className="inline-flex h-8 max-w-[180px] items-center gap-1.5 rounded-full border border-border bg-card px-2.5 text-[0.76rem] font-semibold text-brand-ink transition-colors hover:border-chrome-4 hover:bg-brand-panel"
                  >
                    <span
                      className="grid size-5 shrink-0 place-items-center rounded-md"
                      style={{ color: meta.color }}
                      aria-hidden
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span className="truncate">{course.subject}</span>
                  </Link>
                );
              })
            )}
            {readyCourses.length > 3 && (
              <Link
                to="/courses"
                className="inline-flex h-8 items-center rounded-full px-2 text-[0.74rem] font-semibold text-brand-ink/60 hover:text-brand-ink hover:underline"
              >
                +{readyCourses.length - 3} more
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
