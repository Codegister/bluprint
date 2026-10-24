import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { readableError } from "@/lib/errors";
import { EXAM_BOARDS, STUDY_LEVELS } from "@/lib/examBoards";
import {
  POPULAR_SUBJECTS,
  SUBJECTS,
  subjectMeta,
  tierChoices,
  tierLabel,
} from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { Check, ChevronLeft, ChevronRight, Loader2, Plus, Search, X } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

const MAX_COURSES = 12;

/** One selected course while it is still being edited in the picker. */
type CourseDraft = {
  examBoard: string;
  tier?: string;
  variant?: string;
};

const levelHints: Record<string, string> = {
  GCSE: "Years 10–11",
  KS3: "Years 7–9",
  "A-Level": "Years 12–13",
  IB: "HL and SL",
  AP: "Advanced Placement",
  Undergraduate: "University",
};

/** KS3 has no exam board; the empty string keeps the label clean. */
function boardLabel(board: string): string {
  return board === "None" ? "" : board;
}

function defaultBoardFor(level: string): string {
  if (level === "KS3") return "None";
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

/** A small segmented control, used for tiers and routes in the settings panel. */
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
    <div className="mt-4">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1.5 flex rounded-xl bg-brand-panel p-0.5">
        {options.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option)}
              className={cn(
                "flex-1 rounded-[10px] px-2 py-1.5 text-[0.76rem] font-semibold transition-colors",
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
 * One subject on a single line. Clicking it selects the subject and points the
 * settings panel at it; nothing expands inside the list.
 */
function SubjectRow({
  name,
  draft,
  active,
  onOpen,
}: {
  name: string;
  draft?: CourseDraft;
  active: boolean;
  onOpen: () => void;
}) {
  const meta = subjectMeta(name);
  const Icon = meta.icon;
  const selected = Boolean(draft);
  const detail = draft
    ? [
        boardLabel(draft.examBoard),
        draft.variant ?? "",
        draft.tier ? tierLabel(draft.tier) : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
        active
          ? "border-[#7C5CFF]/50 bg-white shadow-[0_8px_20px_-18px_rgba(22,24,31,0.6)]"
          : selected
            ? "border-border bg-white"
            : "border-transparent hover:border-border hover:bg-white",
      )}
    >
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", meta.tint)}>
        <Icon className="size-4" style={{ color: meta.color }} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.86rem] font-semibold text-brand-ink">
          {name}
        </span>
        {detail && (
          <span className="mt-0.5 block truncate text-[0.68rem] text-muted-foreground">
            {detail}
          </span>
        )}
      </span>
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full border transition-colors",
          selected
            ? "border-[#191B27] bg-[#191B27] text-white"
            : "border-border text-brand-ink/35",
        )}
      >
        {selected ? (
          <Check className="size-3.5" aria-hidden />
        ) : (
          <Plus className="size-3.5" aria-hidden />
        )}
      </span>
    </button>
  );
}

