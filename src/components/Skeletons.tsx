import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Page-shaped loading states.
 *
 * Each one mirrors the layout of the screen it stands in for - header, cards,
 * rows - so the page does not jump when the data arrives. They are purely
 * decorative: the wrapper carries `aria-busy` and a screen-reader label, and
 * the individual blocks are hidden from assistive technology.
 */

/** A labelled, busy container for a set of skeleton shapes. */
function Busy({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Paragraph lines. The final line is shorter, like real copy. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn("h-3", index === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

/** One list row: optional avatar, two lines of copy, a chip on the right. */
export function SkeletonRow({
  withAvatar = false,
  className,
}: {
  withAvatar?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3.5", className)}>
      {withAvatar && <Skeleton className="size-9 shrink-0 rounded-full" />}
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3 w-1/3 min-w-[7rem]" />
        <Skeleton className="h-2.5 w-1/2" />
      </div>
      <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
    </div>
  );
}

/** A card of rows, used for course and set lists. */
export function SkeletonRows({
  rows = 4,
  withAvatar = false,
}: {
  rows?: number;
  withAvatar?: boolean;
}) {
  return (
    <div aria-hidden="true" className="divide-y divide-border/60">
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonRow key={index} withAvatar={withAvatar} />
      ))}
    </div>
  );
}

/** The title block shared by the study set, course and paper pages. */
export function SkeletonPageHeader() {
  return (
    <div aria-hidden="true" className="space-y-3">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-8 w-2/3 max-w-md" />
      <Skeleton className="h-3.5 w-1/2 max-w-sm" />
      <div className="flex flex-wrap gap-2 pt-1">
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-28 rounded-full" />
      </div>
    </div>
  );
}

/** Study set: header card with tabs, then the active tab's panel. */
export function SkeletonStudySetPage() {
  return (
    <Busy label="Loading your study set" className="space-y-4">
      <div className="gizmo-card p-5 sm:p-6" aria-hidden="true">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-3/4 max-w-sm" />
            <Skeleton className="h-3 w-1/2 max-w-xs" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="size-9 rounded-full" />
          </div>
        </div>
        <div className="mt-5 flex gap-2" aria-hidden="true">
          {[72, 92, 68, 64, 70].map((width) => (
            <Skeleton
              key={width}
              className="h-8 rounded-full"
              style={{ width }}
            />
          ))}
        </div>
      </div>
      <div className="gizmo-card space-y-4 p-5 sm:p-6" aria-hidden="true">
        <Skeleton className="h-4 w-32" />
        <SkeletonText lines={4} />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <SkeletonText lines={2} />
      </div>
    </Busy>
  );
}

/** Course pathpage: hero, progress, then unit rows. */
export function SkeletonCoursePage() {
  return (
    <Busy label="Loading your course pathway" className="space-y-4">
      <SkeletonPageHeader />
      <div className="gizmo-card space-y-4 p-5 sm:p-6" aria-hidden="true">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-2.5 w-full rounded-full" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-16 rounded-2xl" />
          ))}
        </div>
      </div>
      <div className="gizmo-card overflow-hidden" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="flex items-center gap-3 border-b border-border/60 px-4 py-4 last:border-b-0"
          >
            <Skeleton className="size-7 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-2.5 w-3/5" />
            </div>
            <Skeleton className="h-7 w-20 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </Busy>
  );
}

/** Past paper: title, blueprint chips, then the question panel. */
export function SkeletonPastPaperPage() {
  return (
    <Busy label="Loading your past paper" className="space-y-4">
      <SkeletonPageHeader />
      <div className="gizmo-card space-y-4 p-5 sm:p-6" aria-hidden="true">
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-7 w-24 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-2.5 w-full rounded-full" />
      </div>
      <div className="gizmo-card space-y-4 p-5 sm:p-6" aria-hidden="true">
        <Skeleton className="h-4 w-40" />
        <SkeletonText lines={3} />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>
    </Busy>
  );
}

/** Timetable: heading, day strip, the day's session list and the side cards. */
export function SkeletonTimetablePage() {
  return (
    <Busy label="Loading your revision timetable" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4" aria-hidden="true">
        <div className="space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-3.5 w-48" />
        </div>
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
      <div className="flex gap-2 overflow-hidden" aria-hidden="true">
        {[64, 72, 68, 76, 70, 66, 74].map((width, index) => (
          <Skeleton
            key={index}
            className="h-16 shrink-0 rounded-2xl"
            style={{ width }}
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]" aria-hidden="true">
        <div className="gizmo-card overflow-hidden">
          <div className="border-b border-border/60 px-4 py-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-3.5 w-40" />
          </div>
          <div className="space-y-2 p-3 sm:p-4">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-[74px] rounded-2xl" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-[1.7rem]" />
          <Skeleton className="h-52 rounded-[1.7rem]" />
        </div>
      </div>
    </Busy>
  );
}

/** Timetable builder: stepper, then the current step's card of options. */
export function SkeletonBuilderPage() {
  return (
    <Busy label="Loading the timetable builder" className="space-y-4">
      <Skeleton className="h-3 w-28" aria-hidden="true" />
      <div className="space-y-3" aria-hidden="true">
        <Skeleton className="h-8 w-2/3 max-w-md" />
        <Skeleton className="h-3.5 w-full max-w-xl" />
        <Skeleton className="h-3.5 w-4/5 max-w-lg" />
      </div>
      <div className="flex gap-2 pt-1" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-7 flex-1 rounded-full" />
        ))}
      </div>
      <div className="gizmo-card space-y-5 p-5 sm:p-6" aria-hidden="true">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-2/3 max-w-sm" />
          <Skeleton className="h-3 w-1/2 max-w-xs" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <Skeleton key={index} className="h-16 rounded-2xl" />
          ))}
        </div>
      </div>
      <Skeleton className="h-16 rounded-[1.4rem]" aria-hidden="true" />
    </Busy>
  );
}

/** Chat transcript: alternate incoming and outgoing bubbles. */
export function SkeletonChat({ bubbles = 3 }: { bubbles?: number }) {
  return (
    <Busy label="Loading your tutor conversation" className="space-y-3 py-2">
      {Array.from({ length: bubbles }).map((_, index) => {
        const mine = index % 2 === 1;
        return (
          <div
            key={index}
            aria-hidden="true"
            className={cn("flex", mine ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "space-y-2 rounded-2xl border border-border bg-card p-3.5",
                mine ? "w-2/3" : "w-4/5",
              )}
            >
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-2.5 w-full" />
              <Skeleton className="h-2.5 w-4/5" />
            </div>
          </div>
        );
      })}
    </Busy>
  );
}

/** A settings-style panel of label/value rows. */
export function SkeletonPanel({ rows = 4 }: { rows?: number }) {
  return (
    <Busy label="Loading" className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="flex items-center justify-between gap-3"
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </Busy>
  );
}
