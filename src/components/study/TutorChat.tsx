import { Mascot } from "@/components/Mascot";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useAction, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
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

/**
 * Tutor chat for a study set, a course, or a single course unit.
 *
 * The whole thread lives on the server, so switching tabs, reloading, or
 * signing back in keeps the conversation. While a reply is in flight the
 * student's question is shown locally so the wait has context.
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

  const groundedIn =
    scope.kind === "set"
      ? "Grounded in this set's notes"
      : scope.unitTitle
        ? "Grounded in this unit's specification"
        : "Grounded in this course's specification";

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest turn in view without moving the whole page.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages?.length, sending]);

  const send = async (raw?: string) => {
    const question = (raw ?? draft).trim();
    if (!question || sending) return;

    setError(null);
    setSending(true);
    setPending(question);
    setDraft("");

    try {
      if (scope.kind === "set") {
        await askTutor({ setId: scope.setId, question });
      } else {
        await askCourseTutor({
          courseId: scope.courseId,
          unitTitle: scope.unitTitle,
          question,
        });
      }
    } catch (sendError) {
      setError(
        readableError(sendError, "The tutor could not answer that. Please try again."),
      );
      // Put the question back so a retry does not mean retyping it.
      setDraft(question);
    } finally {
      setSending(false);
      setPending(null);
    }
  };

  const empty = messages !== undefined && messages.length === 0 && !pending;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <section className="gizmo-card overflow-hidden">
        <header className="border-b border-border px-4 py-4 sm:px-5">
          <p className="font-display text-[0.98rem] font-bold text-brand-ink">
            AI tutor
          </p>
          <p className="truncate text-[0.74rem] text-muted-foreground">
            {qualification ? `${qualification} · ` : ""}
            {groundedIn}
          </p>
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
              <Mascot size={96} />
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
                    onClick={() => void send(suggestion)}
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
                    "flex gap-2.5",
                    message.role === "user" && "justify-end",
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
                  </div>
                </div>
              ))}

              {pending && (
                <>
                  <div className="flex justify-end">
                    <div className="max-w-[86%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#191B27] px-4 py-3 text-[0.9rem] leading-relaxed text-white">
                      {pending}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-brand-panel px-4 py-3.5">
                      {[0, 1, 2].map((dot) => (
                        <span
                          key={dot}
                          className="size-1.5 animate-pulse rounded-full bg-brand-ink/35"
                          style={{ animationDelay: `${dot * 160}ms` }}
                        />
                      ))}
                      <span className="sr-only">The tutor is writing</span>
                    </div>
                  </div>
                </>
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

          <div className="relative">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder={
                scope.kind === "set"
                  ? "Ask anything about this set…"
                  : "Ask anything about this course…"
              }
              aria-label="Ask the AI tutor"
              rows={2}
              maxLength={1200}
              disabled={sending}
              className="min-h-[76px] resize-none rounded-2xl border-border bg-white pb-10 pr-20 text-sm leading-relaxed text-brand-ink shadow-none placeholder:text-muted-foreground/60 focus-visible:border-[#B9A6FF] focus-visible:ring-[#7C5CFF]/15"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => void send()}
              disabled={!draft.trim() || sending}
              className="absolute bottom-2.5 right-2.5 h-8 rounded-full bg-[#191B27] px-3 text-[0.75rem] font-semibold text-white hover:bg-[#2A2D3E] disabled:bg-[#191B27]/20"
            >
              {sending ? <Loader2 className="size-3.5 animate-spin" /> : "Send"}
            </Button>
          </div>

          <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">
            Enter to send · Shift + Enter for a new line · answers can be wrong, so check
            them against your notes.
          </p>
        </div>
      </section>
    </div>
  );
}
