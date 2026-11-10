import { cn } from "@/lib/utils";

type PickerOption = {
  id: string;
  title: string;
  number: number;
  /** Present when the option is a pathway part rather than a single topic. */
  topicCount?: number;
};

/**
 * A flat checklist of whole pathway choices. A part includes every topic it
 * contains; a single topic is used when building from one topic on the pathway.
 * Subtopics are deliberately not shown: the student is choosing the scope of a
 * set, and each choice is included in full.
 */
export function TopicPicker({
  options,
  selectedIds,
  onChange,
  disabled = false,
  className,
  noun = "topic",
}: {
  options: PickerOption[];
  selectedIds: readonly string[];
  onChange: (optionIds: string[]) => void;
  disabled?: boolean;
  className?: string;
  noun?: "part" | "topic";
}) {
  const chosen = new Set(selectedIds);
  const selectedCount = options.filter((option) =>
    chosen.has(option.id),
  ).length;
  const allSelected = options.length > 0 && selectedCount === options.length;

  const toggle = (optionId: string) => {
    const next = new Set(chosen);
    if (next.has(optionId)) next.delete(optionId);
    else next.add(optionId);
    // Always hand back pathway order, no matter which box was clicked.
    onChange(
      options
        .filter((option) => next.has(option.id))
        .map((option) => option.id),
    );
  };

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className="text-[0.7rem] font-medium text-muted-foreground"
          aria-live="polite"
        >
          {selectedCount} of {options.length} {noun}
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
        aria-label={
          noun === "part" ? "Parts in this set" : "Topics in this set"
        }
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
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-[0.82rem] font-medium leading-snug",
                      isSelected ? "text-brand-ink" : "text-brand-ink/75",
                    )}
                  >
                    {option.title}
                  </span>
                  {noun === "part" && option.topicCount !== undefined && (
                    <span className="mt-0.5 block text-[0.7rem] leading-snug text-muted-foreground">
                      {option.topicCount} topic
                      {option.topicCount === 1 ? "" : "s"}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
