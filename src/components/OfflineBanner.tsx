import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  clearQueue,
  queueReview,
  readQueue,
  readSetSnapshot,
  saveSetSnapshot,
  type SetSnapshot,
} from "@/lib/offlineCache";
import { plural } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import { Check, CloudOff, Loader2, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { toast } from "sonner";

const RATINGS = [
  { value: 1, label: "Again", className: "bg-[#FFEEF0] text-[#A81F28]" },
  { value: 2, label: "Hard", className: "bg-[#FFF6E5] text-[#96650A]" },
  { value: 3, label: "Good", className: "bg-[#F3FBF7] text-[#0B6B45]" },
  { value: 4, label: "Easy", className: "bg-[#EAF3FF] text-[#17509B]" },
] as const;

/**
 * Keeps this set's cards on the device and shows an offline card to review.
 *
 * Mounted once in the app shell, so it works on any page. It watches the route
 * for a set, snapshots the set while it is on screen, and when the connection
 * drops it offers the cached cards. A rating made offline is queued and sent the
 * moment the connection returns (or when the tab comes back online).
 */
export function OfflineBanner() {
  const location = useLocation();
  const setIdParam = /^\/sets\/([a-z0-9]{20,40})/i.exec(location.pathname)?.[1] ?? null;
  const details = useQuery(
    api.studySets.getDetails,
    setIdParam ? { setId: setIdParam as Id<"studySets"> } : "skip",
  );
  const save = useMutation(api.studySets.reviewCard);

  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [open, setOpen] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [queued, setQueued] = useState(0);
  const [flushing, setFlushing] = useState(false);

  const snapshot: SetSnapshot | null = useMemo(() => {
    if (!details) return null;
    return {
      setId: details.set._id,
      title: details.set.title,
      savedAt: Date.now(),
      cards: details.cards.map((card) => ({
        id: card._id,
        front: card.front,
        back: card.back,
        status: card.status,
      })),
      quiz: details.quiz.map((question) => ({
        id: question._id,
        question: question.question,
        options: question.options,
        explanation: question.explanation,
      })),
    };
  }, [details]);

  // Snapshot whenever a set is on screen, so leaving the page does not take the
  // copy with it.
  useEffect(() => {
    if (snapshot) saveSetSnapshot(snapshot);
  }, [snapshot]);

  // Queue length is read on mount and whenever the tab flips offline/online.
  useEffect(() => {
    setQueued(readQueue().length);
    const goOffline = () => setOnline(false);
    const goOnline = () => {
      setOnline(true);
      void flush();
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flush = async () => {
    const queue = readQueue();
    if (queue.length === 0) return;
    setFlushing(true);
    try {
      for (const item of queue) {
        await save({
          cardId: item.cardId as Id<"flashcards">,
          rating: item.rating,
        });
      }
      clearQueue(queue);
      setQueued(0);
      toast.success(
        `${plural(queue.length, "review")} synced from your offline session.`,
      );
    } catch {
      // Still offline or the sync failed: keep the queue for the next attempt.
      setQueued(readQueue().length);
    } finally {
      setFlushing(false);
    }
  };

  const cached = setIdParam ? readSetSnapshot(setIdParam) : null;
  const cards = cached?.cards ?? [];
  const current = cards[cardIndex];

  const rate = (rating: 1 | 2 | 3 | 4) => {
    if (!current) return;
    queueReview(current.id, rating);
    setQueued(readQueue().length);
    setRevealed(false);
    setCardIndex((index) => (index + 1 < cards.length ? index + 1 : 0));
  };

  if (online && queued === 0) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto mb-3 w-[min(96%,42rem)]">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 shadow-lg">
          <p className="flex items-center gap-2 text-[0.78rem] font-semibold text-brand-ink">
            <CloudOff className="size-4 text-chrome-7" aria-hidden />
            {online
              ? `${plural(queued, "review")} waiting to sync`
              : cards.length > 0
                ? `Offline — ${plural(cards.length, "cached card")} ready`
                : "Offline — nothing cached for this set yet"}
          </p>
          <div className="flex items-center gap-2">
            {queued > 0 && online && (
              <Button
                variant="ghost"
                onClick={() => void flush()}
                disabled={flushing}
                className="h-8 rounded-full px-3 text-[0.72rem] font-semibold"
              >
                {flushing ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <RotateCcw className="size-3.5" aria-hidden />
                )}
                Sync now
              </Button>
            )}
            {cards.length > 0 && (
              <Button
                onClick={() => setOpen(true)}
                className="h-8 rounded-full px-3 text-[0.72rem] font-semibold"
              >
                Review offline
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {cached?.title ?? "Cached cards"}
            </DialogTitle>
            <DialogDescription>
              From the copy saved on this device. Ratings are queued and sync when
              you are back online.
            </DialogDescription>
          </DialogHeader>

          {current ? (
            <div>
              <p className="text-[0.72rem] font-semibold text-muted-foreground">
                Card {cardIndex + 1} of {cards.length}
              </p>
              <p className="mt-2 font-display text-[1.05rem] font-bold text-brand-ink">
                {current.front}
              </p>
              {revealed ? (
                <>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-brand-ink/80">
                    {current.back}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {RATINGS.map((rating) => (
                      <button
                        key={rating.value}
                        type="button"
                        onClick={() => rate(rating.value)}
                        className={`rounded-xl px-3 py-2 text-[0.78rem] font-semibold ${rating.className}`}
                      >
                        {rating.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <Button
                  onClick={() => setRevealed(true)}
                  className="mt-3 h-9 rounded-full px-4 text-sm font-semibold"
                >
                  <Check className="size-4" aria-hidden />
                  Show the answer
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No cards cached yet. Open the set while connected and it will be saved
              here.
            </p>
          )}

          <div className="flex items-center justify-between">
            <p className="text-[0.72rem] text-muted-foreground">
              {queued > 0 ? `${plural(queued, "review")} queued` : "Nothing queued"}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[0.74rem] font-semibold text-muted-foreground hover:bg-brand-panel"
            >
              <X className="size-3.5" aria-hidden />
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
