/**
 * Subject colours and date/time formatting shared by the timetable builder and
 * the one-day-at-a-time timetable screen.
 */

/**
 * Subject shades are assigned by course order, so a subject keeps the same
 * metal tone on its session cards and in the legend. The palette is the nine
 * chrome steps; classes are written in full so Tailwind can see them.
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
    bar: "bg-chrome-8",
    tint: "bg-chrome-2",
    border: "border-chrome-4",
    text: "text-chrome-8",
    dot: "bg-chrome-8",
  },
  {
    bar: "bg-chrome-6",
    tint: "bg-chrome-3",
    border: "border-chrome-4",
    text: "text-chrome-7",
    dot: "bg-chrome-6",
  },
  {
    bar: "bg-chrome-4",
    tint: "bg-chrome-2",
    border: "border-chrome-4",
    text: "text-chrome-8",
    dot: "bg-chrome-4",
  },
  {
    bar: "bg-chrome-7",
    tint: "bg-chrome-3",
    border: "border-chrome-5",
    text: "text-chrome-8",
    dot: "bg-chrome-7",
  },
  {
    bar: "bg-chrome-5",
    tint: "bg-chrome-2",
    border: "border-chrome-4",
    text: "text-chrome-7",
    dot: "bg-chrome-5",
  },
  {
    bar: "bg-chrome-3",
    tint: "bg-chrome-2",
    border: "border-chrome-3",
    text: "text-chrome-8",
    dot: "bg-chrome-3",
  },
  {
    bar: "bg-chrome-8",
    tint: "bg-chrome-3",
    border: "border-chrome-5",
    text: "text-chrome-8",
    dot: "bg-chrome-8",
  },
  {
    bar: "bg-chrome-6",
    tint: "bg-chrome-2",
    border: "border-chrome-4",
    text: "text-chrome-7",
    dot: "bg-chrome-6",
  },
  {
    bar: "bg-chrome-5",
    tint: "bg-chrome-3",
    border: "border-chrome-4",
    text: "text-chrome-8",
    dot: "bg-chrome-5",
  },
  {
    bar: "bg-chrome-4",
    tint: "bg-chrome-2",
    border: "border-chrome-5",
    text: "text-chrome-7",
    dot: "bg-chrome-4",
  },
  {
    bar: "bg-chrome-7",
    tint: "bg-chrome-3",
    border: "border-chrome-4",
    text: "text-chrome-8",
    dot: "bg-chrome-7",
  },
  {
    bar: "bg-chrome-3",
    tint: "bg-chrome-2",
    border: "border-chrome-4",
    text: "text-chrome-8",
    dot: "bg-chrome-3",
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
