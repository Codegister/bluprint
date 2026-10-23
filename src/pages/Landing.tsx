import { Brand } from "@/components/Brand";
import { DeckGlyph, Mascot } from "@/components/Mascot";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  Check,
  FileText,
  Layers,
  ListChecks,
  PenLine,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3ECFF] px-3 py-1 text-[0.72rem] font-semibold text-[#5B3DF5]">
      {children}
    </span>
  );
}

function HeroPreview() {
  const [revealed, setRevealed] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      <div className="gizmo-card relative overflow-hidden p-4 sm:p-6">
        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-center sm:gap-5 sm:text-left">
          <Mascot size={112} />
          <div>
            <p className="text-[0.9rem] font-medium text-muted-foreground">
              What shall we
            </p>
            <p className="font-display text-[2rem] font-extrabold leading-none tracking-[-0.04em] text-brand-ink sm:text-[2.4rem]">
              Study?
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-border bg-white p-4 shadow-[0_18px_40px_-30px_rgba(22,24,31,0.5)]">
          <p className="text-[0.95rem] text-muted-foreground">I want to study…</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="grid size-8 place-items-center rounded-full bg-brand-panel text-brand-ink/60">
              <ScanLine className="size-4" />
            </span>
            <span className="rounded-full bg-[#191B27] px-4 py-2 text-[0.82rem] font-semibold text-white">
              Generate
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { icon: <FileText className="size-4" />, label: "File" },
            { icon: <Camera className="size-4" />, label: "Photos" },
            { icon: <Video className="size-4" />, label: "Video" },
          ].map((action) => (
            <div
              key={action.label}
              className="flex items-center justify-center gap-1.5 rounded-full border border-border bg-white px-2 py-2.5 text-[0.82rem] font-medium text-brand-ink/80"
            >
              {action.icon}
              {action.label}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setRevealed((value) => !value)}
          className="mt-4 block w-full rounded-3xl border border-border bg-brand-panel/60 p-4 text-left transition-colors hover:border-brand-pink/30"
        >
          <div className="flex items-center justify-between">
            <span className="text-[0.72rem] font-semibold text-muted-foreground">
              Card 3 of 10
            </span>
            <span className="rounded-full bg-[#E9F0FF] px-2 py-0.5 text-[0.7rem] font-semibold text-[#3B82F6]">
              Biology
            </span>
          </div>
          <p className="mt-3 font-display text-[1.05rem] font-semibold leading-snug text-brand-ink">
            Why does the mitochondrion have folded inner membranes?
          </p>
          <div className="mt-3 min-h-[40px]">
            {revealed ? (
              <p className="text-[0.86rem] leading-relaxed text-brand-ink/75">
                Cristae increase the surface area available to the electron transport chain,
                so more ATP is produced.
              </p>
            ) : (
              <p className="text-[0.82rem] text-muted-foreground">
                Tap to reveal the answer
              </p>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-[0.75rem] font-medium">
            <span className="text-muted-foreground">
              {revealed ? "Self-assessed" : "Active recall"}
            </span>
            <span className="text-[#5B3DF5]">
              {revealed ? "Hide answer" : "Reveal answer"} →
            </span>
          </div>
        </button>
      </div>

      <div className="gizmo-card absolute -bottom-4 left-6 right-6 hidden items-center justify-between gap-2 px-4 py-2.5 sm:flex">
        <span className="text-[0.75rem] font-medium text-muted-foreground">
          Saved to your workspace
        </span>
        <div className="flex gap-1.5">
          {["Summary", "Cards", "Quiz", "Exam"].map((item) => (
            <span
              key={item}
              className="rounded-full bg-brand-panel px-2 py-0.5 text-[0.7rem] font-medium text-brand-ink/70"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function OutputCard({
  icon,
  title,
  copy,
  tint,
  children,
}: {
  icon: ReactNode;
  title: string;
  copy: string;
  tint: string;
  children: ReactNode;
}) {
  return (
    <div className="gizmo-card flex h-full flex-col p-5 sm:p-6">
      <span className={cn("grid size-11 place-items-center rounded-2xl", tint)}>
        {icon}
      </span>
      <h3 className="mt-4 font-display text-[1.12rem] font-semibold text-brand-ink">
        {title}
      </h3>
      <p className="mt-1 text-[0.88rem] leading-relaxed text-muted-foreground">{copy}</p>
      <div className="mt-4 flex-1">{children}</div>
    </div>
  );
}

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const startHref = isAuthenticated ? "/dashboard" : "/auth?returnTo=%2Fdashboard";
  const startLabel = isAuthenticated ? "Open dashboard" : "Create your workspace";

  return (
    <div className="min-h-screen bg-background text-brand-ink">
      <header className="sticky top-0 z-50 border-b border-border bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-[70px] w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Brand />

          <nav className="hidden items-center gap-7 text-[0.9rem] font-medium text-muted-foreground md:flex">
            <a href="#pipeline" className="transition-colors hover:text-brand-ink">
              How it works
            </a>
            <a href="#outputs" className="transition-colors hover:text-brand-ink">
              What you get
            </a>
            <a href="#workspace" className="transition-colors hover:text-brand-ink">
              Workspace
            </a>
            <a href="#questions" className="transition-colors hover:text-brand-ink">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2">
            {!isAuthenticated && (
              <Button
                asChild
                variant="ghost"
                className="hidden h-10 rounded-full px-4 text-[0.88rem] font-semibold text-brand-ink/75 hover:bg-brand-panel hover:text-brand-ink sm:inline-flex"
              >
                <Link to="/auth?returnTo=/dashboard">Sign in</Link>
              </Button>
            )}
            <Button
              asChild
              className="h-10 rounded-full bg-[#191B27] px-5 text-[0.88rem] font-semibold text-white hover:bg-[#2A2D3E]"
            >
              <Link to={startHref}>
                {isAuthenticated ? "Dashboard" : "Get started"}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 -top-32 size-[26rem] rounded-full bg-[#EDE7FF] blur-3xl" />
        <div className="pointer-events-none absolute -right-32 top-24 size-[22rem] rounded-full bg-[#FFE9F2] blur-3xl" />

        <div className="relative mx-auto grid w-full max-w-6xl gap-14 px-4 pb-24 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:pb-28">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <Eyebrow>
              <Sparkles className="size-3.5" />
              A private study workspace
            </Eyebrow>

            <h1 className="mt-5 text-[3rem] font-extrabold leading-[0.98] tracking-[-0.04em] sm:text-[4rem] lg:text-[4.4rem]">
              Notes in.
              <br />
              <span className="text-brand-pink">Revision out.</span>
            </h1>

            <p className="mt-6 max-w-[33rem] text-[1.02rem] leading-relaxed text-muted-foreground">
              Bluprint reads your lecture photos, screen recordings and pasted notes, then
              builds a summary, flashcards, a quiz and exam-style questions. Everything saved
              in one private workspace for you and your friends.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full bg-[#191B27] px-6 text-[0.95rem] font-semibold text-white hover:bg-[#2A2D3E]"
              >
                <Link to={startHref}>
                  {startLabel}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-border bg-white px-6 text-[0.95rem] font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
              >
                <a href="#pipeline">See how it works</a>
              </Button>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.82rem] font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-brand-mint" /> Sign in with an email code
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-brand-mint" /> Sets stay private
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-brand-mint" /> No setup to start
              </span>
            </div>
          </motion.div>

          <HeroPreview />
        </div>
      </section>

      {/* Pipeline */}
      <section id="pipeline" className="border-y border-border bg-white/60">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <Reveal className="max-w-2xl">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-4 text-[2rem] font-extrabold leading-tight tracking-[-0.03em] sm:text-[2.6rem]">
              Upload once. Revise all week.
            </h2>
            <p className="mt-3 max-w-xl text-[1rem] leading-relaxed text-muted-foreground">
              Bluprint extracts the source, builds every revision material in one run, and
              keeps the set saved so you can come back to it later.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Bring your notes",
                copy: "Add photos of handwritten notes, a screen recording of a lecture, or paste text directly. Images are compressed in the browser; video is sampled into frames before upload.",
                tint: "bg-[#F3ECFF] text-[#7C5CFF]",
                icon: <Camera className="size-5" />,
              },
              {
                step: "2",
                title: "Bluprint builds it",
                copy: "A vision model reads the source, then a text model writes a structured summary, ten flashcards, five quiz questions and three written exam questions.",
                tint: "bg-[#E9F0FF] text-[#3B82F6]",
                icon: <Layers className="size-5" />,
              },
              {
                step: "3",
                title: "Practise and get marked",
                copy: "Flip cards and rate your recall, take the quiz with explanations, then answer exam questions and get marked against a marking guide.",
                tint: "bg-[#FFE9F2] text-[#EC4899]",
                icon: <PenLine className="size-5" />,
              },
            ].map((step, index) => (
              <Reveal key={step.step} delay={index * 0.06}>
                <div className="gizmo-card flex h-full flex-col p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "grid size-10 place-items-center rounded-2xl",
                        step.tint,
                      )}
                    >
                      {step.icon}
                    </span>
                    <span className="text-[0.78rem] font-semibold text-muted-foreground">
                      Step {step.step}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-[1.15rem] font-semibold text-brand-ink">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-[0.9rem] leading-relaxed text-muted-foreground">
                    {step.copy}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1}>
            <div className="gizmo-card mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#E9FBF3] text-[#12B8A6]">
                  <ShieldCheck className="size-5" />
                </span>
                <div>
                  <p className="text-[0.95rem] font-semibold text-brand-ink">
                    Your notes never leave your account
                  </p>
                  <p className="mt-0.5 text-[0.83rem] leading-relaxed text-muted-foreground">
                    Uploads, sets and scores are private to the account that created them.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {["Photos", "Video frames", "Pasted text"].map((source) => (
                  <span
                    key={source}
                    className="rounded-full bg-brand-panel px-2.5 py-1 text-[0.76rem] font-medium text-brand-ink/70"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Outputs */}
      <section id="outputs" className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <Reveal className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <Eyebrow>What you get</Eyebrow>
              <h2 className="mt-4 text-[2rem] font-extrabold leading-tight tracking-[-0.03em] sm:text-[2.6rem]">
                Four ways to test yourself.
              </h2>
              <p className="mt-3 max-w-xl text-[1rem] leading-relaxed text-muted-foreground">
                Every set is built from the same source, so the summary, cards, quiz and exam
                questions always match what you actually uploaded.
              </p>
            </div>
            <p className="rounded-full bg-brand-panel px-3 py-1.5 text-[0.78rem] font-semibold text-brand-ink/70">
              19 materials per set
            </p>
          </Reveal>

          <div className="mt-9 grid gap-4 sm:grid-cols-2">
            <Reveal>
              <OutputCard
                icon={<FileText className="size-5" />}
                title="A summary you can skim"
                copy="An overview, the points worth remembering and likely exam angles."
                tint="bg-[#F3ECFF] text-[#7C5CFF]"
              >
                <div className="rounded-2xl bg-brand-panel/70 p-4">
                  <p className="text-[0.7rem] font-semibold text-muted-foreground">
                    Overview
                  </p>
                  <p className="mt-1.5 text-[0.86rem] leading-relaxed text-brand-ink/75">
                    Aerobic respiration converts glucose into ATP. Most ATP is produced by
                    oxidative phosphorylation in the mitochondria.
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {[
                      "Cristae increase inner-membrane surface area.",
                      "Glycolysis occurs in the cytoplasm.",
                      "The Krebs cycle runs in the mitochondrial matrix.",
                    ].map((point) => (
                      <p
                        key={point}
                        className="flex items-start gap-2 text-[0.82rem] leading-relaxed text-muted-foreground"
                      >
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-pink/70" />
                        {point}
                      </p>
                    ))}
                  </div>
                </div>
              </OutputCard>
            </Reveal>

            <Reveal delay={0.05}>
              <OutputCard
                icon={<Layers className="size-5" />}
                title="Flashcards for recall"
                copy="Ten focused cards per set. Mark each one as known or bring it back."
                tint="bg-[#E9FBF3] text-[#12B8A6]"
              >
                <div className="rounded-2xl bg-brand-panel/70 p-4">
                  <div className="flex items-center justify-between text-[0.72rem] font-semibold text-muted-foreground">
                    <span>Card 4 of 10</span>
                    <span className="text-brand-mint">Known</span>
                  </div>
                  <p className="mt-3 text-[0.92rem] font-semibold leading-relaxed text-brand-ink/85">
                    Where does the Krebs cycle take place?
                  </p>
                  <p className="mt-2 border-t border-border pt-2 text-[0.84rem] leading-relaxed text-brand-mint">
                    In the mitochondrial matrix.
                  </p>
                </div>
              </OutputCard>
            </Reveal>

            <Reveal delay={0.02}>
              <OutputCard
                icon={<ListChecks className="size-5" />}
                title="Quizzes that explain"
                copy="Multiple choice with a short reason for every answer, right or wrong."
                tint="bg-[#E9F0FF] text-[#3B82F6]"
              >
                <div className="rounded-2xl bg-brand-panel/70 p-4">
                  <p className="text-[0.88rem] font-semibold leading-relaxed text-brand-ink/85">
                    What do cristae increase?
                  </p>
                  <div className="mt-2.5 space-y-1.5">
                    {["Membrane surface area", "DNA content", "Cell volume"].map(
                      (option, index) => (
                        <div
                          key={option}
                          className={cn(
                            "flex items-center justify-between rounded-xl px-3 py-1.5 text-[0.82rem]",
                            index === 0
                              ? "bg-[#E9FBF3] font-medium text-brand-mint"
                              : "bg-white text-muted-foreground",
                          )}
                        >
                          {option}
                          {index === 0 && <Check className="size-3.5" />}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </OutputCard>
            </Reveal>

            <Reveal delay={0.07}>
              <OutputCard
                icon={<PenLine className="size-5" />}
                title="Exam answers, marked"
                copy="Answer in full sentences. Bluprint marks against the guide and shows what's missing."
                tint="bg-[#FFF6E5] text-[#E8A317]"
              >
                <div className="rounded-2xl bg-brand-panel/70 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.72rem] font-semibold text-muted-foreground">
                      Question 2 · 10 marks
                    </span>
                    <span className="rounded-full bg-[#FFF6E5] px-2 py-0.5 text-[0.78rem] font-semibold text-[#B87700]">
                      7 / 10
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                    <div className="h-full w-[70%] rounded-full bg-brand-lime" />
                  </div>
                  <p className="mt-2.5 text-[0.82rem] leading-relaxed text-muted-foreground">
                    Strong structure. Add the proton gradient and ATP synthase to reach the
                    final marks.
                  </p>
                </div>
              </OutputCard>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Workspace */}
      <section id="workspace" className="border-b border-border bg-white/60">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <Reveal>
            <Eyebrow>Your workspace</Eyebrow>
            <h2 className="mt-4 max-w-lg text-[2rem] font-extrabold leading-tight tracking-[-0.03em] sm:text-[2.5rem]">
              Your dashboard. Your uploads. No shared folder.
            </h2>
            <p className="mt-3 max-w-lg text-[1rem] leading-relaxed text-muted-foreground">
              Everyone signs in with their own email code. Sets, scores and review progress
              stay with the account that created them — no shared folder and no accidental
              edits.
            </p>

            <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {[
                {
                  icon: <DeckGlyph className="size-6" color="#7C5CFF" />,
                  title: "Your dashboard",
                  copy: "Saved sets, mastered cards and quiz averages.",
                },
                {
                  icon: <Camera className="size-5 text-[#3B82F6]" />,
                  title: "Your content",
                  copy: "Upload photos, sample a video or paste notes.",
                },
                {
                  icon: <FileText className="size-5 text-[#EC4899]" />,
                  title: "Private by default",
                  copy: "Every request is scoped to the signed-in user.",
                },
                {
                  icon: <ShieldCheck className="size-5 text-[#12B8A6]" />,
                  title: "Server-side models",
                  copy: "The NVIDIA key never reaches the browser.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl bg-white p-4 soft-shadow">
                  {item.icon}
                  <p className="mt-2 text-[0.92rem] font-semibold text-brand-ink">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[0.82rem] leading-relaxed text-muted-foreground">
                    {item.copy}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="gizmo-card overflow-hidden p-3">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[0.82rem] font-semibold text-brand-ink">
                  Your decks
                </span>
                <span className="rounded-full bg-brand-panel px-2 py-0.5 text-[0.7rem] font-semibold text-muted-foreground">
                  3 saved
                </span>
              </div>
              <div className="space-y-1.5">
                {[
                  { title: "Cell biology", color: "#7C5CFF", meta: "10 cards · 5 quiz" },
                  { title: "Organic chemistry", color: "#12B8A6", meta: "10 cards · 5 quiz" },
                  { title: "Macroeconomics", color: "#F472B6", meta: "10 cards · 5 quiz" },
                ].map((deck) => (
                  <div
                    key={deck.title}
                    className="flex items-center gap-3 rounded-2xl bg-brand-panel/60 px-3 py-2.5"
                  >
                    <DeckGlyph className="size-7" color={deck.color} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.9rem] font-semibold text-brand-ink">
                        {deck.title}
                      </p>
                      <p className="text-[0.75rem] text-muted-foreground">{deck.meta}</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[0.72rem] font-semibold text-[#5B3DF5]">
                      Ready
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-2xl bg-[#F3ECFF] p-4">
                <p className="text-[0.85rem] font-semibold text-[#4A32C9]">
                  Model access is handled for you
                </p>
                <p className="mt-1 text-[0.8rem] leading-relaxed text-[#5B3DF5]/80">
                  NVIDIA_API_KEY is read on the server and never exposed to the browser.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section id="questions" className="border-b border-border">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.72fr_1.28fr]">
          <Reveal>
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="mt-4 text-[2rem] font-extrabold leading-tight tracking-[-0.03em] sm:text-[2.4rem]">
              Details that matter.
            </h2>
            <p className="mt-3 max-w-xs text-[0.95rem] leading-relaxed text-muted-foreground">
              Built to run for a handful of friends with one shared NVIDIA key.
            </p>
            <div className="mt-6 flex items-start gap-3 rounded-2xl bg-white p-4 soft-shadow">
              <Mascot size={54} float={false} />
              <p className="text-[0.85rem] leading-relaxed text-muted-foreground">
                If a build fails, the set keeps its extracted notes and gives you a retry.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <Accordion type="single" collapsible className="w-full">
              {[
                {
                  q: "What can I upload?",
                  a: "JPG or PNG photos of printed or handwritten notes, a video (six frames are sampled in your browser), or text pasted directly. Each set is built from one source upload.",
                },
                {
                  q: "Who can see my study sets?",
                  a: "Only you. Sign-in uses an email one-time code, and every query checks ownership before returning a set, card, quiz or score.",
                },
                {
                  q: "Where do the NVIDIA API keys live?",
                  a: "Only in the server environment, under NVIDIA_API_KEY. You can supply several keys in that value; Bluprint rotates through them on each request and never sends one to the browser.",
                },
                {
                  q: "What happens when a build fails?",
                  a: "The set is marked failed with the model's error. Your extracted notes and uploaded images are kept, and retrying re-runs generation without a new upload.",
                },
                {
                  q: "Does it work on a phone?",
                  a: "Yes. The workspace collapses to a mobile header and menu, and the app can be installed from your browser's add-to-home-screen action.",
                },
              ].map((item) => (
                <AccordionItem
                  key={item.q}
                  value={item.q}
                  className="mb-2 rounded-2xl border border-border bg-white px-4 last:mb-0"
                >
                  <AccordionTrigger className="py-4 text-left font-display text-[0.98rem] font-semibold text-brand-ink hover:no-underline">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="max-w-xl pb-4 text-[0.88rem] leading-relaxed text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-[#F3ECFF] px-6 py-10 sm:px-10 sm:py-12">
            <div className="pointer-events-none absolute -right-10 -top-16 size-64 rounded-full bg-white/50 blur-2xl" />
            <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <p className="text-[0.78rem] font-semibold text-[#5B3DF5]">
                  Ready when you are
                </p>
                <h2 className="mt-3 max-w-xl text-[2rem] font-extrabold leading-tight tracking-[-0.03em] text-brand-ink sm:text-[2.6rem]">
                  Turn your notes into something you can practise.
                </h2>
                <p className="mt-3 max-w-lg text-[0.95rem] leading-relaxed text-brand-ink/60">
                  Start with one page. Bluprint handles the extraction, structure and marking;
                  your sets stay saved for the next session.
                </p>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 rounded-full bg-[#191B27] px-6 text-[0.95rem] font-semibold text-white hover:bg-[#2A2D3E]"
                  >
                    <Link to={startHref}>
                      {startLabel}
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="h-12 rounded-full border-[#DED3FF] bg-white px-6 text-[0.95rem] font-semibold text-[#4A32C9] shadow-none hover:bg-white/70"
                  >
                    <Link to="/auth?returnTo=/dashboard">
                      I already have an account
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="flex justify-center">
                <Mascot size={220} />
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
          <Brand />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.85rem] font-medium text-muted-foreground">
            <a href="#pipeline" className="hover:text-brand-ink">
              How it works
            </a>
            <a href="#outputs" className="hover:text-brand-ink">
              What you get
            </a>
            <a href="#workspace" className="hover:text-brand-ink">
              Workspace
            </a>
            <Link to={startHref} className="hover:text-brand-ink">
              {isAuthenticated ? "Dashboard" : "Sign in"}
            </Link>
          </div>
          <p className="text-[0.78rem] text-muted-foreground/70">Built for a small group</p>
        </div>
      </footer>
    </div>
  );
}
