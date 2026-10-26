import { AppShell } from "@/components/AppShell";
import { SkeletonChat } from "@/components/Skeletons";
import { Mascot } from "@/components/Mascot";
import { PromptInput } from "@/components/ui/ai-chat-input";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { EASE, TypingDots, enter } from "@/components/motion/Motion";
import { readableError } from "@/lib/errors";
import { courseSubtitle } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { useAction, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  Check,
  ChevronRight,
  GraduationCap,
  Layers3,
  Sparkles,
} from "lucide-react";

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

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
 * Full-screen AI tutor.
 *
 * It reads the scope from the URL: `/tutor?set=<id>`, `/tutor?course=<id>`, or
 * `/tutor?course=<id>&unit=<unit title>`. With no scope it opens on a chooser,
 * so the tutor always starts from one clear decision and the chat itself takes
 * the whole page.
 */
export default function TutorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const setId = searchParams.get("set");
  const courseId = searchParams.get("course");
  const unitTitle = searchParams.get("unit");

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

  // With no scope in the URL, the screen asks which material to use. Both
  // lists load up front so the choice is ready immediately.
  const scoped = validSetId || validCourseId;
  const myCourses = useQuery(api.courses.listMine);
  const mySets = useQuery(api.studySets.listMine);

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

  const [draft, setDraft] = useState("");
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

  // No scope chosen yet: this screen has one job, choosing what to ask about.
  if (!scoped) {
    const readyCourses = (myCourses ?? []).filter(
      (course) => course.status === "ready",
    );
    const readySets = (mySets ?? []).filter((set) => set.status === "ready");
    const loadingCourses = myCourses === undefined;
    const loadingSets = mySets === undefined;

    return (
      <AppShell>
        <div className="mx-auto w-full max-w-3xl">
          <motion.header
            className="chrome-plate rounded-[1.6rem] px-5 py-6 text-center"
            {...enter(0.04, 12)}
          >
            <span className="sticker mx-auto bg-white/85 text-chrome-7">
              <Sparkles className="size-3" aria-hidden />
              AI tutor
            </span>
            <h1 className="mt-3 font-display text-[1.6rem] font-bold tracking-[-0.03em] text-brand-ink sm:text-[2rem]">
              What are you working on?
            </h1>
            <p className="mx-auto mt-2 max-w-md text-[0.88rem] leading-relaxed text-muted-foreground">
              Pick a course to ask about the whole specification, or a saved set
              to ask about one piece of material. Answers stay grounded in what
              you choose.
            </p>
          </motion.header>

          <section className="mt-6">
            <div className="flex items-center gap-2.5">
              <span className="grid size-7 place-items-center rounded-lg bg-[#E6F7EF] text-[#128A4C]">
                <GraduationCap className="size-4" aria-hidden />
              </span>
              <h2 className="font-display text-[1.05rem] font-bold text-brand-ink">
                Ask about a course
              </h2>
              <span className="hidden h-px flex-1 border-t border-dashed border-border sm:block" />
            </div>

            <div className="mt-3 overflow-hidden rounded-3xl border border-border bg-white">
              {loadingCourses ? (
                <p className="px-5 py-5 text-[0.82rem] text-muted-foreground">
                  Loading your courses…
                </p>
              ) : readyCourses.length === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5">
                  <p className="text-[0.82rem] text-muted-foreground">
                    No ready courses yet. Set one up to ask the tutor about a
                    whole specification.
                  </p>
                  <Button asChild variant="outline" className="h-8 rounded-full border-border bg-white px-3 text-[0.76rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel">
                    <Link to="/courses/new">Set up courses</Link>
                  </Button>
                </div>
              ) : (
                readyCourses.map((course) => (
                  <Link
                    key={course._id}
                    to={`/tutor?course=${course._id}`}
                    className="group flex items-center gap-3 border-b border-border/70 px-4 py-4 last:border-b-0 transition-colors hover:bg-[#F7FCFA] sm:px-5"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#E6F7EF] text-[#128A4C]">
                      <GraduationCap className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[0.95rem] font-bold text-brand-ink">
                        {course.subject}
                      </span>
                      <span className="mt-0.5 block truncate text-[0.74rem] text-muted-foreground">
                        {courseSubtitle(course)}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-brand-ink/30 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))
              )}
            </div>
          </section>

          <section className="mt-6">
            <div className="flex items-center gap-2.5">
              <span className="grid size-7 place-items-center rounded-lg bg-[#FFF1DE] text-[#B4720E]">
                <Layers3 className="size-4" aria-hidden />
              </span>
              <h2 className="font-display text-[1.05rem] font-bold text-brand-ink">
                Ask about a study set
              </h2>
              <span className="hidden h-px flex-1 border-t border-dashed border-border sm:block" />
            </div>

            <div className="mt-3 overflow-hidden rounded-3xl border border-border bg-white">
              {loadingSets ? (
                <p className="px-5 py-5 text-[0.82rem] text-muted-foreground">
                  Loading your study sets…
                </p>
              ) : readySets.length === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5">
                  <p className="text-[0.82rem] text-muted-foreground">
                    No ready study sets yet. Upload notes to make one.
                  </p>
                  <Button asChild variant="outline" className="h-8 rounded-full border-border bg-white px-3 text-[0.76rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel">
                    <Link to="/dashboard?new=1">New study set</Link>
                  </Button>
                </div>
              ) : (
                readySets.slice(0, 6).map((set) => (
                  <Link
                    key={set._id}
                    to={`/tutor?set=${set._id}`}
                    className="group flex items-center gap-3 border-b border-border/70 px-4 py-4 last:border-b-0 transition-colors hover:bg-brand-panel sm:px-5"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#FFF1DE] text-[#B4720E]">
                      <Layers3 className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[0.95rem] font-bold text-brand-ink">
                        {set.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[0.74rem] text-muted-foreground">
                        {set.cardCount} cards · {set.quizCount} quiz ·{" "}
                        {set.examCount} exam
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-brand-ink/30 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))
              )}
            </div>

            {readySets.length > 6 && (
              <p className="mt-2 text-[0.74rem] text-muted-foreground">
                Showing your six most recent sets.{" "}
                <Link
                  to="/dashboard"
                  className="font-semibold text-chrome-7 underline-offset-2 hover:underline"
                >
                  See all sets
                </Link>
              </p>
            )}
          </section>
        </div>
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
