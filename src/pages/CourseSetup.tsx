import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { readableError } from "@/lib/errors";
import { EXAM_BOARDS, STUDY_LEVELS } from "@/lib/examBoards";
import {
  SUBJECT_GROUPS,
  SUBJECTS,
  poetryThemesFor,
  subjectMeta,
  tierChoices,
  tierLabel,
} from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

const MAX_COURSES = 12;

/** One selected course while it is still being edited in the picker. */
type CourseDraft = {
  examBoard: string;
  tier?: string;
  variant?: string;
  poetryTheme?: string;
};

const levelHints: Record<string, string> = {
  GCSE: "Years 10–11",
  "A-Level": "Years 12–13",
  IB: "HL and SL",
  AP: "Advanced Placement",
  Undergraduate: "University",
};

function defaultBoardFor(level: string): string {
  if (level === "IB") return "IB";
  if (level === "AP") return "College Board AP";
  if (level === "Undergraduate") return "Other";
  return "AQA";
}

/** GCSE defaults to Higher; students only switch when their school enters them
 *  for Foundation. Other qualifications have no tier. */
function defaultTierFor(level: string, subject: string): string | undefined {
  const { tiers } = tierChoices(level, subject);
  return tiers.includes("Higher") ? "Higher" : tiers[0];
}

/** Power and Conflict stays the default; students can switch anthology theme. */
function defaultPoetryThemeFor(level: string, subject: string): string | undefined {
  return poetryThemesFor(level, subject)[0];
}

