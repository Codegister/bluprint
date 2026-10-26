import { Meter, enter } from "@/components/motion/Motion";
import { api } from "@/convex/_generated/api";
import { percent } from "@/lib/format";
import { courseSubtitle, subjectMeta } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import type { FunctionReturnType } from "convex/server";
import { motion } from "framer-motion";
import { ArrowRight, Check, GraduationCap, LayoutGrid } from "lucide-react";
import { Link } from "react-router";

type CourseSummary = FunctionReturnType<typeof api.courses.listMine>[number];

/**
 * The course rail on the dashboard.
 *
 * One chip per saved course, plus "All courses". The choice scopes both the
 * tutor panel above and the study-set list below; without it the screen is a
 * view of everything. Courses are loaded lazily, so the rail has a quiet
 * skeleton before it resolves.
 */
export function CoursePicker({
  courses,
  selected,
  onSelect,
}: {
  courses: CourseSummary[] | undefined;
  selected: string | null;
  onSelect: (courseId: string | null) => void;
}) {
  const selectedCourse =
    courses?.find((course) => course._id === selected) ?? null;

  return (
    <motion.section
      aria-labelledby="course-picker-heading"
      className="chrome-plate rounded-[1.6rem] px-4 pb-4 pt-3.5"
      {...enter(0.12, 10)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-6 place-items-center rounded-lg bg-gizmo-lime text-[#1C1A14]">
          <GraduationCap className="size-3.5" aria-hidden />
        </span>
        <h2 id="course-picker-heading" className="mono-label text-chrome-7">
          Course
        </h2>
        <p className="text-[0.74rem] text-muted-foreground">
          {selectedCourse
            ? `${selectedCourse.setCount} ${selectedCourse.setCount === 1 ? "set" : "sets"} · ${selectedCourse.completedCount}/${selectedCourse.topicCount} topics done`
            : "Scope the tutor and your sets to one course"}
        </p>
        <Link
          to="/courses/new"
          className="ml-auto text-[0.75rem] font-semibold text-brand-ink/70 underline-offset-2 hover:text-brand-ink hover:underline"
        >
          Add course
        </Link>
      </div>

      <div
        role="group"
        aria-label="Choose a course"
        className="no-scrollbar -mx-1 mt-2.5 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-pressed={!selectedCourse}
          className={cn(
            "flex h-[58px] shrink-0 items-center gap-2 rounded-2xl border px-3 text-left transition-colors",
            !selectedCourse
              ? "border-brand-ink/25 bg-gizmo-lime/55 text-[#1C1A14] shadow-[0_2px_0_rgba(28,26,20,0.1)] dark:shadow-none"
              : "border-border bg-white text-brand-ink/75 hover:bg-brand-panel",
          )}
        >
          <span className="grid size-7 place-items-center rounded-xl bg-white/70 text-[#1C1A14]">
            <LayoutGrid className="size-4" aria-hidden />
          </span>
          <span>
            <span className="block text-[0.84rem] font-semibold">All courses</span>
            <span
              className={cn(
                "block text-[0.68rem]",
                !selectedCourse ? "text-[#1C1A14]/65" : "text-muted-foreground",
              )}
            >
              Everything
            </span>
          </span>
          {!selectedCourse && <Check className="ml-1 size-3.5" aria-hidden />}
        </button>

        {courses === undefined ? (
          <span className="h-[58px] w-40 shrink-0 animate-pulse rounded-2xl bg-brand-panel" />
        ) : (
          courses.map((course) => {
            const meta = subjectMeta(course.subject);
            const Icon = meta.icon;
            const active = selected === course._id;
            return (
              <button
                key={course._id}
                type="button"
                onClick={() => onSelect(course._id)}
                aria-pressed={active}
                title={courseSubtitle(course)}
                className={cn(
                  "flex h-[58px] shrink-0 items-center gap-2 rounded-2xl border px-3 text-left transition-colors",
                  active
                    ? "border-brand-ink/25 bg-gizmo-lilac/55 text-[#1C1A14] shadow-[0_2px_0_rgba(28,26,20,0.1)] dark:shadow-none"
                    : "border-border bg-white text-brand-ink/75 hover:bg-brand-panel",
                )}
              >
                <span
                  className={cn("grid size-7 place-items-center rounded-xl", meta.tint)}
                  style={{ color: meta.color }}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block max-w-[150px] truncate text-[0.84rem] font-semibold">
                    {course.subject}
                  </span>
                  <span
                    className={cn(
                      "block max-w-[150px] truncate text-[0.68rem]",
                      active ? "text-[#1C1A14]/65" : "text-muted-foreground",
                    )}
                  >
                    {course.level}
                    {course.examBoard !== "None" ? ` · ${course.examBoard}` : ""}
                  </span>
                </span>
                {active && <Check className="ml-1 size-3.5 shrink-0" aria-hidden />}
              </button>
            );
          })
        )}
      </div>

      {selectedCourse && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-2.5">
          <p className="text-[0.76rem] font-semibold text-brand-ink">
            {courseSubtitle(selectedCourse)}
          </p>
          <div className="flex items-center gap-2">
            <Meter
              value={percent(
                selectedCourse.completedCount,
                Math.max(1, selectedCourse.topicCount),
              )}
              className="h-1.5 w-24"
              barClassName="bg-brand-pink-deep"
              label={`${selectedCourse.subject} pathway progress`}
            />
            <span className="text-[0.7rem] text-muted-foreground">
              {percent(
                selectedCourse.completedCount,
                Math.max(1, selectedCourse.topicCount),
              )}
              % mapped
            </span>
          </div>
          <Link
            to={`/courses/${selectedCourse._id}`}
            className="ml-auto inline-flex items-center gap-1 text-[0.76rem] font-semibold text-brand-ink hover:underline"
          >
            Open course
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      )}
    </motion.section>
  );
}
