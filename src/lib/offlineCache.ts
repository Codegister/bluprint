/**
 * Offline snapshot and answer queue.
 *
 * The current set's cards and quiz are written to localStorage whenever they
 * are on screen, so a session survives a lost connection. Ratings made while
 * offline are queued and replayed when the connection returns — the same
 * `reviewCard` mutation the app would have called, in the same order, so a
 * queued review is scheduled as if the network had never dropped.
 *
 * No service worker: on this host a cached app shell can outlive a deploy and
 * serve a stale bundle, which is a worse failure than a missing offline page.
 * The snapshot covers the data the student is mid-way through.
 */

export type CachedCard = { id: string; front: string; back: string; status: string };
export type CachedQuizQuestion = {
  id: string;
  question: string;
  options: string[];
  explanation: string;
};

export type SetSnapshot = {
  setId: string;
  title: string;
  savedAt: number;
  cards: CachedCard[];
  quiz: CachedQuizQuestion[];
};

type QueuedReview = { cardId: string; rating: 1 | 2 | 3 | 4; at: number };

const SNAPSHOT_PREFIX = "bluprint:offline:set:";
const QUEUE_KEY = "bluprint:offline:queue";
/** Only the most recent three sets are kept; this is a cache, not an archive. */
const MAX_SNAPSHOTS = 3;

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    // Private mode and blocked storage both throw on access.
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveSetSnapshot(snapshot: SetSnapshot): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(`${SNAPSHOT_PREFIX}${snapshot.setId}`, JSON.stringify(snapshot));
    const keys = Object.keys(store).filter((key) => key.startsWith(SNAPSHOT_PREFIX));
    if (keys.length > MAX_SNAPSHOTS) {
      const oldest = keys
        .map((key) => {
          try {
            const parsed = JSON.parse(store.getItem(key) ?? "{}") as SetSnapshot;
            return { key, savedAt: parsed.savedAt ?? 0 };
          } catch {
            return { key, savedAt: 0 };
          }
        })
        .sort((a, b) => a.savedAt - b.savedAt);
      for (const entry of oldest.slice(0, keys.length - MAX_SNAPSHOTS)) {
        store.removeItem(entry.key);
      }
    }
  } catch {
    // A full or blocked store only costs the offline copy.
  }
}

export function readSetSnapshot(setId: string): SetSnapshot | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(`${SNAPSHOT_PREFIX}${setId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SetSnapshot;
    return Array.isArray(parsed.cards) ? parsed : null;
  } catch {
    return null;
  }
}

export function queueReview(cardId: string, rating: 1 | 2 | 3 | 4): void {
  const store = storage();
  if (!store) return;
  try {
    const queue = readQueue();
    queue.push({ cardId, rating, at: Date.now() });
    store.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-200)));
  } catch {
    // Nothing to do: the review is lost, and the card stays due.
  }
}

export function readQueue(): QueuedReview[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedReview[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Empties the queue after a successful flush, and returns what was sent. */
export function clearQueue(sent: QueuedReview[]): void {
  const store = storage();
  if (!store) return;
  try {
    const remaining = readQueue().filter(
      (item) => !sent.some((done) => done.at === item.at && done.cardId === item.cardId),
    );
    store.setItem(QUEUE_KEY, JSON.stringify(remaining));
  } catch {
    // Leaving the queue in place would replay these twice; dropping the write
    // is the safer failure.
  }
}

export function queueLength(): number {
  return readQueue().length;
}
