import { Mascot } from "@/components/Mascot";
import { Button } from "@/components/ui/button";
import { EASE, enter } from "@/components/motion/Motion";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { motion } from "framer-motion";
import { ArrowRight, GraduationCap, Layers3, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

type CourseSummary = FunctionReturnType<typeof api.courses.listMine>[number];

const SUGGESTIONS = [
  "Explain this topic like I'm new to it",
  "What am I most likely to lose marks on?",
  "Ask me an exam question",
  "Give me a worked example",
];

/**
 * The tutor panel at the top of the dashboard.
 *
 * It is a launcher, not a second chat: the question is carried to the real
 * tutor screen in the URL, and the chosen course scopes the answer there. That
 * keeps one conversation per set/course on the server instead of a fifth
 * half-context thread on Home.
 */
export function TutorLauncher({
  selectedCourse,
  aiReady,
}: {
  selectedCourse: CourseSummary | null;
  aiReady: boolean | undefined;
}) {
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const disabled = aiReady === false;

  const openTutor = (value?: string) => {
    const text = (value ?? question).trim();
    const params = new URLSearchParams();
    if (selectedCourse) params.set("course", selectedCourse._id);
    if (text) params.set("q", text);
    const query = params.toString();
    navigate(`/tutor${query ? `?${query}` : ""}`);
  };

  return (
    <motion.section
      aria-labelledby="tutor-panel-heading"
      className="chrome-hero relative overflow-hidden rounded-[2rem] px-5 pb-5 pt-5 sm:px-7 sm:pb-6 sm:pt-6"
      {...enter(0.06, 14)}
    >
      <span className="chrome-metal-sheen" aria-hidden />
      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="sticker -rotate-1 bg-gizmo-sky text-brand-ink">
              <Sparkles className="size-3" aria-hidden />
              AI tutor
            </span>
            <span className="text-[0.72rem] font-medium text-brand-ink/60">
              {selectedCourse ? (
                <span className="inline-flex items-center gap-1">
                  <GraduationCap className="size-3" aria-hidden />
                  {selectedCourse.subject}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Layers3 className="size-3" aria-hidden />
                  Your saved material
                </span>
              )}
            </span>
          </div>

          <h2
            id="tutor-panel-heading"
            className="mt-2.5 font-display text-[1.45rem] font-extrabold leading-[1.1] tracking-[-0.035em] text-brand-ink sm:text-[1.7rem]"
          >
            Stuck on something? <span className="highlighter">Ask Bluprint.</span>
          </h2>
          <p className="mt-1.5 max-w-xl text-[0.85rem] leading-relaxed text-brand-ink/65">
            Get an explanation, a worked example or an exam question grounded in{" "}
            {selectedCourse
              ? `${selectedCourse.subject} and your saved sets`
              : "your saved sets and courses"}
            .
          </p>

          <form
            className="mt-3.5"
            onSubmit={(event) => {
              event.preventDefault();
              openTutor();
            }}
          >
            <div className="relative">
              <Sparkles
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                disabled={disabled}
                placeholder={
                  disabled
                    ? "AI is not connected on this deployment"
                    : "Ask about a topic, a card you keep missing, or an exam question…"
                }
                aria-label="Question for the AI tutor"
                className="h-12 w-full rounded-full border border-border bg-card pl-10 pr-[5.5rem] text-[0.88rem] text-brand-ink shadow-none outline-none placeholder:text-muted-foreground/80 focus-visible:border-ring/50 focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <Button
                type="submit"
                disabled={disabled}
                className="absolute right-1 top-1 h-10 rounded-full px-4 text-[0.8rem] font-semibold"
              >
                Ask
                <ArrowRight className="size-3.5" aria-hidden />
              </Button>
            </div>
          </form>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={disabled}
                onClick={() => openTutor(suggestion)}
                className="rounded-full border border-border bg-card px-2.5 py-1 text-[0.72rem] font-medium text-brand-ink/75 transition-colors hover:border-chrome-4 hover:bg-brand-panel hover:text-brand-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
            <Link
              to={
                selectedCourse
                  ? `/tutor?course=${selectedCourse._id}`
                  : "/tutor"
              }
              className="ml-auto inline-flex items-center gap-1 text-[0.76rem] font-semibold text-brand-ink/70 hover:text-brand-ink hover:underline"
            >
              Open the tutor
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>

        <motion.div
          className="hidden shrink-0 lg:block"
          initial={{ opacity: 0, scale: 0.9, rotate: 3 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
        >
          <Mascot size={128} />
        </motion.div>
      </div>
    </motion.section>
  );
}
