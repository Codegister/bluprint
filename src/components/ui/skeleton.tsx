import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

/**
 * The building block for loading states.
 *
 * Pages show these shapes in place of a spinner, then swap them for real
 * content when the query arrives. The fill is a palette token, so it follows
 * the light / dark theme and never blinks a light block onto a dark page.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-xl bg-brand-panel", className)}
      {...props}
    />
  );
}
