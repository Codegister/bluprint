import { enter } from "@/components/motion/Motion";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * The one page header.
 *
 * Every top-level screen opens on the same plate, with the same rhythm:
 * eyebrow (optional), title, one-line description, then the screen's single
 * primary action on the right. Sharing the frame is what makes moving between
 * screens feel like turning pages in one book rather than opening panels.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <motion.header
      className={cn(
        "chrome-plate flex flex-wrap items-end justify-between gap-4 rounded-[1.6rem] px-5 py-5",
        className,
      )}
      {...enter(0.04, 10)}
    >
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="mono-label text-chrome-7">{eyebrow}</p>}
        <h1 className="mt-1 font-display text-[1.65rem] font-extrabold leading-tight tracking-[-0.035em] text-brand-ink sm:text-[2rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-xl text-[0.88rem] leading-relaxed text-brand-ink/65">
            {description}
          </p>
        )}
        {children}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
          {actions}
        </div>
      )}
    </motion.header>
  );
}
