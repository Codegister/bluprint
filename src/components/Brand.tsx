import { cn } from "@/lib/utils";
import { Link } from "react-router";

/**
 * The Bluprint mark: two offset note cards, one filled with the highlighter
 * colour, and three ruled lines. It reads at a glance as “notes, stacked” and
 * does not depend on a mascot or a gradient.
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
      className={cn("brand group inline-flex items-center gap-2.5", className)}
    >
      <span className="brand-mark" aria-hidden>
        <svg viewBox="0 0 30 30" className="size-full" fill="none">
          <path
            d="M6 7.5h12.5a2 2 0 0 1 2 2v15H8a2 2 0 0 1-2-2v-15Z"
            fill="var(--card)"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path
            d="M10 4.5h12.5a2 2 0 0 1 2 2v15H12a2 2 0 0 1-2-2v-15Z"
            fill="var(--highlighter)"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path
            d="M13 9.5h7.5M13 13h5.5M13 16.5h6.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {!markOnly && (
        <span className="brand-word">
          Bluprint<span className="brand-period">.</span>
        </span>
      )}
    </Link>
  );
}
