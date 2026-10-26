import { AppShell } from "@/components/AppShell";
import { Mascot } from "@/components/Mascot";
import { Meter, enter } from "@/components/motion/Motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { percent } from "@/lib/format";
import { courseSubtitle, subjectMeta } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { motion } from "framer-motion";
import { ChevronRight, GraduationCap, Loader2, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router";

type CourseSummary = FunctionReturnType<typeof api.courses.listMine>[number];

/** One row of the course list. */
function CourseRow({ course }: { course: CourseSummary }) {
  const meta = subjectMeta(course.subject);
  const Icon = meta.icon;
  const mastery = percent(course.completedCount, course.topicCount);
  const building = course.status === "queued" || course.status === "processing";

  return (
    <Link
      to={`/courses/${course._id}`}
      className="group grid grid-cols-1 gap-3 border-b border-border/70 px-4 py-4 transition-colors last:border-b-0 hover:bg-brand-panel sm:grid-cols-[minmax(0,1fr)_170px_160px_16px] sm:items-center sm:px-5"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn("grid size-11 shrink-0 place-items-center rounded-2xl", meta.tint)}
          style={{ color: meta.color }}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate font-display text-[0.98rem] font-bold text-brand-ink">
              {course.subject}
            </h3>
            {course.isNew && (
              <span className="rounded-full bg-chrome-7 px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-[0.04em] text-white">
                New
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[0.76rem] text-muted-foreground">
            {courseSubtitle(course)}
          </p>
        </div>
      </div>

      <div>
        {building ? (
          <p className="flex items-center gap-1.5 text-[0.76rem] font-medium text-[#96650A]">
            <Loader2 className="size-3 animate-spin" />
            {course.progress || "Building"}
          </p>
        ) : course.status === "error" ? (
          <p className="flex items-center gap-1.5 text-[0.76rem] font-medium text-[#96650A]">
            <Loader2 className="size-3 animate-spin" /> Finishing map
          </p>
        ) : (
          <>
            <p className="text-[0.8rem] font-semibold text-brand-ink">
              {course.completedCount}
              <span className="font-normal text-muted-foreground">
                {" "}
                / {course.topicCount} topics
              </span>
            </p>
            <Meter
              value={mastery}
              className="mt-1.5 h-1.5 w-full max-w-[130px]"
              barStyle={{ backgroundColor: meta.color }}
              label={`${course.subject} pathway progress`}
            />
          </>
        )}
      </div>

      <div>
        {course.status === "ready" ? (
          <div className="flex items-center gap-2 text-[0.76rem] text-muted-foreground">
            <span className="font-semibold text-brand-ink">
              {course.setCount} {course.setCount === 1 ? "set" : "sets"}
            </span>
            {course.cardCount > 0 && (
              <span className="text-[0.72rem]">
                {percent(course.knownCount, course.cardCount)}% known
              </span>
            )}
          </div>
        ) : (
          <p className="text-[0.76rem] text-muted-foreground">
            {course.status === "error" ? "Preparing pathway" : "Mapping specification"}
          </p>
        )}
      </div>

      <ChevronRight className="hidden size-4 text-brand-ink/30 transition-transform group-hover:translate-x-0.5 sm:block" />
    </Link>
  );
}

/**
 * The course library. It shows revision pathways only, so it does not have to
 * share the screen with the tutor or the saved-set list.
 */
export default function Courses() {
  const courseRows = useQuery(api.courses.listMine);
  const recoverCourses = useMutation(api.courses.recoverMine);
  const recoveryRequested = useRef(false);

  // Recover courses left failed by an older build. This runs once per page
  // load and means the student never has to press a retry button.
  useEffect(() => {
    if (!courseRows) return;
    const now = Date.now();
    const needsRecovery = courseRows.some(
      (course) =>
        course.status === "error" ||
        (course.status === "processing" &&
          (course.processingStartedAt === undefined ||
            now - course.processingStartedAt > 10 * 60 * 1000)) ||
        (course.status === "queued" && now - course.updatedAt > 2 * 60 * 1000),
    );
    if (!needsRecovery) {
      recoveryRequested.current = false;
      return;
    }
    if (recoveryRequested.current) return;
    recoveryRequested.current = true;
    void recoverCourses().catch(() => {
      recoveryRequested.current = false;
    });
  }, [courseRows, recoverCourses]);

  const count = courseRows?.length ?? 0;

  return (
    <AppShell>
      <motion.header
        className="chrome-plate flex flex-wrap items-end justify-between gap-4 rounded-[1.6rem] px-5 py-5"
        {...enter(0.04, 12)}
      >
        <div className="min-w-0">
          <p className="mono-label text-[#128A4C]">Revision pathways</p>
          <h1 className="mt-1 font-display text-[1.6rem] font-bold leading-tight tracking-[-0.03em] text-brand-ink sm:text-[2rem]">
            Your courses
          </h1>
          <p className="mt-1.5 max-w-lg text-[0.88rem] leading-relaxed text-muted-foreground">
            Each course maps its published specification into topics you can
            revise, track and build study material from.
          </p>
        </div>
        <Button
          asChild
          className="h-10 rounded-full bg-[#191B27] px-4 text-[0.82rem] font-semibold text-white hover:bg-[#2A2D3E]"
        >
          <Link to="/courses/new">
            <Plus className="size-4" />
            {count > 0 ? "Add courses" : "Choose courses"}
          </Link>
        </Button>
      </motion.header>

      <section className="mt-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-lg bg-[#E3F8F0] text-[#128A4C]">
            <GraduationCap className="size-4" aria-hidden />
          </span>
          <h2 className="font-display text-[1.05rem] font-bold text-brand-ink">
            Course list
          </h2>
          <span className="text-[0.74rem] font-semibold tabular-nums text-muted-foreground">
            {count}
          </span>
          <span className="hidden h-px flex-1 border-t border-dashed border-border sm:block" />
        </div>

        <div className="mt-3 overflow-hidden rounded-3xl border border-border bg-white">
          {courseRows === undefined ? (
            <div role="status" aria-busy="true" aria-live="polite">
              <span className="sr-only">Loading your courses</span>
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  aria-hidden="true"
                  className="grid grid-cols-1 items-center gap-3 border-b border-border/60 px-5 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_170px_160px_16px]"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-11 shrink-0 rounded-2xl" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-3 w-1/3" />
                      <Skeleton className="h-2.5 w-1/2" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-2.5 w-24" />
                    <Skeleton className="h-1.5 w-full max-w-[130px] rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="size-4 rounded" />
                </div>
              ))}
            </div>
          ) : courseRows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-8 text-center sm:flex-row sm:text-left">
              <Mascot size={92} float={false} className="shrink-0" />
              <div>
                <p className="font-display text-[1rem] font-bold text-brand-ink">
                  No courses yet
                </p>
                <p className="mt-1 max-w-md text-[0.82rem] leading-relaxed text-muted-foreground">
                  Choose your qualification and subjects, and Bluprint maps each
                  published specification into a revision pathway.
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="mt-3 h-9 rounded-full border-border bg-white px-4 text-[0.8rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
                >
                  <Link to="/courses/new">
                    Choose courses
                    <ChevronRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(0,1fr)_170px_160px_16px] gap-3 border-b border-border bg-background px-5 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:grid">
                <span>Subject</span>
                <span>Pathway</span>
                <span>Materials</span>
                <span />
              </div>
              <div className="rise-stagger">
                {courseRows.map((course) => (
                  <CourseRow key={course._id} course={course} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </AppShell>
  );
}
