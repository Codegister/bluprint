/**
 * The tutor's build agent.
 *
 * The tutor should be able to act on a request such as "build me a Spanish quiz
 * on topic 1", not just talk about it. This module is the deterministic part of
 * that: it decides whether a message is a build request, picks the student's
 * course, resolves a topic by number, unit or title, and chooses a sensible
 * build size. It never calls a model, so the decision can be tested directly
 * and the browser can never smuggle in a course or topic of its choosing.
 */

import { BUILD_DEFAULTS, BUILD_MAX, BUILD_MIN } from "./buildDefaults";

/** A course topic as the agent sees it, already in course reading order. */
export type TutorAgentTopic = {
  id: string;
  title: string;
  unitTitle: string;
  /** Course-wide topic number, matching the number shown in the course UI. */
  number: number;
};

/** The smallest safe course shape the agent needs. No notes or key points. */
export type TutorAgentCourse = {
  id: string;
  subject: string;
  level: string;
  examBoard: string;
  /**
   * The course's next unfinished topic, when the caller knows it. A build for
   * "each of my courses" has no topic in the message, so this is the topic the
   * course page would offer next instead of always starting at topic 1.
   */
  nextTopicId?: string;
  units: Array<{
    title: string;
    topics: Array<{ id: string; title: string }>;
  }>;
};

export type TutorBuildCounts = {
  cards: number;
  quiz: number;
  exam: number;
};

export type TutorBuildPlan = {
  status: "build";
  courseId: string;
  subject: string;
  topicIds: string[];
  firstTopicId: string;
  label: string;
  counts: TutorBuildCounts;
};

/** One build per ready course, for "build me a set for each of my courses". */
export type TutorBuildBatch = {
  status: "build-many";
  plans: TutorBuildPlan[];
};

export type TutorBuildDecision =
  | TutorBuildPlan
  | TutorBuildBatch
  | { status: "needs-topic"; courseId: string; subject: string }
  | { status: "needs-course"; subjects: string[] }
  | { status: "not-a-build" };

const BUILD_REQUEST = [
  // The verb and its object may be separated by a short description
  // ("build me a Spanish quiz"), but not by a whole sentence.
  /\b(?:build|make|create|generate|prepare|put together)\b[^.!?]{0,55}\b(?:quiz|study sets?|sets?|flashcards?|cards?|questions?|deck)\b/i,
  // "I want a Spanish quiz", but not "I need help with my quiz".
  /\b(?:want|need|would like|i'?d like)\s+(?:a|an|another|some|the)\b[^.!?]{0,40}\b(?:quiz|study sets?|sets?|flashcards?|cards?|deck)\b/i,
  /\b(?:give me|create me|make me|build me)\b[^.!?]{0,40}\b(?:quiz|study sets?|sets?|flashcards?|cards?|questions?|deck)\b/i,
];

const NON_BUILD_OPENING = /^\s*(?:how|what|why|where|when|which|who)\b/i;
const NEGATED_BUILD = /^\s*(?:no|don'?t|do not|stop|not)\b/i;

/**
 * "A set for each of my courses", "one per course", "sets for all my courses".
 * Without this the planner treats the request as a single unnamed course and
 * asks which one, while the model, told to ask, starts writing material into
 * the chat instead of creating anything.
 */
const EVERY_COURSE =
  /\b(?:each|every|all)\s+(?:of\s+)?(?:my\s+|the\s+)?courses?\b|\bper\s+course\b|\bfor\s+my\s+courses?\b/i;

/**
 * True only for an imperative request to create material.
 *
 * A question about a quiz ("why did I get this wrong?") or an explanation
 * request ("what is a study set?") must not spend a build allowance. The
 * patterns require both the creating verb and the material noun, and questions
 * that begin with a question word are explicitly left alone.
 */
export function isTutorBuildRequest(question: string): boolean {
  const text = question.trim();
  if (!text || NON_BUILD_OPENING.test(text) || NEGATED_BUILD.test(text)) return false;
  return BUILD_REQUEST.some((pattern) => pattern.test(text));
}

const TOPIC_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

const STOP_WORDS = new Set([
  "all",
  "another",
  "both",
  "courses",
  "each",
  "every",
  "five",
  "four",
  "full",
  "one",
  "per",
  "sets",
  "single",
  "three",
  "two",
  "whole",
  "about",
  "and",
  "are",
  "build",
  "card",
  "cards",
  "chapter",
  "course",
  "create",
  "deck",
  "exam",
  "flashcard",
  "flashcards",
  "for",
  "from",
  "generate",
  "have",
  "into",
  "make",
  "material",
  "me",
  "my",
  "of",
  "on",
  "part",
  "please",
  "quiz",
  "revision",
  "set",
  "some",
  "study",
  "test",
  "that",
  "the",
  "their",
  "this",
  "topic",
  "unit",
  "want",
  "with",
  "your",
]);

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function significantTokens(value: string): string[] {
  const result: string[] = [];
  for (const token of tokens(value)) {
    if (token.length < 3 || STOP_WORDS.has(token)) continue;
    if (/^\d+$/.test(token)) continue;
    result.push(token);
  }
  return result;
}

/** Matches simple singular/plural forms without a stemmer dependency. */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  return a.length > 3 && b.length > 3 && (a.replace(/s$/, "") === b.replace(/s$/, ""));
}

/** 1-based topic numbers in course reading order. */
export function numberTopics(course: TutorAgentCourse): TutorAgentTopic[] {
  let number = 0;
  return course.units.flatMap((unit) =>
    unit.topics.map((topic) => {
      number += 1;
      return {
        id: topic.id,
        title: topic.title,
        unitTitle: unit.title,
        number,
      };
    }),
  );
}

function readNumber(value: string | undefined): number | null {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric > 0) return numeric;
  return TOPIC_WORDS[value.toLowerCase()] ?? null;
}

