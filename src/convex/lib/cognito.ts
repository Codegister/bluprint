/**
 * Cognito (cognito.org) publishes one revision page per qualification, exam
 * board and subject, laid out with the board's own paper and topic headings.
 *
 * Pathways are built from that page instead of from a model's memory of the
 * specification. A model asked to recall a whole course will quietly merge or
 * skip topics; reading the published heading list first means every topic and
 * subtopic reaches the pathway, and the model is only used to describe them.
 *
 * This module is deliberately dependency-free: it fetches the page, strips the
 * HTML down to text and reads the heading structure. If a course is not on
 * Cognito, or the page is rendered client-side only, it returns null and the
 * caller falls back to a model-written outline.
 */

export type CognitoSubtopic = { reference?: string; title: string };
export type CognitoTopic = {
  reference?: string;
  title: string;
  subtopics: CognitoSubtopic[];
};
export type CognitoSection = { title: string; topics: CognitoTopic[] };
export type CognitoOutline = {
  sourceUrl: string;
  label: string;
  specificationCode?: string;
  sections: CognitoSection[];
};

const SITE = "https://cognito.org";
const PAGE_TIMEOUT_MS = 20_000;
/** Some subject pages nest user-facing filters; we only ever read the course. */
const MAX_HTML_CHARS = 4_000_000;

/** Qualification folder names used by cognito.org. */
const LEVEL_SLUGS: Record<string, string> = {
  GCSE: "gcse",
  "A-Level": "alevel",
  IB: "ib",
  AP: "ap",
};

/** Exam-board folder names used by cognito.org. */
const BOARD_SLUGS: Array<{ match: RegExp; slug: string }> = [
  { match: /^aqa$/i, slug: "aqa" },
  { match: /edexcel|pearson/i, slug: "edexcel" },
  { match: /^ocr$/i, slug: "ocr" },
  { match: /eduqas/i, slug: "eduqas" },
  { match: /wjec/i, slug: "wjec" },
  { match: /cambridge|cie|caie/i, slug: "cie" },
  { match: /^sqa$/i, slug: "sqa" },
  { match: /^ccea$/i, slug: "ccea" },
];

async function fetchPage(url: string): Promise<{ url: string; html: string } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        // Cognito's robots.txt allows automated readers; identify plainly.
        "User-Agent": "BluprintStudyBot/1.0 (+course pathway builder)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const html = (await response.text()).slice(0, MAX_HTML_CHARS);
    return { url: response.url || url, html };
  } catch {
    return null;
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;|&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&ndash;|&mdash;/gi, "-")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

/** Strips a page to one line per visible text run. */
function htmlToLines(html: string): string[] {
  const stripped = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|ul|ol|h[1-6]|button|a|span|tr|td|section|header|footer)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const CONTAINER_RE =
  /^(paper|year|section|component|module|unit|theme|part)\s+([0-9A-Za-z]{1,4})\s*(?:[-:]\s*(.+))?$/i;
const TOPIC_RE = /^(?:topic|chapter)\s+([0-9A-Za-z]{1,4})\s*(?:[-:]\s*(.+))?$/i;
const SUBTOPIC_RE = /^(\d+(?:\.\d+){1,3})\.?\s*[-:]?\s*(.+)$/;
const DASH_RE = /^[-]\s*(.+)$/;

/** Nesting order of the container words Cognito uses in its headings. */
function containerLevel(word: string): number {
  switch (word.toLowerCase()) {
    case "year":
      return 1;
    case "paper":
    case "section":
    case "part":
      return 2;
    default:
      return 3;
  }
}

const IGNORED_HEADINGS =
  /^(notes|quiz|flashcards|past papers?|study .*|build your own .*|add course|expand all|collapse all|overall progress:?|reject non-essential|accept all cookies|cookies?|faqs?|sign in|sign up|blog|courses|schools|contact|privacy|terms)$/i;

/** A short title-like line, used for set-text names and other unlabelled headings. */
function isPlainHeading(line: string): boolean {
  if (line.length < 2 || line.length > 64) return false;
  if (/[.!?;:,]$/.test(line)) return false;
  if (/^\d/.test(line)) return false;
  if (IGNORED_HEADINGS.test(line)) return false;
  return line.split(/\s+/).length <= 8;
}

type SectionFrame = { level: number; title: string };

