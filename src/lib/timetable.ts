/**
 * Subject colours and date/time formatting shared by the timetable builder and
 * the one-day-at-a-time timetable screen.
 */

/**
 * Subject colours are assigned by course order, so a subject keeps the same
 * colour on its session cards and in the legend. All classes are written out in
 * full here so Tailwind can see them.
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
    bar: "bg-[#0E8C7F]",
    tint: "bg-[#E4F6F2]",
    border: "border-[#B6E4DB]",
    text: "text-[#0A655C]",
    dot: "bg-[#0E8C7F]",
  },
  {
    bar: "bg-[#4C5FD5]",
    tint: "bg-[#EAECFB]",
    border: "border-[#C6CCF3]",
    text: "text-[#3846A8]",
    dot: "bg-[#4C5FD5]",
  },
  {
    bar: "bg-[#B7791F]",
    tint: "bg-[#FAF1DF]",
    border: "border-[#EBD6AB]",
    text: "text-[#8A5A12]",
    dot: "bg-[#B7791F]",
  },
  {
    bar: "bg-[#C2466A]",
    tint: "bg-[#FAE9EF]",
    border: "border-[#EDC4D2]",
    text: "text-[#98304F]",
    dot: "bg-[#C2466A]",
  },
  {
    bar: "bg-[#6B4DBE]",
    tint: "bg-[#F0EBFA]",
    border: "border-[#D6C8F0]",
    text: "text-[#513897]",
    dot: "bg-[#6B4DBE]",
  },
  {
    bar: "bg-[#2B7FB8]",
    tint: "bg-[#E6F2F9]",
    border: "border-[#BFDDEF]",
    text: "text-[#206390]",
    dot: "bg-[#2B7FB8]",
  },
  {
    bar: "bg-[#5F7A1F]",
    tint: "bg-[#F0F4E3]",
    border: "border-[#D3DEB2]",
    text: "text-[#4A6016]",
    dot: "bg-[#5F7A1F]",
  },
  {
    bar: "bg-[#C2622A]",
    tint: "bg-[#FBEDE4]",
    border: "border-[#EECDBA]",
    text: "text-[#97491E]",
    dot: "bg-[#C2622A]",
  },
  {
    bar: "bg-[#8C4A86]",
    tint: "bg-[#F7ECF6]",
    border: "border-[#E4C6E1]",
    text: "text-[#6D3768]",
    dot: "bg-[#8C4A86]",
  },
  {
    bar: "bg-[#5A6B7B]",
    tint: "bg-[#EEF1F4]",
    border: "border-[#CDD6DE]",
    text: "text-[#445361]",
    dot: "bg-[#5A6B7B]",
  },
  {
    bar: "bg-[#3F7D5A]",
    tint: "bg-[#EAF4EE]",
    border: "border-[#C3DFCF]",
    text: "text-[#2E5D42]",
    dot: "bg-[#3F7D5A]",
  },
  {
    bar: "bg-[#8A6D1F]",
    tint: "bg-[#F7F2E1]",
    border: "border-[#E2D5AC]",
    text: "text-[#6A5315]",
    dot: "bg-[#8A6D1F]",
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
