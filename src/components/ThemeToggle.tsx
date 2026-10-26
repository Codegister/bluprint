import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

/**
 * One-tap switch between the light paper theme and the high-contrast dark
 * theme. It is a plain <button> so it works with keyboard, screen readers and
 * every browser without a settings menu of its own.
 *
 * `withLabel` is for roomy spots (the sidebar); headers use the icon-only
 * version, which keeps the same 36-40px hit target as the other header
 * controls.
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
        "group inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-card font-semibold text-brand-ink transition-colors",
        "hover:bg-brand-panel focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
        withLabel ? "h-9 px-3.5 text-[0.8rem]" : "size-9",
        className,
      )}
    >
      {/* Both icons live in the same slot so the button never changes width. */}
      <span className="grid size-4 place-items-center">
        {isDark ? (
          <Sun className="size-4 text-[#FFC163]" aria-hidden />
        ) : (
          <Moon className="size-4 text-[#5B3DF5]" aria-hidden />
        )}
      </span>
      {withLabel && <span>{isDark ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}
