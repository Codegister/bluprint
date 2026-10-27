import { Mascot } from "@/components/Mascot";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { readableError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useAction } from "convex/react";
import { motion } from "framer-motion";
import { Loader2, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Everything the explain window needs to know about the question it sits beside. */
export type ExplainContext = {
  kind: "quiz" | "exam";
  question: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  marks?: number;
  markingGuide?: string[];
  studentAnswer?: string;
};

type Turn = { role: "user" | "assistant"; content: string };

/**
 * A small, session-only tutor window for one quiz or exam question.
 *
 * The question, its answer and the marking guide are preloaded on the server,
 * so the only prompt sent is "Explain this." Follow-ups stay in this component
 * and are never written to the saved tutor thread: closing the window ends the
 * conversation. That keeps the main tutor's history clean and means the window
 * cannot grow into a second, duplicated conversation.
 */
export function ExplainDialog({
  setId,
  context,
  qualification,
  className,
  label = "AI explain",
}: {
  setId: Id<"studySets">;
  context: ExplainContext;
  qualification?: string;
  className?: string;
  label?: string;
}) {
  const explain = useAction(api.ai.explainQuestion);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Guards against React StrictMode opening the window twice and paying for
  // two identical explanations in development.
  const askedFor = useRef<string | null>(null);
  // Closing the window, or asking again, must drop any reply still in flight.
  const requestId = useRef(0);
  const contextKey = `${context.kind}:${context.question}`;

  const ask = async (prompt: string, prior: Turn[]) => {
    const text = prompt.trim();
    if (!text || pending) return;
    const id = requestId.current + 1;
    requestId.current = id;

    setPending(true);
    setError(null);
    const next: Turn[] = [...prior, { role: "user", content: text }];
    setTurns(next);

    try {
      const result = await explain({
        setId,
        kind: context.kind,
        question: context.question,
        ...(context.options ? { options: context.options } : {}),
        ...(context.correctAnswer ? { correctAnswer: context.correctAnswer } : {}),
        ...(context.explanation ? { explanation: context.explanation } : {}),
        ...(context.marks !== undefined ? { marks: context.marks } : {}),
        ...(context.markingGuide ? { markingGuide: context.markingGuide } : {}),
        ...(context.studentAnswer ? { studentAnswer: context.studentAnswer } : {}),
        ...(qualification ? { qualification } : {}),
        history: prior,
        prompt: text,
      });
      if (requestId.current !== id) return;
      setTurns([...next, { role: "assistant", content: result.reply }]);
    } catch (sendError) {
      if (requestId.current !== id) return;
      setTurns(prior);
      setError(
        readableError(sendError, "Could not explain that question. Please retry."),
      );
    } finally {
      if (requestId.current === id) setPending(false);
    }
  };

  // Opening the window sends the shortest useful prompt. The question itself is
  // already on the server, so there is nothing else to type.
  useEffect(() => {
    if (!open) return;
    if (askedFor.current === contextKey) return;
    askedFor.current = contextKey;
    void ask("Explain this.", []);
    // `ask` closes over the current question; `contextKey` changes when that
    // question changes, which is the only time this should re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contextKey]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [turns.length, pending]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) return;
    // Closing is the end of this session: nothing survives except in memory.
    requestId.current += 1;
    setPending(false);
    setTurns([]);
    setDraft("");
    setError(null);
    askedFor.current = null;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full border border-chrome-4 bg-brand-panel px-3 text-[0.74rem] font-semibold text-chrome-7 transition-colors hover:border-chrome-5 hover:bg-chrome-3",
          className,
        )}
      >
        <Sparkles className="size-3.5" aria-hidden />
        {label}
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[86vh] w-[calc(100%-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden rounded-[1.6rem] p-0">
          <DialogHeader className="flex-row items-center gap-2.5 space-y-0 border-b border-border px-4 py-3.5 sm:px-5">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-panel text-chrome-7">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 text-left">
              <DialogTitle className="font-display text-[0.95rem] font-bold text-brand-ink">
                AI explain
              </DialogTitle>
              <DialogDescription className="truncate text-[0.7rem]">
                {context.kind === "quiz" ? "This quiz question" : "This exam question"} ·
                not saved to your tutor history
              </DialogDescription>
            </div>
          </DialogHeader>

          <div
            ref={scrollRef}
            className="gizmo-scroll min-h-[190px] flex-1 overflow-y-auto px-4 py-4 sm:px-5"
          >
            {turns.length === 0 && pending ? (
              <div className="flex h-40 flex-col items-center justify-center text-center">
                <Mascot size={64} float={false} />
                <p className="mt-2 text-[0.8rem] font-medium text-muted-foreground">
                  Reading the question…
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {turns.map((turn, index) => (
                  <motion.div
                    key={`${index}-${turn.role}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex",
                      turn.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    <p
                      className={cn(
                        "max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[0.84rem] leading-relaxed",
                        turn.role === "user"
                          ? "rounded-br-md bg-[#191B27] text-white"
                          : "rounded-bl-md bg-brand-panel text-brand-ink/85",
                      )}
                    >
                      {turn.content}
                    </p>
                  </motion.div>
                ))}

                {pending && turns.length > 0 && (
                  <p className="inline-flex items-center gap-2 rounded-2xl bg-brand-panel px-3.5 py-2.5 text-[0.8rem] text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    Thinking…
                  </p>
                )}
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-2xl bg-[#FFEEF0] px-3.5 py-2.5 text-xs leading-relaxed text-[#A81F28]">
                {error}
              </p>
            )}
          </div>

          <form
            className="border-t border-border px-4 py-3 sm:px-5"
            onSubmit={(event) => {
              event.preventDefault();
              const text = draft;
              setDraft("");
              void ask(text, turns);
            }}
          >
            <div className="flex items-center gap-2 rounded-full border border-border bg-white py-1 pl-4 pr-1">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask a follow-up…"
                aria-label="Ask a follow-up about this question"
                maxLength={600}
                className="h-8 min-w-0 flex-1 bg-transparent text-[0.82rem] text-brand-ink outline-none placeholder:text-muted-foreground/90"
              />
              <button
                type="submit"
                disabled={pending || draft.trim().length === 0}
                aria-label="Send follow-up"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-[#191B27] text-white transition-colors hover:bg-[#2A2D3E] disabled:bg-[#191B27]/25"
              >
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Send className="size-3.5" aria-hidden />
                )}
              </button>
            </div>
            <p className="mt-2 text-[0.66rem] leading-relaxed text-muted-foreground">
              This window and its messages disappear when you close it. The main
              tutor keeps its own separate history.
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
