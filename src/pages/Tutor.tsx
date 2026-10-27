import { AppShell } from "@/components/AppShell";
import { CreateSetDialog } from "@/components/CreateSetDialog";
import { GettingStarted, markTutorUsed } from "@/components/GettingStarted";
import { NextStep } from "@/components/NextStep";
import { PageHeader } from "@/components/PageHeader";
import {
  SkeletonChat,
  SkeletonPageHeader,
  SkeletonRows,
} from "@/components/Skeletons";
import { Mascot } from "@/components/Mascot";
import { SetLibrary } from "@/components/study/SetLibrary";
import { TutorChat, type TutorScope } from "@/components/study/TutorChat";
import { PromptInput } from "@/components/ui/ai-chat-input";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { DeckGlyph } from "@/components/Mascot";
import { EASE, Meter, TypingDots, enter } from "@/components/motion/Motion";
import { useAuth } from "@/hooks/use-auth";
import { readableError } from "@/lib/errors";
import { displayName, percent } from "@/lib/format";
import { takePendingNotes } from "@/lib/pendingNotes";
import { subjectMeta } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { useAction, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowRight, Check, Globe, GraduationCap, Play, Sparkles } from "lucide-react";

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
          <span className="mt-px shrink-0 rounded bg-white px-1 font-semibold text-brand-ink/70">
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
          <span className="shrink-0 text-brand-ink/65">
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
    if (!open) setHeroNotes(null);
  };

  // Notes pasted on the landing hero before signing in. They are handed to the
  // create dialog once, so the visitor's words become their first set.
  const [heroNotes, setHeroNotes] = useState<string | null>(null);
  useEffect(() => {
    const pending = takePendingNotes();
    if (!pending) return;
    setHeroNotes(pending);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("new", "1");
        return next;
      },
      { replace: true },
    );
    // Runs once on arrival: the saved notes are cleared as they are read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const [draft, setDraft] = useState(questionParam);
  const [pending, setPending] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Web grounding is opted into per question, exactly as on the home tutor.
  const [useWeb, setUseWeb] = useState(false);
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

  const send = async (
    value: string,
    meta: { model: string; attachments: File[] },
  ) => {
    const question = value.trim();
    if (!question || sending) return;
    markTutorUsed();

    // The picker reports a level label; the server maps it to a NVIDIA model.
    // Fast, Balanced or Deep: the server turns the label into a budget, a
    // temperature and a depth instruction.
    const chosenTier = meta.model || tier;
    setTier(chosenTier);
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
        });
      } else if (validCourseId && courseId) {
        await askCourseTutor({
          courseId: courseId as Id<"courses">,
          unitTitle: unitTitle ?? undefined,
          question,
          useWeb,
          tier: chosenTier,
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
    // Until the queries answer, the page would say "No cards due · 0 day
    // streak" and tell a returning student the tutor has nothing to read.
    // Draw the page's shape instead of a false empty state.
    if (mySets === undefined || myCourses === undefined || study === undefined) {
      return (
        <AppShell>
          <div className="mx-auto w-full max-w-4xl">
            <SkeletonPageHeader />
            <div className="mt-4 rounded-2xl border border-border bg-card p-4">
              <SkeletonChat bubbles={2} />
            </div>
            <div className="mt-7">
              <SkeletonRows rows={4} withAvatar />
            </div>
          </div>
        </AppShell>
      );
    }

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

    // The scope chip stores "set:<id>" or "course:<id>"; the chat needs the
    // typed scope object, and the header needs the label and qualification.
    const [scopeKind, scopeValue] = activeScope?.value.split(":") ?? [];
    const tutorScope: TutorScope | null =
      scopeKind === "set" && scopeValue
        ? { kind: "set", setId: scopeValue as Id<"studySets"> }
        : scopeKind === "course" && scopeValue
          ? { kind: "course", courseId: scopeValue as Id<"courses"> }
          : null;
    const tutorSet =
      scopeKind === "set"
        ? recentSets.find((set) => set._id === scopeValue)
        : undefined;
    const tutorCourse =
      scopeKind === "course"
        ? readyCourses.find((course) => course._id === scopeValue)
        : undefined;
    const tutorTitle = tutorSet?.title ?? tutorCourse?.subject ?? "your material";
    const tutorQualification = tutorSet
      ? [tutorSet.course, tutorSet.examBoard].filter(Boolean).join(" · ")
      : tutorCourse
        ? `${tutorCourse.examBoard} ${tutorCourse.level}`
        : undefined;

    // The guide's tutor step brings the composer into view instead of leaving
    // the page, so the next action is literally under the cursor.
    const focusTutor = () => {
      document
        .getElementById("home-tutor")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      document
        .querySelector<HTMLTextAreaElement>("#home-tutor textarea")
        ?.focus({ preventScroll: true });
    };

    return (
      <AppShell>
        <div className="mx-auto w-full max-w-4xl">
          <PageHeader
            eyebrow="Home"
            title={`Hi, ${firstName}`}
            description={
              <>
                {totalDue > 0
                  ? `${totalDue} card${totalDue === 1 ? "" : "s"} due`
                  : "No cards due"}{" "}
                · {study?.streak ?? 0} day
                {(study?.streak ?? 0) === 1 ? "" : "s"} streak
              </>
            }
            actions={
              <Button
                type="button"
                onClick={() => setNewSetOpen(true)}
                className="h-11 shrink-0 rounded-full px-5 text-sm font-semibold"
              >
                Add material
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            }
          />

          {aiStatus && !aiStatus.configured && (
            <p className="mt-4 rounded-2xl bg-[#FFF6E5] px-4 py-2.5 text-[0.8rem] font-medium text-[#96650A]">
              AI is not connected on this deployment. Add NVIDIA_API_KEY to use
              the tutor and build new study sets. Saved material still works.
            </p>
          )}

          <GettingStarted
            onAddMaterial={() => setNewSetOpen(true)}
            onExploreTutor={focusTutor}
          />

          {/* The tutor is the page's main tool: the full chat with model tiers,
              the picker, dictation and streaming answers, not a link elsewhere. */}
          <motion.section
            id="home-tutor"
            aria-label="Ask the tutor"
            className="mt-4 scroll-mt-24"
            {...enter(0.08, 10)}
          >
            {tutorScope ? (
              <TutorChat
                scope={tutorScope}
                title={tutorTitle}
                qualification={tutorQualification}
                onAsk={markTutorUsed}
                scopeControl={
                  scopeOptions.length > 0 ? (
                    <label className="flex min-w-0 items-center gap-1.5 text-[0.72rem] text-muted-foreground">
                      <span className="shrink-0">About</span>
                      <select
                        value={activeScope?.value ?? ""}
                        onChange={(event) => setHomeScope(event.target.value)}
                        className="h-7 max-w-[180px] min-w-0 rounded-full border border-border bg-card px-2 text-[0.72rem] font-semibold text-brand-ink outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                      >
                        {scopeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : undefined
                }
              />
            ) : (
              <div className="gizmo-card flex flex-col items-center gap-3 px-5 py-8 text-center">
                <Mascot size={64} float={false} />
                <div className="max-w-sm">
                  <p className="font-display text-[1.05rem] font-bold text-brand-ink">
                    The tutor needs something to read
                  </p>
                  {/* No button here: "Add material" is the page's one primary
                      action, two lines above, and the courses section below has
                      its own. An empty state explains; it does not repeat. */}
                  <p className="mt-1 text-[0.85rem] leading-relaxed text-muted-foreground">
                    Use <span className="font-semibold text-brand-ink">Add material</span>{" "}
                    to paste or upload a page of notes, or pick your subjects in{" "}
                    Courses below. The tutor then explains, quizzes and marks
                    answers from your own material.
                  </p>
                </div>
              </div>
            )}
          </motion.section>

          {continueSets.length > 0 && (
            <section className="mt-7" aria-labelledby="continue-heading">
              <div className="flex items-center gap-3">
                <h2
                  id="continue-heading"
                  className="flex items-center gap-2 font-display text-[1.1rem] font-bold text-brand-ink"
                >
                  <Play className="size-4 text-brand-mint" aria-hidden />
                  Continue
                </h2>
                <span className="hidden h-px flex-1 border-t border-dashed border-border sm:block" />
              </div>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {continueSets.map((set) => {
                  const accent = subjectMeta(set.course ?? "").color;
                  return (
                  <Link
                    key={set._id}
                    to={`/sets/${set._id}`}
                    className="group flex items-center gap-3.5 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-brand-sky/40 hover:bg-brand-sky/5"
                  >
                    <DeckGlyph className="size-10 shrink-0" color={accent} />
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
                        barStyle={{ backgroundColor: accent }}
                        label={`${set.title} readiness`}
                      />
                      <span
                        className="mt-1.5 flex items-center gap-1 text-[0.74rem] font-semibold"
                        style={{ color: accent }}
                      >
                        <Play className="size-3" aria-hidden />
                        Continue studying
                      </span>
                    </span>
                  </Link>
                  );
                })}
              </div>
            </section>
          )}

          <SetLibrary onCreate={() => setNewSetOpen(true)} />

          {/* Courses stay reachable without competing with the sets list. */}
          <section className="mt-7" aria-labelledby="home-courses-heading">
            <div className="flex flex-wrap items-center gap-3">
              <h2
                id="home-courses-heading"
                className="flex items-center gap-2 font-display text-[1.1rem] font-bold text-brand-ink"
              >
                <GraduationCap className="size-4 text-brand-violet" aria-hidden />
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
                tutor about the whole specification. Use{" "}
                <span className="font-semibold text-brand-ink">Add a course</span>{" "}
                above to start.
              </p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {readyCourses.slice(0, 4).map((course) => {
                  const done = percent(
                    course.completedCount,
                    Math.max(1, course.topicCount),
                  );
                  const meta = subjectMeta(course.subject);
                  const CourseIcon = meta.icon;
                  return (
                    <div
                      key={course._id}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3"
                    >
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-lg",
                          meta.tint,
                        )}
                        style={{ color: meta.color }}
                      >
                        <CourseIcon className="size-3.5" aria-hidden />
                      </span>
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

          <NextStep
            to="/today"
            title="Start today's session"
            hint={
              totalDue > 0
                ? `${totalDue} card${totalDue === 1 ? "" : "s"} are ready for review`
                : "One short session keeps the plan moving"
            }
            className="mb-1 mt-7"
          />
        </div>

        <CreateSetDialog
          open={newSetOpen}
          onOpenChange={setNewSetOpen}
          initialText={heroNotes ?? undefined}
        />
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
            <p className="flex items-center gap-1.5 font-display text-[0.98rem] font-bold text-brand-ink">
              <Sparkles className="size-4 text-brand-violet" aria-hidden />
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
                  ? "border-brand-sky/40 bg-brand-sky/10 text-brand-ink"
                  : "border-border bg-white text-muted-foreground hover:bg-brand-panel",
              )}
              title="Let the tutor search the web for this question"
            >
              <Globe className="size-3.5" aria-hidden />
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
                      void send(suggestion, { model: tier, attachments: [] })
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
                        : "rounded-bl-md border border-brand-sky/15 bg-brand-sky/10 text-brand-ink/90",
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
              className="mb-3 rounded-2xl bg-[#FFEEF0] px-3.5 py-2.5 text-xs leading-relaxed text-[#A81F28]"
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
            onDictate={async (audio, format) =>
              (await transcribe({ audio, format })).text
            }
          />

          <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">
            Use Enter inside the prompt to send · Shift + Enter for a new line ·{" "}
            {useWeb
              ? "web search is on, so recent and specification details can be checked online."
              : "web search is off, so answers come from your material and the model only."}{" "}
            Fast, Balanced and Deep set how long and deep the answer is. Answers can be wrong, so
            check them against your notes.
          </p>
        </motion.div>
      </div>
    </AppShell>
  );
}