/**
 * Reads the heading list out of a Cognito course page.
 *
 * The pages mix three shapes, all of which appear here:
 *   - Paper/Year/Module headings that group topics ("Paper 1 - Computer Systems")
 *   - numbered topic headings with a title on the next line ("Topic 1" / "- Memory")
 *   - dotted subtopics ("2.1 - Primary Storage (RAM & ROM)")
 *   - unlabelled set-text headings (English Literature: "Macbeth")
 */
export function parseCognitoPage(html: string, sourceUrl: string): CognitoOutline | null {
  const lines = htmlToLines(html);
  const start = lines.findIndex((line) => /^study any\b/i.test(line));
  if (start === -1) return null;

  // The outline runs from the course blurb to the FAQ block.
  const end = lines.findIndex(
    (line, index) => index > start && /^(faqs?|frequently asked)/i.test(line),
  );
  const body = lines.slice(start + 1, end === -1 ? undefined : end);

  const label = lines[0] ?? "";
  const specificationCode = /\(([A-Z]{2,4}\s?\d{3,5})\)/.exec(lines[start] ?? "")?.[1];

  const sections: CognitoSection[] = [];
  const frames: SectionFrame[] = [];
  let plainHeading: string | null = null;
  // "Module 1" / "- Particle Physics": the dashed name is the topic, while the
  // module stays in the section heading above it.
  let moduleTopicTitle: string | null = null;
  let currentSection: CognitoSection | null = null;
  let currentTopic: CognitoTopic | null = null;
  let pending:
    | { kind: "topic"; reference?: string }
    | { kind: "container"; level: number }
    | null = null;

  const closeSection = () => {
    currentSection = null;
    currentTopic = null;
  };

  // `currentTopic` is assigned inside the helpers below, so reading it through
  // a function keeps the type checker from narrowing it to null at the point
  // of use.
  const openTopicNode = (): CognitoTopic | null => currentTopic;

  const ensureSection = (includePlainHeading = true): CognitoSection => {
    if (currentSection) return currentSection;
    const title =
      [...frames.map((frame) => frame.title), includePlainHeading ? plainHeading : null]
        .filter(Boolean)
        .join(" · ") || "Course content";
    const section: CognitoSection = { title, topics: [] };
    sections.push(section);
    currentSection = section;
    return section;
  };

  const startTopic = (title: string, reference?: string) => {
    const clean = title.replace(/^[-:]\s*/, "").trim();
    if (!clean) return;
    const section = ensureSection();
    const topic: CognitoTopic = {
      title: clean,
      subtopics: [],
      ...(reference ? { reference } : {}),
    };
    section.topics.push(topic);
    currentTopic = topic;
  };

  for (const line of body) {
    const container = CONTAINER_RE.exec(line);
    const topic = TOPIC_RE.exec(line);
    const nextDash = DASH_RE.exec(line);

    if (topic) {
      const reference = topic[1];
      if (topic[2]) startTopic(topic[2], reference);
      else pending = { kind: "topic", reference };
      continue;
    }

    if (container) {
      const level = containerLevel(container[1]!);
      // Starting a sibling section closes everything at the same or deeper level.
      while (frames.length > 0 && frames[frames.length - 1]!.level >= level) {
        frames.pop();
      }
      closeSection();
      plainHeading = null;
      moduleTopicTitle = null;
      if (container[3]) {
        frames.push({ level, title: `${container[1]} ${container[2]} - ${container[3].trim()}` });
      } else {
        frames.push({ level, title: `${container[1]} ${container[2]}` });
        pending = { kind: "container", level };
      }
      continue;
    }

    if (nextDash && pending) {
      const title = nextDash[1]!.trim();
      if (pending.kind === "topic") {
        startTopic(title, pending.reference);
      } else {
        moduleTopicTitle = title;
      }
      pending = null;
      continue;
    }

    const subtopic = SUBTOPIC_RE.exec(line);
    if (subtopic) {
      const title = subtopic[2]!.trim();
      if (!title) continue;
      const section = ensureSection(false);
      if (!openTopicNode()) {
        // A module whose content starts straight at 1.1, with no topic heading.
        startTopic(moduleTopicTitle ?? plainHeading ?? section.title);
      }
      openTopicNode()!.subtopics.push({ reference: subtopic[1], title });
      continue;
    }

    if (pending) {
      // A container or topic heading with its title on the following line.
      if (pending.kind === "topic") startTopic(line, pending.reference);
      else moduleTopicTitle = line;
      pending = null;
      continue;
    }

    // A new heading can start once the previous topic has its subtopics, or
    // before any content has been seen. `currentTopic` is assigned inside a
    // helper, so read it through a widened local for the type checker.
    const canStartHeading = !currentSection || Boolean(openTopicNode()?.subtopics.length);
    if (canStartHeading && isPlainHeading(line)) {
      closeSection();
      plainHeading = line;
      moduleTopicTitle = null;
    }
  }

  const cleaned: CognitoSection[] = sections
    .map((section) => ({
      ...section,
      topics: section.topics.filter((topic: CognitoTopic) => topic.title.length > 1),
    }))
    .filter((section) => section.topics.length > 0);

  const topicCount = cleaned.reduce((sum, section) => sum + section.topics.length, 0);
  // A page that produced only a heading or two was probably not server-rendered
  // with its outline; let the model build one instead of shipping a stub.
  if (cleaned.length === 0 || topicCount < 3) return null;

  return {
    sourceUrl,
    label,
    ...(specificationCode ? { specificationCode } : {}),
    sections: cleaned,
  };
}

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !["and", "the", "of", "for"].includes(word));
}

