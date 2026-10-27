/**
 * Subject colours and date/time formatting shared by the timetable builder and
 * the one-day-at-a-time timetable screen.
 */

/**
 * Subject colours are assigned by course order, so a subject keeps the same
 * colour on its builder tile, its session cards and in the legend. The hues
 * come from the app's anodised accent slots and are mixed down for the tint,
 * which keeps light and dark mode readable without a second palette. Classes
 * are written in full so Tailwind can see them.
 */
export type SubjectColor = {
  bar: string;
  tint: string;
  border: string;
  text: string;
  dot: string;
};

export const SUBJECT_COLORS: SubjectColor[] = [
  {
    bar: "bg-brand-mint",
    tint: "bg-brand-mint/25",
    border: "border-brand-mint/50",
    text: "text-brand-mint",
    dot: "bg-brand-mint",
  },
  {
    bar: "bg-brand-peach",
    tint: "bg-brand-peach/25",
    border: "border-brand-peach/50",
    text: "text-brand-peach",
    dot: "bg-brand-peach",
  },
  {
    bar: "bg-brand-sky",
    tint: "bg-brand-sky/25",
    border: "border-brand-sky/50",
    text: "text-brand-sky",
    dot: "bg-brand-sky",
  },
  {
    bar: "bg-brand-violet",
    tint: "bg-brand-violet/25",
    border: "border-brand-violet/50",
    text: "text-brand-violet",
    dot: "bg-brand-violet",
  },
  {
    bar: "bg-brand-lime",
    tint: "bg-brand-lime/25",
    border: "border-brand-lime/50",
    text: "text-brand-lime",
    dot: "bg-brand-lime",
  },
  {
    bar: "bg-brand-teal",
    tint: "bg-brand-teal/25",
    border: "border-brand-teal/50",
    text: "text-brand-teal",
    dot: "bg-brand-teal",
  },
  {
    bar: "bg-brand-pink",
    tint: "bg-brand-pink/25",
    border: "border-brand-pink/50",
    text: "text-brand-pink",
    dot: "bg-brand-pink",
  },
];

export function colorForCourses(
  courseSettings: Array<{ courseId: string }>,
): Map<string, SubjectColor> {
  return new Map(
    courseSettings.map((setting, index) => [
      setting.courseId,
      SUBJECT_COLORS[index % SUBJECT_COLORS.length]!,
    ]),
  );
}

export function addDaysKey(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const suffix = hour >= 12 ? "pm" : "am";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${suffix}`;
}

/** 24-hour clock used by session cards, e.g. 17:05. */
export function formatTime24(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${hour.toString().padStart(2, "0")}:${minute
    .toString()
    .padStart(2, "0")}`;
}

export function formatTimeRange(startMinutes: number, duration: number): string {
  return `${formatTime24(startMinutes)}–${formatTime24(startMinutes + duration)}`;
}

/**
 * Reads a time typed into the block-time dialog. Accepts "18:00", "18.00",
 * "6pm" and "6:30 pm". Returns minutes from midnight, or null when the text is
 * not a clock time.
 */
export function parseTimeInput(value: string): number | null {
  const cleaned = value.trim().toLowerCase().replace(/\s+/g, "").replace(/\./g, ":");
  if (!cleaned) return null;
  const match = /^(\d{1,2})(?::?([0-5]\d))?(am|pm)?$/.exec(cleaned);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const suffix = match[3];
  if (suffix) {
    if (hour < 1 || hour > 12) return null;
    return ((hour % 12) + (suffix === "pm" ? 12 : 0)) * 60 + minute;
  }
  if (hour > 23) return null;
  return hour * 60 + minute;
}

export function formatDayLabel(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function formatLongDate(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
