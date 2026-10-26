import { cn } from "@/lib/utils";
import { Link } from "react-router";

/**
 * Bluprint wordmark. The mark is a rounded black-chrome tile with an engraved
 * page-and-spark glyph; the wordmark is heavy, tight and lowercase.
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
      {/* `brand-tile` keeps the dark chrome mark readable in the dark theme,
          where ink tiles are inverted to a light fill. */}
      <span className="brand-tile grid size-9 place-items-center rounded-[0.7rem] bg-[#191B27] text-white transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-105">
        <svg
          viewBox="0 0 24 24"
          className="size-[18px]"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6.5 4.5h6.2a3.8 3.8 0 0 1 0 7.6H6.5V4.5Z"
            fill="#FFFFFF"
          />
          <path
            d="M6.5 12.1h7a3.9 3.9 0 1 1 0 7.9h-7v-7.9Z"
            fill="#B0B8C0"
          />
          <circle cx="18.5" cy="5.5" r="1.9" fill="#8F98A2" />
        </svg>
      </span>
      {!markOnly && (
        <span className="chrome-title font-display text-[1.5rem] font-extrabold leading-none tracking-[-0.045em]">
          bluprint
        </span>
      )}
    </Link>
  );
}
