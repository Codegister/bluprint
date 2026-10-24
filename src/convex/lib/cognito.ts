/**
 * Cognito (cognito.org) is the source of every course pathway.
 *
 * The site's "Find my course" menu walks qualification → subject → exam board →
 * tier, and each step has a URL that serves the same content. This module walks
 * that path with those URLs, reads the published headings, and returns a
 * complete outline. Cognito's notes page is preferred because it lists every
 * subtopic; its specification page is the fallback when a notes page is served
 * without its content.
 *
 * No model is involved: a pathway is only ever the headings Cognito publishes
 * for that exact course, which is what stops topics from being invented or
 * dropped.
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
  /** "GCSE Computer Science (OCR)" as Cognito labels it. */
  label: string;
  specificationCode?: string;
  /** Specification overview paragraph, when a specification page was read. */
  intro?: string;
  sections: CognitoSection[];
};

const SITE = "https://cognito.org";
const PAGE_TIMEOUT_MS = 20_000;
/** Guard against an unexpectedly enormous page; real course pages are < 1 MB. */
const MAX_HTML_CHARS = 4_000_000;

export type CognitoCourse = {
  subject: string;
  level: string;
  examBoard: string;
  tier?: string;
  variant?: string;
};

/** Qualification folder names used by cognito.org. */
const LEVEL_SLUGS: Record<string, string> = {
  GCSE: "gcse",
  KS3: "ks3",
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

/**
 * Specification pages put a numbered topic in one paragraph, so every tag is a
 * line break there. Notes pages read better with tags collapsed to spaces.
 */
function htmlToBlockLines(html: string): string[] {
  const stripped = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, "\n");
  return decodeEntities(stripped)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
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
  /^(notes|quiz|flashcards|past papers?|study .*|build your own .*|add course|expand all|collapse all|overall progress:?|reject non-essential|accept all cookies|cookies?|faqs?|sign in|sign up|blog|courses|schools|contact|privacy|terms|cheat sheets?|exam practice)$/i;

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
 * Reads the heading list out of a Cognito notes page.
 *
 * Those pages mix several shapes, all of which appear here:
 *   - Paper/Year/Module headings that group topics ("Paper 1 - Computer Systems")
 *   - numbered topic headings with a title on the next line ("Topic 1" / "- Memory")
 *   - dotted subtopics ("2.1 - Primary Storage (RAM & ROM)")
 *   - unlabelled set-text headings (English Literature: "Macbeth")
 */
export function parseCognitoPage(html: string, sourceUrl: string): CognitoOutline | null {
  const lines = htmlToLines(html);
  // Most pages open with a "Study any subtopic…" blurb. Some (IB, tiered GCSE)
  // print the outline without it, so the first paper or topic heading anchors
  // the outline — and a paper heading above it is kept.
  const intro = lines.findIndex((line) => /^study any\b/i.test(line));
  const start =
    intro >= 0
      ? intro
      : lines.findIndex((line) => CONTAINER_RE.test(line) || TOPIC_RE.test(line));
  if (start === -1) return null;

  // The outline runs from the course blurb to the FAQ block.
  const end = lines.findIndex(
    (line, index) => index > start && /^(faqs?|frequently asked)/i.test(line),
  );
  const body = lines.slice(intro >= 0 ? start + 1 : start, end === -1 ? undefined : end);

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

  const ensureSection = (includePlainHeading = true): CognitoSection => {
    if (currentSection) return currentSection;
    // Pages with no paper or set-text grouping (Biology, IB) still get a
    // readable unit name from the course label at the top of the page.
    const title =
      [...frames.map((frame) => frame.title), includePlainHeading ? plainHeading : null]
        .filter(Boolean)
        .join(" · ") ||
      label ||
      "Course content";
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

  // `currentTopic` is assigned inside the helpers below, so reading it through
  // a function keeps the type checker from narrowing it to null at the point
  // of use.
  const openTopicNode = (): CognitoTopic | null => currentTopic;

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
      // A section whose content starts straight at 1.1, with no topic heading
      // (a physics module, or a poetry anthology). Its own heading names both
      // the unit and its single topic.
      const section = ensureSection();
      if (!openTopicNode()) {
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
    // before any content has been seen.
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
  // with its outline; the caller tries the specification page instead.
  if (cleaned.length === 0 || topicCount < 3) return null;

  return {
    sourceUrl,
    label,
    ...(specificationCode ? { specificationCode } : {}),
    sections: cleaned,
  };
}

/**
 * Reads the numbered "subject content" list from a Cognito specification page.
 * This is coarser than a notes page (topics with a couple of summary bullets),
 * but it still carries the official topic list, so it is used only when the
 * notes page has no readable outline.
 */
export function parseSpecificationPage(
  html: string,
  sourceUrl: string,
): CognitoOutline | null {
  const lines = htmlToBlockLines(html);
  const first = lines[0] ?? "";
  const label =
    first
      .split(/\s+[–-]\s+/)[0]
      ?.replace(/\s+specification$/i, "")
      .trim() || "";
  const specificationCode = /\(([A-Z0-9]{4,6})\)/.exec(first)?.[1];

  // The page repeats "specification overview" as a heading and a section label.
  const overviewIndex = lines.findIndex((line) => /^specification overview$/i.test(line));
  const intro =
    overviewIndex >= 0 && (lines[overviewIndex + 1]?.length ?? 0) > 80
      ? lines[overviewIndex + 1]!.slice(0, 1200)
      : undefined;

  const topicStarts: number[] = [];
  for (let index = 0; index < lines.length - 3; index += 1) {
    if (!/^\d{1,2}$/.test(lines[index]!)) continue;
    if (lines[index + 1] !== ".") continue;
    // Some boards label every topic "All papers" rather than one paper.
    if (!/papers?\b/i.test(lines[index + 3] ?? "")) continue;
    const title = lines[index + 2] ?? "";
    if (title.length < 3 || title.length > 120) continue;
    topicStarts.push(index);
  }
  if (topicStarts.length < 3) return null;

  const byPaper = new Map<string, CognitoTopic[]>();
  for (let position = 0; position < topicStarts.length; position += 1) {
    const start = topicStarts[position]!;
    const stop = topicStarts[position + 1] ?? lines.length;
    const reference = lines[start]!;
    const title = lines[start + 2]!;
    const rawPaperLabel = lines[start + 3]!.replace(/\s+section\s+[a-z0-9]+$/i, "").trim();
    // "All papers" is a single specification-wide list, so it becomes one unit
    // named after the course instead of a unit called "All papers".
    const paperLabel = /^(all|both)\s+papers?$/i.test(rawPaperLabel) ? "" : rawPaperLabel;
    const subtopics: CognitoSubtopic[] = [];

    for (let cursor = start + 4; cursor < stop; cursor += 1) {
      if (lines[cursor] !== "•") continue;
      const text = lines[cursor + 1]?.trim();
      if (text && text !== "•") subtopics.push({ title: text.slice(0, 160) });
    }

    const sectionTitle = paperLabel.replace(/^papers?\s+/i, "Paper ").replace(/\s+/g, " ");
    const topics = byPaper.get(sectionTitle) ?? [];
    topics.push({ reference, title, subtopics });
    byPaper.set(sectionTitle, topics);
  }

  if (byPaper.size === 0) return null;

  return {
    sourceUrl,
    label,
    ...(specificationCode ? { specificationCode } : {}),
    ...(intro ? { intro } : {}),
    sections: [...byPaper.entries()].map(([title, topics]) => ({
      title: title || label || "Course content",
      topics,
    })),
  };
}

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !["and", "the", "of", "for"].includes(word));
}

/** Subject names Cognito files under a different word. */
const SUBJECT_SLUG_ALIASES: Record<string, string> = {
  mathematics: "maths",
  "further mathematics": "further-maths",
  // KS3 keeps one English course and shortens Computer Science to "cs"; the
  // GCSE index has neither slug, so these only match where they exist.
  "computer science": "cs",
  "english language": "english",
  "english literature": "english",
};

/** Matches "Mathematics" to "maths", "Biology" to "biology-triple", and so on. */
function subjectScore(subject: string, slug: string): number {
  const wanted = words(subject);
  if (wanted.length === 0) return 0;
  const offered = words(slug.replace(/-/g, " "));
  const hits = wanted.filter((word) =>
    offered.some(
      (candidate) =>
        candidate === word || candidate.startsWith(word) || word.startsWith(candidate),
    ),
  ).length;
  return hits / wanted.length;
}

/** A queued batch of courses shares one subject index fetch. */
const subjectIndexCache = new Map<string, { at: number; html: string }>();

async function subjectIndex(levelSlug: string): Promise<string | null> {
  const cached = subjectIndexCache.get(levelSlug);
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.html;
  const page = await fetchPage(`${SITE}/courses/${levelSlug}`);
  if (!page) return null;
  subjectIndexCache.set(levelSlug, { at: Date.now(), html: page.html });
  return page.html;
}

export async function findSubjectSlug(
  levelSlug: string,
  subject: string,
): Promise<string | null> {
  const html = await subjectIndex(levelSlug);
  if (!html) return null;
  const prefix = `/courses/${levelSlug}/`;
  // Links can point at a leaf (`/courses/ks3/biology/notes`) as well as at the
  // subject itself, so keep the first two segments and ignore the rest.
  const paths = [
    ...html.matchAll(
      /href="(\/courses\/[a-z0-9-]+\/[a-z0-9-]+)(?:\/[a-z0-9/-]*)?"/g,
    ),
  ]
    .map((match) => match[1]!)
    .filter((path) => path.startsWith(prefix));
  const unique = [...new Set(paths)];

  const alias = SUBJECT_SLUG_ALIASES[subject.trim().toLowerCase().replace(/\s+/g, " ")];
  if (alias && unique.includes(`${prefix}${alias}`)) return alias;

  let best: { slug: string; score: number } | null = null;
  for (const path of unique) {
    const slug = path.slice(prefix.length);
    const exact = words(subject).join("-");
    // "Mathematics" scores 1 against both "maths" and "further-maths", so the
    // shorter, non-prefixed slug wins the tie.
    const score =
      subjectScore(subject, slug) +
      (slug === exact ? 0.5 : 0) -
      Math.min(0.4, slug.split("-").length * 0.05);
    if (!best || score > best.score) best = { slug, score };
  }
  // Every word in the subject name must appear in the slug, otherwise Cognito
  // is probably offering a different course (e.g. Biology for Environmental Science).
  return best && subjectScore(subject, best.slug) >= 0.999 ? best.slug : null;
}

function boardSlugFor(board: string): string | null {
  const found = BOARD_SLUGS.find((entry) => entry.match.test(board.trim()));
  return found?.slug ?? null;
}

/**
 * The tier / route segment Cognito adds below the exam board. GCSE uses
 * higher/foundation; IB uses ibhl/ibsl instead of a board.
 */
export function routeSlugs(course: CognitoCourse): string[] {
  const tier = (course.tier ?? "").trim().toLowerCase();
  if (tier.includes("foundation")) return ["foundation"];
  if (tier.includes("higher")) return ["higher"];
  const variant = (course.variant ?? "").trim().toLowerCase();
  if (variant === "hl") return ["ibhl"];
  if (variant === "sl") return ["ibsl"];
  return [];
}

/**
 * Combined Science is the one qualification Cognito splits before the exam
 * board: the student picks Biology, Chemistry or Physics, then the board, then
 * the tier. A Combined Science pathway should cover all three, so each
 * component is scraped and merged under its own unit.
 */
const COMBINED_SCIENCE_COMPONENTS = ["biology", "chemistry", "physics"] as const;

/** Notes URL for a component, finding Cognito's routed slug if it differs. */
async function componentNotes(
  levelSlug: string,
  component: string,
  boardSlug: string,
  route: string,
): Promise<CognitoOutline | null> {
  const canonical = `/courses/${levelSlug}/${component}-combined/${boardSlug}/${route}/notes`;
  const direct = await fetchPage(`${SITE}${canonical}`);
  if (direct) {
    const outline = parseCognitoPage(direct.html, direct.url);
    if (outline) return outline;
  }

  // Fall back to the route shown in the menu; its landing page redirects to
  // Cognito's canonical course path (…/biology-combined/…).
  const landing = await fetchPage(
    `${SITE}/courses/${levelSlug}/combined-science/${component}/${boardSlug}/${route}`,
  );
  if (!landing) return null;
  const notesUrl = landing.url.replace(/\/lessons(?:\?.*)?$/, "/notes");
  if (notesUrl === landing.url) return null;
  const page = await fetchPage(notesUrl);
  return page ? parseCognitoPage(page.html, page.url) : null;
}

async function fetchCombinedScienceOutline(
  levelSlug: string,
  boardSlug: string,
  route: string,
  boardLabel: string,
): Promise<CognitoOutline | null> {
  const parts = await Promise.all(
    COMBINED_SCIENCE_COMPONENTS.map(async (component) => ({
      component,
      outline: await componentNotes(levelSlug, component, boardSlug, route),
    })),
  );
  // Half a Combined Science course is worse than a starter map, so every
  // component has to be readable before the merged map is accepted.
  if (parts.some((part) => !part.outline)) return null;

  const sections: CognitoSection[] = parts.flatMap(({ component, outline }) => {
    const name = component.charAt(0).toUpperCase() + component.slice(1);
    return outline!.sections.map((section) => ({
      title:
        outline!.sections.length === 1
          ? name
          : `${name} · ${section.title.replace(new RegExp(`^${name}\\s*·?\\s*`, "i"), "")}`,
      topics: section.topics,
    }));
  });

  const topicCount = sections.reduce((sum, section) => sum + section.topics.length, 0);
  if (sections.length === 0 || topicCount < 3) return null;

  return {
    sourceUrl: `${SITE}/courses/${levelSlug}/combined-science`,
    label: `GCSE Combined Science (${boardLabel})`,
    sections,
  };
}

/**
 * Walks the same route as "Find my course": qualification, subject, exam board,
 * then tier. Cognito redirects dated routes (biology → biology-triple) itself,
 * so the candidate URLs are tried in order and the first readable outline wins.
 */
export async function fetchCognitoOutline(
  course: CognitoCourse,
): Promise<CognitoOutline | null> {
  const levelSlug = LEVEL_SLUGS[course.level.trim()];
  if (!levelSlug) return null;

  const subjectSlug = await findSubjectSlug(levelSlug, course.subject);
  if (!subjectSlug) return null;

  const boardSlug = boardSlugFor(course.examBoard);
  const routes = routeSlugs(course);

  // Combined Science adds a Biology / Chemistry / Physics step before the board.
  if (subjectSlug === "combined-science") {
    if (!boardSlug || routes.length === 0) return null;
    return await fetchCombinedScienceOutline(
      levelSlug,
      boardSlug,
      routes[0]!,
      course.examBoard,
    );
  }

  const candidates: string[] = [];

  if (boardSlug) {
    for (const route of routes) {
      candidates.push(`/courses/${levelSlug}/${subjectSlug}/${boardSlug}/${route}/notes`);
    }
    candidates.push(`/courses/${levelSlug}/${subjectSlug}/${boardSlug}/notes`);
  }
  // IB has no board segment; its route is the whole path. KS3 has neither a
  // board nor a tier, so the subject page is the whole path.
  for (const route of routes) {
    candidates.push(`/courses/${levelSlug}/${subjectSlug}/${route}/notes`);
  }
  if (!boardSlug) {
    candidates.push(`/courses/${levelSlug}/${subjectSlug}/notes`);
  }

  for (const path of [...new Set(candidates)]) {
    const page = await fetchPage(`${SITE}${path}`);
    if (!page) continue;
    const outline = parseCognitoPage(page.html, page.url);
    if (outline) return outline;
  }

  // The notes page is a client-rendered shell for some courses. The
  // specification page still lists the official topics.
  if (boardSlug) {
    const spec = await fetchPage(
      `${SITE}/specifications/${levelSlug}/${subjectSlug}/${boardSlug}`,
    );
    if (spec) {
      const outline = parseSpecificationPage(spec.html, spec.url);
      if (outline) return outline;
    }
  }

  return null;
}
