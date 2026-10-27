import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

/**
 * The seam between screens.
 *
 * Each screen that finishes a piece of the study loop ends with one link to the
 * next piece — courses to material, material to practise, practise to today's
 * queue. It reads as a continuation rather than another menu.
 */
export function NextStep({
  to,
  title,
  hint,
  className,
}: {
  to: string;
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "mt-6 flex items-center gap-3 rounded-2xl border border-dashed border-brand-sky/30 bg-brand-sky/5 px-4 py-3 transition-colors hover:border-brand-sky/50 hover:bg-brand-sky/10",
        className,
      )}
    >
      <span className="shrink-0 text-[0.64rem] font-bold uppercase tracking-[0.12em] text-brand-sky">
        Next
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.86rem] font-semibold text-brand-ink">
          {title}
        </span>
        {hint && (
          <span className="block truncate text-[0.74rem] text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
      <ArrowRight className="size-4 shrink-0 text-brand-sky" aria-hidden />
    </Link>
  );
}
