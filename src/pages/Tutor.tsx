import { AppShell } from "@/components/AppShell";
import { CreateSetDialog } from "@/components/CreateSetDialog";
import { SkeletonChat } from "@/components/Skeletons";
import { Mascot } from "@/components/Mascot";
import { SetLibrary } from "@/components/study/SetLibrary";
import { PromptInput } from "@/components/ui/ai-chat-input";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DeckGlyph } from "@/components/Mascot";
import { EASE, Meter, TypingDots, enter } from "@/components/motion/Motion";
import { useAuth } from "@/hooks/use-auth";
import { readableError } from "@/lib/errors";
import { displayName, percent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAction, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Flame,
  GraduationCap,
  Play,
  Sparkles,
} from "lucide-react";

import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";

const SUGGESTIONS = [
  "Explain this topic like I'm new to it",
  "What am I most likely to lose marks on?",
  "Ask me an exam question",
  "Give me a worked example",
];

/** Numbered links that match the [1], [2] citations in an answer. */
function SourceList({ sources }: { sources: Array<{ title: string; url: string }> }) {
  if (sources.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1">
      {sources.map((source, index) => (
        <li key={source.url} className="flex items-start gap-1.5 text-[0.74rem]">
          <span className="mt-px shrink-0 rounded bg-white px-1 font-semibold text-brand-ink/45">
            {index + 1}
          </span>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 truncate text-chrome-6 underline decoration-chrome-4 underline-offset-2 hover:text-chrome-8"
            title={source.title}
          >
            {source.title || new URL(source.url).hostname.replace(/^www\./, "")}
          </a>
          <span className="shrink-0 text-brand-ink/35">
            {new URL(source.url).hostname.replace(/^www\./, "")}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Full-screen AI tutor, and the signed-in home.
 *
 * It reads the scope from the URL: `/tutor?set=<id>`, `/tutor?course=<id>`, or
 * `/tutor?course=<id>&unit=<unit title>`. With no scope it is the home screen:
 * a course list to start from, the saved study-set library, and the streak
 * banner. Choosing a scope turns the same route into the chat, so there is one
 * tutor rather than a launcher plus a second conversation screen.
 */
export default function TutorPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const setId = searchParams.get("set");
  const courseId = searchParams.get("course");
  const unitTitle = searchParams.get("unit");
  // A set or course panel hands its question over in the URL. It is put
  // into the composer once a scope is chosen, so the student can edit it before
  // sending rather than firing a question at the wrong material.
  const questionParam = (searchParams.get("q") ?? "").trim();

  const validSetId = Boolean(setId && /^[a-z0-9]{20,40}$/i.test(setId));
  const validCourseId = Boolean(courseId && /^[a-z0-9]{20,40}$/i.test(courseId));

  const setMessages = useQuery(
    api.tutor.listMessages,
    validSetId ? { setId: setId as Id<"studySets"> } : "skip",
  );
  const courseMessages = useQuery(
    api.tutor.listCourseMessages,
    validCourseId && courseId
      ? { courseId: courseId as Id<"courses">, unitTitle: unitTitle ?? undefined }
      : "skip",
  );

  const messages =
    validSetId && setId ? setMessages : courseMessages;

  // With no scope in the URL, the screen is Home: a tutor question box, what to
  // continue, the saved library, then courses.
  const scoped = validSetId || validCourseId;
  const myCourses = useQuery(api.courses.listMine);
  const mySets = useQuery(api.studySets.listMine);
  const study = useQuery(api.studySets.studyStats);
  const { user } = useAuth();
  // Home asks one question, about one thing. The scope defaults to the last set
  // the student touched, so the Ask button works on the first visit to the page
  // without a second chooser step.
  const [homeScope, setHomeScope] = useState("");
  const [homeQuestion, setHomeQuestion] = useState(questionParam);
  const { hash } = useLocation();

  // `/tutor#sets` arrives from the sidebar and from a set's back link, so the
  // library is brought into view instead of opening at the top.
  useEffect(() => {
    if (scoped || !hash) return;
    const node = document.getElementById(hash.slice(1));
    if (!node) return;
    const frame = requestAnimationFrame(() =>
      node.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [hash, scoped]);

  // "New material" is a URL flag, so the empty state and any saved link can
  // open the upload dialog from anywhere.
  const newSetOpen = searchParams.get("new") === "1";
  const setNewSetOpen = (open: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (open) next.set("new", "1");
    else next.delete("new");
    setSearchParams(next, { replace: true });
  };

  const askTutor = useAction(api.ai.askTutor);
  const askCourseTutor = useAction(api.ai.askCourseTutor);
  // Dictation is transcribed on the server, so speech keys stay off the client.
  const transcribe = useAction(api.ai.transcribeDictation);
  // Same source as the embedded tutor: tiers are offered by label only, and
  // the NVIDIA model behind each label stays on the server.
  const aiStatus = useQuery(api.settings.aiStatus);
  const tierLabels = aiStatus?.tutorTiers ?? ["Balanced"];
  const defaultTier = aiStatus?.defaultTutorTier ?? "Balanced";
  // The picker shows a tagline and a distinct icon per tier; both come from the
  // server, so "Ultra" can say "ultra fast" without the browser knowing models.
  const modelDetails = Object.fromEntries(
    (aiStatus?.tutorTierDetails ?? []).map((tier) => [
      tier.label,
      { tagline: tier.tagline, icon: tier.icon },
    ]),
  );
  const effortLabels = aiStatus?.tutorEfforts ?? ["Low", "Medium", "Max Effort"];

  const [draft, setDraft] = useState(questionParam);
  const [pending, setPending] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useWeb, setUseWeb] = useState(false);
  const [effort, setEffort] = useState<string>(
    aiStatus?.defaultTutorEffort ?? "Medium",
  );
  // Last tier used, so a suggested question keeps the same answer style.
  const [tier, setTier] = useState(defaultTier);
  const scrollRef = useRef<HTMLDivElement>(null);

  const streaming = messages?.find((message) => message.streaming);
  const streamedLength = streaming?.content.length ?? 0;

  const title =
    validSetId && setId && setMessages
      ? setMessages.length > 0
        ? "Ask the tutor"
        : "Ask the tutor"
      : messages === undefined
        ? "Ask the tutor"
        : unitTitle
          ? `Ask the tutor about ${unitTitle}`
          : "Ask the tutor";

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages?.length, sending, streamedLength]);

  const send = async (value: string, meta: { model: string; effort: string; attachments: File[] }) => {
    const question = value.trim();
    if (!question || sending) return;

    // The picker reports a tier label; the server maps it to a NVIDIA model.
    const chosenTier = meta.model || tier;
    // The effort bars report a label the server turns into a budget, a
    // temperature and a depth instruction.
    const chosenEffort = meta.effort || effort;
    setTier(chosenTier);
    setEffort(chosenEffort);
    setError(null);
    setSending(true);
    setPending(question);

    try {
      if (validSetId && setId) {
        await askTutor({
          setId: setId as Id<"studySets">,
          question,
          useWeb,
          tier: chosenTier,
          effort: chosenEffort,
        });
      } else if (validCourseId && courseId) {
        await askCourseTutor({
          courseId: courseId as Id<"courses">,
          unitTitle: unitTitle ?? undefined,
          question,
          useWeb,
          tier: chosenTier,
          effort: chosenEffort,
        });
      }
    } catch (sendError) {
      setError(
        readableError(sendError, "The tutor could not answer that. Please try again."),
      );
      setDraft(question);
    } finally {
      setSending(false);
      setPending(null);
    }
  };

  const empty = messages !== undefined && messages.length === 0 && !sending;

  // No scope chosen yet: this is the home screen. It leads with the tutor, then
  // what to continue, then the library. One primary action: add material.
  if (!scoped) {
    const readyCourses = (myCourses ?? []).filter(
      (course) => course.status === "ready",
    );
    const readySets = (mySets ?? []).filter((set) => set.status === "ready");
    const recentSets = [...readySets].sort(
      (a, b) =>
        (b.lastStudiedAt ?? b.updatedAt) - (a.lastStudiedAt ?? a.updatedAt),
    );
    const continueSets = (() => {
      const picks = recentSets.slice(0, 1);
      const mostDue = [...readySets].sort((a, b) => b.dueCount - a.dueCount)[0];
      if (mostDue && !picks.some((set) => set._id === mostDue._id)) {
        picks.push(mostDue);
      }
      return picks;
    })();

    const scopeOptions = [
      ...recentSets.slice(0, 8).map((set) => ({
        value: `set:${set._id}`,
        label: `Set · ${set.title}`,
      })),
      ...readyCourses.map((course) => ({
        value: `course:${course._id}`,
        label: `Course · ${course.subject}`,
      })),
    ];
    const activeScope =
      scopeOptions.find((option) => option.value === homeScope) ??
      scopeOptions[0] ??
      null;
    const totalDue = (mySets ?? []).reduce(
      (sum, set) => sum + (set.dueCount ?? 0),
      0,
    );
    const firstName = displayName(user?.name, user?.email)
      .split(" ")[0]
      .split("@")[0];

    const openTutorWith = (question: string) => {
      const text = question.trim();
      if (!text || !activeScope) return;
      const [kind, id] = activeScope.value.split(":");
      const params = new URLSearchParams({ [kind]: id, q: text });
      navigate(`/tutor?${params.toString()}`);
    };

    return (
      <AppShell>
        <div className="mx-auto w-full max-w-4xl">
          <motion.header
            className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
            {...enter(0.04, 10)}
          >
            <div className="min-w-0">
              <p className="mono-label text-chrome-7">Home</p>
              <h1 className="mt-1 truncate font-display text-[1.7rem] font-extrabold leading-tight tracking-[-0.035em] text-brand-ink sm:text-[2.1rem]">
                Hi, {firstName}
              </h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.86rem] text-brand-ink/65">
                <span>
                  {totalDue > 0
                    ? `${totalDue} card${totalDue === 1 ? "" : "s"} due`
                    : "No cards due"}
                </span>
                <span className="text-brand-ink/25">·</span>
                <span className="inline-flex items-center gap-1">
                  <Flame className="size-3.5 text-brand-pink-deep" aria-hidden />
                  {study?.streak ?? 0} day
                  {(study?.streak ?? 0) === 1 ? "" : "s"} streak
                </span>
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setNewSetOpen(true)}
              className="h-11 shrink-0 rounded-full px-5 text-sm font-semibold"
            >
              Add material
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </motion.header>

          {aiStatus && !aiStatus.configured && (
            <p className="mt-4 rounded-2xl bg-[#FFF6E5] px-4 py-2.5 text-[0.8rem] font-medium text-[#96650A]">
              AI is not connected on this deployment. Add NVIDIA_API_KEY to use
              the tutor and build new study sets. Saved material still works.
            </p>
          )}

          {/* The tutor is the page's main tool, not a link to another screen. */}
          <motion.section
            aria-labelledby="home-tutor-heading"
            className="chrome-hero mt-4 rounded-[1.6rem] px-4 py-4 sm:px-5 sm:py-5"
            {...enter(0.08, 10)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="size-4 text-chrome-7" aria-hidden />
              <h2
                id="home-tutor-heading"
                className="font-display text-[1.05rem] font-bold text-brand-ink"
              >
                Ask the tutor
              </h2>
              {scopeOptions.length > 0 && (
                <label className="ml-auto flex min-w-0 items-center gap-1.5 text-[0.76rem] text-muted-foreground">
                  <span className="shrink-0">About</span>
                  <select
                    value={activeScope?.value ?? ""}
                    onChange={(event) => setHomeScope(event.target.value)}
                    className="h-8 max-w-[220px] min-w-0 rounded-full border border-border bg-card px-2.5 text-[0.76rem] font-semibold text-brand-ink outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                  >
                    {scopeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <form
              className="mt-3"
              onSubmit={(event) => {
                event.preventDefault();
                openTutorWith(homeQuestion);
              }}
            >
              <div className="relative">
                <input
                  value={homeQuestion}
                  onChange={(event) => setHomeQuestion(event.target.value)}
                  disabled={!activeScope}
                  placeholder={
                    activeScope
                      ? "Ask about your notes, a course or a set…"
                      : "Add your notes to ask the tutor"
                  }
                  aria-label="Question for the AI tutor"
                  className="h-12 w-full rounded-full border border-border bg-card pl-4 pr-[5rem] text-[0.9rem] text-brand-ink outline-none placeholder:text-muted-foreground/80 focus-visible:border-ring/50 focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <Button
                  type="submit"
                  disabled={!activeScope || !homeQuestion.trim()}
                  className="absolute right-1 top-1 h-10 rounded-full px-4 text-[0.82rem] font-semibold"
                >
                  Ask
                  <ArrowRight className="size-3.5" aria-hidden />
                </Button>
              </div>
            </form>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.slice(0, 3).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={!activeScope}
                  onClick={() => openTutorWith(suggestion)}
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-[0.72rem] font-medium text-brand-ink/75 transition-colors hover:border-chrome-4 hover:bg-brand-panel hover:text-brand-ink disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </motion.section>

          {continueSets.length > 0 && (
            <section className="mt-7" aria-labelledby="continue-heading">
              <div className="flex items-center gap-3">
                <h2
                  id="continue-heading"
                  className="font-display text-[1.1rem] font-bold text-brand-ink"
                >
                  Continue
                </h2>
                <span className="hidden h-px flex-1 border-t border-dashed border-border sm:block" />
              </div>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {continueSets.map((set) => (
                  <Link
                    key={set._id}
                    to={`/sets/${set._id}`}
                    className="group flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-chrome-4 hover:bg-brand-panel"
                  >
                    <DeckGlyph className="size-10 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-display text-[0.95rem] font-bold text-brand-ink">
                          {set.title}
                        </span>
                        <span className="shrink-0 text-[0.7rem] font-semibold text-muted-foreground">
                          {set.dueCount > 0 ? `${set.dueCount} due` : `${set.readiness}% ready`}
                        </span>
                      </span>
                      <Meter
                        value={set.readiness}
                        className="mt-2 h-1.5 bg-brand-panel"
                        barClassName="bg-brand-ink/60"
                        label={`${set.title} readiness`}
                      />
                      <span className="mt-1.5 flex items-center gap-1 text-[0.74rem] font-semibold text-brand-ink/70">
                        <Play className="size-3" aria-hidden />
                        Continue studying
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <SetLibrary onCreate={() => setNewSetOpen(true)} />

          {/* Courses stay reachable without competing with the sets list. */}
          <section className="mt-7" aria-labelledby="home-courses-heading">
            <div className="flex flex-wrap items-center gap-3">
              <h2
                id="home-courses-heading"
                className="font-display text-[1.1rem] font-bold text-brand-ink"
              >
                Courses
              </h2>
              <span className="hidden h-px flex-1 border-t border-dashed border-border sm:block" />
              <Link
                to="/courses"
                className="text-[0.76rem] font-semibold text-brand-ink/70 underline-offset-2 hover:text-brand-ink hover:underline"
              >
                {readyCourses.length > 0 ? "Manage courses" : "Add a course"}
              </Link>
            </div>

            {readyCourses.length === 0 ? (
              <p className="mt-2 text-[0.82rem] leading-relaxed text-muted-foreground">
                Choose your subjects to get a topic-by-topic pathway and ask the
                tutor about the whole specification.{" "}
                <Link
                  to="/courses/new"
                  className="font-semibold text-brand-ink underline-offset-2 hover:underline"
                >
                  Choose courses
                </Link>
              </p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {readyCourses.slice(0, 4).map((course) => {
                  const done = percent(
                    course.completedCount,
                    Math.max(1, course.topicCount),
                  );
                  return (
                    <div
                      key={course._id}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3"
                    >
                      <GraduationCap className="size-4 shrink-0 text-chrome-7" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/courses/${course._id}`}
                          className="block truncate text-[0.88rem] font-semibold text-brand-ink hover:underline"
                        >
                          {course.subject}
                        </Link>
                        <p className="text-[0.72rem] text-muted-foreground">
                          {done}% of topics done
                        </p>
                      </div>
                      <Link
                        to={`/courses/${course._id}/papers`}
                        className="shrink-0 text-[0.74rem] font-semibold text-brand-ink/70 underline-offset-2 hover:text-brand-ink hover:underline"
                      >
                        Practise
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <CreateSetDialog open={newSetOpen} onOpenChange={setNewSetOpen} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl">
        <motion.header
          className="chrome-bar flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-5"
          {...enter(0.04, 10)}
        >
          <div className="min-w-0">
            <p className="font-display text-[0.98rem] font-bold text-brand-ink">
              AI tutor
            </p>
            <p className="truncate text-[0.74rem] text-muted-foreground">
              {title}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={useWeb}
              onClick={() => setUseWeb((value) => !value)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[0.72rem] font-semibold transition-colors",
                useWeb
                  ? "border-[#B6E4DB] bg-[#E4F6F2] text-[#0A655C]"
                  : "border-border bg-white text-muted-foreground hover:bg-brand-panel",
              )}
              title="Let the tutor search the web for this question"
            >
              <Sparkles className="size-3.5" aria-hidden />
              Web
              {useWeb && <Check className="size-3" aria-hidden />}
            </button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-[0.72rem] text-muted-foreground hover:text-brand-ink"
            >
              Close
            </Button>
          </div>
        </motion.header>

        <div
          ref={scrollRef}
          className="gizmo-scroll max-h-[70vh] min-h-[320px] overflow-y-auto px-4 py-5 sm:px-5"
        >
          {messages === undefined ? (
            // Bubble-shaped placeholders keep the transcript's height steady
            // while the history arrives, instead of a centred spinner.
            <SkeletonChat />
          ) : empty ? (
            <motion.div
              className="flex flex-col items-center pb-2 text-center"
              {...enter(0.08, 12)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 0.6, ease: EASE, delay: 0.06 }}
              >
                <Mascot size={96} float={false} />
              </motion.div>
              <p className="font-display text-[1.15rem] font-bold text-brand-ink">
                Stuck on something?
              </p>
              <p className="mt-1 max-w-sm text-[0.86rem] leading-relaxed text-muted-foreground">
                Ask about your material. The tutor can explain an idea, quiz you, or show
                exactly where marks are usually lost.
              </p>
              <div className="rise-stagger mt-4 grid w-full gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() =>
                      void send(suggestion, {
                        model: tier,
                        effort,
                        attachments: [],
                      })
                    }
                    className="rounded-2xl border border-border bg-white px-3.5 py-2.5 text-left text-[0.82rem] font-medium text-brand-ink/80 transition-colors hover:border-chrome-4 hover:bg-brand-panel"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {messages.map((message, index) => (
                <motion.div
                  key={message._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.3,
                    ease: EASE,
                    delay: Math.min(index * 0.03, 0.18),
                  }}
                  className={cn(
                    "flex flex-col gap-1",
                    message.role === "user" && "items-end",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[86%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[0.9rem] leading-relaxed",
                      message.role === "user"
                        ? "rounded-br-md bg-[#191B27] text-white"
                        : "rounded-bl-md bg-brand-panel text-brand-ink/85",
                    )}
                  >
                    {message.content}
                    {message.streaming && (
                      <span
                        aria-hidden
                        className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-brand-ink/50"
                      />
                    )}
                    {message.streaming && message.content.length === 0 && (
                      <span className="inline-flex items-center gap-2 text-muted-foreground">
                        <TypingDots />
                        {message.sources.length > 0
                          ? "Reading the web…"
                          : useWeb
                            ? "Searching the web…"
                            : "Thinking…"}
                      </span>
                    )}
                  </div>
                  {message.role === "assistant" && !message.streaming && (
                    <div className="max-w-[86%]">
                      <SourceList sources={message.sources ?? []} />
                    </div>
                  )}
                </motion.div>
              ))}

              {sending && !streaming && pending && (
                <motion.div
                  className="flex justify-end"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  <div className="max-w-[86%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#191B27] px-4 py-3 text-[0.9rem] leading-relaxed text-white opacity-80">
                    {pending}
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>

        <motion.div
          className="border-t border-border px-4 py-4 sm:px-5"
          {...enter(0.12, 10)}
        >
          {error && (
            <motion.p
              key={error}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="mb-3 rounded-2xl bg-[#FFEEF0] px-3.5 py-2.5 text-xs leading-relaxed text-[#C93C49]"
            >
              {error}
            </motion.p>
          )}

          <PromptInput
            value={draft}
            onChange={setDraft}
            onSubmit={send}
            placeholder="Ask anything about this material…"
            className="pb-2"
            fullWidth
            maxAttachments={1}
            models={tierLabels}
            modelDetails={modelDetails}
            efforts={effortLabels}
            onDictate={async (audio, format) =>
              (await transcribe({ audio, format })).text
            }
          />

          <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">
            Use Enter inside the prompt to send · Shift + Enter for a new line ·{" "}
            {useWeb
              ? "web search is on, so recent and specification details can be checked online."
              : "web search is off, so answers come from your material and the model only."}{" "}
            Effort sets how long and deep the answer is. Answers can be wrong, so
            check them against your notes.
          </p>
        </motion.div>
      </div>
    </AppShell>
  );
}
