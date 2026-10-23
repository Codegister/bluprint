/** Small display helpers shared by the dashboard and study-set pages. */

export function relativeDate(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export function sourceLabel(sourceType: "text" | "photos" | "video"): string {
  if (sourceType === "photos") return "Photos";
  if (sourceType === "video") return "Video";
  return "Pasted notes";
}

/** First letter for the little avatar bubble. */
export function initialFor(name?: string | null, email?: string | null): string {
  const source = name?.trim() || email?.trim() || "?";
  return source.charAt(0).toUpperCase();
}

export function displayName(
  name?: string | null,
  email?: string | null,
): string {
  if (name?.trim()) return name.trim();
  if (email?.trim()) return email.split("@")[0];
  return "friend";
}

export function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}
