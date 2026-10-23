import { Brand } from "@/components/Brand";
import { BlueprintGlyph, BlueprintMark } from "@/components/BlueprintMark";
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
  CheckCircle2,
  Database,
  FileText,
  GitBranch,
  KeyRound,
  Layers,
  ListChecks,
  Lock,
  PenLine,
  ScanLine,
  ShieldCheck,
  SquareTerminal,
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
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionLabel({
  index,
  children,
}: {
  index: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[11px] text-brand-pink">{index}</span>
      <span className="h-px w-8 bg-border" />
      <span className="mono-label text-muted-foreground">{children}</span>
    </div>
  );
}

function HeroConsole() {
  const [revealed, setRevealed] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      <div className="pointer-events-none absolute -inset-10 blueprint-grid opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      <BlueprintGlyph
        size={420}
        className="pointer-events-none absolute -right-24 -top-24 hidden opacity-[0.13] lg:block"
      />

      <div className="relative rounded-xl border border-border bg-card/95">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="size-2 rounded-full bg-brand-peach/70" />
            <span className="size-2 rounded-full bg-brand-lime/70" />
            <span className="size-2 rounded-full bg-brand-mint/70" />
          </div>
          <span className="font-mono text-[10px] tracking-wide text-muted-foreground">
            bluprint / compile
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[9px] font-medium tracking-[0.14em] text-brand-mint">
            <span className="size-1.5 rounded-full bg-brand-mint" />
            READY
          </span>
        </div>

        <div className="space-y-1.5 px-4 py-4 font-mono text-[11px] leading-6 sm:px-5">
          <p className="text-brand-ink">
            <span className="text-muted-foreground">$</span> bpr compile
            ./notes/cell-biology
          </p>
          <p className="text-muted-foreground">
            <span className="text-brand-mint">✓</span> extract
            <span className="float-right text-brand-ink/70">8 pages · 1,842 chars</span>
          </p>
          <p className="text-muted-foreground">
            <span className="text-brand-mint">✓</span> summarise
            <span className="float-right text-brand-ink/70">overview + 7 points</span>
          </p>
          <p className="text-muted-foreground">
            <span className="text-brand-mint">✓</span> generate
            <span className="float-right text-brand-ink/70">10 cards · 5 quiz · 3 exam</span>
          </p>
          <p className="text-brand-pink">
            <span className="text-muted-foreground">&gt;</span> set_7f2a ready
            <span className="animate-caret ml-1 inline-block h-3 w-[6px] bg-brand-pink align-middle" />
          </p>
        </div>

        <div className="border-t border-border p-3 sm:p-4">
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            className="block w-full rounded-lg border border-border bg-brand-panel p-4 text-left transition-colors hover:border-brand-pink/30 sm:p-5"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground">
                CARD 03 / 10
              </span>
              <span className="rounded border border-brand-sky/25 bg-brand-sky/10 px-1.5 py-0.5 font-mono text-[9px] tracking-wide text-brand-sky">
                BIOLOGY
              </span>
            </div>
            <p className="mt-4 font-display text-[1.2rem] font-medium leading-snug text-brand-ink sm:text-[1.35rem]">
              Why does the mitochondrion have folded inner membranes?
            </p>
            <motion.div
              key={revealed ? "answer" : "prompt"}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 min-h-[44px]"
            >
              {revealed ? (
                <p className="text-[13px] leading-relaxed text-brand-mint">
                  Cristae increase the surface area available to the electron transport
                  chain, so more ATP is produced.
                </p>
              ) : (
                <p className="font-mono text-[10px] tracking-wide text-muted-foreground">
                  [ hidden — click to reveal ]
                </p>
              )}
            </motion.div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="font-mono text-[9px] text-muted-foreground">
                {revealed ? "SELF-ASSESSED" : "ACTIVE RECALL"}
              </span>
              <span className="font-mono text-[9px] text-brand-pink">
                {revealed ? "HIDE ANSWER" : "REVEAL ANSWER"} →
              </span>
            </div>
          </button>
        </div>
      </div>

      <div className="absolute -bottom-3 left-4 right-4 flex items-center justify-between gap-2 rounded-lg border border-border bg-brand-panel/95 px-3 py-2 backdrop-blur sm:left-6 sm:right-6">
        <span className="font-mono text-[9px] tracking-[0.12em] text-muted-foreground">
          OUTPUT
        </span>
        <div className="flex flex-wrap gap-1.5">
          {["summary.md", "cards.json", "quiz.json", "exam.md"].map((file) => (
            <span
              key={file}
              className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[9px] text-brand-ink/60"
            >
              {file}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function OutputCard({
  label,
  icon,
  title,
  copy,
  accent,
  children,
}: {
  label: string;
  icon: ReactNode;
  title: string;
  copy: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className={cn("h-px w-full", accent)} />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="mono-label text-muted-foreground">{label}</p>
            <h3 className="mt-2 font-display text-lg font-semibold text-brand-ink">
              {title}
            </h3>
          </div>
          <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-brand-panel text-muted-foreground [&_svg]:size-4">
            {icon}
          </span>
        </div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{copy}</p>
        <div className="mt-4 flex-1">{children}</div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const startHref = isAuthenticated ? "/dashboard" : "/auth";
  const startLabel = isAuthenticated ? "Open dashboard" : "Create your workspace";

  return (
    <div className="min-h-screen bg-background text-brand-ink">
      <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-7">
            <Brand />
            <span className="hidden h-4 w-px bg-border sm:block" />
            <span className="hidden font-mono text-[10px] tracking-[0.14em] text-muted-foreground sm:block">
              NOTES IN / REVISION OUT
            </span>
          </div>

          <nav className="hidden items-center gap-6 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground md:flex">
            <a href="#pipeline" className="transition-colors hover:text-brand-ink">
              Pipeline
            </a>
            <a href="#outputs" className="transition-colors hover:text-brand-ink">
              Outputs
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
                className="hidden h-9 rounded-md px-3 font-mono text-[11px] tracking-wide text-muted-foreground hover:bg-brand-panel hover:text-brand-ink sm:inline-flex"
              >
                <Link to="/auth?returnTo=/dashboard">Sign in</Link>
              </Button>
            )}
            <Button
              asChild
              className="h-9 rounded-md bg-brand-pink px-4 font-mono text-[11px] font-medium tracking-wide text-brand-void hover:bg-brand-pink-deep"
            >
              <Link to={startHref}>
                {isAuthenticated ? "Dashboard" : "Get started"}
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 blueprint-grid opacity-40 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -left-40 top-0 size-[28rem] rounded-full bg-brand-pink/[0.06] blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-0 size-[26rem] rounded-full bg-brand-lime/[0.04] blur-3xl" />

        <div className="relative mx-auto grid w-full max-w-6xl gap-16 px-4 pb-24 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.04fr_0.96fr] lg:items-center lg:pb-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center gap-2 rounded border border-border bg-brand-panel/70 px-2.5 py-1.5 font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-brand-mint" />
              A PRIVATE REVISION COMPILER
            </div>

            <h1 className="display-tight mt-6 max-w-[13ch] text-[3.1rem] font-semibold leading-[0.98] sm:text-[4.2rem] lg:text-[4.8rem]">
              Notes in.
              <br />
              <span className="text-brand-pink">Revision out.</span>
            </h1>

            <p className="mt-6 max-w-[34rem] text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              Bluprint reads your lecture photos, screen recordings and pasted notes, then
              compiles a summary, flashcards, a quiz and exam-style questions. A private
              workspace for you and your friends.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                asChild
                size="lg"
                className="h-11 rounded-md bg-brand-pink px-5 font-mono text-[12px] font-medium tracking-wide text-brand-void hover:bg-brand-pink-deep"
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
                className="h-11 rounded-md border-border bg-transparent px-5 font-mono text-[12px] tracking-wide text-brand-ink hover:bg-brand-panel"
              >
                <a href="#pipeline">Inspect the pipeline</a>
              </Button>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] tracking-wide text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Check className="size-3 text-brand-mint" /> EMAIL-CODE AUTH
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3 text-brand-mint" /> PRIVATE SETS
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3 text-brand-mint" /> NVIDIA MODELS
              </span>
            </div>

            <div className="mt-7 flex flex-wrap gap-1.5">
              {[
                { icon: <Camera className="size-3" />, label: "PHOTOS" },
                { icon: <Video className="size-3" />, label: "VIDEO FRAMES" },
                { icon: <FileText className="size-3" />, label: "PASTED TEXT" },
              ].map((source) => (
                <span
                  key={source.label}
                  className="inline-flex items-center gap-1.5 rounded border border-border bg-brand-panel/60 px-2 py-1 font-mono text-[9px] tracking-[0.1em] text-muted-foreground"
                >
                  {source.icon}
                  {source.label}
                </span>
              ))}
            </div>
          </motion.div>

          <HeroConsole />
        </div>
      </section>

      {/* Pipeline */}
      <section id="pipeline" className="border-b border-border bg-brand-panel/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <Reveal className="max-w-2xl">
            <SectionLabel index="01">The pipeline</SectionLabel>
            <h2 className="display-tight mt-4 text-3xl font-semibold sm:text-[2.5rem]">
              Three passes. No manual formatting.
            </h2>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
              Upload once. Bluprint extracts the source, generates every revision artifact
              in one run, and keeps the set saved so you can return to it later.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="relative">
              <div className="absolute bottom-6 left-[19px] top-6 w-px bg-gradient-to-b from-brand-pink/40 via-border to-transparent" />
              <div className="space-y-3">
                {[
                  {
                    step: "01",
                    title: "Ingest",
                    copy: "Add photos of handwritten notes, a screen recording of a lecture, or paste text directly. Images are compressed in the browser; video is sampled into frames before upload.",
                    meta: "PHOTOS · VIDEO · TEXT",
                    icon: <ScanLine className="size-4" />,
                  },
                  {
                    step: "02",
                    title: "Compile",
                    copy: "An NVIDIA vision model reads the source. A text model then writes a structured summary, ten flashcards, five multiple-choice questions and three written exam questions.",
                    meta: "EXTRACT → STRUCTURE → GENERATE",
                    icon: <GitBranch className="size-4" />,
                  },
                  {
                    step: "03",
                    title: "Practise",
                    copy: "Flip cards and rate your recall, take the quiz with explanations, then answer exam questions and get marked against a marking guide.",
                    meta: "REVIEW · QUIZ · MARKING",
                    icon: <PenLine className="size-4" />,
                  },
                ].map((step, index) => (
                  <Reveal key={step.step} delay={index * 0.05}>
                    <div className="relative flex gap-4 rounded-lg border border-border bg-card p-4 sm:p-5">
                      <div className="relative z-10 grid size-10 shrink-0 place-items-center rounded-md border border-brand-pink/25 bg-brand-panel text-brand-pink">
                        {step.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="font-mono text-[10px] text-brand-pink">
                            {step.step}
                          </span>
                          <h3 className="font-display text-lg font-semibold text-brand-ink">
                            {step.title}
                          </h3>
                          <span className="font-mono text-[9px] tracking-[0.1em] text-muted-foreground">
                            {step.meta}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                          {step.copy}
                        </p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>

            <Reveal delay={0.08}>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
                    BUILD MANIFEST
                  </span>
                  <span className="rounded bg-brand-mint/10 px-1.5 py-0.5 font-mono text-[9px] tracking-wide text-brand-mint">
                    READY
                  </span>
                </div>
                <div className="space-y-3 p-4">
                  <div className="space-y-1 font-mono text-[10.5px]">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">source</span>
                      <span className="truncate text-brand-ink/75">./cell-biology</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">model</span>
                      <span className="text-brand-ink/75">nvidia / text</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">artifacts</span>
                      <span className="text-brand-ink/75">19</span>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-border pt-3">
                    {[
                      ["summary", "3 sections", "bg-brand-pink"],
                      ["flashcards", "10 cards", "bg-brand-mint"],
                      ["quiz", "5 questions", "bg-brand-sky"],
                      ["exam", "3 questions", "bg-brand-lime"],
                    ].map(([label, detail, color]) => (
                      <div key={label} className="flex items-center gap-2.5">
                        <span className={cn("size-1.5 shrink-0 rounded-full", color)} />
                        <span className="flex-1 font-mono text-[10.5px] text-brand-ink/70">
                          {label}
                        </span>
                        <span className="font-mono text-[9.5px] text-muted-foreground">
                          {detail}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-md border border-border bg-background px-3 py-2 font-mono text-[10px] text-muted-foreground">
                    <span className="text-brand-mint">✓</span> saved to your workspace
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Outputs */}
      <section id="outputs" className="border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <Reveal className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <SectionLabel index="02">Generated output</SectionLabel>
              <h2 className="display-tight mt-4 text-3xl font-semibold sm:text-[2.5rem]">
                Four ways to test yourself.
              </h2>
              <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
                Each set is compiled from the same source, so the summary, cards, quiz and
                exam questions stay aligned with what you actually uploaded.
              </p>
            </div>
            <p className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
              PER SET / 19 ARTIFACTS
            </p>
          </Reveal>

          <div className="mt-9 grid gap-3 sm:grid-cols-2">
            <Reveal>
              <OutputCard
                label="A / Summary"
                icon={<FileText />}
                title="A structured overview"
                copy="An overview, the points worth remembering and likely exam angles."
                accent="bg-brand-pink"
              >
                <div className="rounded-md border border-border bg-brand-panel px-3 py-3">
                  <p className="mono-label text-muted-foreground">OVERVIEW</p>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-brand-ink/70">
                    Aerobic respiration converts glucose into ATP. Most ATP is produced by
                    oxidative phosphorylation in the mitochondria.
                  </p>
                  <div className="mt-2.5 space-y-1.5">
                    {[
                      "Cristae increase inner-membrane surface area.",
                      "Glycolysis occurs in the cytoplasm.",
                      "The Krebs cycle runs in the mitochondrial matrix.",
                    ].map((point) => (
                      <p
                        key={point}
                        className="flex items-start gap-2 text-[10.5px] leading-relaxed text-muted-foreground"
                      >
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand-pink/70" />
                        {point}
                      </p>
                    ))}
                  </div>
                </div>
              </OutputCard>
            </Reveal>

            <Reveal delay={0.05}>
              <OutputCard
                label="B / Flashcards"
                icon={<Layers />}
                title="Recall, not recognition"
                copy="Ten focused cards per set. Mark each one as known or bring it back."
                accent="bg-brand-mint"
              >
                <div className="rounded-md border border-border bg-brand-panel p-3">
                  <div className="flex items-center justify-between font-mono text-[9px] tracking-wide text-muted-foreground">
                    <span>CARD 04 / 10</span>
                    <span className="text-brand-mint">KNOWN</span>
                  </div>
                  <p className="mt-3 text-[12.5px] font-medium leading-relaxed text-brand-ink/85">
                    Where does the Krebs cycle take place?
                  </p>
                  <p className="mt-2 border-t border-border pt-2 text-[11px] leading-relaxed text-brand-mint">
                    In the mitochondrial matrix.
                  </p>
                </div>
              </OutputCard>
            </Reveal>

            <Reveal delay={0.02}>
              <OutputCard
                label="C / Quiz"
                icon={<ListChecks />}
                title="Five questions, explained"
                copy="Multiple choice with a short reason for every answer — right or wrong."
                accent="bg-brand-sky"
              >
                <div className="rounded-md border border-border bg-brand-panel p-3">
                  <p className="text-[11.5px] font-medium leading-relaxed text-brand-ink/85">
                    What do cristae increase?
                  </p>
                  <div className="mt-2.5 space-y-1">
                    {["Membrane surface area", "DNA content", "Cell volume"].map(
                      (option, index) => (
                        <div
                          key={option}
                          className={cn(
                            "flex items-center justify-between rounded border px-2 py-1 text-[10.5px]",
                            index === 0
                              ? "border-brand-mint/30 bg-brand-mint/10 text-brand-mint"
                              : "border-border text-muted-foreground",
                          )}
                        >
                          {option}
                          {index === 0 && <Check className="size-3" />}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </OutputCard>
            </Reveal>

            <Reveal delay={0.07}>
              <OutputCard
                label="D / Exam marking"
                icon={<PenLine />}
                title="Written answers, marked"
                copy="Answer in full sentences. Bluprint marks against the guide and shows what's missing."
                accent="bg-brand-lime"
              >
                <div className="rounded-md border border-border bg-brand-panel p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] tracking-wide text-muted-foreground">
                      Q2 / 10 MARKS
                    </span>
                    <span className="rounded bg-brand-lime/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-brand-lime">
                      7 / 10
                    </span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
                    <div className="h-full w-[70%] rounded-full bg-brand-lime" />
                  </div>
                  <p className="mt-2.5 text-[10.5px] leading-relaxed text-muted-foreground">
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
      <section id="workspace" className="border-b border-border bg-brand-panel/30">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <Reveal>
            <SectionLabel index="03">Your workspace</SectionLabel>
            <h2 className="display-tight mt-4 max-w-lg text-3xl font-semibold sm:text-[2.5rem]">
              Your dashboard. Your uploads. No shared folder.
            </h2>
            <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-muted-foreground">
              Everyone signs in with their own email code. Sets, scores and review progress
              are scoped to the account that created them — no shared folder and no
              accidental edits.
            </p>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {[
                {
                  icon: <SquareTerminal className="size-4" />,
                  title: "Your dashboard",
                  copy: "Saved sets, mastered cards and quiz averages.",
                },
                {
                  icon: <Database className="size-4" />,
                  title: "Your content",
                  copy: "Upload photos, sample a video or paste notes.",
                },
                {
                  icon: <Lock className="size-4" />,
                  title: "Private by default",
                  copy: "Every query is scoped to the signed-in user.",
                },
                {
                  icon: <ShieldCheck className="size-4" />,
                  title: "Server-side models",
                  copy: "The NVIDIA key never reaches the browser.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-lg border border-border bg-card p-3.5"
                >
                  <span className="text-brand-pink">{item.icon}</span>
                  <p className="mt-2 text-[12.5px] font-medium text-brand-ink">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    {item.copy}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="mono-label text-muted-foreground">WORKSPACE SPEC</span>
                <span className="font-mono text-[9px] text-muted-foreground">v1.0</span>
              </div>
              <dl className="divide-y divide-border font-mono text-[10.5px]">
                {[
                  ["auth", "email one-time code"],
                  ["storage", "convex / file storage"],
                  ["models", "nvidia api"],
                  ["inputs", "jpg · png · mp4 · text"],
                  ["outputs", "summary · cards · quiz · exam"],
                  ["visibility", "private per account"],
                ].map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <dt className="text-muted-foreground">{key}</dt>
                    <dd className="text-right text-brand-ink/75">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="border-t border-border bg-brand-panel px-4 py-3">
                <p className="font-mono text-[9px] tracking-[0.12em] text-muted-foreground">
                  MODEL ACCESS
                </p>
                <p className="mt-1 font-mono text-[10.5px] text-brand-pink">
                  NVIDIA_API_KEY · rotated server-side
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section id="questions" className="border-b border-border">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.7fr_1.3fr]">
          <Reveal>
            <SectionLabel index="04">Questions</SectionLabel>
            <h2 className="display-tight mt-4 text-3xl font-semibold sm:text-[2.3rem]">
              Details that matter.
            </h2>
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
              Built to run for a handful of friends with one shared NVIDIA key.
            </p>
            <div className="mt-6 flex items-start gap-3 rounded-lg border border-border bg-card p-3">
              <BlueprintMark size={30} className="mt-0.5 text-brand-pink" />
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                If a run fails, the set keeps its extracted notes and gives you a retry.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <Accordion type="single" collapsible className="w-full">
              {[
                {
                  q: "What can I upload?",
                  a: "JPG or PNG photos of printed or handwritten notes, a video (six frames are sampled in your browser), or text pasted directly. Each set is compiled from one source upload.",
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
                <AccordionItem key={item.q} value={item.q} className="border-border">
                  <AccordionTrigger className="py-4 text-left font-display text-[15px] font-medium text-brand-ink hover:no-underline">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="max-w-xl pb-5 text-[12.5px] leading-relaxed text-muted-foreground">
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
          <div className="relative overflow-hidden rounded-xl border border-border bg-card">
            <div className="pointer-events-none absolute inset-0 blueprint-grid opacity-40" />
            <div className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-brand-pink/[0.08] blur-3xl" />
            <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <p className="mono-label text-brand-pink">READY WHEN YOU ARE</p>
                <h2 className="display-tight mt-3 max-w-xl text-3xl font-semibold sm:text-[2.6rem]">
                  Your notes are already the hard part. Compile them into something you can
                  practise.
                </h2>
                <p className="mt-3 max-w-lg text-[13.5px] leading-relaxed text-muted-foreground">
                  Start with one page. Bluprint handles the extraction, structure and
                  marking; your sets stay saved for the next session.
                </p>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                  <Button
                    asChild
                    size="lg"
                    className="h-11 rounded-md bg-brand-pink px-5 font-mono text-[12px] font-medium tracking-wide text-brand-void hover:bg-brand-pink-deep"
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
                    className="h-11 rounded-md border-border bg-transparent px-5 font-mono text-[12px] tracking-wide hover:bg-brand-panel"
                  >
                    <Link to="/auth?returnTo=/dashboard">
                      I already have an account
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="hidden justify-center lg:flex">
                <BlueprintGlyph size={280} className="opacity-70" />
              </div>
            </div>
            <div className="relative flex flex-wrap items-center justify-between gap-2 border-t border-border px-6 py-3 font-mono text-[9px] tracking-[0.12em] text-muted-foreground sm:px-10">
              <span>BLUPRINT / REVISION COMPILER</span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-brand-mint" />
                PIPELINE OPERATIONAL
              </span>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Brand />
            <span className="hidden h-4 w-px bg-border sm:block" />
            <p className="hidden font-mono text-[9px] tracking-[0.12em] text-muted-foreground sm:block">
              NOTES IN / REVISION OUT
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] tracking-wide text-muted-foreground">
            <a href="#pipeline" className="hover:text-brand-ink">
              PIPELINE
            </a>
            <a href="#outputs" className="hover:text-brand-ink">
              OUTPUTS
            </a>
            <a href="#workspace" className="hover:text-brand-ink">
              WORKSPACE
            </a>
            <Link to={startHref} className="hover:text-brand-ink">
              {isAuthenticated ? "DASHBOARD" : "SIGN IN"}
            </Link>
          </div>
          <p className="font-mono text-[9px] tracking-[0.1em] text-muted-foreground/60">
            BUILT FOR A SMALL GROUP
          </p>
        </div>
      </footer>
    </div>
  );
}
