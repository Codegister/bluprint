/**
 * Dev-only data for the seeded signed-in preview.
 *
 * These are deliberately plain objects: the preview server aliases Convex's
 * query hooks to return them, while the screens themselves remain the real
 * Today and Timetable components.
 */

function dayKey(offset = 0): string {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

const now = Date.now();
const today = dayKey();

export const previewUser = {
  _id: "preview-user",
  name: "Sam Carter",
  email: "sam@example.com",
  isAnonymous: false,
} as const;

export const previewSets = [
  {
    _id: "preview-set-cell-biology",
    title: "Cell biology",
    course: "Biology",
    examBoard: "AQA",
    level: "GCSE",
    sourceType: "text",
    sourceLabel: "Class notes",
    status: "ready",
    cardCount: 42,
    quizCount: 8,
    examCount: 4,
    knownCount: 31,
    dueCount: 12,
    weakCount: 3,
    lastStudiedAt: now - 1000 * 60 * 60 * 5,
    updatedAt: now - 1000 * 60 * 60 * 5,
    createdAt: now - 1000 * 60 * 60 * 24 * 8,
    topicIds: ["bio-cells"],
    pace: null,
  },
  {
    _id: "preview-set-organic-chemistry",
    title: "Organic chemistry",
    course: "Chemistry",
    examBoard: "AQA",
    level: "GCSE",
    sourceType: "photos",
    sourceLabel: "Two photographed pages",
    status: "ready",
    cardCount: 28,
    quizCount: 6,
    examCount: 3,
    knownCount: 17,
    dueCount: 6,
    weakCount: 2,
    lastStudiedAt: now - 1000 * 60 * 60 * 27,
    updatedAt: now - 1000 * 60 * 60 * 27,
    createdAt: now - 1000 * 60 * 60 * 24 * 5,
    topicIds: ["chem-organic"],
    pace: null,
  },
];

export const previewPlan = {
  _id: "preview-plan",
  startDate: dayKey(-4),
  examDate: dayKey(18),
  dailyMinutes: 90,
  dayOffMinutes: 180,
  sessionMinutes: 45,
  startMinutes: 16 * 60,
  dayOffStartMinutes: 10 * 60,
  daysPerWeek: 5,
  studyMethod: "mixed",
  courseSettings: [
    { courseId: "preview-course-biology", subject: "Biology" },
    { courseId: "preview-course-chemistry", subject: "Chemistry" },
  ],
};

const sessions = [
  {
    id: "preview-session-1",
    kind: "topic",
    courseId: "preview-course-biology",
    topicId: "bio-cells",
    startMinutes: 16 * 60,
    minutes: 45,
    topic: "Cell structure and specialisation",
    course: "Biology",
    unit: "Cells and transport",
    done: true,
  },
  {
    id: "preview-session-2",
    kind: "topic",
    courseId: "preview-course-chemistry",
    topicId: "chem-organic",
    startMinutes: 17 * 60,
    minutes: 45,
    topic: "Crude oil and alkanes",
    course: "Chemistry",
    unit: "Organic chemistry",
    done: false,
  },
  {
    id: "preview-session-3",
    kind: "topic",
    courseId: "preview-course-biology",
    topicId: "bio-transport",
    startMinutes: 18 * 60 + 30,
    minutes: 45,
    topic: "Transport in cells",
    course: "Biology",
    unit: "Cells and transport",
    done: false,
    carriedFrom: dayKey(-1),
  },
];

export function previewDayView(date = today) {
  const days = Array.from({ length: 7 }, (_, index) => ({
    date: dayKey(index),
    count: index === 0 ? sessions.length : index === 1 ? 2 : 3,
    done: index === 0 ? 1 : 0,
  }));

  return {
    date,
    plan: previewPlan,
    day: { sessions },
    blocked: [
      {
        startMinutes: 19 * 60 + 30,
        endMinutes: 20 * 60 + 30,
        label: "Football training",
      },
    ],
    meals: [
      { label: "Lunch", startMinutes: 12 * 60, endMinutes: 12 * 60 + 45 },
      { label: "Dinner", startMinutes: 18 * 60, endMinutes: 18 * 60 + 30 },
    ],
    days,
    missed: 1,
    isDayOff: false,
    reason: null,
  };
}

export const previewFixtures = {
  studyStats: {
    items: {
      total: 72,
      correct: 54,
      cards: { total: 48, correct: 37 },
      quiz: { total: 18, correct: 13 },
      exam: { total: 6, correct: 4 },
    },
    goal: 30,
    streak: 12,
    goalReason: "A steady daily queue keeps the next exam in reach.",
    examInDays: 18,
    examTitle: "Biology Paper 1",
  },
  sets: previewSets,
  calibration: {
    sentence:
      "Your confidence is running a little ahead of your quiz accuracy. Rate the next few cards honestly and the two will meet.",
  },
  progressShares: [],
  accountExport: {
    email: previewUser.email,
    name: previewUser.name,
    exportedAt: now,
    streak: 12,
    sets: [],
  },
  aiStatus: { configured: true },
  courses: [],
  plan: previewPlan,
  today,
};
