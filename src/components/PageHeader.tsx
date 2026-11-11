import { enter } from "@/components/motion/Motion";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * The editorial masthead used by every signed-in screen.
 *
 * It is intentionally not a card. The page is a sheet of paper; the title sits
 * directly on it, with one rule underneath and the actions aligned to the
 * baseline. That gives every route the same hierarchy without boxing it in.
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
      className={cn("page-masthead", className)}
      {...enter(0.04, 10)}
    >
      <div className="page-masthead-copy">
        {eyebrow && (
          <p className="page-kicker">
            <span className="page-kicker-dot" aria-hidden />
            {eyebrow}
          </p>
        )}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
        {children}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </motion.header>
  );
}
