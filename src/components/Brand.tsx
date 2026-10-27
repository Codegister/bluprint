import { cn } from "@/lib/utils";
import { Link } from "react-router";

/**
 * Bluprint wordmark. The mark is a sticker tile with an ink page-and-spark
 * glyph and the wordmark is heavy and tight. It is written "Bluprint" here
 * exactly as it is written in prose everywhere else: one spelling, one brand.
 */
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
      className={cn("group inline-flex items-center gap-2.5", className)}
    >
      <span className="grid size-9 place-items-center rounded-[0.7rem] border border-brand-ink/70 bg-gizmo-lime text-brand-ink shadow-[0_2px_0_rgba(28,26,20,0.22)] transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-105">
        <svg
          viewBox="0 0 24 24"
          className="size-[18px]"
          fill="none"
          aria-hidden="true"
        >
          <path d="M6.5 4.5h6.2a3.8 3.8 0 0 1 0 7.6H6.5V4.5Z" fill="currentColor" />
          <path
            d="M6.5 12.1h7a3.9 3.9 0 1 1 0 7.9h-7v-7.9Z"
            fill="currentColor"
            opacity="0.55"
          />
          <circle cx="18.5" cy="5.5" r="1.9" fill="currentColor" />
        </svg>
      </span>
      {!markOnly && (
        <span className="font-display text-[1.5rem] font-extrabold leading-none tracking-[-0.045em] text-brand-ink">
          Bluprint
        </span>
      )}
    </Link>
  );
}
