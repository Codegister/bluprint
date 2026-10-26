import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";
import { Moon, Sun } from "lucide-react";

/**
 * The light / dark switch.
 *
 * Icon-only by default so it can sit in a header. `withLabel` is the wider
 * sidebar row, which names the mode that is currently on and the one a click
 * will switch to.
 */
export function ThemeToggle({
  className,
  withLabel = false,
}: {
  className?: string;
  withLabel?: boolean;
}) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const next = dark ? "light" : "dark";

  if (withLabel) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${next} mode`}
        title={`Switch to ${next} mode`}
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left text-[0.9rem] font-medium text-brand-ink transition-colors hover:bg-brand-panel",
          className,
        )}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-[0.6rem] bg-brand-panel text-brand-ink ring-1 ring-border/70 transition-colors group-hover:bg-card">
          {dark ? (
            <Moon className="size-[15px]" aria-hidden />
          ) : (
            <Sun className="size-[15px]" aria-hidden />
          )}
        </span>
        {dark ? "Dark mode" : "Light mode"}
        <span className="ml-auto text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Switch
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={cn(
        "grid size-9 place-items-center rounded-full border border-border bg-card text-brand-ink transition-colors hover:bg-brand-panel",
        className,
      )}
    >
      {/* Icon-only buttons show the mode a click will switch to. */}
      {dark ? (
        <Sun className="size-[17px]" aria-hidden />
      ) : (
        <Moon className="size-[17px]" aria-hidden />
      )}
    </button>
  );
}
