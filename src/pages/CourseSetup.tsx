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
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  Star,
  X,
} from "lucide-react";
import { Fragment, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

const MAX_COURSES = 12;

/** One selected course while it is still being edited in the picker. */
type CourseDraft = {
  examBoard: string;
  tier?: string;
  variant?: string;
  rsRoute?: string;
  rsReligion?: string;
  rsSpec?: string;
  rsSpec2?: string;
};

/** The questions asked after a subject is tapped, in order. "rs" is the
 *  Religious Studies route/religion/units step that GCSE RS asks after board
 *  and tier. */
type Question = "board" | "tier" | "rs";

/**
 * Edexcel GCSE Religious Studies is two separate specifications, so the route
 * is the first thing the RS step asks:
 *
 *   A (Faith and Practice in the 21st Century) — beliefs, practices, sources
 *   of wisdom, forms of expression, then Philosophy and Ethics or Textual
 *   Studies.
 *   B (Beliefs in Action) — two of three Areas of Study.
 */
const RS_ROUTE_A = "Edexcel Religious Studies A";
const RS_ROUTE_B = "Edexcel Religious Studies B";

const RS_ROUTE_CHOICES = [
  {
    value: RS_ROUTE_A,
    label: "Religious Studies A",
    hint: "Faith and Practice in the 21st Century",
  },
  {
    value: RS_ROUTE_B,
    label: "Religious Studies B",
    hint: "Beliefs in Action",
  },
] as const;

/** RS A paper 3 / paper 4: each school picks one. */
const RS_A_THIRD_PAPERS = [
  {
    value: "Philosophy and Ethics",
    hint: "Paper 3 · arguments for God, relationships and families",
  },
  {
    value: "Textual Studies: Mark's Gospel",
    hint: "Paper 4 · close study of Mark's Gospel",
  },
  {
    value: "Textual Studies: The Qur'an",
    hint: "Paper 4 · close study of the Qur'an",
  },
] as const;

/** RS B: students study two of these three. */
const RS_B_AREAS = [
  {
    value: "Religion and Ethics",
    hint: "Beliefs, marriage and the family, life and death",
  },
  {
    value: "Religion, Peace and Conflict",
    hint: "Crime and punishment, peace and conflict",
  },
  {
    value: "Religion, Philosophy and Social Justice",
    hint: "God and the world, human rights, wealth and poverty",
  },
] as const;

const RS_RELIGIONS = [
  "Christianity",
  "Catholic Christianity",
  "Islam",
  "Judaism",
  "Buddhism",
  "Hinduism",
  "Sikhism",
] as const;

/** The next RS question for a draft, or null when RS is fully answered. */
type RsStep = "route" | "religion" | "thirdPaper" | "areaOne" | "areaTwo";

function rsStepFor(draft?: CourseDraft): RsStep | null {
  if (!draft?.rsRoute) return "route";
  if (!draft.rsReligion) return "religion";
  if (draft.rsRoute === RS_ROUTE_B) {
    if (!draft.rsSpec) return "areaOne";
    if (!draft.rsSpec2) return "areaTwo";
    return null;
  }
  return draft.rsSpec ? null : "thirdPaper";
}

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

/**
 * What Bluprint still needs to know about a subject.
 *
 * Only qualifications that actually have a choice are asked about: GCSE asks for
 * a board and a tier, A-Level asks for a board, IB asks for HL or SL, and KS3,
 * AP and university modules have nothing to ask — tapping one just adds it.
 *
 * Religious Studies GCSE is handled by the RS picker lower in the file, which
 * can ask for a route, a second religion and the chosen spec titles on top of
 * the generic board and tier questions above.
 */
function questionsFor(level: string, subject: string): Question[] {
  const questions: Question[] = [];
  if (level === "GCSE" || level === "A-Level") questions.push("board");
  const { tiers, variants } = tierChoices(level, subject);
  if (tiers.length > 0 || variants.length > 0) questions.push("tier");
  if (
    level === "GCSE" &&
    subject === "Religious Studies" &&
    (variants.length === 0 && tiers.length > 0)
  ) {
    questions.push("rs");
  }
  return questions;
}

/**
 * One subject on a single line. Clicking it either asks its questions or, when
 * there is nothing to ask, adds it and leaves the student on the list.
 */
function SubjectRow({
  name,
  draft,
  active,
  isDefault,
  flashed,
  onOpen,
}: {
  name: string;
  draft?: CourseDraft;
  active: boolean;
  /** True when the row's board and tier are the remembered defaults. */
  isDefault: boolean;
  /** Briefly ring the row when it was just added without questions. */
  flashed: boolean;
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

  const rsDetail = draft?.rsRoute
    ? ` · ${draft.rsRoute.replace("Edexcel ", "")}${
        draft.rsReligion ? ` · ${draft.rsReligion}` : ""
      }${draft.rsSpec ? ` · ${draft.rsSpec}` : ""}${
        draft.rsSpec2 ? ` · ${draft.rsSpec2}` : ""
      }`
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
          : flashed
            ? "border-[#7C5CFF] bg-[#FAF8FF] ring-2 ring-[#7C5CFF]/20"
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
        {(detail || rsDetail) && (
          <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[0.68rem] text-muted-foreground">
            {isDefault && (
              <>
                <Star
                  className="size-2.5 shrink-0 text-[#7C5CFF]"
                  fill="currentColor"
                  aria-hidden
                />
                <span className="sr-only">Default board and tier:</span>
              </>
            )}
            <span className="min-w-0 truncate">
              {detail}
              {rsDetail}
            </span>
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
  // The first board and tier answered become the defaults for every subject
  // added afterwards, so the same choice is not asked for eight times.
  const [rememberedBoard, setRememberedBoard] = useState<string | null>(null);
  const [rememberedTier, setRememberedTier] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The row that was just added with the defaults, so it can be rung briefly.
  const [flashed, setFlashed] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);
  // Where the list was scrolled to before its questions replaced it.
  const listScroll = useRef(0);

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

  /** True when a row's answers are exactly the remembered defaults. */
  const usesDefaults = (draft?: CourseDraft) => {
    if (!draft || (!rememberedBoard && !rememberedTier)) return false;
    if (rememberedBoard && draft.examBoard !== rememberedBoard) return false;
    if (
      rememberedTier &&
      draft.tier !== rememberedTier &&
      draft.variant !== rememberedTier
    ) {
      return false;
    }
    return true;
  };

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

  const activeDraft = active ? selected[active] : undefined;
  const activeMeta = active ? subjectMeta(active) : null;
  const activeChoices = active && level ? tierChoices(level, active) : null;
  const questions = active && level ? questionsFor(level, active) : [];
  const currentQuestionIndex =
    Math.min(questionIndex, Math.max(0, questions.length - 1));
  const currentQuestion: (Question | "rs") | null =
    questions[currentQuestionIndex] ?? null;
  const rsStep =
    active && level === "GCSE" && active === "Religious Studies"
      ? rsStepFor(activeDraft)
      : null;

  const chooseQualification = (next: string) => {
    const nextBoard = defaultBoardFor(next);
    setLevel(next);
    setBoard(nextBoard);
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
    setQuestionIndex(0);
    setQuery("");
    // A tier or board only means something inside its qualification.
    setRememberedBoard(null);
    setRememberedTier(null);
    setError(null);
  };

  const changeQualification = () => {
    setLevel(null);
    setActive(null);
    setRememberedBoard(null);
    setRememberedTier(null);
    setQuery("");
    setError(null);
  };

  /** Back to the list; the last answer is already saved. */
  const finishQuestions = () => {
    const top = listScroll.current;
    setActive(null);
    setQuestionIndex(0);
    // The question card is much shorter than the list, so the browser pulls the
    // page upward while it is open. Put the student back where they were once
    // the list is back in the DOM.
    requestAnimationFrame(() => window.scrollTo({ top }));
  };

  const totalQuestionCount = questions.length;

  /**
   * Records one Religious Studies answer. RS lives on a single question card
   * that asks its sub-questions in turn, so nothing here moves the card.
   */
  const setRs = (
    key: "rsRoute" | "rsReligion" | "rsSpec" | "rsSpec2",
    value: string,
  ) => {
    if (!active) return;
    setSelected((current) => {
      const course = current[active];
      if (!course) return current;
      const next: CourseDraft = { ...course, [key]: value };
      // Route A and route B are different specifications, so switching route
      // clears the choices that only make sense on the other one.
      if (key === "rsRoute" && course.rsRoute !== value) {
        next.rsReligion = undefined;
        next.rsSpec = undefined;
        next.rsSpec2 = undefined;
      }
      if (key === "rsSpec") {
        next.rsSpec2 = undefined;
      }
      return { ...current, [active]: next };
    });
    setError(null);
  };

  const openSubject = (name: string) => {
    const clean = name.trim().slice(0, 80);
    if (clean.length < 2 || !level) return;
    const existing = clean in selected;
    if (!existing && selectedNames.length >= MAX_COURSES) {
      toast.error(`You can set up ${MAX_COURSES} courses at a time.`);
      return;
    }

    const choices = tierChoices(level, clean);
    const nextBoard = rememberedBoard ?? board;
    // A remembered Higher tier must not be applied to a course that only offers
    // HL/SL, so check it against this subject's own choices first.
    const nextAnswer =
      rememberedTier &&
      (choices.tiers.includes(rememberedTier) ||
        choices.variants.includes(rememberedTier))
        ? rememberedTier
        : undefined;

    setSelected((current) =>
      existing
        ? current
        : {
            ...current,
            [clean]: {
              examBoard: nextBoard,
              ...(choices.variants.length > 0
                ? nextAnswer
                  ? { variant: nextAnswer }
                  : {}
                : { tier: nextAnswer ?? defaultTierFor(level, clean) }),
            },
          },
    );
    setError(null);

    const needed = questionsFor(level, clean);
    // A new subject that can use the remembered answers is added straight away;
    // clicking an existing one still opens them so it can be changed.
    const alreadyAnswered = needed.every((question) =>
      question === "board"
        ? Boolean(rememberedBoard)
        : // Religious Studies always asks its route, religion and paper
          // choices, even when a board and tier are remembered.
          question === "rs"
          ? false
          : Boolean(nextAnswer),
    );
    if (needed.length === 0 || (!existing && alreadyAnswered)) {
      setActive(null);
      if (!existing && alreadyAnswered) {
        // Show that the subject picked up the remembered options.
        setFlashed(clean);
        if (flashTimer.current) window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => setFlashed(null), 1400);
      }
      return;
    }
    if (!active) listScroll.current = window.scrollY;
    setQuestionIndex(0);
    setActive(clean);
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
    if (active === name) finishQuestions();
    setError(null);
  };

  const setCourseBoard = (name: string, next: string) => {
    setSelected((current) => ({
      ...current,
      [name]: { ...current[name]!, examBoard: next },
    }));
  };

  const setCourseTier = (name: string, value: string) => {
    setSelected((current) => {
      const course = current[name];
      if (!course) return current;
      // IB offers HL/SL as a route, GCSE offers a tier. Both live in one answer.
      const { variants } = tierChoices(level ?? "", name);
      if (variants.length > 0) {
        return { ...current, [name]: { ...course, variant: value } };
      }
      return { ...current, [name]: { ...course, tier: value } };
    });
  };

  /** Move to the next question, or back to the list when this was the last. */
  const advance = () => {
    if (!active) return;
    if (questionIndex + 1 < questions.length) {
      setQuestionIndex(questionIndex + 1);
      return;
    }
    finishQuestions();
  };

  const answerBoard = (next: string) => {
    if (!active) return;
    setCourseBoard(active, next);
    // Only the first answer sets the default; a one-off change for one subject
    // should not quietly rewrite every subject added after it.
    if (!rememberedBoard) setRememberedBoard(next);
    advance();
  };

  const answerTier = (next: string) => {
    if (!active) return;
    setCourseTier(active, next);
    if (!rememberedTier) setRememberedTier(next);
    advance();
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
          rsRoute: selected[subject]!.rsRoute,
          rsReligion: selected[subject]!.rsReligion,
          rsSpec: selected[subject]!.rsSpec,
          rsSpec2: selected[subject]!.rsSpec2,
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

  const asking = Boolean(
    active && activeDraft && activeMeta && activeChoices && currentQuestion,
  );

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
          specification, then builds revision material for every topic. Religious
          Studies is split into Edexcel Religious Studies A and B, with the
          religions and units you study.
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

            <div className={cn("relative sm:ml-auto sm:w-64", asking && "hidden")}>
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
            {asking
              ? "One answer at a time. Bluprint saves it and puts you back on the subject list."
              : "The subjects most students take are listed first. Click a subject to add it."}
          </p>

          <div className="mt-2 max-w-2xl pb-16">
            {asking && activeDraft && activeMeta && activeChoices && currentQuestion ? (
              <section className="rounded-[1.6rem] border border-border bg-white p-5 shadow-[0_16px_40px_-34px_rgba(22,24,31,0.5)] sm:p-6">
                <button
                  type="button"
                  onClick={() =>
                    questionIndex > 0
                      ? setQuestionIndex(questionIndex - 1)
                      : finishQuestions()
                  }
                  className="flex items-center gap-1 text-[0.74rem] font-semibold text-muted-foreground transition-colors hover:text-brand-ink"
                >
                  <ChevronLeft className="size-3.5" aria-hidden />
                  {questionIndex > 0 ? "Back" : "All subjects"}
                </button>

                <div className="mt-3 flex items-start gap-2.5">
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
                    <p className="truncate font-display text-[1.02rem] font-bold text-brand-ink">
                      {active}
                    </p>
                    <p className="text-[0.72rem] text-muted-foreground">
                      Question {Math.min(questionIndex + 1, totalQuestionCount)} of {" "}
                      {totalQuestionCount}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCourse(active!)}
                    className="shrink-0 text-[0.72rem] font-semibold text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </div>

                {currentQuestion === "board" ? (
                  <>
                    <h2 className="mt-5 font-display text-[1.06rem] font-bold text-brand-ink">
                      Which exam board?
                    </h2>
                    <p className="mt-1 text-[0.78rem] text-muted-foreground">
                      Choose the board your school enters you for in {active}.
                    </p>
                    <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                      {EXAM_BOARDS.map((option) => {
                        const chosen = activeDraft.examBoard === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            aria-pressed={chosen}
                            onClick={() => answerBoard(option)}
                            className={cn(
                              "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-[0.82rem] font-medium transition-colors",
                              chosen
                                ? "border-[#191B27] bg-[#191B27] text-white"
                                : "border-border bg-white text-brand-ink/80 hover:border-[#7C5CFF]/50 hover:bg-[#FAF8FF]",
                            )}
                          >
                            <span className="truncate">{option}</span>
                            {chosen && <Check className="size-4 shrink-0" aria-hidden />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="mt-5 font-display text-[1.06rem] font-bold text-brand-ink">
                      {activeChoices.tiers.length > 0
                        ? "Which tier?"
                        : "Which route?"}
                    </h2>
                    <p className="mt-1 text-[0.78rem] text-muted-foreground">
                      {activeChoices.tiers.length > 0
                        ? "Most students sit Higher; pick Foundation if that is your entry."
                        : "Higher Level (HL) and Standard Level (SL) are examined differently."}
                    </p>
                    <div
                      className={cn(
                        "mt-3 grid gap-1.5",
                        (activeChoices.tiers.length > 0
                          ? activeChoices.tiers
                          : activeChoices.variants
                        ).length > 1 && "sm:grid-cols-2",
                      )}
                    >
                      {(activeChoices.tiers.length > 0
                        ? activeChoices.tiers
                        : activeChoices.variants
                      ).map((option) => {
                        const chosen =
                          activeChoices.tiers.length > 0
                            ? activeDraft.tier === option
                            : activeDraft.variant === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            aria-pressed={chosen}
                            onClick={() => answerTier(option)}
                            className={cn(
                              "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-[0.84rem] font-semibold transition-colors",
                              chosen
                                ? "border-[#191B27] bg-[#191B27] text-white"
                                : "border-border bg-white text-brand-ink/80 hover:border-[#7C5CFF]/50 hover:bg-[#FAF8FF]",
                            )}
                          >
                            <span className="truncate">{tierLabel(option)}</span>
                            {chosen && <Check className="size-4 shrink-0" aria-hidden />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {currentQuestion === "rs" ? (
                  <section className="mt-6 space-y-4">
                    {rsStep === "route" ? (
                      <>
                        <h2 className="font-display text-[1.06rem] font-bold text-brand-ink">
                          Which Religious Studies route?
                        </h2>
                        <p className="text-[0.78rem] text-muted-foreground">
                          Edexcel publishes two separate GCSE specifications. Pick
                          the one your school enters you for — the content and the
                          papers are different.
                        </p>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {RS_ROUTE_CHOICES.map((option) => {
                            const chosen = activeDraft?.rsRoute === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                aria-pressed={chosen}
                                onClick={() => setRs("rsRoute", option.value)}
                                className={cn(
                                  "flex flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                                  chosen
                                    ? "border-[#191B27] bg-[#191B27] text-white"
                                    : "border-border bg-white text-brand-ink/80 hover:border-[#7C5CFF]/50 hover:bg-[#FAF8FF]",
                                )}
                              >
                                <span className="flex items-center gap-2 text-[0.84rem] font-semibold">
                                  <span className="truncate">{option.label}</span>
                                  {chosen && (
                                    <Check
                                      className="size-4 shrink-0"
                                      aria-hidden
                                    />
                                  )}
                                </span>
                                <span
                                  className={cn(
                                    "text-[0.7rem] font-medium",
                                    chosen
                                      ? "text-white/60"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  {option.hint}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : null}

                    {rsStep === "religion" ? (
                      <>
                        <h2 className="font-display text-[1.06rem] font-bold text-brand-ink">
                          Which religion does your course cover?
                        </h2>
                        <p className="text-[0.78rem] text-muted-foreground">
                          Pick the religion your lessons follow. You can add the
                          same subject again if your school enters you for a second
                          religion.
                        </p>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {RS_RELIGIONS.map((religion) => {
                            const chosen = activeDraft?.rsReligion === religion;
                            return (
                              <button
                                key={religion}
                                type="button"
                                aria-pressed={chosen}
                                onClick={() => setRs("rsReligion", religion)}
                                className={cn(
                                  "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-[0.84rem] font-semibold transition-colors",
                                  chosen
                                    ? "border-[#191B27] bg-[#191B27] text-white"
                                    : "border-border bg-white text-brand-ink/80 hover:border-[#7C5CFF]/50 hover:bg-[#FAF8FF]",
                                )}
                              >
                                <span className="truncate">{religion}</span>
                                {chosen && (
                                  <Check className="size-4 shrink-0" aria-hidden />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : null}

                    {rsStep === "thirdPaper" ? (
                      <>
                        <h2 className="font-display text-[1.06rem] font-bold text-brand-ink">
                          Which third paper does your school take?
                        </h2>
                        <p className="text-[0.78rem] text-muted-foreground">
                          Religious Studies A is three papers. Paper 1 is the study
                          of your religion and Paper 2 is a second religion; the
                          third is either Philosophy and Ethics or Textual Studies.
                        </p>
                        <div className="grid gap-1.5">
                          {RS_A_THIRD_PAPERS.map((paper) => {
                            const chosen = activeDraft?.rsSpec === paper.value;
                            return (
                              <button
                                key={paper.value}
                                type="button"
                                aria-pressed={chosen}
                                onClick={() => setRs("rsSpec", paper.value)}
                                className={cn(
                                  "flex flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                                  chosen
                                    ? "border-[#191B27] bg-[#191B27] text-white"
                                    : "border-border bg-white text-brand-ink/80 hover:border-[#7C5CFF]/50 hover:bg-[#FAF8FF]",
                                )}
                              >
                                <span className="text-[0.84rem] font-semibold">
                                  {paper.value}
                                </span>
                                <span
                                  className={cn(
                                    "text-[0.7rem] font-medium",
                                    chosen
                                      ? "text-white/60"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  {paper.hint}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : null}

                    {rsStep === "areaOne" || rsStep === "areaTwo" ? (
                      <>
                        <h2 className="font-display text-[1.06rem] font-bold text-brand-ink">
                          {rsStep === "areaOne"
                            ? "Which is your first Area of Study?"
                            : "And your second Area of Study?"}
                        </h2>
                        <p className="text-[0.78rem] text-muted-foreground">
                          Religious Studies B is two Areas of Study, each with its
                          own paper. Pick both so the pathway matches your lessons.
                        </p>
                        <div className="grid gap-1.5">
                          {RS_B_AREAS.filter((area) =>
                            rsStep === "areaOne"
                              ? area.value !== activeDraft?.rsSpec2
                              : area.value !== activeDraft?.rsSpec,
                          ).map((area) => {
                            const chosen =
                              rsStep === "areaOne"
                                ? activeDraft?.rsSpec === area.value
                                : activeDraft?.rsSpec2 === area.value;
                            return (
                              <button
                                key={area.value}
                                type="button"
                                aria-pressed={chosen}
                                onClick={() =>
                                  setRs(
                                    rsStep === "areaOne" ? "rsSpec" : "rsSpec2",
                                    area.value,
                                  )
                                }
                                className={cn(
                                  "flex flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                                  chosen
                                    ? "border-[#191B27] bg-[#191B27] text-white"
                                    : "border-border bg-white text-brand-ink/80 hover:border-[#7C5CFF]/50 hover:bg-[#FAF8FF]",
                                )}
                              >
                                <span className="text-[0.84rem] font-semibold">
                                  {area.value}
                                </span>
                                <span
                                  className={cn(
                                    "text-[0.7rem] font-medium",
                                    chosen
                                      ? "text-white/60"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  {area.hint}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : null}

                    {rsStep === null ? (
                      <div className="space-y-2">
                        <h2 className="font-display text-[1.06rem] font-bold text-brand-ink">
                          Religious Studies is set up
                        </h2>
                        <p className="text-[0.78rem] text-muted-foreground">
                          {activeDraft?.rsRoute === RS_ROUTE_B
                            ? `${activeDraft?.rsReligion ?? ""} · ${activeDraft?.rsSpec ?? ""} · ${activeDraft?.rsSpec2 ?? ""}`
                            : `${activeDraft?.rsReligion ?? ""} · ${activeDraft?.rsSpec ?? ""}`}
                        </p>
                        <Button
                          type="button"
                          onClick={finishQuestions}
                          className="h-9 rounded-full bg-[#191B27] px-4 text-[0.78rem] font-semibold text-white hover:bg-[#2A2D3E]"
                        >
                          Done
                        </Button>
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </section>
            ) : (
              <>
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
                          active={false}
                          isDefault={usesDefaults(selected[subject.name])}
                          flashed={flashed === subject.name}
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
                            {level === "KS3"
                              ? ""
                              : ` · ${boardLabel(rememberedBoard ?? board)}`}
                          </span>
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </>
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
