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

/**
 * A count with its noun in the right number: "1 mark", "2 marks". Every
 * count-driven label goes through here so the app never prints "1 marks".
 */
export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

/** "1 mark" / "3 marks" — the label used on every marking row and header. */
export function markLabel(marks: number): string {
  return plural(marks, "mark");
}

/** "1 clear point" / "3 clear points" — the guidance under an answer box. */
export function pointLabel(points: number): string {
  return plural(points, "clear point");
}

/** Local calendar date for an `<input type="date">`, without UTC drift. */
export function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Noon avoids DST making a calendar date render as the previous day. */
export function dateFromInput(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function daysUntilInput(value: string): number {
  const target = dateFromInput(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