function topicNumberIn(question: string): number | null {
  const match = question.match(
    /\b(?:topic|chapter)\s*(?:number\s*)?#?\s*(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/i,
  );
  return readNumber(match?.[1]);
}

function unitNumberIn(question: string): number | null {
  const match = question.match(
    /\bunit\s*(?:number\s*)?#?\s*(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i,
  );
  return readNumber(match?.[1]);
}

/**
 * Picks a unit when the student says "unit 2" or names the unit, but only when
 * exactly one unit matches. A namesake in another unit must not silently win.
 */
function unitFor(
  question: string,
  units: Array<{ title: string; topics: Array<{ id: string; title: string }> }>,
): number | null {
  const number = unitNumberIn(question);
  if (number !== null) return number - 1;
  if (units.length <= 1) return units.length === 1 ? 0 : null;

  const questionTokens = new Set(tokens(question));
  const matches: number[] = [];
  for (const [index, unit] of units.entries()) {
    const unitTokens = significantTokens(unit.title);
    if (unitTokens.length === 0) continue;
    const hits = unitTokens.filter((token) =>
      [...questionTokens].some((word) => sameWord(word, token)),
    ).length;
    if (hits > 0 && hits >= Math.ceil(unitTokens.length / 2)) matches.push(index);
  }
  return matches.length === 1 ? matches[0]! : null;
}

function scoreTopic(question: string, topic: TutorAgentTopic): number {
  const questionText = tokens(question).join(" ");
  const titleText = tokens(topic.title).join(" ");
  if (titleText.length >= 4 && questionText.includes(titleText)) return 100;

  const questionWords = new Set(tokens(question));
  const titleWords = significantTokens(topic.title);
  if (titleWords.length === 0) return 0;
  const hits = titleWords.filter((word) =>
    [...questionWords].some((candidate) => sameWord(candidate, word)),
  ).length;
  return hits === 0 ? 0 : hits / titleWords.length;
}

