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

export const previewCourse = {
  course: {
    _id: "previewcourse000000001",
    userId: "preview-user",
    subject: "Biology",
    examBoard: "AQA",
    level: "GCSE",
    tier: "Higher",
    status: "ready",
    completedTopics: ["bio-cells"],
    createdAt: now - 8 * 24 * 60 * 60 * 1000,
    updatedAt: now - 24 * 60 * 60 * 1000,
    pathway: {
      overview: "AQA GCSE Biology, split into cells, organisms and ecology.",
      examFormat: "Two written papers, each 1 hour 45 minutes.",
      source: "specification",
      version: 2,
      papers: [],
      units: [
        {
          title: "Cell biology",
          summary: "Cells, transport and cell division.",
          topics: [
            {
              id: "bio-cells",
              title: "Cell structure and transport",
              specReference: "4.1.1",
              summary: "The structure of cells and how substances move in and out.",
              keyPoints: [
                "Cells are the basic unit of living organisms.",
                "Cristae increase the surface area for ATP production.",
              ],
              examSkill: "Describe and explain structure-function links.",
            },
            {
              id: "bio-division",
              title: "Cell division",
              specReference: "4.1.2",
              summary: "Mitosis, meiosis and the cell cycle.",
              keyPoints: ["Mitosis produces genetically identical cells."],
              examSkill: "Compare mitosis and meiosis.",
            },
          ],
        },
        {
          title: "Organisation",
          summary: "Enzymes, digestion and transport systems.",
          topics: [
            {
              id: "bio-enzymes",
              title: "Enzymes and digestion",
              specReference: "4.2.1",
              summary: "Enzyme action and the digestive system.",
              keyPoints: ["Enzymes are biological catalysts."],
              examSkill: "Explain the effect of temperature on enzyme activity.",
            },
          ],
        },
      ],
    },
  },
  completedCount: 1,
  topicCount: 3,
  pathwayVersion: 2,
  sets: [
    {
      _id: "previewset000000000001",
      title: "Cell structure and transport",
      topicId: "bio-cells",
      topicIds: ["bio-cells"],
      status: "ready",
      sourceType: "text",
      sourceLabel: "Class notes",
      cardCount: 1,
      knownCount: 1,
      quizCount: 2,
      examCount: 1,
      updatedAt: now - 60 * 60 * 1000,
    },
  ],
  processingStale: false,
};

