import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SectionOption } from "@/lib/pathwaySections";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useState } from "react";

/**
 * Combines a run of consecutive pathway topics into one study set, starting
 * from the topic the student tapped.
 *
 * The options are the real topics still ahead on the pathway, so a course with
 * ten topics offers ten, never the server's twelve-topic limit. One topic is
 * the normal set; combining is an optional way to revise a whole area at once.
 *
 * The caller gives this a `key` per topic, so choosing a different topic starts
 * the count at one again without an effect resetting it after a render.
 */
export function PathwaySectionsDialog({
  open,
  onOpenChange,
  options,
  busy,
  onBuild,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: SectionOption[];
  busy: boolean;
  onBuild: (sections: number) => void;
}) {
  const [count, setCount] = useState(1);

  const total = options.length;
  const chosen = options.slice(0, Math.min(count, total));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto rounded-[1.75rem] border-border bg-white p-0 shadow-none sm:max-w-lg">
        <div className="px-6 pt-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold text-brand-ink">
              Combine topics
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Build one set from this topic onwards. Pick how many topics it
              should cover; Bluprint reads them in order and builds a summary,
              flashcards, a quiz and exam practice from them together.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6">
          <p className="mt-5 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-chrome-7">
            Topics in this set
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {Array.from({ length: total }, (_, index) => index + 1).map((value) => {
              const selected = value === Math.min(count, total);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  disabled={busy}
                  onClick={() => setCount(value)}
                  className={cn(
                    "grid size-9 place-items-center rounded-full border text-sm font-semibold tabular-nums transition-colors",
                    selected
                      ? "border-[#191B27] bg-[#191B27] text-white"
                      : "border-border bg-white text-brand-ink/70 hover:bg-brand-panel",
                  )}
                >
                  {value}
                </button>
              );
            })}
          </div>

          <ul className="mt-4 space-y-1.5">
            {chosen.map((option, index) => (
              <li
                key={option.id}
                className="flex items-start gap-2.5 rounded-2xl bg-[#FCFCFD] px-3 py-2.5"
              >
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-panel text-[0.66rem] font-semibold tabular-nums text-chrome-7">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.82rem] font-semibold leading-snug text-brand-ink">
                    {option.title}
                  </span>
                  <span className="block text-[0.7rem] leading-snug text-muted-foreground">
                    {option.unit}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[0.68rem] leading-relaxed text-muted-foreground">
            {chosen.length === 1
              ? `One topic makes a normal set. This course has ${total} topic${total === 1 ? "" : "s"} from here.`
              : `${chosen.length} of ${total} topics from here are combined into one set, in pathway order. A longer set builds more cards and questions so every topic is covered.`}
            {total === 1 ? " This is the last topic on the pathway." : ""}
          </p>

          <DialogFooter className="mt-5 flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
              className="h-11 rounded-full border-border bg-white px-5 text-sm font-semibold text-brand-ink shadow-none hover:bg-brand-panel"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => onBuild(chosen.length)}
              disabled={busy || chosen.length === 0}
              className="h-11 rounded-full bg-[#191B27] px-5 text-sm font-semibold text-white hover:bg-[#2A2D3E]"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {chosen.length === 1
                ? "Build 1 topic"
                : `Build set from ${chosen.length} topics`}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
