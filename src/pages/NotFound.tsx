import { Brand } from "@/components/Brand";
import { Mascot } from "@/components/Mascot";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Brand />
        <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-muted-foreground">
          Page not found
        </span>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-[2rem] border border-border bg-card p-8 text-center"
        >
          <Mascot size={140} className="mx-auto" />
          <h1 className="mt-2 font-display text-[1.6rem] font-bold text-brand-ink">
            This page went missing
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-[0.9rem] leading-relaxed text-muted-foreground">
            The link may have moved, or it never existed. Head back to your dashboard
            and pick up where you left off.
          </p>
          <Button
            asChild
            className="mt-6 h-11 rounded-full bg-[#191B27] px-6 font-semibold text-white hover:bg-[#2A2D3E]"
          >
            <Link to="/dashboard">Back to home</Link>
          </Button>
        </motion.div>
      </main>
    </div>
  );
}