/** A small segmented control, used for tiers and routes inside a course row. */
function Segmented({
  label,
  options,
  value,
  onChange,
  format = (option) => option,
}: {
  label: string;
  options: string[];
  value?: string;
  onChange: (option: string) => void;
  format?: (option: string) => string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[0.62rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
        {label}
      </span>
      <div className="flex rounded-lg bg-brand-panel p-0.5">
        {options.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option)}
              className={cn(
                "rounded-[7px] px-2 py-1 text-[0.7rem] font-semibold transition-colors",
                active
                  ? "bg-white text-brand-ink shadow-[0_1px_2px_rgba(22,24,31,0.1)]"
                  : "text-brand-ink/55 hover:text-brand-ink",
              )}
            >
              {format(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * One subject in the catalogue. The row stays a single compact line until it is
 * selected; its board, tier and poetry theme then open directly underneath the
 * row rather than in a separate panel.
 */
function CourseRow({
  name,
  draft,
  level,
  open,
  onActivate,
  onRemove,
  onBoard,
  onPoetryTheme,
  onTier,
}: {
  name: string;
  draft?: CourseDraft;
  level: string;
  open: boolean;
  onActivate: () => void;
  onRemove: () => void;
  onBoard: (board: string) => void;
  onPoetryTheme: (theme: string) => void;
  onTier: (field: "tier" | "variant", value: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const { variants, tiers } = tierChoices(level, name);
  const poetryThemes = poetryThemesFor(level, name);
  const selected = Boolean(draft);
  const meta = subjectMeta(name);
  const Icon = meta.icon;

  const details: string[] = [];
  if (draft) {
    details.push(draft.examBoard);
    if (draft.tier) details.push(tierLabel(draft.tier));
    if (draft.variant) details.push(draft.variant);
    if (draft.poetryTheme) details.push(draft.poetryTheme);
  }

  return (
    <div
      ref={rowRef}
      className={cn(
        "group rounded-xl border transition-colors",
        selected
          ? "border-[#191B27]/15 bg-white"
          : "border-transparent hover:border-border hover:bg-white",
      )}
    >
      <div className="flex items-center gap-2.5 px-2.5 py-2">
        <span
          className={cn("grid size-8 shrink-0 place-items-center rounded-lg", meta.tint)}
        >
          <Icon className="size-4" style={{ color: meta.color }} aria-hidden />
        </span>
        <button
          type="button"
          onClick={onActivate}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block truncate text-[0.86rem] font-semibold text-brand-ink">
            {name}
          </span>
          <span className="mt-0.5 block truncate text-[0.68rem] text-muted-foreground">
            {details.length > 0 ? details.join(" · ") : "Tap to add"}
          </span>
        </button>
        <button
          type="button"
          aria-label={selected ? `Remove ${name}` : `Add ${name}`}
          aria-pressed={selected}
          onClick={selected ? onRemove : onActivate}
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full border transition-colors",
            selected
              ? "border-[#191B27] bg-[#191B27] text-white hover:bg-[#2A2D3E]"
              : "border-border text-brand-ink/35 group-hover:border-[#7C5CFF] group-hover:text-[#5B3DF5]",
          )}
        >
          {selected ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <Plus className="size-3.5" aria-hidden />
          )}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {draft && open && (
          <motion.div
            key="editor"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 px-2.5 py-2.5">
              <label className="flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                Board
                <select
                  aria-label={`Exam board for ${name}`}
                  value={draft.examBoard}
                  onChange={(event) => onBoard(event.target.value)}
                  className="h-8 rounded-lg border border-border bg-white px-1.5 text-[0.72rem] font-medium normal-case tracking-normal text-brand-ink outline-none focus:border-[#7C5CFF]"
                >
                  {EXAM_BOARDS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              {tiers.length > 0 && (
                <Segmented
                  label="Tier"
                  options={tiers}
                  value={draft.tier}
                  onChange={(value) => onTier("tier", value)}
                />
              )}

              {variants.length > 0 && (
                <Segmented
                  label="Route"
                  options={variants}
                  value={draft.variant}
                  onChange={(value) => onTier("variant", value)}
                />
              )}

              {poetryThemes.length > 0 && (
                <label className="flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                  Poems
                  <select
                    aria-label={`Poetry theme for ${name}`}
                    value={draft.poetryTheme ?? poetryThemes[0]}
                    onChange={(event) => onPoetryTheme(event.target.value)}
                    className="h-8 rounded-lg border border-border bg-white px-1.5 text-[0.72rem] font-medium normal-case tracking-normal text-brand-ink outline-none focus:border-[#7C5CFF]"
                  >
                    {poetryThemes.map((theme) => (
                      <option key={theme} value={theme}>
                        {theme}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <button
                type="button"
                onClick={onRemove}
                className="ml-auto text-[0.7rem] font-semibold text-muted-foreground transition-colors hover:text-destructive"
              >
                Remove
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CourseSetup() {
  const navigate = useNavigate();
  const createMany = useMutation(api.courses.createMany);

  const [level, setLevel] = useState("GCSE");
  const [board, setBoard] = useState("AQA");
  const [selected, setSelected] = useState<Record<string, CourseDraft>>({});
  const [query, setQuery] = useState("");
  const [opened, setOpened] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedNames = Object.keys(selected);
  const selectedCount = selectedNames.length;
  const distinctBoards = new Set(
    Object.values(selected).map((course) => course.examBoard),
  ).size;

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return SUBJECT_GROUPS.map((group) => ({
      group,
      subjects: SUBJECTS.filter(
        (subject) =>
          subject.group === group &&
          (!needle ||
            subject.name.toLowerCase().includes(needle) ||
            group.toLowerCase().includes(needle)),
      ),
    })).filter((entry) => entry.subjects.length > 0);
  }, [query]);

  const trimmedQuery = query.trim();
  const exactMatch = SUBJECTS.some(
    (subject) => subject.name.toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const showCustom = trimmedQuery.length >= 2 && !exactMatch && !(trimmedQuery in selected);

  const addCourse = (name: string, options?: { clearQuery?: boolean }) => {
    const clean = name.trim().slice(0, 80);
    if (clean.length < 2) return;
    if (Object.keys(selected).length >= MAX_COURSES) {
      toast.error(`You can set up ${MAX_COURSES} courses at a time.`);
      return;
    }
    setSelected((current) => {
      if (clean in current) return current;
      return {
        ...current,
        [clean]: {
          examBoard: board,
          tier: defaultTierFor(level, clean),
          poetryTheme: defaultPoetryThemeFor(level, clean),
        },
      };
    });
    setOpened(clean);
    // A custom course only exists in this picker, so drop the search that found
    // it. A catalogue subject keeps the query so several matches can be added.
    if (options?.clearQuery) setQuery("");
    setError(null);
  };

  const removeCourse = (name: string) => {
    setSelected((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
    setOpened((current) => (current === name ? null : current));
    setError(null);
  };

  /** Clicking a selected row opens or closes its settings. */
  const activate = (name: string) => {
    if (name in selected) {
      setOpened((current) => (current === name ? null : name));
      return;
    }
    addCourse(name);
  };

  const chooseLevel = (next: string) => {
    const nextBoard = defaultBoardFor(next);
    setLevel(next);
    setBoard(nextBoard);
    // Tier labels differ between qualifications (Higher, HL). Reset them to the
    // new level's default rather than sending a stale one, and reset the
    // per-subject boards to the new qualification's default.
    setSelected((current) =>
      Object.fromEntries(
        Object.keys(current).map((name) => [
          name,
          {
            examBoard: nextBoard,
            tier: defaultTierFor(next, name),
            poetryTheme: defaultPoetryThemeFor(next, name),
          },
        ]),
      ),
    );
  };

  /** The default board applies to new picks and to courses the student has not
   *  customised, which is the common case for a whole subject list. */
  const chooseBoard = (next: string) => {
    setBoard(next);
    setSelected((current) =>
      Object.fromEntries(
        Object.entries(current).map(([name, course]) => [
          name,
          { ...course, examBoard: next },
        ]),
      ),
    );
  };

  const setCourseBoard = (name: string, next: string) => {
    setSelected((current) => ({
      ...current,
      [name]: { ...current[name]!, examBoard: next },
    }));
  };

  const setCoursePoetryTheme = (name: string, theme: string) => {
    setSelected((current) => ({
      ...current,
      [name]: { ...current[name]!, poetryTheme: theme },
    }));
  };

  const setCourseTier = (name: string, field: "tier" | "variant", value: string) => {
    setSelected((current) => {
      const course = current[name];
      if (!course) return current;
      // A tier is a required choice once shown, so clicking the active tier
      // keeps it. Routes such as IB HL/SL can still be toggled off.
      if (field === "tier") return { ...current, [name]: { ...course, tier: value } };
      return {
        ...current,
        [name]: { ...course, variant: course.variant === value ? undefined : value },
      };
    });
  };

  const buildLabel = saving
    ? "Queuing pathways…"
    : selectedCount === 0
      ? "Build pathways"
      : `Build ${selectedCount} pathway${selectedCount === 1 ? "" : "s"}`;

  const build = async () => {
    if (selectedCount === 0) {
      setError("Pick at least one course.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await createMany({
        level,
        examBoard: board,
        courses: selectedNames.map((subject) => ({
          subject,
          examBoard: selected[subject]!.examBoard,
          tier: selected[subject]!.tier,
          variant: selected[subject]!.variant,
          poetryTheme: selected[subject]!.poetryTheme,
        })),
      });

      if (result.queued === 0) {
        toast.info("Those courses are already on your dashboard.");
      } else {
        toast.success(
          `${result.queued} pathway${result.queued === 1 ? "" : "s"} queued. Bluprint is mapping each specification in the background.`,
        );
      }
      navigate("/dashboard");
    } catch (buildError) {
      const message = readableError(
        buildError,
        "Could not start those pathways. Please try again.",
      );
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 text-[0.78rem] font-semibold text-muted-foreground transition-colors hover:text-brand-ink"
      >
        <X className="size-3.5 rotate-45" aria-hidden />
        Back to home
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#7C5CFF]">
            Course pathways
          </p>
          <h1 className="font-display text-[1.5rem] font-bold leading-tight text-brand-ink sm:text-[1.8rem]">
            Your courses
          </h1>
        </div>
        <p className="max-w-md text-[0.82rem] leading-relaxed text-muted-foreground">
          Pick what you study. Bluprint maps each course from its published
          specification, then builds revision material for every topic.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="gizmo-scroll -mx-1 flex items-center gap-0.5 overflow-x-auto rounded-xl bg-brand-panel p-1 sm:mx-0">
          {STUDY_LEVELS.map((option) => {
            const active = level === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => chooseLevel(option)}
                title={levelHints[option]}
                className={cn(
                  "shrink-0 rounded-[9px] px-3 py-1.5 text-[0.78rem] font-semibold transition-colors",
                  active
                    ? "bg-white text-brand-ink shadow-[0_1px_3px_rgba(22,24,31,0.12)]"
                    : "text-brand-ink/55 hover:text-brand-ink",
                )}
              >
                {option}
              </button>
            );
          })}
        </div>

        <label className="flex shrink-0 items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
          Default board
          <select
            value={board}
            onChange={(event) => chooseBoard(event.target.value)}
            className="h-9 rounded-xl border border-border bg-white px-2 text-[0.78rem] font-medium normal-case tracking-normal text-brand-ink outline-none focus:border-[#7C5CFF]"
          >
            {EXAM_BOARDS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="relative sm:ml-auto sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search subjects"
            aria-label="Search subjects"
            className="h-9 rounded-xl border-border bg-white pl-8 pr-8 text-[0.82rem] shadow-none placeholder:text-muted-foreground/60"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-brand-panel hover:text-brand-ink"
            >
              <X className="size-3" aria-hidden />
            </button>
          )}
        </div>
      </div>

      <p className="mt-4 text-[0.72rem] text-muted-foreground">
        {selectedCount === 0
          ? "Tap a subject to add it. Its board and tier appear right below."
          : "Tap a selected subject to change its board, tier or route."}
      </p>

      <div className="gizmo-scroll mt-2 max-h-[none]">
        {groups.length === 0 && !showCustom ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
            <p className="text-[0.85rem] text-muted-foreground">
              No subject matches “{trimmedQuery}”.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map(({ group, subjects }) => (
              <section key={group}>
                <p className="px-1 text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {group}
                </p>
                <div className="mt-1 grid items-start gap-1 sm:grid-cols-2">
                  {subjects.map((subject) => (
                    <CourseRow
                      key={subject.name}
                      name={subject.name}
                      draft={selected[subject.name]}
                      level={level}
                      open={opened === subject.name}
                      onActivate={() => activate(subject.name)}
                      onRemove={() => removeCourse(subject.name)}
                      onBoard={(next) => setCourseBoard(subject.name, next)}
                      onPoetryTheme={(theme) =>
                        setCoursePoetryTheme(subject.name, theme)
                      }
                      onTier={(field, value) =>
                        setCourseTier(subject.name, field, value)
                      }
                    />
                  ))}
                </div>
              </section>
            ))}

            {showCustom && (
              <button
                type="button"
                onClick={() => addCourse(trimmedQuery, { clearQuery: true })}
                className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-border px-3 py-2.5 text-left transition-colors hover:border-[#7C5CFF] hover:bg-white"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#EFEDFF]">
                  <Plus className="size-4 text-[#5B3DF5]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.84rem] font-semibold text-brand-ink">
                    Add “{trimmedQuery}” as a custom course
                  </span>
                  <span className="text-[0.7rem] text-muted-foreground">
                    Uses {board} · {level}
                  </span>
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-[#FFEEF0] px-3 py-2 text-[0.78rem] leading-relaxed text-[#C23B49]">
          {error}
        </p>
      )}

      <div className="sticky bottom-3 z-20 mt-6">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-white/95 px-3.5 py-2.5 shadow-[0_14px_40px_-24px_rgba(22,24,31,0.45)] backdrop-blur">
          <div className="min-w-0 flex-1">
            <p className="text-[0.82rem] font-semibold text-brand-ink">
              {selectedCount} course{selectedCount === 1 ? "" : "s"}
              <span className="font-medium text-muted-foreground">
                {" "}
                · {level} ·{" "}
                {distinctBoards > 1 ? `${distinctBoards} boards` : board}
              </span>
            </p>
            <p className="truncate text-[0.7rem] text-muted-foreground">
              {selectedCount === 0
                ? "Choose up to 12 courses"
                : selectedNames.slice(0, 3).join(", ") +
                  (selectedCount > 3 ? ` and ${selectedCount - 3} more` : "")}
            </p>
          </div>
          <Button
            onClick={build}
            disabled={saving || selectedCount === 0}
            className="h-10 shrink-0 rounded-full bg-[#191B27] px-5 text-[0.82rem] font-semibold text-white hover:bg-[#2A2D3E] disabled:opacity-40"
          >
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {buildLabel}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
