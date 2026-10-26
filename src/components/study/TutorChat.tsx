import { Mascot } from "@/components/Mascot";
import { PromptInput } from "@/components/ui/ai-chat-input";

type MascotFloat = boolean | undefined;
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useAction, useQuery } from "convex/react";
import { Check, Globe, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const SUGGESTIONS = [
  "Explain this topic like I'm new to it",
  "What am I most likely to lose marks on?",
  "Ask me an exam question",
  "Give me a worked example",
];

/**
 * What a tutor conversation is grounded in. A study set uses its saved notes; a
 * course uses its scraped pathway, optionally narrowed to one unit.
 */
export type TutorScope =
  | { kind: "set"; setId: Id<"studySets"> }
  | { kind: "course"; courseId: Id<"courses">; unitTitle?: string };

type Source = { title: string; url: string };

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Numbered links that match the [1], [2] citations in an answer. */
function SourceList({ sources }: { sources: Source[] }) {
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
            className="min-w-0 truncate text-[#4C5FD5] underline decoration-[#C6CCF3] underline-offset-2 hover:text-[#3846A8]"
            title={source.title}
          >
            {source.title || hostOf(source.url)}
          </a>
          <span className="shrink-0 text-brand-ink/35">{hostOf(source.url)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Tutor chat for a study set, a course, or a single course unit.
 *
 * The whole thread lives on the server, so switching tabs, reloading, or
 * signing back in keeps the conversation. Answers stream in: the server opens
 * an empty reply before it calls NVIDIA and writes the text into it as it
 * arrives, so this component simply renders the growing message. Web search is
 * optional per question and the cited pages are saved with the answer.
 */
export function TutorChat({
  scope,
  title,
  qualification,
}: {
  scope: TutorScope;
  title: string;
  qualification?: string;
}) {
  // Both subscriptions are declared unconditionally; Convex skips the one that
  // does not belong to this scope.
  const setMessages = useQuery(
    api.tutor.listMessages,
    scope.kind === "set" ? { setId: scope.setId } : "skip",
  );
  const courseMessages = useQuery(
    api.tutor.listCourseMessages,
    scope.kind === "course"
      ? { courseId: scope.courseId, unitTitle: scope.unitTitle }
      : "skip",
  );
  const messages = scope.kind === "set" ? setMessages : courseMessages;
  const askTutor = useAction(api.ai.askTutor);
  const askCourseTutor = useAction(api.ai.askCourseTutor);
  // Dictation is transcribed on the server, so speech keys stay off the client.
  const transcribe = useAction(api.ai.transcribeDictation);
  // Tiers are named by feel only (Ultra is ultra fast, Max is maximum strength).
  // The NVIDIA model behind each label is chosen on the server, never sent here.
  const aiStatus = useQuery(api.settings.aiStatus);
  const tierLabels = aiStatus?.tutorTiers ?? ["Balanced"];
  const defaultTier = aiStatus?.defaultTutorTier ?? "Balanced";
  // Each tier gets its own tagline and glyph, so the picker can say "ultra
  // fast" beside Ultra and no two models share an icon.
  const modelDetails = Object.fromEntries(
    (aiStatus?.tutorTierDetails ?? []).map((tier) => [
      tier.label,
      { tagline: tier.tagline, icon: tier.icon },
    ]),
  );
  const effortLabels = aiStatus?.tutorEfforts ?? ["Low", "Medium", "Max Effort"];

  const groundedIn =
    scope.kind === "set"
      ? "Grounded in this set's notes"
      : scope.unitTitle
        ? "Grounded in this unit's specification"
        : "Grounded in this course's specification";

  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Web search stays off unless the student asks for it: the tutor answers
  // from the saved notes and specification first.
  const [useWeb, setUseWeb] = useState(false);
  const [effort, setEffort] = useState<string>(
    aiStatus?.defaultTutorEffort ?? "Medium",
  );
  // The last tier the student used, so a suggested question uses the same one.
  const [tier, setTier] = useState(defaultTier);
  const scrollRef = useRef<HTMLDivElement>(null);

  // The reply being written right now, if any.
  const streaming = messages?.find((message) => message.streaming);
  const streamedLength = streaming?.content.length ?? 0;

  // Keep the newest turn in view without moving the whole page.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages?.length, sending, streamedLength]);

  const send = async (value: string, meta: { model: string; effort: string; attachments: File[] }) => {
    const question = value.trim();
    if (!question || sending) return;

    // The composer's model picker reports a tier label; an unknown one falls
    // back to the default on the server.
    const chosenTier = meta.model || tier;
    // Effort is a real setting: the server turns this label into the answer
    // budget, temperature and a short/long-answer instruction.
    const chosenEffort = meta.effort || effort;
    setTier(chosenTier);
    setEffort(chosenEffort);
    setError(null);
    setSending(true);
    setPending(question);

    try {
      if (scope.kind === "set") {
        await askTutor({
          setId: scope.setId,
          question,
          useWeb,
          tier: chosenTier,
          effort: chosenEffort,
        });
      } else {
        await askCourseTutor({
          courseId: scope.courseId,
          unitTitle: scope.unitTitle,
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
      // The question is already saved, so restore it for a retry.
      setDraft(question);
    } finally {
      setSending(false);
      setPending(null);
    }
  };

  const empty = messages !== undefined && messages.length === 0 && !sending;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <section className="gizmo-card overflow-hidden">
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="font-display text-[0.98rem] font-bold text-brand-ink">
              AI tutor
            </p>
            <p className="truncate text-[0.74rem] text-muted-foreground">
              {qualification ? `${qualification} · ` : ""}
              {groundedIn}
            </p>
          </div>
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
            <Globe className="size-3.5" aria-hidden />
            Web
            {useWeb && <Check className="size-3" aria-hidden />}
          </button>
        </header>

        <div
          ref={scrollRef}
          className="gizmo-scroll max-h-[520px] min-h-[300px] overflow-y-auto px-4 py-5 sm:px-5"
        >
          {messages === undefined ? (
            <div className="flex h-56 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : empty ? (
            <div className="flex flex-col items-center pb-2 text-center">
              <Mascot size={96} float={false} />
              <p className="font-display text-[1.15rem] font-bold text-brand-ink">
                Stuck on something?
              </p>
              <p className="mt-1 max-w-sm text-[0.86rem] leading-relaxed text-muted-foreground">
                Ask about {title}. The tutor can explain an idea, quiz you, or show
                exactly where marks are usually lost.
              </p>
              <div className="mt-4 grid w-full gap-2 sm:grid-cols-2">
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
                    className="rounded-2xl border border-border bg-white px-3.5 py-2.5 text-left text-[0.82rem] font-medium text-brand-ink/80 transition-colors hover:border-[#D8CCFF] hover:bg-[#FAF8FF]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message._id}
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
                        <Loader2 className="size-3.5 animate-spin" />
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
                      <SourceList sources={message.sources} />
                    </div>
                  )}
                </div>
              ))}

              {sending && !streaming && pending && (
                <div className="flex justify-end">
                  <div className="max-w-[86%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#191B27] px-4 py-3 text-[0.9rem] leading-relaxed text-white opacity-80">
                    {pending}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border px-4 py-4 sm:px-5">
          {error && (
            <p className="mb-3 rounded-2xl bg-[#FFEEF0] px-3.5 py-2.5 text-xs leading-relaxed text-[#C93C49]">
              {error}
            </p>
          )}

          <PromptInput
            value={draft}
            onChange={setDraft}
            onSubmit={send}
            placeholder={
              scope.kind === "set"
                ? "Ask anything about this set…"
                : "Ask anything about this course…"
            }
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
        </div>
      </section>
    </div>
  );
}
