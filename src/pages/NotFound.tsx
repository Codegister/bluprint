import { Brand } from "@/components/Brand";
import { ChromeBackdrop } from "@/components/ChromeBackdrop";
import { Mascot } from "@/components/Mascot";
import { enter } from "@/components/motion/Motion";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <ChromeBackdrop intensity={0.9} />
      <header className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Brand />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-20">
        <motion.div
          className="chrome-plate w-full max-w-md rounded-[2rem] p-8 text-center"
          {...enter(0.04, 16)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          >
            <Mascot size={140} className="mx-auto" />
          </motion.div>
          <h1 className="chrome-title mt-2 font-display text-[1.6rem] font-bold">
            This page went missing
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-[0.9rem] leading-relaxed text-muted-foreground">
            The link may have moved, or it never existed. Head back to your tutor
            and pick up where you left off.
          </p>
          <Button asChild className="mt-6 h-11 px-6">
            <Link to="/tutor">Back to home</Link>
          </Button>
        </motion.div>
      </main>
    </div>
  );
}
