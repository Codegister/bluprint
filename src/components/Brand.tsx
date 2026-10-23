import { BlueprintMark } from "@/components/BlueprintMark";
import { cn } from "@/lib/utils";
import { Link } from "react-router";

/** Bluprint wordmark used in the nav, sidebar, auth screen and footer. */
export function Brand({
  className,
  markOnly = false,
  to = "/",
  onNavigate,
}: {
  className?: string;
  markOnly?: boolean;
  to?: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to={to}
      aria-label="Bluprint home"
      onClick={onNavigate}
      className={cn("group flex items-center gap-2.5", className)}
    >
      <span className="relative grid size-9 place-items-center rounded-lg border border-brand-pink/30 bg-brand-panel text-brand-pink transition-colors group-hover:border-brand-pink/60 group-hover:bg-brand-pink/10">
        <BlueprintMark size={25} />
        <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-brand-lime" />
      </span>
      {!markOnly && (
        <span className="font-display text-[1.3rem] font-semibold leading-none tracking-tight text-brand-ink">
          bluprint
          <span className="text-brand-pink">.</span>
        </span>
      )}
    </Link>
  );
}
