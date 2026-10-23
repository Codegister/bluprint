import { Brand } from "@/components/Brand";
import { BlueprintGlyph } from "@/components/BlueprintMark";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Brand />
        <span className="font-mono text-[9px] tracking-wide text-muted-foreground">
          HTTP 404
        </span>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-xl border border-border bg-card p-7 text-center sm:p-8"
        >
          <div className="mx-auto grid size-24 place-items-center rounded-lg border border-border bg-brand-panel">
            <BlueprintGlyph size={84} className="opacity-70" />
          </div>
          <p className="mt-5 mono-label text-brand-peach">404 / ROUTE NOT FOUND</p>
          <h1 className="mt-2 font-display text-2xl font-semibold">
            This route doesn't resolve.
          </h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
            The page may have moved or never existed. Return to the dashboard and continue
            from your saved sets.
          </p>
          <Button
            asChild
            className="mt-5 h-9 rounded-md bg-brand-pink px-4 font-mono text-[10.5px] font-medium tracking-wide text-brand-void hover:bg-brand-pink-deep"
          >
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </motion.div>
      </main>
    </div>
  );
}