/** Matches "Mathematics" to "maths", "Biology" to "biology-triple", and so on. */
function subjectScore(subject: string, slug: string): number {
  const wanted = words(subject);
  if (wanted.length === 0) return 0;
  const offered = words(slug.replace(/-/g, " "));
  const hits = wanted.filter((word) =>
    offered.some((candidate) => candidate === word || candidate.startsWith(word) || word.startsWith(candidate)),
  ).length;
  return hits / wanted.length;
}

async function findSubjectPath(levelSlug: string, subject: string): Promise<string | null> {
  const index = await fetchPage(`${SITE}/courses/${levelSlug}`);
  if (!index) return null;
  const prefix = `/courses/${levelSlug}/`;
  const paths = [...index.html.matchAll(/href="(\/courses\/[a-z0-9-]+\/[a-z0-9-]+)"/g)]
    .map((match) => match[1]!)
    .filter((path) => path.startsWith(prefix));
  const unique = [...new Set(paths)];

  let best: { path: string; score: number } | null = null;
  for (const path of unique) {
    const slug = path.slice(prefix.length);
    const score = subjectScore(subject, slug);
    if (!best || score > best.score) best = { path, score };
  }
  // Every word in the subject name must appear in the slug, otherwise Cognito
  // is probably offering a different course (e.g. Biology for Environmental Science).
  return best && best.score >= 0.999 ? best.path : null;
}

function boardSlugFor(board: string): string | null {
  const found = BOARD_SLUGS.find((entry) => entry.match.test(board.trim()));
  return found?.slug ?? null;
}

/**
 * Looks up the published outline for one course. Returns null when Cognito does
 * not list the subject, the board is not covered, or the page has no readable
 * outline — every caller treats that as "write the outline with a model".
 */
export async function fetchCognitoOutline(course: {
  subject: string;
  level: string;
  examBoard: string;
}): Promise<CognitoOutline | null> {
  const levelSlug = LEVEL_SLUGS[course.level.trim()];
  if (!levelSlug) return null;

  const subjectPath = await findSubjectPath(levelSlug, course.subject);
  if (!subjectPath) return null;

  const boardSlug = boardSlugFor(course.examBoard);
  const subjectPage = await fetchPage(`${SITE}${subjectPath}`);
  if (!subjectPage) return null;

  // The subject page links to each board's notes page. Only the board the
  // student is actually sitting is relevant: specifications differ.
  const boardPages = new Map<string, string>();
  for (const match of subjectPage.html.matchAll(/href="([^"]*\/notes)"/g)) {
    const path = match[1]!;
    const boardMatch = /\/([a-z-]+)\/notes$/.exec(path);
    if (boardMatch) boardPages.set(boardMatch[1]!, path);
  }

  const notesPath = boardSlug ? boardPages.get(boardSlug) : undefined;
  if (!notesPath) return null;

  const notesPage = await fetchPage(
    notesPath.startsWith("http") ? notesPath : `${SITE}${notesPath}`,
  );
  if (!notesPage) return null;

  return parseCognitoPage(notesPage.html, notesPage.url);
}
