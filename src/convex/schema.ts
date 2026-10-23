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
      errorMessage: v.optional(v.string()),
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
      knownCount: v.number(),
      updatedAt: v.number(),
      processingStartedAt: v.optional(v.number()),
      lastStudiedAt: v.optional(v.number()),
      lastQuizScore: v.optional(v.number()),
      lastQuizTotal: v.optional(v.number()),
    }).index("by_user_updated", ["userId", "updatedAt"]),

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

    // add other tables here

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
