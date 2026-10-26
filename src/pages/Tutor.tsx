import { AppShell } from "@/components/AppShell";
import { Mascot } from "@/components/Mascot";
import { PromptInput } from "@/components/ui/ai-chat-input";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useAction, useQuery } from "convex/react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

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
            className="min-w-0 truncate text-[#4C5FD5] underline decoration-[#C6CCF3] underline-offset-2 hover:text-[#3846A8]"
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

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Full-screen AI tutor.
 *
 * It reads the scope from the URL: `/tutor?set=<id>`, `/tutor?course=<id>`, or
 * `/tutor?course=<id>&unit=<unit title>`. The chat itself is identical to the
 * embedded TutorChat component, but here it takes the whole page rather than
 * living inside a dialog.
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

  const askTutor = useAction(api.ai.askTutor);
  const askCourseTutor = useAction(api.ai.askCourseTutor);
  // Dictation is transcribed on the server, so speech keys stay off the client.
  const transcribe = useAction(api.ai.transcribeDictation);
  // Same source as the embedded tutor: tiers are offered by label only, and
  // the NVIDIA model behind each label stays on the server.
  const aiStatus = useQuery(api.settings.aiStatus);
  const tierLabels = aiStatus?.tutorTiers ?? ["Balanced"];
  const defaultTier = aiStatus?.defaultTutorTier ?? "Balanced";

  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useWeb, setUseWeb] = useState(false);
  const [effort, setEffort] = useState<"Low" | "Medium" | "Max Effort">("Medium");
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

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
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
        </header>

        <div
          ref={scrollRef}
          className="gizmo-scroll max-h-[70vh] min-h-[320px] overflow-y-auto px-4 py-5 sm:px-5"
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
                Ask about your material. The tutor can explain an idea, quiz you, or show
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
                      <SourceList sources={message.sources ?? []} />
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
            placeholder="Ask anything about this material…"
            className="pb-2"
            fullWidth
            maxAttachments={1}
            models={tierLabels}
            modelIcons={{}}
            onDictate={async (audio, format) =>
              (await transcribe({ audio, format })).text
            }
          />

          <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">
            Use Enter inside the prompt to send · Shift + Enter for a new line ·{" "}
            {useWeb
              ? "web search is on, so recent and specification details can be checked online."
              : "web search is off, so answers come from your material and the model only."}{" "}
            Answers can be wrong, so check them against your notes.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