export const previewSet = {
  asOf: now,
  nextDueAt: now,
  set: {
    _id: "previewset000000000001",
    userId: "preview-user",
    title: "Cell structure and transport",
    status: "ready",
    sourceType: "text",
    sourceLabel: "Class notes",
    examBoard: "AQA",
    level: "GCSE",
    subject: "Biology",
    cardCount: 1,
    quizCount: 2,
    examCount: 1,
    knownCount: 1,
    dueCount: 1,
    weakCount: 0,
    notes:
      "Cells are the basic unit of living organisms. The inner membrane of a mitochondrion folds into cristae, increasing the surface area for ATP production.",
    summary: {
      keyPoints: [
        "Cells are the basic unit of living organisms.",
        "Cristae increase the surface area for ATP production.",
        "The inner membrane is folded, not smooth.",
      ],
    },
    progressPercent: 100,
    createdAt: now - 8 * 24 * 60 * 60 * 1000,
    updatedAt: now - 60 * 60 * 1000,
    examDate: dayKey(18),
    sourceImageIds: [],
  },
  cards: [
    {
      _id: "previewcard000000000001",
      setId: "previewset000000000001",
      order: 0,
      front: "Why does the inner membrane fold?",
      back: "Cristae increase the surface area for ATP production.",
      dueAt: now - 1000,
      reps: 2,
      stability: 3,
      status: "review",
    },
  ],
  quiz: [
    {
      _id: "previewquiz000000000001",
      setId: "previewset000000000001",
      order: 0,
      type: "mcq",
      question: "What does the folding of the inner membrane increase?",
      options: [
        "The surface area for ATP production",
        "The volume of the mitochondrion",
        "The number of ribosomes",
        "The rate of photosynthesis",
      ],
      correctIndex: 0,
      explanation:
        "Cristae increase the surface area available for ATP synthase, so more ATP is produced.",
      missCount: 0,
    },
    {
      _id: "previewquiz000000000002",
      setId: "previewset000000000001",
      order: 1,
      type: "mcq",
      question: "Which part of the cell controls what enters and leaves?",
      options: [
        "The cell membrane",
        "The nucleus",
        "The cytoplasm",
        "The ribosome",
      ],
      correctIndex: 0,
      explanation: "The cell membrane is selectively permeable.",
      missCount: 0,
    },
  ],
  exams: [
    {
      _id: "previewexam000000000001",
      _creationTime: now - 60 * 60 * 1000,
      setId: "previewset000000000001",
      userId: "preview-user",
      order: 0,
      question:
        "Explain how the inner membrane of a mitochondrion is adapted for ATP production.",
      marks: 4,
      modelAnswer:
        "The inner membrane folds into cristae, which increases the surface area for the electron transport chain and ATP synthase. More ATP can therefore be produced by oxidative phosphorylation.",
      markingGuide: [
        "The inner membrane folds into cristae.",
        "Folding increases the surface area.",
        "More ATP synthase / electron transport chain proteins can sit in the membrane.",
        "More ATP is produced by oxidative phosphorylation.",
      ],
      criteria: [
        {
          id: "crit-1",
          marks: 1,
          text: "The inner membrane folds into cristae.",
        },
        {
          id: "crit-2",
          marks: 1,
          text: "Folding increases the surface area.",
        },
        {
          id: "crit-3",
          marks: 1,
          text: "More ATP synthase / electron transport chain proteins can sit in the membrane.",
        },
        {
          id: "crit-4",
          marks: 1,
          text: "More ATP is produced by oxidative phosphorylation.",
        },
      ],
      specRef: "AQA 3.1.1",
      userAnswer:
        "The inner membrane folds into cristae. This gives more surface area for ATP synthase, so more ATP is produced.",
      awardedMarks: 3,
      feedback:
        "You named cristae and the increased surface area. The link to ATP synthase is there, but the answer does not explicitly mention oxidative phosphorylation.",
      checklist: [
        {
          point: "The inner membrane folds into cristae.",
          marks: 1,
          awarded: 1,
          evidence: "The inner membrane folds into cristae.",
        },
        {
          point: "Folding increases the surface area.",
          marks: 1,
          awarded: 1,
          evidence: "This gives more surface area",
        },
        {
          point:
            "More ATP synthase / electron transport chain proteins can sit in the membrane.",
          marks: 1,
          awarded: 1,
          evidence: "more surface area for ATP synthase",
        },
        {
          point: "More ATP is produced by oxidative phosphorylation.",
          marks: 1,
          awarded: 0,
          evidence: "so more ATP is produced",
        },
      ],
      gradedAt: now - 30 * 60 * 1000,
    },
  ],
  sourceImages: [],
  readiness: {
    score: 72,
    band: "building",
    parts: { recall: 70, quiz: null, exam: null },
    inputs: {
      cardsSettled: 1,
      cardsTotal: 1,
      quizCorrect: 0,
      quizTotal: 2,
      examEarned: 0,
      examTotal: 0,
    },
    weights: { recall: 60, quiz: 25, exam: 15 },
  },
  projected: {
    score: 78,
    band: "building",
    parts: { recall: 76, quiz: null, exam: null },
    inputs: {
      cardsSettled: 1,
      cardsTotal: 1,
      quizCorrect: 0,
      quizTotal: 2,
      examEarned: 0,
      examTotal: 0,
    },
    weights: { recall: 60, quiz: 25, exam: 15 },
  },
  pace: {
    examDate: dayKey(18),
    daysLeft: 18,
    remaining: 1,
    perDay: 0.1,
    quizPerWeek: 1,
    status: "on-track",
    projected: 78,
    target: 80,
  },
  dueCount: 1,
  weakCardCount: 0,
  weakQuizCount: 0,
  cardRepairNeeded: false,
  quizAnswered: 0,
  quizCorrect: 0,
  quizTotal: 2,
  processingStale: false,
};

export const previewPaper = {
  paper: {
    _id: "previewpaper000000000001",
    userId: "preview-user",
    courseId: "preview-course-biology",
    title: "AQA Biology Paper 1",
    status: "processing",
    progress: "Writing question 3 of 12",
    createdAt: now - 63_000,
    updatedAt: now - 1_000,
    processingStartedAt: now - 63_000,
    questionCount: 12,
    totalMarks: 60,
    durationMinutes: 105,
    answeredCount: 0,
    earnedMarks: 0,
  },
  course: {
    _id: "preview-course-biology",
    userId: "preview-user",
    subject: "Biology",
    examBoard: "AQA",
    level: "GCSE",
    tier: "Higher",
    status: "ready",
    createdAt: now - 8 * 24 * 60 * 60 * 1000,
    updatedAt: now - 24 * 60 * 60 * 1000,
    completedTopics: ["bio-cells"],
    pathway: {
      version: 2,
      units: [],
      papers: [],
    },
  },
  questions: [],
  processingStale: false,
};

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
