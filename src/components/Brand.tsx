import { cn } from "@/lib/utils";
import { Link } from "react-router";
import { Pip } from "./Pip";

/** Pipnote wordmark used in the nav, sidebar, auth screen and footer. */
export function Brand({
  className,
  markOnly = false,
  tone = "light",
  to = "/",
  onNavigate,
}: {
  className?: string;
  markOnly?: boolean;
  tone?: "light" | "dark";
  to?: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to={to}
      aria-label="Pipnote home"
      onClick={onNavigate}
      className={cn("group flex items-center gap-2.5", className)}
    >
      <span
        className={cn(
          "relative grid size-10 place-items-center rounded-[13px] border-2 border-brand-ink bg-brand-ink transition-transform group-hover:-rotate-3",
          tone === "dark" && "border-brand-cream/20",
        )}
      >
        <Pip size={31} className="translate-y-[1px]" />
        <span className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-brand-ink bg-brand-lime" />
      </span>
      {!markOnly && (
        <span
          className={cn(
            "font-display text-[1.45rem] font-bold leading-none tracking-tight",
            tone === "dark" ? "text-brand-cream" : "text-brand-ink",
          )}
        >
          pipnote
          <span className="text-brand-pink-deep">.</span>
        </span>
      )}
    </Link>
  );
}
