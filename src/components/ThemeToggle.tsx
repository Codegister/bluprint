import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

/**
 * The theme switch.
 *
 * It is deliberately a filled, labelled control rather than a quiet icon: the
 * theme is a preference people look for, and a low-contrast ghost button in a
 * sidebar is easy to miss. The fill follows the theme (ink on paper, pale
 * violet on the dark page) so it stays the most obvious control in its corner.
 *
 * `withLabel` widens it for the sidebar and spells the mode out in full.
 */
export function ThemeToggle({
  withLabel = false,
  className,
}: {
  withLabel?: boolean;
  className?: string;
}) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to high contrast dark mode";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={label}
      title={label}
      className={cn(
        "group inline-flex shrink-0 items-center gap-2 rounded-full border border-transparent font-semibold transition-colors",
        "bg-[#191B27] text-white hover:bg-[#2A2D3E]",
        "dark:bg-[#C3B2FF] dark:text-[#141025] dark:hover:bg-[#D8CCFF]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        withLabel ? "h-10 w-full justify-between px-4 text-[0.82rem]" : "h-9 px-3 text-[0.74rem]",
        className,
      )}
    >
      <span className="inline-flex items-center gap-2">
        <span
          className="grid size-4 place-items-center"
          aria-hidden="true"
        >
          {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </span>
        <span>{withLabel ? (isDark ? "Light mode" : "Dark mode") : isDark ? "Light" : "Dark"}</span>
      </span>

      {/* A tiny switch makes the current state legible at a glance, not just
          after reading the label. */}
      <span
        aria-hidden="true"
        className={cn(
          "relative h-4 w-7 shrink-0 rounded-full transition-colors",
          isDark ? "bg-[#141025]/30" : "bg-white/30",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-3 rounded-full transition-all",
            isDark
              ? "left-[15px] bg-[#141025]"
              : "left-0.5 bg-white",
          )}
        />
      </span>
    </button>
  );
}
