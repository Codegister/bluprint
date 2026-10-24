import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { readableError } from "@/lib/errors";
import { EXAM_BOARDS, STUDY_LEVELS } from "@/lib/examBoards";
import {
  SUBJECT_GROUPS,
  SUBJECTS,
  subjectMeta,
  tierChoices,
  tierLabel,
} from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
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
      return { ...current, [name]: { examBoard: board } };
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
      return {
        ...current,
        [name]: {
          ...course,
          [field]: course[field] === value ? undefined : value,
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
    setSelected((current) => ({
      ...current,
      [name.slice(0, 80)]: { examBoard: board },
    }));
    setCustom("");
    setQuery("");
  };

  const chooseLevel = (next: string) => {
    const nextBoard = defaultBoardFor(next);
    setLevel(next);
    setBoard(nextBoard);
    // Tier labels differ between qualifications (Triple, Higher, HL). Clear
    // them rather than sending a stale one with the new level, and reset the
    // per-subject boards to the new qualification's default.
    setSelected((current) =>
      Object.fromEntries(
        Object.keys(current).map((name) => [name, { examBoard: nextBoard }]),
      ),
    );
  };

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
      <div className="flex items-center gap-3">
        <Link
          to="/dashboard"
          aria-label="Back to home"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-white text-brand-ink/70 transition-colors hover:bg-brand-panel hover:text-brand-ink"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[#7C5CFF]">
            Course pathway
          </p>
          <h1 className="font-display text-[1.6rem] font-bold leading-tight text-brand-ink sm:text-[2rem]">
            Set up your courses
          </h1>
        </div>
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
            <button
              type="button"
              onClick={() => {
                if (item.number === 1) setStep(1);
                if (item.number === 2 && selectedCount > 0) setStep(2);
              }}
              className={cn(
                "flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[0.8rem] font-semibold transition-colors",
                step === item.number
                  ? "bg-[#191B27] text-white"
                  : "text-muted-foreground hover:bg-brand-panel",
              )}
            >
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-full text-[0.68rem]",
                  step === item.number
                    ? "bg-white/15 text-white"
                    : step > item.number
                      ? "bg-[#EAFBF0] text-[#128A4C]"
                      : "bg-brand-panel text-brand-ink/60",
                )}
              >
                {step > item.number ? <Check className="size-3" /> : item.number}
              </span>
              {item.label}
            </button>
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
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-display text-[0.98rem] font-bold text-brand-ink">
                      {option}
                    </span>
                    {active && (
                      <span className="grid size-5 place-items-center rounded-full bg-[#7C5CFF] text-white">
                        <Check className="size-3" />
                      </span>
                    )}
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
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </section>
      ) : (
        <div className="mt-6 grid items-start gap-5 pb-24 lg:grid-cols-[minmax(0,1fr)_330px] lg:pb-0">
          <section className="rounded-[2rem] border border-border bg-white p-5 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-[1.15rem] font-bold text-brand-ink">
                  Pick your subjects
                </h2>
                <p className="mt-0.5 text-[0.82rem] text-muted-foreground">
                  {level} · {distinctBoards > 1 ? "mixed exam boards" : board} ·
                  choose up to {MAX_COURSES}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-full border border-border px-3 py-1.5 text-[0.76rem] font-semibold text-brand-ink/70 hover:bg-brand-panel"
              >
                Change qualification
              </button>
            </div>

            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search subjects"
                aria-label="Search subjects"
                className="h-11 rounded-2xl border-border bg-white pl-10 text-sm shadow-none placeholder:text-muted-foreground/60"
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
                <Plus className="size-4" />
                Add
              </Button>
            </div>

            <div className="gizmo-scroll mt-5 max-h-[560px] space-y-5 overflow-y-auto pr-1">
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
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {subjects.map((subject) => {
                        const draft = selected[subject.name];
                        const active = Boolean(draft);
                        const Icon = subject.icon;
                        return (
                          <button
                            key={subject.name}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggle(subject.name)}
                            className={cn(
                              "flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors",
                              active
                                ? "border-[#191B27] bg-[#FAFAFF]"
                                : "border-border bg-white hover:bg-brand-panel",
                            )}
                          >
                            <span
                              className={cn(
                                "grid size-8 shrink-0 place-items-center rounded-xl",
                                subject.tint,
                              )}
                              style={{ color: subject.color }}
                            >
                              <Icon className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[0.84rem] font-semibold text-brand-ink">
                                {subject.name}
                              </span>
                              {draft && (
                                <span className="mt-0.5 block truncate text-[0.62rem] font-medium text-muted-foreground">
                                  {draft.examBoard}
                                  {draft.variant ? ` · ${draft.variant}` : ""}
                                  {draft.tier ? ` · ${tierLabel(draft.tier)}` : ""}
                                </span>
                              )}
                            </span>
                            {active && (
                              <span className="grid size-4 shrink-0 place-items-center rounded-full bg-[#191B27] text-white">
                                <Check className="size-2.5" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <aside className="rounded-[2rem] border border-border bg-white p-5 shadow-[0_18px_44px_-34px_rgba(22,24,31,0.4)] lg:sticky lg:top-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[1.05rem] font-bold text-brand-ink">
                Your courses
              </h2>
              <span className="rounded-full bg-[#F3ECFF] px-2.5 py-1 text-[0.72rem] font-bold text-[#5B3DF5]">
                {selectedCount}
              </span>
            </div>
            <p className="mt-1 text-[0.72rem] leading-relaxed text-muted-foreground">
              Set the exam board and tier for each subject.
            </p>

            {selectedCount === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-border px-3 py-6 text-center text-[0.8rem] leading-relaxed text-muted-foreground">
                Nothing picked yet. Tap a subject to add it to your pathway.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {selectedNames.map((name) => {
                  const meta = subjectMeta(name);
                  const Icon = meta.icon;
                  const course = selected[name]!;
                  const { variants, tiers } = tierChoices(level, name);
                  return (
                    <div
                      key={name}
                      className="rounded-2xl border border-border px-3 py-2.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "grid size-7 shrink-0 place-items-center rounded-lg",
                            meta.tint,
                          )}
                          style={{ color: meta.color }}
                        >
                          <Icon className="size-3.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[0.82rem] font-semibold text-brand-ink">
                          {name}
                        </span>
                        <select
                          aria-label={`Exam board for ${name}`}
                          value={course.examBoard}
                          onChange={(event) => setCourseBoard(name, event.target.value)}
                          className="h-7 max-w-[106px] shrink-0 rounded-lg border border-border bg-white px-1 text-[0.64rem] font-semibold text-brand-ink outline-none focus:border-[#B9A6FF]"
                        >
                          {EXAM_BOARDS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          aria-label={`Remove ${name}`}
                          onClick={() => toggle(name)}
                          className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-brand-panel hover:text-brand-ink"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>

                      {(variants.length > 0 || tiers.length > 0) && (
                        <div className="mt-2 space-y-1.5 pl-9">
                          {variants.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="mr-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                                Route
                              </span>
                              {variants.map((variant) => (
                                <button
                                  key={variant}
                                  type="button"
                                  aria-pressed={course.variant === variant}
                                  onClick={() => setCourseTier(name, "variant", variant)}
                                  className={cn(
                                    "rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold transition-colors",
                                    course.variant === variant
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
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="mr-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                                Tier
                              </span>
                              {tiers.map((tier) => (
                                <button
                                  key={tier}
                                  type="button"
                                  aria-pressed={course.tier === tier}
                                  onClick={() => setCourseTier(name, "tier", tier)}
                                  className={cn(
                                    "rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold transition-colors",
                                    course.tier === tier
                                      ? "border-[#12B8A6] bg-[#E6F9F6] text-[#0E8C7F]"
                                      : "border-border text-brand-ink/60 hover:bg-brand-panel",
                                  )}
                                >
                                  {tierLabel(tier)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-xl bg-[#FFEEF0] px-3 py-2 text-[0.76rem] leading-relaxed text-[#C23B49]">
                {error}
              </p>
            )}

            <Button
              onClick={build}
              disabled={saving || selectedCount === 0}
              className="mt-4 h-11 w-full rounded-full bg-[#191B27] font-semibold text-white hover:bg-[#2A2D3E] disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              {saving
                ? "Queuing pathways…"
                : `Build ${selectedCount || ""} pathway${selectedCount === 1 ? "" : "s"}`}
            </Button>
            <p className="mt-2.5 flex items-start gap-1.5 text-[0.7rem] leading-relaxed text-muted-foreground">
              <Sparkles className="mt-0.5 size-3 shrink-0 text-[#7C5CFF]" />
              Each course is mapped in the background. You can close this tab and
              come back when it's ready.
            </p>
          </aside>

          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
            <div className="mx-auto flex max-w-2xl items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[0.8rem] font-semibold text-brand-ink">
                  {selectedCount} course{selectedCount === 1 ? "" : "s"} selected
                </p>
                <p className="truncate text-[0.7rem] text-muted-foreground">
                  {level} · {distinctBoards > 1 ? `${distinctBoards} exam boards` : board}
                </p>
              </div>
              <Button
                onClick={build}
                disabled={saving || selectedCount === 0}
                className="h-10 shrink-0 rounded-full bg-[#191B27] px-5 text-[0.85rem] font-semibold text-white hover:bg-[#2A2D3E] disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Wand2 className="size-4" />
                )}
                {saving ? "Queuing…" : "Build pathways"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
