import type { Doc } from "@/convex/_generated/dataModel";

export type RevisionPlan = Doc<"revisionPlans">;
export type RevisionEntry = RevisionPlan["entries"][number];

/**
 * Subject colours are assigned by course order, so a subject keeps the same
 * colour across the grid, the day cards and the legend. All classes are written
 * out in full here so Tailwind can see them.
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
      SUBJECT_COLORS[index % SUBJECT_COLORS.length],
    ]),
  );
}

export function addDaysKey(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Monday of the week containing `value`, using ISO weekdays. */
export function startOfWeek(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  return addDaysKey(value, -offset);
}

export function formatTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const suffix = hour >= 12 ? "pm" : "am";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${suffix}`;
}

/** 24-hour clock used by the timetable grid, e.g. 17:05. */
export function formatTime24(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

export function formatTimeRange(startMinutes: number, duration: number): string {
  return `${formatTime24(startMinutes)}–${formatTime24(startMinutes + duration)}`;
}

/**
 * Legacy fallback only. Plans built before the day-off budget was asked for
 * used a simple 1.5–2× school-day figure; this reproduces that so those
 * timetables still report the capacity they were actually built with. New
 * plans store the chosen `dayOffMinutes` and never call this.
 */
export function extendedDailyMinutes(
  schoolDayMinutes: number,
  minSessionMinutes = 25,
): number {
  return Math.max(
    Math.round((schoolDayMinutes * 2) / 5) * 5,
    schoolDayMinutes + minSessionMinutes,
  );
}

export function formatDayHeading(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  });
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

export type TimetableDay = {
  date: string;
  label: string;
  dayNumber: string;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  isSchoolHoliday: boolean;
  schoolHolidayName: string | null;
  isExamDay: boolean;
  entries: RevisionEntry[];
  minutes: number;
};

export type TimetableWeek = {
  weekStart: string;
  label: string;
  days: TimetableDay[];
  minutes: number;
};

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Builds complete Monday-to-Sunday weeks so the grid reads like a calendar,
 * including days with no sessions and bank holidays.
 */
export function buildTimetableWeeks(plan: RevisionPlan): TimetableWeek[] {
  const entriesByDate = new Map<string, RevisionEntry[]>();
  for (const entry of plan.entries) {
    const list = entriesByDate.get(entry.date) ?? [];
    list.push({ ...entry });
    entriesByDate.set(entry.date, list);
  }
  for (const list of entriesByDate.values()) {
    list.sort((a, b) => (a.startMinutes ?? 0) - (b.startMinutes ?? 0));
    // Plans built before start times existed get sequential times for display
    // rather than every session appearing at the same moment.
    let clock = plan.startMinutes ?? 17 * 60;
    for (const entry of list) {
      if (entry.startMinutes === undefined) {
        entry.startMinutes = clock;
      }
      clock = Math.max(clock, entry.startMinutes + entry.minutes);
    }
  }

  const holidaysByDate = new Map(
    (plan.holidays ?? []).map((holiday) => [holiday.date, holiday.name]),
  );
  const schoolHolidaysByDate = new Map(
    (plan.schoolHolidays ?? []).map((holiday) => [holiday.date, holiday.name]),
  );
  const lastEntryDate = plan.entries.reduce(
    (latest, entry) => (entry.date > latest ? entry.date : latest),
    plan.startDate,
  );
  // Include the first exam when it lands in the week straight after the last
  // revision day, so the calendar ends on the exam rather than cutting off.
  const includeExamWeek =
    plan.examDate > lastEntryDate && plan.examDate <= addDaysKey(lastEntryDate, 6);
  const firstWeek = startOfWeek(plan.startDate);
  const lastWeek = startOfWeek(includeExamWeek ? plan.examDate : lastEntryDate);
  const weeks: TimetableWeek[] = [];

  for (
    let weekStart = firstWeek;
    weekStart <= lastWeek;
    weekStart = addDaysKey(weekStart, 7)
  ) {
    const days: TimetableDay[] = WEEKDAY_NAMES.map((_, offset) => {
      const date = addDaysKey(weekStart, offset);
      const entries = entriesByDate.get(date) ?? [];
      const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
      return {
        date,
        label: formatDayLabel(date),
        dayNumber: new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en-GB", {
          day: "numeric",
          timeZone: "UTC",
        }),
        isWeekend: weekday === 0 || weekday === 6,
        isHoliday: holidaysByDate.has(date),
        holidayName: holidaysByDate.get(date) ?? null,
        isSchoolHoliday: schoolHolidaysByDate.has(date),
        schoolHolidayName: schoolHolidaysByDate.get(date) ?? null,
        isExamDay: date === plan.examDate,
        entries,
        minutes: entries.reduce((sum, entry) => sum + entry.minutes, 0),
      };
    });
    weeks.push({
      weekStart,
      label: `Week of ${formatDayLabel(weekStart)}`,
      days,
      minutes: days.reduce((sum, day) => sum + day.minutes, 0),
    });
  }

  return weeks;
}

