import type { SectionOption } from "@/lib/pathwaySections";
import { cn } from "@/lib/utils";

/**
 * A flat checklist of whole pathway topics. Unit names and subtopics are
 * deliberately not shown: the student is choosing the topics a set covers, and
 * each one is included in full. Numbers are the course-wide topic numbers.
 */
export function TopicPicker({
  options,
  selectedIds,
  onChange,
  disabled = false,
  className,
}: {
  options: SectionOption[];
  selectedIds: readonly string[];
  onChange: (topicIds: string[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  const chosen = new Set(selectedIds);
  const selectedCount = options.filter((option) => chosen.has(option.id)).length;
  const allSelected = options.length > 0 && selectedCount === options.length;

  const toggle = (topicId: string) => {
    const next = new Set(chosen);
    if (next.has(topicId)) next.delete(topicId);
    else next.add(topicId);
    // Always hand back pathway order, no matter which box was clicked.
    onChange(options.filter((option) => next.has(option.id)).map((option) => option.id));
  };

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className="text-[0.7rem] font-medium text-muted-foreground"
          aria-live="polite"
        >
          {selectedCount} of {options.length} topic
          {options.length === 1 ? "" : "s"} selected
        </p>
        {options.length > 1 && (
          <div className="flex items-center gap-3">
            {!allSelected && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(options.map((option) => option.id))}
                className="text-[0.7rem] font-semibold text-chrome-7 transition-colors hover:text-brand-ink disabled:opacity-50"
              >
                Select all
              </button>
            )}
            {selectedCount > 0 && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange([])}
                className="text-[0.7rem] font-semibold text-muted-foreground transition-colors hover:text-brand-ink disabled:opacity-50"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      <ul
        aria-label="Topics in this set"
        className="mt-2 max-h-72 overflow-y-auto rounded-2xl border border-border bg-[#FCFCFD] p-1.5"
      >
        {options.map((option) => {
          const isSelected = chosen.has(option.id);
          return (
            <li key={option.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-xl px-2.5 py-2 transition-colors",
                  isSelected ? "bg-white" : "hover:bg-white/70",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={disabled}
                  onChange={() => toggle(option.id)}
                  className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[#191B27] disabled:cursor-not-allowed"
                />
                <span
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[0.64rem] font-semibold tabular-nums",
                    isSelected
                      ? "bg-[#191B27] text-white"
                      : "bg-brand-panel text-chrome-7",
                  )}
                >
                  {option.number}
                </span>
                <span
                  className={cn(
                    "min-w-0 text-[0.82rem] font-medium leading-snug",
                    isSelected ? "text-brand-ink" : "text-brand-ink/75",
                  )}
                >
                  {option.title}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