export default function CourseSetup() {
  const navigate = useNavigate();
  const createMany = useMutation(api.courses.createMany);

  // Null until the student has chosen a qualification. Picking one is the first
  // thing the page asks for, because it decides the boards and tiers on offer.
  const [level, setLevel] = useState<string | null>(null);
  const [board, setBoard] = useState("AQA");
  const [selected, setSelected] = useState<Record<string, CourseDraft>>({});
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedNames = Object.keys(selected);
  const selectedCount = selectedNames.length;
  const boardsInUse = new Set(
    Object.values(selected)
      .map((course) => course.examBoard)
      .filter((value) => value !== "None"),
  );
  const distinctBoards = boardsInUse.size;
  // The summary reflects the courses actually chosen, not just the default.
  const summaryBoard = distinctBoards === 1 ? [...boardsInUse][0]! : board;

  const ordered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle) {
      return SUBJECTS.filter((subject) =>
        subject.name.toLowerCase().includes(needle),
      );
    }
    const popularNames = new Set<string>(POPULAR_SUBJECTS);
    const popular = POPULAR_SUBJECTS.flatMap((name) =>
      SUBJECTS.filter((subject) => subject.name === name),
    );
    const rest = SUBJECTS.filter((subject) => !popularNames.has(subject.name)).sort(
      (a, b) => a.name.localeCompare(b.name),
    );
    return [...popular, ...rest];
  }, [query]);

  const trimmedQuery = query.trim();
  const exactMatch = SUBJECTS.some(
    (subject) => subject.name.toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const showCustom =
    trimmedQuery.length >= 2 && !exactMatch && !(trimmedQuery in selected);

  const chooseQualification = (next: string) => {
    const nextBoard = defaultBoardFor(next);
    setLevel(next);
    // Boards and tiers differ between qualifications, so existing picks are
    // reset to the new qualification's defaults rather than kept stale.
    setSelected((current) =>
      Object.fromEntries(
        Object.keys(current).map((name) => [
          name,
          { examBoard: nextBoard, tier: defaultTierFor(next, name) },
        ]),
      ),
    );
    setActive(null);
    setQuery("");
    setError(null);
  };

  const changeQualification = () => {
    setLevel(null);
    setActive(null);
    setQuery("");
    setError(null);
  };

  const openSubject = (name: string) => {
    const clean = name.trim().slice(0, 80);
    if (clean.length < 2 || !level) return;
    if (!(clean in selected) && Object.keys(selected).length >= MAX_COURSES) {
      toast.error(`You can set up ${MAX_COURSES} courses at a time.`);
      return;
    }
    setSelected((current) =>
      clean in current
        ? current
        : {
            ...current,
            [clean]: {
              examBoard: board,
              tier: defaultTierFor(level, clean),
            },
          },
    );
    setActive(clean);
    setError(null);
  };

  const addCustom = () => {
    openSubject(trimmedQuery);
    if (trimmedQuery.length >= 2) setQuery("");
  };

  const removeCourse = (name: string) => {
    setSelected((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
    // Removing the subject being edited returns to the list rather than
    // opening a different subject the student did not ask for.
    setActive((current) => (current === name ? null : current));
    setError(null);
  };

  const setCourseBoard = (name: string, next: string) => {
    setSelected((current) => ({
      ...current,
      [name]: { ...current[name]!, examBoard: next },
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

  /** One click to give every course the board the panel is showing. */
  const applyBoardToAll = (next: string) => {
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

  const buildLabel = saving
    ? "Queuing pathways…"
    : selectedCount === 0
      ? "Build pathways"
      : `Build ${selectedCount} pathway${selectedCount === 1 ? "" : "s"}`;

  const build = async () => {
    if (!level) {
      setError("Choose your qualification first.");
      return;
    }
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

  const activeDraft = active ? selected[active] : undefined;
  const activeMeta = active ? subjectMeta(active) : null;
  const activeTiers = active && level ? tierChoices(level, active) : null;

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

      {!level ? (
        <section className="mt-6 rounded-[2rem] border border-border bg-white p-5 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-7">
          <p className="text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-[#7C5CFF]">
            Step 1 of 2
          </p>
          <h2 className="mt-1 font-display text-[1.3rem] font-bold text-brand-ink">
            Which qualification are you studying?
          </h2>
          <p className="mt-1 max-w-xl text-[0.86rem] leading-relaxed text-muted-foreground">
            This decides the exam boards and tiers Bluprint offers for every
            subject, so choose it before picking courses.
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {STUDY_LEVELS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => chooseQualification(option)}
                className="group flex items-center justify-between gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-left transition-colors hover:border-[#7C5CFF]/60 hover:bg-[#FAF8FF]"
              >
                <span>
                  <span className="block text-[0.94rem] font-semibold text-brand-ink">
                    {option}
                  </span>
                  <span className="mt-0.5 block text-[0.72rem] text-muted-foreground">
                    {levelHints[option]}
                  </span>
                </span>
                <ChevronRight
                  className="size-4 text-brand-ink/30 transition-colors group-hover:text-[#5B3DF5]"
                  aria-hidden
                />
              </button>
            ))}
          </div>

          {selectedCount > 0 && (
            <p className="mt-4 text-[0.74rem] text-muted-foreground">
              You already have {selectedCount} course
              {selectedCount === 1 ? "" : "s"} picked. Choosing a qualification
              resets their board and tier to that qualification's defaults.
            </p>
          )}
        </section>
      ) : (
        <>
          <p className="mt-5 text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-[#7C5CFF]">
            Step 2 of 2
          </p>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={changeQualification}
              className="flex shrink-0 items-center gap-2 self-start rounded-full border border-border bg-white px-3 py-1.5 text-[0.78rem] font-semibold text-brand-ink transition-colors hover:bg-brand-panel"
            >
              {level}
              <span className="text-[0.7rem] font-medium text-muted-foreground">
                Change
              </span>
            </button>

            <div className={cn("relative sm:ml-auto sm:w-64", active && "hidden")}>
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

          <p className="mt-3 text-[0.74rem] text-muted-foreground">
            {active
              ? "Set this course's options below, then choose Done. Your other courses are on the subject list."
              : "The subjects most students take are listed first. Click a subject to switch this panel to its options."}
          </p>

          <div className="mt-2 max-w-2xl pb-16">
            {/* The list and the settings swap in the same place, so choosing a
                subject never sends anyone scrolling down the page. */}
            <div className={cn(activeDraft && "hidden")}>
              {ordered.length === 0 && !showCustom ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
                  <p className="text-[0.85rem] text-muted-foreground">
                    No subject matches “{trimmedQuery}”.
                  </p>
                </div>
              ) : (
                <div>
                  {ordered.map((subject, index) => (
                    <Fragment key={subject.name}>
                      {!trimmedQuery && index === POPULAR_SUBJECTS.length && (
                        <p className="mt-4 px-1 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                          All subjects
                        </p>
                      )}
                      <SubjectRow
                        name={subject.name}
                        draft={selected[subject.name]}
                        active={active === subject.name}
                        onOpen={() => openSubject(subject.name)}
                      />
                    </Fragment>
                  ))}

                  {showCustom && (
                    <button
                      type="button"
                      onClick={addCustom}
                      className="mt-2 flex w-full items-center gap-2.5 rounded-xl border border-dashed border-border px-3 py-2.5 text-left transition-colors hover:border-[#7C5CFF] hover:bg-white"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#EFEDFF]">
                        <Plus className="size-4 text-[#5B3DF5]" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.84rem] font-semibold text-brand-ink">
                          Add “{trimmedQuery}” as a custom course
                        </span>
                        <span className="text-[0.7rem] text-muted-foreground">
                          Uses {level}
                          {level === "KS3" ? "" : ` · ${boardLabel(board)}`}
                        </span>
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <aside className={cn(!activeDraft && "hidden")}>
              <div className="rounded-[1.6rem] border border-border bg-white p-4 shadow-[0_16px_40px_-34px_rgba(22,24,31,0.5)] sm:p-5">
                {active && activeDraft && activeMeta && activeTiers ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setActive(null)}
                      className="mb-3 flex items-center gap-1 text-[0.74rem] font-semibold text-muted-foreground transition-colors hover:text-brand-ink"
                    >
                      <ChevronLeft className="size-3.5" aria-hidden />
                      All subjects
                    </button>

                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-xl",
                          activeMeta.tint,
                        )}
                      >
                        <activeMeta.icon
                          className="size-4"
                          style={{ color: activeMeta.color }}
                          aria-hidden
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-[1rem] font-bold text-brand-ink">
                          {active}
                        </p>
                        <p className="text-[0.72rem] text-muted-foreground">
                          {[level, boardLabel(activeDraft.examBoard)]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${active}`}
                        onClick={() => removeCourse(active)}
                        className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-[#FFEEF0] hover:text-destructive"
                      >
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </div>

                    {level === "KS3" ? (
                      <p className="mt-4 rounded-xl bg-brand-panel px-3 py-2.5 text-[0.76rem] leading-relaxed text-muted-foreground">
                        KS3 has no exam board or tier. Bluprint maps the national
                        curriculum topics for this subject.
                      </p>
                    ) : (
                      <label className="mt-4 block text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Exam board
                        <select
                          value={activeDraft.examBoard}
                          aria-label={`Exam board for ${active}`}
                          onChange={(event) =>
                            setCourseBoard(active, event.target.value)
                          }
                          className="mt-1.5 h-9 w-full rounded-xl border border-border bg-white px-2.5 text-[0.8rem] font-medium normal-case tracking-normal text-brand-ink outline-none focus:border-[#7C5CFF]"
                        >
                          {EXAM_BOARDS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {activeTiers.tiers.length > 0 && (
                      <Segmented
                        label="Tier"
                        options={activeTiers.tiers}
                        value={activeDraft.tier}
                        onChange={(value) => setCourseTier(active, "tier", value)}
                      />
                    )}

                    {activeTiers.variants.length > 0 && (
                      <Segmented
                        label="Route"
                        options={activeTiers.variants}
                        value={activeDraft.variant}
                        onChange={(value) => setCourseTier(active, "variant", value)}
                      />
                    )}

                    {selectedCount > 1 &&
                      level !== "KS3" &&
                      activeDraft.examBoard !== "None" && (
                        <button
                          type="button"
                          onClick={() => applyBoardToAll(activeDraft.examBoard)}
                          className="mt-4 w-full rounded-xl bg-brand-panel px-3 py-2 text-[0.74rem] font-semibold text-brand-ink/75 transition-colors hover:bg-[#EFEDFF] hover:text-[#5B3DF5]"
                        >
                          Use {activeDraft.examBoard} for all {selectedCount} courses
                        </button>
                      )}
                  </>
                ) : null}

                {selectedCount > 0 && (
                  <div className="mt-4 border-t border-border pt-3">
                    <p className="px-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Your courses ({selectedCount})
                    </p>
                    <ul className="mt-1.5 space-y-0.5">
                      {selectedNames.map((name) => (
                        <li key={name} className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setActive(name)}
                            className={cn(
                              "min-w-0 flex-1 truncate rounded-lg px-2 py-1 text-left text-[0.78rem] font-medium transition-colors",
                              active === name
                                ? "bg-brand-panel text-brand-ink"
                                : "text-brand-ink/70 hover:bg-brand-panel",
                            )}
                          >
                            {name}
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove ${name}`}
                            onClick={() => removeCourse(name)}
                            className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground/70 transition-colors hover:bg-[#FFEEF0] hover:text-destructive"
                          >
                            <X className="size-3" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button
                  onClick={() => setActive(null)}
                  className="mt-4 h-9 w-full rounded-full bg-[#191B27] px-4 text-[0.8rem] font-semibold text-white hover:bg-[#2A2D3E]"
                >
                  Done
                </Button>
              </div>
            </aside>
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
                    · {level}
                    {level !== "KS3" && (
                      <>
                        {" "}
                        ·{" "}
                        {distinctBoards > 1
                          ? `${distinctBoards} boards`
                          : boardLabel(summaryBoard)}
                      </>
                    )}
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
        </>
      )}
    </AppShell>
  );
}