function topicByTitle(
  question: string,
  topics: TutorAgentTopic[],
): TutorAgentTopic | null {
  const scored = topics
    .map((topic) => ({ topic, score: scoreTopic(question, topic) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  // A tie means the request is genuinely ambiguous. Asking which topic is
  // safer than spending a build on the wrong one.
  if (scored[1] && scored[1].score === scored[0]!.score) return null;
  return scored[0]!.topic;
}

function subjectMatch(question: string, subject: string): boolean {
  const questionText = tokens(question).join(" ");
  const subjectText = tokens(subject).join(" ");
  if (subjectText.length >= 3 && questionText.includes(subjectText)) return true;

  const subjectWords = significantTokens(subject);
  if (subjectWords.length === 0) return false;
  const questionWords = new Set(tokens(question));
  return subjectWords.every((word) =>
    [...questionWords].some((candidate) => sameWord(candidate, word)),
  );
}

function namedSubject(question: string): string | null {
  const match = question.match(
    /\b(?:build|make|create|generate|prepare|put together|want|need|give me)\b[\s\S]{0,45}?\b(?:a|an|the)?\s*([A-Za-z]{3,}(?:\s+[A-Za-z]{3,})?)\s+(?:quiz|study sets?|sets?|flashcards?|cards?|questions?|deck)\b/i,
  );
  const name = match?.[1]?.trim();
  if (!name) return null;
  const first = tokens(name)[0];
  return first && !STOP_WORDS.has(first) ? name : null;
}

function chooseCourse(
  question: string,
  courses: TutorAgentCourse[],
  currentCourseId?: string,
): TutorAgentCourse | null {
  if (courses.length === 0) return null;
  const current = currentCourseId
    ? courses.find((course) => course.id === currentCourseId) ?? null
    : null;
  const matching = courses.filter((course) => subjectMatch(question, course.subject));

  if (matching.length === 0) {
    // "Build me a Chemistry quiz" from a Biology course must not silently
    // build Biology just because it is the only course. A capitalised subject
    // before the material noun is a clear request for a different course.
    if (namedSubject(question)) return null;
    if (current) return current;
    return courses.length === 1 ? courses[0]! : null;
  }
  if (current && matching.some((course) => course.id === current.id)) return current;
  if (matching.length === 1) return matching[0]!;

  // Two courses of the same subject (GCSE and A-Level, for example) are a real
  // choice. Prefer a unique exact subject match, then ask rather than guessing.
  const exact = matching.filter((course) =>
    tokens(question).join(" ").includes(tokens(course.subject).join(" ")),
  );
  return exact.length === 1 ? exact[0]! : null;
}

function labelForTopics(topics: TutorAgentTopic[]): string {
  const first = topics[0]!;
  const last = topics[topics.length - 1]!;
  if (topics.length === 1) return `Topic ${first.number} · ${first.title}`;
  if (first.number === last.number) return first.title;
  return `Topics ${first.number}–${last.number}`;
}

/** One explicit item count, kept inside the account-wide build range. */
function explicitCount(question: string, material: string): number | null {
  const match = question.match(
    new RegExp(`\\b(\\d{1,3})\\s*(?:${material})\\b`, "i"),
  );
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  return Math.min(BUILD_MAX, Math.max(BUILD_MIN, Math.round(value)));
}

/** "a quiz with 8 questions" puts the count after the material noun. */
function explicitCountAfter(question: string, material: string): number | null {
  const match = question.match(
    new RegExp(
      `\\b(?:${material})\\b[^.!?]{0,18}\\b(\\d{1,3})\\s*(?:questions?|qs?)\\b`,
      "i",
    ),
  );
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  return Math.min(BUILD_MAX, Math.max(BUILD_MIN, Math.round(value)));
}

/** A bare "12 questions" belongs to the one material type named nearby. */
function genericQuestions(question: string): number | null {
  const match = question.match(/\b(\d{1,3})\s*(?:questions?|qs?)\b/i);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  return Math.min(BUILD_MAX, Math.max(BUILD_MIN, Math.round(value)));
}

/**
 * The size of a tutor-started build, shaped by what the student asked for.
 *
 * Explicit numbers win for every kind the student named ("24 flashcards, 12
 * quiz questions and 6 exam questions"), up to the same account maximum as the
 * sliders. A request that names no number gets the account maximum of each: a
 * tutor build is a whole pathway set drawn from specification scope, not a thin
 * page of notes, and the student asked for the sets rather than for the
 * smallest deck Bluprint can make.
 */
export function countsForTutorBuild(question: string): TutorBuildCounts {
  const asksForQuiz = /\b(?:quiz|test)\b/i.test(question);
  const asksForCards = /\b(?:flashcard|flashcards|cards)\b/i.test(question);
  const asksForExam = /\b(?:exam(?:-style)?|written)\s+questions?\b/i.test(question);

  const requestedCards = explicitCount(question, "flashcards?|cards?");
  const requestedQuiz =
    explicitCount(question, "(?:quiz|test)\\s*(?:questions?)?") ??
    explicitCountAfter(question, "quiz|test") ??
    (asksForQuiz && !asksForExam ? genericQuestions(question) : null);
  const requestedExam =
    explicitCount(question, "exam(?:-style)?\\s*(?:questions?)?") ??
    explicitCountAfter(question, "exam(?:-style)?|written") ??
    (asksForExam && !asksForQuiz ? genericQuestions(question) : null);

  if (requestedCards !== null || requestedQuiz !== null || requestedExam !== null) {
    const cardsFallback =
      asksForQuiz && !asksForCards
        ? 5
        : asksForCards
          ? 20
          : BUILD_DEFAULTS.cards;
    const quizFallback =
      asksForCards && !asksForQuiz
        ? 3
        : asksForQuiz
          ? 10
          : BUILD_DEFAULTS.quiz;
    return {
      cards: requestedCards ?? cardsFallback,
      quiz: requestedQuiz ?? quizFallback,
      exam: requestedExam ?? BUILD_DEFAULTS.exam,
    };
  }

  return { cards: BUILD_MAX, quiz: BUILD_MAX, exam: BUILD_MAX };
}

/**
 * Resolves one build request against the student's real courses.
 *
 * `currentCourseId` is the course the open set came from, or the course the
 * tutor is already pointed at. It is only a fallback: a named subject in the
 * message wins, so "build me a Spanish quiz" can act from inside Biology.
 */
export function planTutorBuild(
  question: string,
  courses: TutorAgentCourse[],
  options: { currentCourseId?: string; unitTitle?: string } = {},
): TutorBuildDecision {
  if (!isTutorBuildRequest(question)) return { status: "not-a-build" };

  // A request for one set from every course has no topic in it. Build each
  // course's next unfinished topic, which is the same topic its own page puts
  // first, rather than asking a question the student already answered.
  if (EVERY_COURSE.test(question)) {
    // "one set per course" starts with a quantity, not a subject: only a name
    // that matches a real course narrows the batch.
    const named = namedSubject(question);
    const namedCourses = named
      ? courses.filter((entry) => subjectMatch(question, entry.subject))
      : [];
    if (named && namedCourses.length === 0) {
      return {
        status: "needs-course",
        subjects: [...new Set(courses.map((entry) => entry.subject))].slice(0, 6),
      };
    }
    const batchCourses = namedCourses.length > 0 ? namedCourses : courses;
    const plans: TutorBuildPlan[] = batchCourses.flatMap((entry) => {
      const topics = numberTopics(entry);
      if (topics.length === 0) return [];
      const next =
        (entry.nextTopicId
          ? topics.find((topic) => topic.id === entry.nextTopicId)
          : undefined) ?? topics[0]!;
      return [
        {
          status: "build" as const,
          courseId: entry.id,
          subject: entry.subject,
          topicIds: [next.id],
          firstTopicId: next.id,
          label: labelForTopics([next]),
          counts: countsForTutorBuild(question),
        },
      ];
    });
    if (plans.length > 0) return { status: "build-many", plans };
    return {
      status: "needs-course",
      subjects: [...new Set(courses.map((entry) => entry.subject))].slice(0, 6),
    };
  }

  const course = chooseCourse(question, courses, options.currentCourseId);
  if (!course) {
    return {
      status: "needs-course",
      subjects: [...new Set(courses.map((entry) => entry.subject))].slice(0, 6),
    };
  }

  const allTopics = numberTopics(course);
  if (allTopics.length === 0) {
    return { status: "needs-topic", courseId: course.id, subject: course.subject };
  }

  const explicitUnitIndex = unitFor(question, course.units);
  const scopedUnitIndex =
    options.unitTitle !== undefined
      ? course.units.findIndex((unit) => unit.title === options.unitTitle)
      : -1;
  const unitIndex = explicitUnitIndex !== null ? explicitUnitIndex : scopedUnitIndex;
  const unitTopics =
    unitIndex >= 0 && course.units[unitIndex]
      ? allTopics.filter((topic) => topic.unitTitle === course.units[unitIndex]!.title)
      : allTopics;

  const explicitTopicNumber = topicNumberIn(question);
  if (explicitTopicNumber !== null) {
    // "unit 2 topic 1" means the first topic inside that unit. "topic 1" on its
    // own means course-wide topic 1, matching the number in the UI, even when
    // the conversation happens to be scoped to a unit.
    const relativeToUnit = explicitUnitIndex !== null;
    const candidates = relativeToUnit ? unitTopics : allTopics;
    const chosen = relativeToUnit
      ? candidates[explicitTopicNumber - 1]
      : candidates.find((topic) => topic.number === explicitTopicNumber);
    if (!chosen) {
      return { status: "needs-topic", courseId: course.id, subject: course.subject };
    }
    return {
      status: "build",
      courseId: course.id,
      subject: course.subject,
      topicIds: [chosen.id],
      firstTopicId: chosen.id,
      label: labelForTopics([chosen]),
      counts: countsForTutorBuild(question),
    };
  }

  const byTitle = topicByTitle(question, unitTopics.length > 0 ? unitTopics : allTopics);
  if (byTitle) {
    return {
      status: "build",
      courseId: course.id,
      subject: course.subject,
      topicIds: [byTitle.id],
      firstTopicId: byTitle.id,
      label: labelForTopics([byTitle]),
      counts: countsForTutorBuild(question),
    };
  }

  // A unit-scoped conversation has an obvious whole-unit request; a named unit
  // does too. An unscoped whole-course request without a topic is ambiguous.
  if (unitIndex >= 0 && unitTopics.length > 0) {
    return {
      status: "build",
      courseId: course.id,
      subject: course.subject,
      topicIds: unitTopics.map((topic) => topic.id),
      firstTopicId: unitTopics[0]!.id,
      label: labelForTopics(unitTopics),
      counts: countsForTutorBuild(question),
    };
  }

  if (allTopics.length === 1) {
    return {
      status: "build",
      courseId: course.id,
      subject: course.subject,
      topicIds: [allTopics[0]!.id],
      firstTopicId: allTopics[0]!.id,
      label: labelForTopics(allTopics),
      counts: countsForTutorBuild(question),
    };
  }

  return { status: "needs-topic", courseId: course.id, subject: course.subject };
}

/* -------------------------------------------------------------------------- */
/* Agreeing to a set the tutor proposed                                        */
/* -------------------------------------------------------------------------- */

/** A build the tutor offered in a reply, ready to run once the student agrees. */
export type TutorProposedBuild = Omit<TutorBuildPlan, "status">;

/**
 * What the student says to accept it: "Ok, then, proceed to set generation".
 *
 * That sentence names no verb or material of its own, so a planner that reads
 * only the newest message treats the agreement as ordinary chat and the tutor
 * answers with prose instead of building the sets it had just offered.
 */
const BARE_CONFIRMATION =
  /^\s*(?:yes|yeah|yep|ok(?:ay)?|sure|go ahead|proceed|do it|please do|go on|carry on|continue)\b[\s.!,]*(?:please\s+)?(?:proceed|do it|go ahead|continue)?[\s.!,]*$/i;

/**
 * "proceed to set generation" agrees with an offer; "make a study set" asks for
 * a new one. Only a demonstrative ("those sets", "them") or the word
 * "generation" counts, so a fresh build request is never mistaken for consent.
 */
const CONFIRMATION_WITH_OBJECT =
  /\b(?:proceed|go ahead|go on|carry on|continue)\b[^.!?]{0,50}\b(?:sets?|generation|them|those|these|the list|that list|it)\b|\b(?:create|build|generate|make|start)\s+(?:the|those|these|all|them)\b/i;

export function isBuildConfirmation(question: string): boolean {
  const text = question.trim();
  if (!text) return false;
  return BARE_CONFIRMATION.test(text) || CONFIRMATION_WITH_OBJECT.test(text);
}

/** A reply offers at most this many sets; one build per course is the usual 10. */
const MAX_PROPOSED_BUILDS = 12;

/** "1. GCSE Spanish - Identity and Culture" is a proposal; prose is not. */
const PROPOSAL_LINE = /^\s*(?:\d{1,2}[.)])\s+(.{3,220})$/;
const PROPOSAL_SPLIT = /^(.{2,90}?)\s*(?:[\u2014\u2013]|-(?=\s)|:)\s*(.{2,180})$/;

/** A labelled level at the start of a course name ("GCSE Spanish"). */
const PROPOSAL_LEVEL =
  /^(?:gcse|igcse|a[- ]?level|as[- ]?level|ib|ks3|national 5|higher|foundation)\b[\s:\u00b7-]*/i;

/**
 * The numbered "<course> - <topic>" lines a reply offered as sets.
 *
 * Only numbered lines count: a hyphen bullet is how the tutor lists questions
 * and key points, and treating those as courses would build the wrong set.
 */
export function proposedBuildLines(
  reply: string,
): Array<{ course: string; topic: string }> {
  const lines: Array<{ course: string; topic: string }> = [];
  for (const raw of reply.split(/\r?\n/)) {
    const numbered = raw.match(PROPOSAL_LINE);
    if (!numbered) continue;
    const body = numbered[1]!.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
    const split = body.match(PROPOSAL_SPLIT);
    if (!split) continue;
    const course = split[1]!.trim();
    const topic = split[2]!.trim();
    if (course.length < 2 || topic.length < 2) continue;
    lines.push({ course, topic });
  }
  return lines.slice(0, MAX_PROPOSED_BUILDS);
}

function levelKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * The course a proposal line names. A subject at two levels (GCSE Spanish and
 * A-Level Spanish) is separated by the level label, and an ambiguous label is
 * refused rather than guessed: a build on the wrong course spends a real one.
 */
function courseForProposal(
  label: string,
  courses: TutorAgentCourse[],
): TutorAgentCourse | null {
  const levelMatch = label.match(PROPOSAL_LEVEL);
  const level = levelMatch ? levelKey(levelMatch[0]) : "";
  const subjectText = label
    .replace(PROPOSAL_LEVEL, "")
    .replace(/\([^)]*\)/g, " ")
    .trim();
  if (!subjectText) return null;

  const matches = courses.filter((course) => subjectMatch(subjectText, course.subject));
  if (matches.length === 1) return matches[0]!;
  if (matches.length === 0) return null;
  if (!level) return null;

  const byLevel = matches.filter((course) => levelKey(course.level) === level);
  return byLevel.length === 1 ? byLevel[0]! : null;
}

/** The strongest unique title match, or null when nothing or a tie matches. */
function bestByTitle<T>(
  label: string,
  items: T[],
  titleOf: (item: T) => string,
): T | null {
  const scored = items
    .map((item) => ({
      item,
      score: scoreTopic(label, {
        id: "",
        title: titleOf(item),
        unitTitle: "",
        number: 0,
      }),
    }))
    .filter((entry) => entry.score >= 0.6)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  // A tie between two topics means the label does not pick one.
  if (scored[1] && scored[1].score === scored[0]!.score) return null;
  return scored[0]!.item;
}

/**
 * Turns the sets a reply offered into real plans for the student's courses.
 *
 * A line naming a topic builds that topic; a line naming a theme or unit
 * builds the topics inside it. Anything that does not match is reported as
 * unresolved so the reply can say it did not build rather than inventing a
 * topic the student never asked for.
 */
export function resolveProposedBuilds(
  reply: string,
  courses: TutorAgentCourse[],
): { plans: TutorProposedBuild[]; unresolved: string[] } {
  const plans: TutorProposedBuild[] = [];
  const unresolved: string[] = [];
  // A reply that never mentioned sets is a numbered explanation, not an offer.
  if (!/\bsets?\b/i.test(reply)) return { plans, unresolved };

  const counts = countsForTutorBuild(reply);
  const seen = new Set<string>();

  for (const line of proposedBuildLines(reply)) {
    const label = `${line.course} \u2014 ${line.topic}`;
    const course = courseForProposal(line.course, courses);
    if (!course) {
      unresolved.push(label);
      continue;
    }

    const topics = numberTopics(course);
    if (topics.length === 0) {
      unresolved.push(label);
      continue;
    }

    const topic = bestByTitle(line.topic, topics, (entry) => entry.title);
    let chosen = topic ? [topic] : [];
    // A theme or unit name ("Identity and Culture") stands for the topics in it.
    if (chosen.length === 0) {
      const unit = bestByTitle(line.topic, course.units, (entry) => entry.title);
      chosen = unit
        ? topics.filter((entry) => entry.unitTitle === unit.title)
        : [];
    }
    if (chosen.length === 0) {
      unresolved.push(label);
      continue;
    }

    const key = `${course.id}|${chosen.map((topic) => topic.id).join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    plans.push({
      courseId: course.id,
      subject: course.subject,
      topicIds: chosen.map((topic) => topic.id),
      firstTopicId: chosen[0]!.id,
      label: labelForTopics(chosen),
      counts,
    });
  }

  return { plans: plans.slice(0, MAX_PROPOSED_BUILDS), unresolved };
}
