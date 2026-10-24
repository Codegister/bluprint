import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { readableError } from "@/lib/errors";
import { EXAM_BOARDS, STUDY_LEVELS } from "@/lib/examBoards";
import {
  SUBJECT_GROUPS,
  SUBJECTS,
  tierChoices,
  tierLabel,
} from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  GCSE: "Years 10–11 · grades 9–1",
  "A-Level": "Years 12–13 · A*–E",
  IB: "Diploma Programme · HL and SL",
  AP: "Advanced Placement",
  Undergraduate: "University modules",
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

/**
 * A subject tile that opens its board and tier controls directly underneath.
 * Keeping the editor inside the picker means a chosen subject never sends the
 * student to a separate panel to finish configuring it.
 */
function SubjectEditor({
  name,
  draft,
  level,
  onToggle,
  onBoard,
  onTier,
}: {
  name: string;
  draft?: CourseDraft;
  level: string;
  onToggle: () => void;
  onBoard: (board: string) => void;
  onTier: (field: "tier" | "variant", value: string) => void;
}) {
  const { variants, tiers } = tierChoices(level, name);
  const cardRef = useRef<HTMLDivElement>(null);
  const wasSelected = useRef(Boolean(draft));

  // Selecting a subject opens its settings below the tile. If the tile sits at
  // the edge of the scroll area, bring the new controls into view.
  useEffect(() => {
    if (draft && !wasSelected.current) {
      cardRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    wasSelected.current = Boolean(draft);
  }, [draft]);

  if (!draft) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 rounded-2xl border border-border bg-white px-3.5 py-2.5 text-left transition-colors hover:bg-brand-panel"
      >
        <span className="min-w-0 flex-1 truncate text-[0.84rem] font-semibold text-brand-ink">
          {name}
        </span>
        <span className="text-[0.72rem] font-semibold text-[#5B3DF5]">Add</span>
      </button>
    );
  }

  return (
    <div
      ref={cardRef}
      className="rounded-2xl border border-[#191B27] bg-[#FAFAFF]"
    >
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        <span className="min-w-0 flex-1 truncate text-[0.84rem] font-semibold text-brand-ink">
          {name}
        </span>
        <span className="rounded-full bg-[#191B27] px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-[0.05em] text-white">
          Added
        </span>
      </div>

      <div className="border-t border-border/70 px-3.5 pb-3 pt-3">
        <label className="block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Exam board
          <select
            aria-label={`Exam board for ${name}`}
            value={draft.examBoard}
            onChange={(event) => onBoard(event.target.value)}
            className="mt-1 h-9 w-full rounded-xl border border-border bg-white px-2 text-[0.76rem] font-semibold text-brand-ink outline-none focus:border-[#B9A6FF]"
          >
            {EXAM_BOARDS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        {variants.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Route
            </span>
            {variants.map((variant) => (
              <button
                key={variant}
                type="button"
                aria-pressed={draft.variant === variant}
                onClick={() => onTier("variant", variant)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold transition-colors",
                  draft.variant === variant
                    ? "border-[#7C5CFF] bg-[#F3ECFF] text-[#5B3DF5]"
                    : "border-border text-brand-ink/60 hover:bg-brand-panel",
                )}
              >
                {variant}
              </button>
            ))}
          </div>
        )}

        {tiers.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Tier
            </span>
            {tiers.map((tier) => (
              <button
                key={tier}
                type="button"
                aria-pressed={draft.tier === tier}
                onClick={() => onTier("tier", tier)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold transition-colors",
                  draft.tier === tier
                    ? "border-[#12B8A6] bg-[#E6F9F6] text-[#0E8C7F]"
                    : "border-border text-brand-ink/60 hover:bg-brand-panel",
                )}
              >
                {tierLabel(tier)}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onToggle}
            className="text-[0.7rem] font-semibold text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
          >
            Remove course
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CourseSetup() {
  const navigate = useNavigate();
  const ai = useQuery(api.settings.aiStatus);
  const createMany = useMutation(api.courses.createMany);

  const [step, setStep] = useState<1 | 2>(1);
  const [level, setLevel] = useState("GCSE");
  const [board, setBoard] = useState("AQA");
  const [selected, setSelected] = useState<Record<string, CourseDraft>>({});
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedNames = Object.keys(selected);
  const selectedCount = selectedNames.length;
  // Custom courses are not in SUBJECTS, so they need their own inline group.
  const selectedCustomNames = selectedNames.filter(
    (name) => !SUBJECTS.some((subject) => subject.name === name),
  );
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

  const toggle = (name: string) => {
    setSelected((current) => {
      if (name in current) {
        const next = { ...current };
        delete next[name];
        return next;
      }
      if (Object.keys(current).length >= MAX_COURSES) {
        toast.error(`You can set up ${MAX_COURSES} courses at a time.`);
        return current;
      }
      return {
        ...current,
        [name]: { examBoard: board, tier: defaultTierFor(level, name) },
      };
    });
    setError(null);
  };

  const chooseBoard = (next: string) => {
    setBoard(next);
    // Each subject can still be changed individually afterwards. Changing the
    // default board updates every course that has not been customised yet.
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

  const setCourseTier = (name: string, field: "tier" | "variant", value: string) => {
    setSelected((current) => {
      const course = current[name];
      if (!course) return current;
      // A tier is a required choice once shown, so clicking the active tier
      // keeps it. Routes such as IB HL/SL can still be toggled off.
      if (field === "tier") {
        return { ...current, [name]: { ...course, tier: value } };
      }
      return {
        ...current,
        [name]: {
          ...course,
          variant: course.variant === value ? undefined : value,
        },
      };
    });
  };

  const addCustom = () => {
    const name = custom.trim();
    if (name.length < 2) {
      toast.error("Type the course name first.");
      return;
    }
    if (Object.keys(selected).length >= MAX_COURSES) {
      toast.error(`You can set up ${MAX_COURSES} courses at a time.`);
      return;
    }
    const nameSlice = name.slice(0, 80);
    setSelected((current) => ({
      ...current,
      [nameSlice]: {
        examBoard: board,
        tier: defaultTierFor(level, nameSlice),
      },
    }));
    setCustom("");
    setQuery("");
  };

  const chooseLevel = (next: string) => {
    const nextBoard = defaultBoardFor(next);
    setLevel(next);
    setBoard(nextBoard);
    // Tier labels differ between qualifications (Higher, HL). Reset them to
    // the new level's default rather than sending a stale one, and reset the
    // per-subject boards to the new qualification's default.
    setSelected((current) =>
      Object.fromEntries(
        Object.keys(current).map((name) => [
          name,
          { examBoard: nextBoard, tier: defaultTierFor(next, name) },
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
          `${result.queued} pathway${result.queued === 1 ? "" : "s"} queued. Bluprint is mapping the specification in the background.`,
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
        className="text-[0.8rem] font-semibold text-muted-foreground hover:text-brand-ink"
      >
        Back to home
      </Link>
      <div className="mt-4">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[#7C5CFF]">
          Course pathway
        </p>
        <h1 className="font-display text-[1.6rem] font-bold leading-tight text-brand-ink sm:text-[2rem]">
          Set up your courses
        </h1>
      </div>

      <p className="mt-2 max-w-2xl text-[0.92rem] leading-relaxed text-muted-foreground">
        Choose every course you are studying. Bluprint maps the current
        specification for each one — units, topics and exam skills — then builds
        revision material for any topic you open.
      </p>

      <div className="mt-5 flex items-center gap-2">
        {[
          { number: 1 as const, label: "Qualification" },
          { number: 2 as const, label: "Courses" },
        ].map((item, index) => (
          <div key={item.number} className="flex items-center gap-2">
            {index > 0 && <span className="h-px w-6 bg-border sm:w-10" />}
            <span
              className={cn(
                "rounded-full px-3 py-1.5 text-[0.8rem] font-semibold",
                step === item.number
                  ? "bg-[#191B27] text-white"
                  : "text-muted-foreground",
              )}
            >
              {item.number}. {item.label}
            </span>
          </div>
        ))}
      </div>

      {ai?.pathway?.configured === false && (
        <div className="mt-5 rounded-2xl bg-[#FFF6E5] px-4 py-3 text-[0.82rem] leading-relaxed text-[#8A5D00]">
          Course pathways need <code className="font-semibold">OPENROUTER_API_KEY</code>{" "}
          (or <code className="font-semibold">NVIDIA_API_KEY</code> as a fallback) on
          the deployment. You can still pick courses now; builds will retry once a
          key is added.
        </div>
      )}

      {step === 1 ? (
        <section className="mt-6 rounded-[2rem] border border-border bg-white p-5 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-7">
          <h2 className="font-display text-[1.15rem] font-bold text-brand-ink">
            What are you studying?
          </h2>
          <p className="mt-1 text-[0.84rem] text-muted-foreground">
            This sets the depth of every pathway. You can add another qualification
            later.
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {STUDY_LEVELS.map((option) => {
              const active = level === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => chooseLevel(option)}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-left transition-colors",
                    active
                      ? "border-[#7C5CFF] bg-[#FAF8FF] ring-1 ring-[#7C5CFF]/20"
                      : "border-border bg-white hover:bg-brand-panel",
                  )}
                >
                  <span className="block font-display text-[0.98rem] font-bold text-brand-ink">
                    {option}
                  </span>
                  <span className="mt-0.5 block text-[0.74rem] text-muted-foreground">
                    {levelHints[option] ?? "Full specification pathway"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            <h2 className="font-display text-[1.15rem] font-bold text-brand-ink">
              Default exam board
            </h2>
            <p className="mt-1 text-[0.84rem] text-muted-foreground">
              Most schools use one board, but boards often differ by subject. Set
              your usual board here, then change any subject individually in the
              next step.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {EXAM_BOARDS.map((option) => {
                const active = board === option;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    onClick={() => chooseBoard(option)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[0.8rem] font-semibold transition-colors",
                      active
                        ? "border-[#7C5CFF] bg-[#F3ECFF] text-[#5B3DF5]"
                        : "border-border bg-white text-brand-ink/70 hover:bg-brand-panel",
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-7 flex justify-end">
            <Button
              onClick={() => setStep(2)}
              className="h-11 rounded-full bg-[#191B27] px-6 font-semibold text-white hover:bg-[#2A2D3E]"
            >
              Choose courses
            </Button>
          </div>
        </section>
      ) : (
        <div className="mt-6 pb-8">
          <section className="rounded-[2rem] border border-border bg-white p-5 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-[1.15rem] font-bold text-brand-ink">
                  Pick your subjects
                </h2>
                <p className="mt-0.5 text-[0.82rem] text-muted-foreground">
                  {selectedCount} selected · {level} ·{" "}
                  {distinctBoards > 1 ? "mixed exam boards" : board} · choose up to{" "}
                  {MAX_COURSES}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-1 text-[0.78rem] font-semibold text-[#5B3DF5] hover:underline"
                >
                  Change level or board
                </button>
                <Button
                  onClick={build}
                  disabled={saving || selectedCount === 0}
                  className="h-10 rounded-full bg-[#191B27] px-5 text-[0.82rem] font-semibold text-white hover:bg-[#2A2D3E] disabled:opacity-50"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                  {buildLabel}
                </Button>
              </div>
            </div>

            <p className="mt-2 text-[0.74rem] text-muted-foreground">
              Select a subject to set its exam board and tier directly below it.
            </p>

            {error && (
              <p className="mt-3 rounded-xl bg-[#FFEEF0] px-3 py-2 text-[0.76rem] leading-relaxed text-[#C23B49]">
                {error}
              </p>
            )}

            <div className="mt-4">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search subjects"
                aria-label="Search subjects"
                className="h-11 rounded-2xl border-border bg-white px-4 text-sm shadow-none placeholder:text-muted-foreground/60"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <Input
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustom();
                  }
                }}
                placeholder="Course not listed? e.g. Law LLB, IB Business"
                aria-label="Custom course name"
                maxLength={80}
                className="h-10 rounded-2xl border-border bg-white text-sm shadow-none placeholder:text-muted-foreground/60"
              />
              <Button
                type="button"
                onClick={addCustom}
                variant="outline"
                className="h-10 shrink-0 rounded-full border-border bg-white px-4 font-semibold text-brand-ink hover:bg-brand-panel"
              >
                Add
              </Button>
            </div>

            <div className="gizmo-scroll mt-5 max-h-[640px] space-y-5 overflow-y-auto pr-1">
              {selectedCustomNames.length > 0 && (
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Your custom courses
                  </p>
                  <div className="mt-2 grid items-start gap-2 sm:grid-cols-2">
                    {selectedCustomNames.map((name) => (
                      <SubjectEditor
                        key={name}
                        name={name}
                        draft={selected[name]}
                        level={level}
                        onToggle={() => toggle(name)}
                        onBoard={(next) => setCourseBoard(name, next)}
                        onTier={(field, value) => setCourseTier(name, field, value)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {groups.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[0.84rem] text-muted-foreground">
                  No subject matches “{query}”. Add it as a custom course above.
                </p>
              ) : (
                groups.map(({ group, subjects }) => (
                  <div key={group}>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      {group}
                    </p>
                    <div className="mt-2 grid items-start gap-2 sm:grid-cols-2">
                      {subjects.map((subject) => (
                        <SubjectEditor
                          key={subject.name}
                          name={subject.name}
                          draft={selected[subject.name]}
                          level={level}
                          onToggle={() => toggle(subject.name)}
                          onBoard={(next) => setCourseBoard(subject.name, next)}
                          onTier={(field, value) =>
                            setCourseTier(subject.name, field, value)
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[0.8rem] text-muted-foreground">
                <span className="font-semibold text-brand-ink">
                  {selectedCount} course{selectedCount === 1 ? "" : "s"}
                </span>{" "}
                selected · {level} ·{" "}
                {distinctBoards > 1 ? `${distinctBoards} exam boards` : board}
              </p>
              <Button
                onClick={build}
                disabled={saving || selectedCount === 0}
                className="h-11 w-full rounded-full bg-[#191B27] px-6 text-[0.85rem] font-semibold text-white hover:bg-[#2A2D3E] disabled:opacity-50 sm:w-auto"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {buildLabel}
              </Button>
            </div>
          </section>

        </div>
      )}
    </AppShell>
  );
}
