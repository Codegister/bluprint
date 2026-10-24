import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // A study set is one uploaded bundle of notes plus everything Bluprint
    // generated from it. `notes` is the plain text extracted from photos/video
    // or pasted directly, so the source material survives between sessions.
    studySets: defineTable({
      userId: v.id("users"),
      title: v.string(),
      notes: v.string(),
      sourceType: v.union(
        v.literal("text"),
        v.literal("photos"),
        v.literal("video"),
      ),
      sourceLabel: v.optional(v.string()),
      // Free-text course label picked when the set is created (e.g. "Biology").
      // Used to group and filter decks the way StudySmarter and Gizmo do.
      course: v.optional(v.string()),
      // Exam context picked alongside the course. The board and level steer
      // how exam questions are phrased and how written answers are marked.
      examBoard: v.optional(v.string()),
      level: v.optional(v.string()),
      // Set when material was built from a topic on a course pathway. The
      // original course is kept so progress can be shown on the course page.
      courseId: v.optional(v.id("courses")),
      topicId: v.optional(v.string()),
      // Photos (or video frames) are kept in Convex file storage so the
      // original material can be revisited from the set page.
      sourceImageIds: v.array(v.id("_storage")),
      status: v.union(
        v.literal("queued"),
        v.literal("processing"),
        v.literal("ready"),
        v.literal("error"),
      ),
      progress: v.optional(v.string()),
      // 0–100 for the build screen. Written as each stage and batch finishes,
      // so the bar reflects real work instead of a fixed animation.
      progressPercent: v.optional(v.number()),
      errorMessage: v.optional(v.string()),
      // Explains a build that hit the material's realistic limit or where one
      // section failed, without hiding the sections that did generate.
      generationNote: v.optional(v.string()),
      summary: v.optional(
        v.object({
          overview: v.string(),
          keyPoints: v.array(v.string()),
          examFocus: v.array(v.string()),
        }),
      ),
      cardCount: v.number(),
      quizCount: v.number(),
      examCount: v.number(),
      // How many items the student asked for. Keeping the request means a
      // rebuild produces the same length instead of dropping back to defaults.
      targetCardCount: v.optional(v.number()),
      targetQuizCount: v.optional(v.number()),
      targetExamCount: v.optional(v.number()),
      knownCount: v.number(),
      updatedAt: v.number(),
      processingStartedAt: v.optional(v.number()),
      lastStudiedAt: v.optional(v.number()),
      lastQuizScore: v.optional(v.number()),
      lastQuizTotal: v.optional(v.number()),
    })
      .index("by_user_updated", ["userId", "updatedAt"])
      .index("by_course", ["courseId", "updatedAt"]),

    // A course pathway is the second way into Bluprint: instead of uploading
    // notes, a student picks their qualification and the AI lays out the whole
    // specification as units and topics. Topics are ordered, tagged with the
    // specification reference, and can be expanded into a study set on demand.
    courses: defineTable({
      userId: v.id("users"),
      subject: v.string(),
      level: v.string(),
      examBoard: v.string(),
      // GCSE uses Higher/Foundation, and IB uses HL/SL. `variant` stores the
      // route (HL or SL) separately so a course can read "IB · HL" the way the
      // boards describe it.
      tier: v.optional(v.string()),
      variant: v.optional(v.string()),
      // English Language/Literature poetry anthology studied at GCSE. Kept as
      // free text so older courses and other qualifications still load.
      poetryTheme: v.optional(v.string()),
      status: v.union(
        v.literal("queued"),
        v.literal("processing"),
        v.literal("ready"),
        v.literal("error"),
      ),
      progress: v.optional(v.string()),
      errorMessage: v.optional(v.string()),
      processingStartedAt: v.optional(v.number()),
      pathway: v.optional(
        v.object({
          overview: v.string(),
          examFormat: v.string(),
          units: v.array(
            v.object({
              title: v.string(),
              summary: v.string(),
              topics: v.array(
                v.object({
                  id: v.string(),
                  title: v.string(),
                  specReference: v.optional(v.string()),
                  summary: v.string(),
                  keyPoints: v.array(v.string()),
                  examSkill: v.string(),
                }),
              ),
            }),
          ),
        }),
      ),
      // Topic ids the student has marked as revised.
      completedTopics: v.array(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      lastStudiedAt: v.optional(v.number()),
    }).index("by_user_updated", ["userId", "updatedAt"]),

    // One saved revision timetable per account. Dates are UTC calendar keys
    // (YYYY-MM-DD) so a plan renders the same day regardless of server timezone.
    revisionPlans: defineTable({
      userId: v.id("users"),
      startDate: v.string(),
      // The start the student asked for. When every topic would not fit before
      // the first exam, the plan begins earlier and startDate is that earlier
      // date; this keeps the original so the timetable can explain the change.
      requestedStartDate: v.optional(v.string()),
      examDate: v.string(),
      // Legacy: plans built before the per-subject grid used one session length.
      sessionMinutes: v.optional(v.number()),
      dailyMinutes: v.optional(v.number()),
      // Capacity used on bank holidays, weekends and school holidays. Stored so
      // the timetable shows the budget it was actually built with, not today's
      // multiplier.
      dayOffMinutes: v.optional(v.number()),
      // Minutes from midnight, e.g. 16 * 60 for a 16:00 start.
      startMinutes: v.optional(v.number()),
      daysPerWeek: v.number(),
      courseSettings: v.optional(
        v.array(
          v.object({
            courseId: v.id("courses"),
            subject: v.string(),
            minutes: v.number(),
            // Paper 1, Paper 2, or Both. Entries store the resolved paper.
            paper: v.string(),
          }),
        ),
      ),
      entries: v.array(
        v.object({
          date: v.string(),
          courseId: v.id("courses"),
          course: v.string(),
          unit: v.string(),
          topicId: v.string(),
          topic: v.string(),
          minutes: v.number(),
          paper: v.optional(v.string()),
          startMinutes: v.optional(v.number()),
          // Gap after this session, equal to the session itself. Absent on the
          // last session of a day, because there is nothing to break before.
          breakMinutes: v.optional(v.number()),
        }),
      ),
      // UK bank holidays in the plan window, shown in empty day columns.
      holidays: v.optional(
        v.array(
          v.object({
            date: v.string(),
            name: v.string(),
          }),
        ),
      ),
      // Typical England school breaks. These get the same extra capacity as a
      // weekend, unlike bank holidays, which are skipped.
      schoolHolidays: v.optional(
        v.array(
          v.object({
            date: v.string(),
            name: v.string(),
          }),
        ),
      ),
      topicTotal: v.number(),
      scheduledTopics: v.number(),
      // True when the plan stops at the session cap before the exam date.
      truncated: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    flashcards: defineTable({
      setId: v.id("studySets"),
      userId: v.id("users"),
      front: v.string(),
      back: v.string(),
      order: v.number(),
      // "new" cards have not been reviewed yet.
      status: v.union(v.literal("new"), v.literal("known"), v.literal("again")),
      reviewCount: v.number(),
      lastReviewedAt: v.optional(v.number()),
      // Lightweight SM-2 scheduling. Missing values mean "due now", which is
      // how cards created before scheduling existed are treated.
      dueAt: v.optional(v.number()),
      intervalDays: v.optional(v.number()),
      ease: v.optional(v.number()),
    }).index("by_set", ["setId"]),

    quizQuestions: defineTable({
      setId: v.id("studySets"),
      userId: v.id("users"),
      question: v.string(),
      options: v.array(v.string()),
      correctIndex: v.number(),
      explanation: v.string(),
      order: v.number(),
    }).index("by_set", ["setId"]),

    // Exam-style questions are answered in full sentences and marked by the
    // NVIDIA model against the stored marking guide.
    examQuestions: defineTable({
      setId: v.id("studySets"),
      userId: v.id("users"),
      question: v.string(),
      marks: v.number(),
      modelAnswer: v.string(),
      markingGuide: v.array(v.string()),
      order: v.number(),
      userAnswer: v.optional(v.string()),
      awardedMarks: v.optional(v.number()),
      feedback: v.optional(v.string()),
      gradedAt: v.optional(v.number()),
    }).index("by_set", ["setId"]),

    quizAttempts: defineTable({
      setId: v.id("studySets"),
      userId: v.id("users"),
      score: v.number(),
      total: v.number(),
      completedAt: v.number(),
    }).index("by_set", ["setId"]),

    // Saved AI tutor conversation for one set. Replayed as context so a
    // follow-up question still makes sense after a reload or a new session.
    tutorMessages: defineTable({
      setId: v.id("studySets"),
      userId: v.id("users"),
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      createdAt: v.number(),
    }).index("by_set", ["setId"]),

    // Tutor conversation pointed at a whole course, or at one unit of it. The
    // scope is the pair (courseId, unitTitle); a missing unitTitle means the
    // whole course. Kept apart from per-set threads so the two never blend.
    courseTutorMessages: defineTable({
      userId: v.id("users"),
      courseId: v.id("courses"),
      unitTitle: v.optional(v.string()),
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      createdAt: v.number(),
    }).index("by_course", ["courseId"]),

    // One row per person per calendar day (UTC) so the dashboard can show a
    // daily review goal and a streak without storing every review event.
    studyDays: defineTable({
      userId: v.id("users"),
      day: v.string(),
      cardsReviewed: v.number(),
      updatedAt: v.number(),
    }).index("by_user_day", ["userId", "day"]),


    // tableName: defineTable({
    //   ...
    //   // table fields
    // }).index("by_field", ["field"])
  },
  {
    schemaValidation: false,
  },
);

export default schema;
