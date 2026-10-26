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
      // Edexcel splits GCSE Religious Studies into A (Faith and Practice) and B
      // (Beliefs in Action). The route, religions and paper/Area of Study
      // choices change the units, so they are stored on the course.
      rsRoute: v.optional(v.string()),
      rsReligion: v.optional(v.string()),
      // Both routes need a second religion: RS A examines it in Paper 2 and
      // RS B takes each Area of Study with a different religion.
      rsReligion2: v.optional(v.string()),
      rsSpec: v.optional(v.string()),
      rsSpec2: v.optional(v.string()),
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
          // The published notes page the pathway was read from. Topic notes and
          // the real past-paper list are read from the same course on Cognito,
          // so the address is kept instead of being guessed at read time.
          sourceUrl: v.optional(v.string()),
          // When the topic-notes address and paper split were last read from
          // Cognito. Courses built before those fields existed are filled in
          // once on first visit; a timestamp keeps that from repeating.
          cognitoSyncedAt: v.optional(v.number()),
          // Papers the qualification is split into, with the topics each one
          // examines. Absent when the specification does not publish a split.
          papers: v.optional(
            v.array(
              v.object({
                label: v.string(),
                topicIds: v.array(v.string()),
              }),
            ),
          ),
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

    // A saved past paper for one course. Real board papers are copyrighted, so
    // a paper here is an original, exam-style paper written from the stored
    // specification and saved once: it reads the same on every visit and the
    // revision timetable can point at it.
    pastPapers: defineTable({
      userId: v.id("users"),
      courseId: v.id("courses"),
      title: v.string(),
      // Which subject blueprint the paper was written to ("rs-edexcel-a",
      // "english-literature", …). The course page compares it with the format
      // the course uses now, so a paper saved before the format changed is
      // offered a rebuild instead of silently staying wrong.
      formatId: v.optional(v.string()),
      // The qualification paper this practice paper covers ("Paper 1", …).
      // Missing means the whole qualification is examinable, which is how
      // papers built before a course was split into papers behave.
      paper: v.optional(v.string()),
      // Every paper is one hour long. The timetable assumes 60 minutes per
      // paper, so the duration is stored rather than guessed at render time.
      durationMinutes: v.number(),
      totalMarks: v.number(),
      questionCount: v.number(),
      // How much of the paper has been attempted, so the course page can show
      // progress without loading every question.
      answeredCount: v.number(),
      earnedMarks: v.number(),
      status: v.union(
        v.literal("queued"),
        v.literal("processing"),
        v.literal("ready"),
        v.literal("error"),
      ),
      progress: v.optional(v.string()),
      errorMessage: v.optional(v.string()),
      processingStartedAt: v.optional(v.number()),
      lastAttemptedAt: v.optional(v.number()),
      // The paper's cover, built on the server from the board's own rubric so
      // the paper reads like a real one and rebuilds identically. Missing on
      // papers built before the cover existed.
      cover: v.optional(
        v.object({
          paperLabel: v.string(),
          qualification: v.string(),
          timeAllowed: v.string(),
          totalMarks: v.number(),
          materials: v.array(v.string()),
          instructions: v.array(v.string()),
          information: v.array(v.string()),
          advice: v.array(v.string()),
        }),
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_course", ["courseId", "createdAt"])
      .index("by_user", ["userId", "createdAt"]),

    // One question in a saved past paper, marked by the same examiner prompt as
    // a study set's exam questions.
    pastPaperQuestions: defineTable({
      paperId: v.id("pastPapers"),
      userId: v.id("users"),
      question: v.string(),
      marks: v.number(),
      // Point-marked questions have one bullet per mark; levels-marked
      // questions (essays and extended responses) have level descriptors.
      marking: v.optional(v.union(v.literal("points"), v.literal("levels"))),
      modelAnswer: v.string(),
      markingGuide: v.array(v.string()),
      order: v.number(),
      // How the board lays the question out: its printed label ("1 (a)",
      // "0 1 . 1"), the section it belongs to, that section's instruction line,
      // the command word it opens with, and the specification reference it
      // tests. Missing on papers built before the layout was stored.
      label: v.optional(v.string()),
      section: v.optional(v.string()),
      sectionInstruction: v.optional(v.string()),
      commandWord: v.optional(v.string()),
      specReference: v.optional(v.string()),
      userAnswer: v.optional(v.string()),
      awardedMarks: v.optional(v.number()),
      feedback: v.optional(v.string()),
      gradedAt: v.optional(v.number()),
    }).index("by_paper", ["paperId"]),

    // One course topic's published notes, read from Cognito and stored so the
    // text is shown inside Bluprint (never linked out) and only scraped once.
    cognitoTopicNotes: defineTable({
      courseId: v.id("courses"),
      topicId: v.string(),
      sections: v.array(
        v.object({
          heading: v.string(),
          blocks: v.array(v.string()),
        }),
      ),
      sources: v.array(v.object({ title: v.string(), url: v.string() })),
      fetchedAt: v.number(),
    }).index("by_course_topic", ["courseId", "topicId"]),

    // The real past papers Cognito lists for a course, cached so the course
    // page can show them without asking the student to visit the site.
    cognitoPastPapers: defineTable({
      courseId: v.id("courses"),
      sourceUrl: v.string(),
      papers: v.array(
        v.object({
          year: v.string(),
          label: v.string(),
          questionUrl: v.string(),
          markSchemeUrl: v.optional(v.string()),
        }),
      ),
      fetchedAt: v.number(),
    }).index("by_course", ["courseId"]),

    // One saved revision timetable per account. Dates are UTC calendar keys
    // (YYYY-MM-DD) so a plan renders the same day regardless of server timezone.
    revisionPlans: defineTable({
      userId: v.id("users"),
      startDate: v.string(),
      // How the plan fills its sessions. "topics" opens a pathway topic,
      // "papers" works through saved past papers, and "mixed" alternates the
      // two. Missing on plans built before the choice existed, which are topics.
      studyMethod: v.optional(
        v.union(
          v.literal("topics"),
          v.literal("papers"),
          v.literal("mixed"),
        ),
      ),
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
      // Start time used on weekends, bank holidays and school holidays, so a
      // day off can begin later than a school evening.
      dayOffStartMinutes: v.optional(v.number()),
      daysPerWeek: v.number(),
      courseSettings: v.optional(
        v.array(
          v.object({
            courseId: v.id("courses"),
            subject: v.string(),
            // Legacy: plans built when each subject had its own session length.
            // New plans use the plan-level `sessionMinutes` instead.
            minutes: v.optional(v.number()),
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
          // "paper" entries are a whole past paper (60 minutes) and link to the
          // saved paper; missing means a normal topic session.
          kind: v.optional(
            v.union(v.literal("topic"), v.literal("paper")),
          ),
          paperId: v.optional(v.id("pastPapers")),
          startMinutes: v.optional(v.number()),
          // Legacy: plans built when a break as long as the session followed
          // it stored that gap here. New plans space sessions with one equal
          // gap instead and do not write this field.
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
      // True while the reply is still being written token by token. The chat
      // renders the growing content live and shows a caret.
      streaming: v.optional(v.boolean()),
      // Pages the answer was allowed to cite, saved with the reply.
      sources: v.optional(
        v.array(v.object({ title: v.string(), url: v.string() })),
      ),
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
      streaming: v.optional(v.boolean()),
      sources: v.optional(
        v.array(v.object({ title: v.string(), url: v.string() })),
      ),
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
