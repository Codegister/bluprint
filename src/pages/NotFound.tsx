import { Brand } from "@/components/Brand";
import { Pip } from "@/components/Pip";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-brand-cream">
      <header className="mx-auto flex h-[68px] w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Brand />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-[30px] border border-brand-ink/12 bg-white p-8 text-center"
        >
          <div className="mx-auto grid size-28 place-items-center rounded-[30px] border-2 border-brand-ink bg-brand-lime">
            <Pip size={96} mood="sleepy" cap />
          </div>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-ink/40">
            404 · page missing
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold">
            This page wandered off.
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-brand-ink/55">
            Pip checked the notes and it's definitely not here. Head back to your sets and
            carry on.
          </p>
          <Button
            asChild
            className="mt-5 h-10 rounded-xl border-2 border-brand-ink bg-brand-pink px-5 font-bold text-brand-ink hover:bg-brand-pink-deep hover:text-brand-cream"
          >
            <Link to="/dashboard">Back to my sets</Link>
          </Button>
        </motion.div>
      </main>
    </div>
  );
}
