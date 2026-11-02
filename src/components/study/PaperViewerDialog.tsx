import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExternalLink, FileText } from "lucide-react";

export type ViewedPaper = {
  url: string;
  title: string;
  /** "Question paper", "Mark scheme", … */
  kind: string;
};

/**
 * Shows a publisher's paper inside Bluprint.
 *
 * The publisher still serves the file: this is an embed, not a copy or a proxy.
 * The open-original link stays available for a board that blocks embedding.
 */
export function PaperViewerDialog({
  paper,
  onClose,
}: {
  paper: ViewedPaper | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={paper !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex h-[90vh] max-h-[90vh] w-[calc(100%-1rem)] max-w-5xl flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:w-[calc(100%-2rem)]">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-14 text-left">
          <DialogTitle className="flex items-center gap-2 font-display text-[1rem] font-bold text-brand-ink">
            <FileText className="size-4 shrink-0 text-[#B7791F]" aria-hidden />
            <span className="truncate">{paper?.title}</span>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem]">
            <span>{paper?.kind} hosted by the exam board.</span>
            {paper && (
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-brand-ink underline decoration-chrome-4 underline-offset-2 hover:text-[#8A5A12]"
              >
                Open original
                <ExternalLink className="size-3" aria-hidden />
              </a>
            )}
          </DialogDescription>
        </DialogHeader>

        {paper && (
          <iframe
            key={paper.url}
            src={paper.url}
            title={`${paper.title} — ${paper.kind}`}
            className="min-h-0 w-full flex-1 bg-white"
            allowFullScreen
          />
        )}

        <p className="shrink-0 border-t border-border bg-brand-panel px-5 py-2.5 text-[0.7rem] leading-relaxed text-muted-foreground">
          The paper stays on the publisher&apos;s server. If it does not appear,
          the board may block embedding — use Open original.
        </p>
      </DialogContent>
    </Dialog>
  );
}
