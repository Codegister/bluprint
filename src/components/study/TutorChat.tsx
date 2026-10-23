import { Mascot } from "@/components/Mascot";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useAction, useQuery } from "convex/react";
import { AlertCircle, ArrowUp, Loader2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const SUGGESTIONS = [
  "Explain this topic like I'm new to it",
  "What am I most likely to lose marks on?",
  "Ask me an exam question",
  "Give me a worked example",
];

/**
 * Per-set tutor chat.
 *
 * The whole thread lives on the server (`tutorMessages`), so switching tabs,
 * reloading, or signing back in keeps the conversation. While a reply is in
 * flight the student's question is shown locally so the wait has context.
 */
export function TutorChat({
  setId,
  title,
  qualification,
}: {
  setId: Id<"studySets">;
  title: string;
  qualification?: string;
}) {
  const messages = useQuery(api.tutor.listMessages, { setId });
  const askTutor = useAction(api.ai.askTutor);

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
      await askTutor({ setId, question });
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
        <header className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#F3ECFF] text-[#5B3DF5]">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[0.98rem] font-bold text-brand-ink">
              AI tutor
            </p>
            <p className="truncate text-[0.74rem] text-muted-foreground">
              {qualification ? `${qualification} · ` : ""}Grounded in this set's notes
            </p>
          </div>
          <span className="hidden shrink-0 rounded-full bg-[#EAFBF0] px-2.5 py-1 text-[0.68rem] font-semibold text-[#128A4C] sm:inline-flex">
            Saved to this set
          </span>
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
                  {message.role === "assistant" && (
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[#F3ECFF] text-[#5B3DF5]">
                      <Sparkles className="size-3.5" />
                    </span>
                  )}
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
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#F3ECFF] text-[#5B3DF5]">
                      <Sparkles className="size-3.5" />
                    </span>
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
            <p className="mb-3 flex items-start gap-2 rounded-2xl bg-[#FFEEF0] px-3.5 py-2.5 text-xs leading-relaxed text-[#C93C49]">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
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
              placeholder="Ask anything about this set…"
              aria-label="Ask the AI tutor"
              rows={2}
              maxLength={1200}
              disabled={sending}
              className="min-h-[76px] resize-none rounded-2xl border-border bg-white pb-9 pr-14 text-sm leading-relaxed text-brand-ink shadow-none placeholder:text-muted-foreground/60 focus-visible:border-[#B9A6FF] focus-visible:ring-[#7C5CFF]/15"
            />
            <Button
              type="button"
              size="icon"
              onClick={() => void send()}
              disabled={!draft.trim() || sending}
              aria-label="Send question"
              className="absolute bottom-2.5 right-2.5 size-9 rounded-full bg-[#191B27] text-white hover:bg-[#2A2D3E] disabled:bg-[#191B27]/20"
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
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
