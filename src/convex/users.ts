import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { deleteStudySetContent } from "./studySets";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return await ctx.db.get(userId);
  },
});

/**
 * Removes the signed-in account and everything attached to it.
 *
 * This is deliberately a server cascade rather than a client sequence: a
 * browser must not be able to leave orphaned notes, uploads or auth rows behind
 * by stopping halfway. It runs as one mutation, so either the whole account is
 * gone or nothing was deleted.
 *
 * The JSON export is offered before this is called (see the account dialog);
 * deletion itself is not reversible.
 */
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Sign in before deleting an account.");
    }
    const user = await ctx.db.get(userId);
    if (!user) return { deleted: true };

    const deleteImage = async (id: Parameters<typeof ctx.storage.delete>[0]) => {
      try {
        await ctx.storage.delete(id);
      } catch {
        // A file removed by an earlier partial cleanup must not block erasure.
      }
    };

    // Sets own their cards, quiz rows, exam rows, attempts, tutor thread and
    // uploaded images. Delete the children first, then the set row.
    const sets = await ctx.db
      .query("studySets")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .collect();
    for (const set of sets) {
      await deleteStudySetContent(ctx, set._id);
      const tutorRows = await ctx.db
        .query("tutorMessages")
        .withIndex("by_set", (q) => q.eq("setId", set._id))
        .collect();
      for (const row of tutorRows) await ctx.db.delete(row._id);
      for (const imageId of set.sourceImageIds) await deleteImage(imageId);
      await ctx.db.delete(set._id);
    }

    // Real questions can carry a photographed mark scheme.
    const realQuestions = await ctx.db
      .query("realQuestions")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .collect();
    for (const row of realQuestions) {
      if (row.sourceImageId) await deleteImage(row.sourceImageId);
      await ctx.db.delete(row._id);
    }

    // Saved papers and their questions.
    const papers = await ctx.db
      .query("pastPapers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const paper of papers) {
      const questions = await ctx.db
        .query("pastPaperQuestions")
        .withIndex("by_paper", (q) => q.eq("paperId", paper._id))
        .collect();
      for (const question of questions) await ctx.db.delete(question._id);
      await ctx.db.delete(paper._id);
    }

    // Courses, their cached Cognito notes and their paper lists. Course-scoped
    // tutor threads hang off the course, so they go too.
    const courses = await ctx.db
      .query("courses")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .collect();
    for (const course of courses) {
      const notes = await ctx.db
        .query("cognitoTopicNotes")
        .withIndex("by_course_topic", (q) => q.eq("courseId", course._id))
        .collect();
      for (const row of notes) await ctx.db.delete(row._id);
      const cachedPapers = await ctx.db
        .query("cognitoPastPapers")
        .withIndex("by_course", (q) => q.eq("courseId", course._id))
        .collect();
      for (const row of cachedPapers) await ctx.db.delete(row._id);
      const threads = await ctx.db
        .query("courseTutorMessages")
        .withIndex("by_course", (q) => q.eq("courseId", course._id))
        .collect();
      for (const row of threads) await ctx.db.delete(row._id);
      await ctx.db.delete(course._id);
    }

    // Timetable, study history, build usage and shared progress.
    const plans = await ctx.db
      .query("revisionPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const row of plans) await ctx.db.delete(row._id);

    const days = await ctx.db
      .query("timetableDays")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .collect();
    for (const row of days) await ctx.db.delete(row._id);

    const studyDays = await ctx.db
      .query("studyDays")
      .withIndex("by_user_day", (q) => q.eq("userId", userId))
      .collect();
    for (const row of studyDays) await ctx.db.delete(row._id);

    const builds = await ctx.db
      .query("buildUsage")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .collect();
    for (const row of builds) await ctx.db.delete(row._id);

    const shares = await ctx.db
      .query("progressShares")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const row of shares) await ctx.db.delete(row._id);

    const mocks = await ctx.db
      .query("mockAttempts")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    for (const row of mocks) await ctx.db.delete(row._id);

    // Auth rows: accounts, their outstanding codes, sessions and refresh
    // tokens. The user row is deleted last so nothing can still reference it.
    const accounts = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    for (const account of accounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .collect();
      for (const row of codes) await ctx.db.delete(row._id);
      await ctx.db.delete(account._id);
    }

    const sessions = await ctx.db
      .query("authSessions")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    for (const session of sessions) {
      const tokens = await ctx.db
        .query("authRefreshTokens")
        .filter((q) => q.eq(q.field("sessionId"), session._id))
        .collect();
      for (const row of tokens) await ctx.db.delete(row._id);
      await ctx.db.delete(session._id);
    }

    if (user.email) {
      const email = user.email.trim().toLowerCase();
      const guard = await ctx.db
        .query("otpGuards")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      if (guard) await ctx.db.delete(guard._id);
      const limits = await ctx.db
        .query("authRateLimits")
        .withIndex("identifier", (q) => q.eq("identifier", user.email!))
        .unique();
      if (limits) await ctx.db.delete(limits._id);
    }

    await ctx.db.delete(userId);
    return { deleted: true };
  },
});
