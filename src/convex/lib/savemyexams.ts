/**
 * Save My Exams is the source of the notes and real past papers shown inside
 * Bluprint.
 *
 * A course is only read after its page proves it is the course the student
 * picked: level, subject, exam board and (where the qualification has them)
 * tier must all match. Save My Exams uses the same three segments for several
 * different qualifications in places — OCR has an A and a B Biology course,
 * and Combined Science has Trilogy and Synergy — so those landing pages are
 * treated as ambiguous rather than guessing one.
 *
 * The pages are read from their embedded `__NEXT_DATA__` payload. Their visible
 * links are React routes, not ordinary anchors, and the notes themselves are
 * Sanity portable-text blocks rather than article HTML, so parsing the payload
 * is both more stable and less lossy than scraping the rendered page.
 */

const SITE = "https://www.savemyexams.com";
const PAGE_TIMEOUT_MS = 20_000;
/** Real course pages are under 2 MB; this is only a runaway guard. */
const MAX_HTML_CHARS = 8_000_000;
const COURSE_CACHE_TTL = 10 * 60 * 1000;
const MAX_NOTES_INDEXES = 6;
// A long Save My Exams topic such as An Inspector Calls publishes 20 note
// pages; the cap must not silently drop the last of them.
const MAX_TOPIC_PAGES = 24;
const MAX_PAPERS = 60;

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleKey(value: string): string {
  return normalise(value);
}

function relationId(entity: JsonObject, name: string): string | undefined {
  const relationships = asObject(entity.relationships);
  const relation = relationships ? asObject(relationships[name]) : null;
  const data = relation ? asObject(relation.data) : null;
  return data ? asString(data.id) : undefined;
}

function nextData(html: string): JsonObject | null {
  const match =
    /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!match) return null;
  try {
    const parsed = asObject(JSON.parse(match[1] ?? ""));
    const props = parsed ? asObject(parsed.props) : null;
    return props ? asObject(props.pageProps) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------------- */
/* Course matching                                                            */
/* ------------------------------------------------------------------------- */

export type SaveMyExamsCourseRequest = {
  level: string;
  subject: string;
  examBoard: string;
  tier?: string;
  variant?: string;
  /** Edexcel GCSE Religious Studies route A or B. These are separate courses. */
  rsRoute?: string;
};

export type SaveMyExamsCourse = {
  /** Canonical course path, including the specification/year segment. */
  basePath: string;
  /** Notes indexes to read. A-Level Maths has pure, mechanics and statistics. */
  notesIndexPaths: string[];
  pastPapersPath: string;
  levelSlug: string;
  subjectSlug: string;
  boardSlug: string;
  title: string;
};

export type SaveMyExamsResolveResult =
  | { status: "matched"; course: SaveMyExamsCourse }
  | { status: "unmatched" }
  | { status: "unavailable" };

const LEVEL_SLUGS: Record<string, string> = {
  gcse: "gcse",
  "a-level": "a-level",
  "as-level": "a-level",
  ib: "ib",
  "ib-diploma": "ib",
  ap: "ap",
  ks3: "ks3",
};

const BOARD_SLUGS: Array<{ match: RegExp; slug: string }> = [
  { match: /^aqa$/i, slug: "aqa" },
  { match: /edexcel|pearson/i, slug: "edexcel" },
  { match: /^ocr\b/i, slug: "ocr" },
  { match: /eduqas/i, slug: "eduqas" },
  { match: /wjec/i, slug: "wjec" },
  { match: /cambridge|cie|caie/i, slug: "cie" },
  { match: /^sqa$/i, slug: "sqa" },
  { match: /^ccea$/i, slug: "ccea" },
];

const SUBJECT_SLUGS: Record<string, string> = {
  mathematics: "maths",
  "further mathematics": "further-maths",
  "combined science": "science",
  "english language": "english-language",
  "english literature": "english-literature",
  "computer science": "computer-science",
  "business studies": "business",
  "religious studies": "religious-studies",
  "media studies": "media-studies",
  "design and technology": "design-technology",
  "design technology": "design-technology",
  "food preparation and nutrition": "food-preparation-nutrition",
  "physical education": "physical-education",
  "health and social care": "health-social-care",
  "information technology": "information-technology",
  "environmental science": "environmental-science",
  "art and design": "art-design",
  "theory of knowledge": "theory-of-knowledge",
};

function levelSlugFor(level: string): string | null {
  const key = level
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return LEVEL_SLUGS[key] ?? null;
}

function boardSlugFor(board: string): string | null {
  if (!board.trim() || /^none$/i.test(board.trim())) return null;
  return BOARD_SLUGS.find((entry) => entry.match.test(board.trim()))?.slug ?? null;
}

function isEdexcelReligiousStudies(wanted: SaveMyExamsCourseRequest): boolean {
  return (
    normalise(wanted.subject) === "religious studies" &&
    boardSlugFor(wanted.examBoard) === "edexcel"
  );
}

/**
 * Save My Exams publishes Edexcel GCSE Religious Studies as two courses,
 * /religious-studies/edexcel/a/ and /b/. The route is part of the course, not a
 * tier, so it must be carried into every path we read.
 */
function edexcelGcseRsRouteAlias(
  wanted: SaveMyExamsCourseRequest,
): "a" | "b" | null {
  if (!isEdexcelReligiousStudies(wanted)) return null;
  // A-Level Edexcel RS is one course; only the GCSE specification is split.
  if (levelSlugFor(wanted.level) !== "gcse") return null;
  const route = /\b(?:religious studies|route)\s*([ab])\b/i.exec(
    wanted.rsRoute ?? "",
  );
  return route ? (route[1]!.toLowerCase() as "a" | "b") : null;
}

function subjectSlugCandidates(subject: string): string[] {
  const key = normalise(subject);
  const candidates = new Set<string>();
  const aliased = SUBJECT_SLUGS[key];
  if (aliased) candidates.add(aliased);
  candidates.add(
    subject
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
  );
  return [...candidates].filter(Boolean);
}

function levelMatches(wanted: string, offered: string | undefined): boolean {
  if (!offered) return false;
  const a = normalise(wanted);
  const b = normalise(offered);
  return a === b || b.startsWith(`${a} `) || a.startsWith(`${b} `);
}

const SUBJECT_TITLE_ALIASES: Record<string, string[]> = {
  mathematics: ["maths"],
  "further mathematics": ["further maths"],
  "design and technology": ["design technology"],
  "physical education": ["pe"],
  "religious studies": ["rs"],
  "business studies": ["business"],
};

function subjectMatches(wanted: string, offered: string | undefined): boolean {
  if (!offered) return false;
  const a = normalise(wanted);
  const b = normalise(offered);
  if (a === b) return true;
  const aliases = SUBJECT_TITLE_ALIASES[a] ?? [];
  if (aliases.includes(b)) return true;
  // A board often prints a route after the subject ("Biology A (Gateway)"),
  // but a different subject that merely contains the word is not a match.
  return b.startsWith(`${a} `);
}

function boardMatches(wanted: string, offered: string | undefined): boolean {
  if (!offered) return false;
  const a = normalise(wanted);
  const b = normalise(offered);
  return a === b || a.includes(b) || b.includes(a);
}

function pathWithSlash(path: string): string {
  return path.endsWith("/") ? path : `${path}/`;
}

function notesIndexPaths(
  html: string,
  basePath: string,
  tier: string | undefined,
): string[] {
  const paths = new Set<string>();
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const raw = (match[1] ?? "").replace(/&amp;/g, "&");
    let path: string;
    try {
      const url = new URL(raw, SITE);
      if (url.origin !== SITE) continue;
      path = url.pathname;
    } catch {
      continue;
    }
    if (!path.startsWith(basePath)) continue;
    if (!path.endsWith("/revision-notes/")) continue;
    paths.add(pathWithSlash(path));
  }
  // Most courses have a single notes index directly under the course. Maths
  // puts it under a tier (GCSE) or module (A-Level), and those links are in the
  // landing page's markup, so the direct path is only a fallback.
  if (paths.size === 0) paths.add(`${basePath}revision-notes/`);

  let selected = [...paths];
  const wantedTier = normalise(tier ?? "");
  const tiered = selected.filter((path) =>
    /\/(higher|foundation)\//i.test(path),
  );
  if (tiered.length > 0) {
    if (wantedTier === "higher" || wantedTier === "foundation") {
      selected = tiered.filter((path) =>
        path.split("/").some((part) => part.toLowerCase() === wantedTier),
      );
    } else {
      selected = tiered;
    }
  }

  return [...new Set(selected)]
    .sort((a, b) => a.length - b.length || a.localeCompare(b))
    .slice(0, MAX_NOTES_INDEXES);
}

/**
 * Reads a course landing page only when it is the exact course asked for.
 * `null` covers both a wrong course and an ambiguous hub; the resolver decides
 * whether anything was reachable at all.
 */
export function parseSaveMyExamsCourse(
  html: string,
  wanted: SaveMyExamsCourseRequest,
): SaveMyExamsCourse | null {
  const props = nextData(html);
  if (!props) return null;
  const breadcrumbs = asObject(props.breadcrumbs);
  const slugs = breadcrumbs ? asObject(breadcrumbs.slugs) : null;
  const titles = breadcrumbs ? asObject(breadcrumbs.titles) : null;
  if (!slugs || !titles) return null;

  const levelSlug = asString(slugs.level);
  const subjectSlug = asString(slugs.subject);
  const boardSlug = asString(slugs.board);
  const yearSlug = asString(slugs.year);
  const subjectAlias = asString(slugs.subjectAlias);
  const levelTitle = asString(titles.level);
  const subjectTitle = asString(titles.subject);
  const boardTitle = asString(titles.board);
  // A hub such as /gcse/biology/ocr/ has no canonical year segment and lists
  // two courses. Choosing one would be a guess, so it is not a match.
  if (!levelSlug || !subjectSlug || !boardSlug || !yearSlug) return null;
  if (!levelTitle || !subjectTitle || !boardTitle) return null;

  if (!levelMatches(wanted.level, levelTitle)) return null;
  if (!subjectMatches(wanted.subject, subjectTitle)) return null;
  if (!boardMatches(wanted.examBoard, boardTitle)) return null;

  const routeAlias = edexcelGcseRsRouteAlias(wanted);
  // Never fall into one route because the other was not checked. A route page
  // must carry the alias we asked for; a route page without a requested route
  // is ambiguous just like the OCR hub.
  if (
    isEdexcelReligiousStudies(wanted) &&
    subjectAlias !== (routeAlias ?? undefined)
  ) {
    return null;
  }

  const routeSegment = routeAlias ? `${routeAlias}/` : "";
  const basePath = pathWithSlash(
    `/${levelSlug}/${subjectSlug}/${boardSlug}/${routeSegment}${yearSlug}`,
  );
  const indexes = notesIndexPaths(html, basePath, wanted.tier);
  if (indexes.length === 0) return null;

  const resources = asObject(props.availableResources);
  const resourcePastPapers = resources
    ? asString(resources["past-papers"])
    : undefined;
  const pastPapersPath =
    resourcePastPapers && resourcePastPapers.startsWith(`/${levelSlug}/`)
      ? pathWithSlash(resourcePastPapers)
      : pathWithSlash(
          `/${levelSlug}/${subjectSlug}/${boardSlug}/${routeSegment}past-papers`,
        );

  const courseEntity =
    asObject(props.courseOrCourses) ??
    asObject(asArray(props.courseOrCourses)[0]);
  const courseName = courseEntity
    ? asString(asObject(courseEntity.attributes)?.name)
    : undefined;

  return {
    basePath,
    notesIndexPaths: indexes,
    pastPapersPath,
    levelSlug,
    subjectSlug,
    boardSlug,
    title:
      asString(props.courseTitle) ??
      courseName ??
      `${boardTitle} ${levelTitle} ${subjectTitle}`,
  };
}

type FetchResult =
  | { status: "ok"; url: string; html: string }
  | { status: "not-found" }
  | { status: "error" };

async function fetchPage(url: string): Promise<FetchResult> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "BluprintStudyBot/1.0 (+course notes and past-paper reader)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (response.status === 404 || response.status === 410) {
      return { status: "not-found" };
    }
    if (!response.ok) return { status: "error" };
    const html = (await response.text()).slice(0, MAX_HTML_CHARS);
    return { status: "ok", url: response.url || url, html };
  } catch {
    return { status: "error" };
  }
}

const courseCache = new Map<
  string,
  { at: number; result: SaveMyExamsResolveResult }
>();

/**
 * Finds the Save My Exams course that matches this Bluprint course. It tries
 * only the paths that can belong to the same subject and board; every returned
 * page is checked against the requested level, subject and board first.
 */
export async function resolveSaveMyExamsCourse(
  wanted: SaveMyExamsCourseRequest,
): Promise<SaveMyExamsResolveResult> {
  const levelSlug = levelSlugFor(wanted.level);
  const boardSlug = boardSlugFor(wanted.examBoard);
  if (!levelSlug || !boardSlug) return { status: "unmatched" };

  const cacheKey = [
    wanted.level,
    wanted.subject,
    wanted.examBoard,
    wanted.tier ?? "",
    wanted.variant ?? "",
    wanted.rsRoute ?? "",
  ]
    .map((part) => part.trim().toLowerCase())
    .join("|");
  const cached = courseCache.get(cacheKey);
  if (cached && Date.now() - cached.at < COURSE_CACHE_TTL) {
    return cached.result;
  }

  let sawPage = false;
  let sawError = false;
  const routeAlias = edexcelGcseRsRouteAlias(wanted);
  for (const subjectSlug of subjectSlugCandidates(wanted.subject)) {
    // The RS hub has no single course, so go straight to the selected route.
    const page = await fetchPage(
      routeAlias
        ? `${SITE}/${levelSlug}/${subjectSlug}/${boardSlug}/${routeAlias}/`
        : `${SITE}/${levelSlug}/${subjectSlug}/${boardSlug}/`,
    );
    if (page.status === "error") {
      sawError = true;
      continue;
    }
    if (page.status === "not-found") continue;
    sawPage = true;
    const course = parseSaveMyExamsCourse(page.html, wanted);
    if (course) {
      const result: SaveMyExamsResolveResult = { status: "matched", course };
      courseCache.set(cacheKey, { at: Date.now(), result });
      return result;
    }
  }

  const result: SaveMyExamsResolveResult =
    !sawPage && sawError
      ? { status: "unavailable" }
      : { status: "unmatched" };
  // A successful read that did not match is stable enough to cache; a network
  // failure is not, so the next visit tries again.
  if (result.status === "unmatched") {
    courseCache.set(cacheKey, { at: Date.now(), result });
  }
  return result;
}

/* ------------------------------------------------------------------------- */
/* Notes index and note pages                                                 */
/* ------------------------------------------------------------------------- */

export type SaveMyExamsNotePage = {
  title: string;
  url: string;
  reference?: string;
  sectionTitle: string;
  topicTitle: string;
  topicReference?: string;
  indexBasePath: string;
};

export type SaveMyExamsNotesIndex = {
  basePath: string;
  pages: SaveMyExamsNotePage[];
};

function slugReference(slug: string): string | undefined {
  const match = /^(\d+(?:-\d+)*)-/.exec(slug);
  return match ? match[1]!.replace(/-/g, ".") : undefined;
}

/** Reads the section → topic → subtopic tree behind one revision-notes index. */
export function parseSaveMyExamsNotesIndex(
  html: string,
): SaveMyExamsNotesIndex | null {
  const props = nextData(html);
  if (!props) return null;
  const basePath = asString(props.basePath);
  if (!basePath || !basePath.includes("/revision-notes/")) return null;

  const sections = asArray(props.sections);
  const topics = asArray(props.topics);
  const subtopics = asArray(props.subtopics);
  if (sections.length === 0 || topics.length === 0 || subtopics.length === 0) {
    return null;
  }

  const sectionById = new Map<string, JsonObject>();
  for (const raw of sections) {
    const entity = asObject(raw);
    const id = entity ? asString(entity.id) : undefined;
    if (entity && id) sectionById.set(id, entity);
  }
  const topicById = new Map<string, JsonObject>();
  for (const raw of topics) {
    const entity = asObject(raw);
    const id = entity ? asString(entity.id) : undefined;
    if (entity && id) topicById.set(id, entity);
  }

  const pages: SaveMyExamsNotePage[] = [];
  const seen = new Set<string>();
  for (const raw of subtopics) {
    const subtopic = asObject(raw);
    if (!subtopic) continue;
    const attrs = asObject(subtopic.attributes);
    const title = attrs ? asString(attrs.name) : undefined;
    const subtopicSlug = attrs ? asString(attrs.slug) : undefined;
    const status = attrs ? asString(attrs.status) : undefined;
    if (!title || !subtopicSlug || (status && status !== "published")) continue;
    if (!relationId(subtopic, "revision_note")) continue;

    const topicId = relationId(subtopic, "topic");
    const topic = topicId ? topicById.get(topicId) : null;
    if (!topic) continue;
    const topicAttrs = asObject(topic.attributes);
    const topicTitle = topicAttrs ? asString(topicAttrs.name) : undefined;
    const topicSlug = topicAttrs ? asString(topicAttrs.slug) : undefined;
    if (!topicTitle || !topicSlug) continue;

    const sectionId = relationId(topic, "section");
    const section = sectionId ? sectionById.get(sectionId) : null;
    if (!section) continue;
    const sectionAttrs = asObject(section.attributes);
    const sectionTitle = sectionAttrs ? asString(sectionAttrs.name) : undefined;
    const sectionSlug = sectionAttrs ? asString(sectionAttrs.slug) : undefined;
    if (!sectionTitle || !sectionSlug) continue;

    const url = pathWithSlash(
      `${SITE}${basePath}${sectionSlug}/${topicSlug}/${subtopicSlug}`,
    );
    if (seen.has(url)) continue;
    seen.add(url);
    pages.push({
      title,
      url,
      ...(slugReference(subtopicSlug)
        ? { reference: slugReference(subtopicSlug) }
        : {}),
      sectionTitle,
      topicTitle,
      ...(slugReference(topicSlug)
        ? { topicReference: slugReference(topicSlug) }
        : {}),
      indexBasePath: pathWithSlash(basePath),
    });
  }

  return pages.length > 0 ? { basePath: pathWithSlash(basePath), pages } : null;
}

export type SaveMyExamsOutlineTopic = {
  title: string;
  reference?: string;
  subtopics: string[];
};

export type SaveMyExamsOutlineSection = {
  title: string;
  topics: SaveMyExamsOutlineTopic[];
};

export type SaveMyExamsOutline = {
  sections: SaveMyExamsOutlineSection[];
  pageCount: number;
  sourceUrl: string;
};

/** Sorts the numbered sections boards print as "1. Shakespeare". */
function numberedSection(title: string): { number: number | null; text: string } {
  const match = /^(\d+)[.)]?\s+(.+)$/.exec(title.trim());
  if (!match) return { number: null, text: title.trim() };
  return {
    number: Number(match[1]),
    text: (match[2] ?? "").trim() || title.trim(),
  };
}

/**
 * Turns the note-page hierarchy into the unit/topic/subtopic outline the course
 * pathway renders. Saving this shape rather than inventing a separate syllabus
 * is what keeps every pathway topic matched to its published notes.
 */
export function outlineFromSaveMyExams(
  indexes: SaveMyExamsNotesIndex[],
): SaveMyExamsOutline | null {
  type TopicRow = {
    title: string;
    reference?: string;
    subtopics: string[];
    seen: Set<string>;
    order: number;
  };
  type SectionRow = {
    title: string;
    number: number | null;
    order: number;
    topics: Map<string, TopicRow>;
  };

  const sections = new Map<string, SectionRow>();
  let pageCount = 0;
  let sourceUrl = "";

  for (const index of indexes) {
    if (!sourceUrl) sourceUrl = `${SITE}${index.basePath}`;
    for (const page of index.pages) {
      pageCount += 1;
      const section = numberedSection(page.sectionTitle.trim() || "Course content");
      const sectionKey = titleKey(section.text);
      let sectionRow = sections.get(sectionKey);
      if (!sectionRow) {
        sectionRow = {
          title: section.text,
          number: section.number,
          order: sections.size,
          topics: new Map(),
        };
        sections.set(sectionKey, sectionRow);
      }

      const topicTitle = page.topicTitle.trim();
      if (!topicTitle) continue;
      const topicKey = titleKey(topicTitle);
      let topic = sectionRow.topics.get(topicKey);
      if (!topic) {
        topic = {
          title: topicTitle,
          ...(page.topicReference ? { reference: page.topicReference } : {}),
          subtopics: [],
          seen: new Set(),
          order: sectionRow.topics.size,
        };
        sectionRow.topics.set(topicKey, topic);
      }
      if (topic.seen.has(page.url)) continue;
      topic.seen.add(page.url);
      const label = [page.reference, page.title]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (label) topic.subtopics.push(label);
    }
  }

  const ordered = [...sections.values()]
    .sort((a, b) => {
      if (a.number !== null && b.number !== null) {
        return a.number - b.number || a.order - b.order;
      }
      if (a.number !== null) return -1;
      if (b.number !== null) return 1;
      return a.order - b.order;
    })
    .map((section) => ({
      title: section.title,
      topics: [...section.topics.values()]
        .sort((a, b) => a.order - b.order)
        .map((topic) => ({
          title: topic.title,
          ...(topic.reference ? { reference: topic.reference } : {}),
          subtopics: [...topic.subtopics],
        })),
    }))
    .filter((section) => section.topics.length > 0);

  if (ordered.length === 0) return null;
  return { sections: ordered, pageCount, sourceUrl: sourceUrl || SITE };
}

export type SaveMyExamsLiteratureChoices = {
  shakespeare?: string;
  novel?: string;
  modern?: string;
  poetry?: string;
};

type LiteratureSection = "shakespeare" | "novel" | "modern" | "poetry";

/** Which set-text group a Save My Exams section belongs to. */
function literatureSection(title: string): LiteratureSection | null {
  const key = titleKey(title);
  if (key.includes("shakespeare")) return "shakespeare";
  if (key.includes("19th century") || key.includes("novel")) return "novel";
  if (
    key.includes("modern text") ||
    key.includes("modern prose") ||
    key.includes("post 1914")
  ) {
    return "modern";
  }
  if (key.includes("poetry")) return "poetry";
  return null;
}

/** Keeps the exam-technique pages that sit above the set texts. */
function isLiteratureGuide(title: string): boolean {
  const key = titleKey(title);
  return (
    key.startsWith("how to answer") ||
    key.includes("exam technique") ||
    key.includes("exam skills") ||
    key === "overview" ||
    key === "an overview"
  );
}

function isChosenText(title: string, choice: string): boolean {
  const topic = titleKey(title);
  const chosen = titleKey(choice);
  if (!topic || !chosen) return false;
  return topic === chosen || topic.includes(chosen) || chosen.includes(topic);
}

/**
 * Narrows an English Literature outline to the set texts a student chose.
 *
 * Save My Exams publishes every text a board offers under one section. The
 * pathway should only show the Shakespeare play, novel, modern text and poetry
 * cluster studied in class, while keeping the "How to Answer" guidance that
 * applies to the whole section. When a chosen title cannot be matched the
 * section is left intact rather than silently discarding the course content.
 */
export function filterSaveMyExamsLiteratureOutline(
  outline: SaveMyExamsOutline,
  choices: SaveMyExamsLiteratureChoices,
): SaveMyExamsOutline {
  const sections = outline.sections.map((section) => {
    const group = literatureSection(section.title);
    const choice = group ? choices[group]?.trim() : undefined;
    if (!choice) return section;

    if (!section.topics.some((topic) => isChosenText(topic.title, choice))) {
      return section;
    }

    return {
      ...section,
      topics: section.topics.filter(
        (topic) =>
          isLiteratureGuide(topic.title) ||
          isChosenText(topic.title, choice),
      ),
    };
  });

  const kept = sections.filter((section) => section.topics.length > 0);
  if (kept.length === 0) return outline;

  return {
    ...outline,
    sections: kept,
    pageCount: kept.reduce(
      (sum, section) =>
        sum +
        section.topics.reduce(
          (topicSum, topic) => topicSum + topic.subtopics.length,
          0,
        ),
      0,
    ),
  };
}

/**
 * Picks the note pages for one pathway topic. Exact topic names are preferred;
 * a specification reference is used next. No fuzzy matching is allowed here:
 * the wrong subtopic is worse than falling back to Bluprint's own notes.
 */
export function findSaveMyExamsNotesPages(
  indexes: SaveMyExamsNotesIndex[],
  topic: { title: string; reference?: string },
): SaveMyExamsNotePage[] {
  const pages = new Map<string, SaveMyExamsNotePage>();
  for (const index of indexes) {
    for (const page of index.pages) if (!pages.has(page.url)) pages.set(page.url, page);
  }
  const all = [...pages.values()];
  const wanted = titleKey(topic.title);
  if (!wanted) return [];

  const limit = (rows: SaveMyExamsNotePage[]) => rows.slice(0, MAX_TOPIC_PAGES);

  const byTopic = all.filter((page) => titleKey(page.topicTitle) === wanted);
  if (byTopic.length > 0) return limit(byTopic);

  const reference = topic.reference?.trim();
  if (reference) {
    const byReference = all.filter((page) => {
      const have = page.topicReference;
      return have === reference || have?.startsWith(`${reference}.`);
    });
    if (byReference.length > 0) return limit(byReference);
  }

  const bySection = all.filter(
    (page) => titleKey(page.sectionTitle) === wanted,
  );
  if (bySection.length > 0) return limit(bySection);

  const exactSubtopic = all.filter((page) => titleKey(page.title) === wanted);
  if (exactSubtopic.length === 1) return exactSubtopic;
  return [];
}

function nodeType(node: JsonObject): string {
  return asString(node.type) ?? asString(node._type) ?? "";
}

function textOf(node: JsonObject): string {
  const direct = asString(node.text);
  if (direct) return direct;
  return asArray(node.content)
    .map((child) => {
      const object = asObject(child);
      return object ? textOf(object) : "";
    })
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanBlock(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function isImageCredit(value: string): boolean {
  return /^use this image$/i.test(cleanBlock(value));
}

function collectBlocks(nodes: unknown[], out: string[]): void {
  for (const raw of nodes) {
    const node = asObject(raw);
    if (!node) continue;
    const type = nodeType(node);
    const children = asArray(node.content);

    if (type === "paragraph" || type === "heading" || type === "blockquote") {
      const value = textOf(node);
      if (value && !isImageCredit(value)) out.push(value);
      continue;
    }

    if (type === "bulletList" || type === "orderedList") {
      for (const itemRaw of children) {
        const item = asObject(itemRaw);
        if (!item) continue;
        const value = textOf(item);
        if (value && !isImageCredit(value)) out.push(`• ${value}`);
      }
      continue;
    }

    if (type === "table") {
      for (const rowRaw of children) {
        const row = asObject(rowRaw);
        if (!row) continue;
        const cells = asArray(row.content)
          .map((cellRaw) => {
            const cell = asObject(cellRaw);
            return cell ? textOf(cell) : "";
          })
          .filter(Boolean);
        if (cells.length > 0) out.push(cells.join(" · "));
      }
      continue;
    }

    if (type === "figure") {
      const attrs = asObject(node.attrs);
      const caption = attrs ? asString(attrs.caption) : undefined;
      if (caption && !isImageCredit(caption)) out.push(`Figure: ${caption}`);
      continue;
    }

    if (type === "specPoint" || type === "callout" || type === "block") {
      collectBlocks(children, out);
      continue;
    }

    // Unknown wrappers are still read for their text, but only when they do
    // not contain recognised block children (which would duplicate content).
    const value = textOf(node);
    if (value && !isImageCredit(value)) out.push(value);
  }
}

function sectionHeading(
  node: JsonObject,
  subtopicTitle: string,
  position: number,
): string {
  const attrs = asObject(node.attrs);
  const name = attrs ? asString(attrs.name) : undefined;
  if (name) return name;
  const firstHeading = asArray(node.content)
    .map(asObject)
    .find((child) => child && nodeType(child) === "heading");
  const fromContent = firstHeading ? textOf(firstHeading) : "";
  return fromContent || subtopicTitle || `Specification point ${position + 1}`;
}

/**
 * Reads one published subtopic note. The page must sit under the notes index it
 * came from and, when known, be the same subtopic slug; that keeps a redirect or
 * a stale link from mixing another course's notes into the topic.
 */
export function parseSaveMyExamsNotePage(
  html: string,
  expectedBasePath: string,
  expectedSubtopicSlug?: string,
): Array<{ heading: string; blocks: string[] }> | null {
  const props = nextData(html);
  if (!props) return null;
  const basePath = asString(props.basePath);
  if (!basePath || pathWithSlash(basePath) !== pathWithSlash(expectedBasePath)) {
    return null;
  }
  const breadcrumbs = asObject(props.breadcrumbs);
  const slugs = breadcrumbs ? asObject(breadcrumbs.slugs) : null;
  const titles = breadcrumbs ? asObject(breadcrumbs.titles) : null;
  if (
    expectedSubtopicSlug &&
    asString(slugs?.subtopic) !== expectedSubtopicSlug
  ) {
    return null;
  }

  const subtopicAttrs = asObject(asObject(props.subtopic)?.attributes);
  const subtopicTitle =
    asString(titles?.subtopic) ??
    (subtopicAttrs ? asString(subtopicAttrs.name) : undefined) ??
    "Notes";
  const revisionNote = asObject(props.revisionNote);
  const attrs = revisionNote ? asObject(revisionNote.attributes) : null;
  const content = attrs ? asArray(attrs.content) : [];
  if (content.length === 0) return [];

  const specPoints = content
    .map(asObject)
    .filter((node): node is JsonObject => Boolean(node && nodeType(node) === "specPoint"));

  const sections: Array<{ heading: string; blocks: string[] }> = [];
  if (specPoints.length > 0) {
    specPoints.forEach((node, index) => {
      const heading = cleanBlock(sectionHeading(node, subtopicTitle, index));
      const blocks: string[] = [];
      collectBlocks(asArray(node.content), blocks);
      const cleaned = blocks
        .map(cleanBlock)
        .filter(Boolean)
        .filter(
          (block, blockIndex) =>
            !(blockIndex === 0 && titleKey(block) === titleKey(heading)),
        );
      const unique = cleaned.filter(
        (block, blockIndex) => blockIndex === 0 || block !== cleaned[blockIndex - 1],
      );
      if (heading && unique.length > 0) {
        sections.push({ heading, blocks: unique });
      }
    });
  } else {
    const blocks: string[] = [];
    collectBlocks(content, blocks);
    const cleaned = blocks.map(cleanBlock).filter(Boolean);
    if (cleaned.length > 0) {
      sections.push({ heading: subtopicTitle, blocks: cleaned });
    }
  }

  return sections;
}

/* ------------------------------------------------------------------------- */
/* Past papers                                                               */
/* ------------------------------------------------------------------------- */

export type SaveMyExamsPaper = {
  year: string;
  label: string;
  questionUrl: string;
  markSchemeUrl?: string;
};

export type SaveMyExamsPaperFilter = {
  tier?: string;
  levelSlug?: string;
  subjectSlug?: string;
  boardSlug?: string;
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function safeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function paperCategory(
  paper: JsonObject,
  categories: Map<string, JsonObject>,
): JsonObject | null {
  const id = relationId(paper, "paper_category");
  if (id && categories.has(id)) return categories.get(id)!;
  const included = asArray(paper.included)
    .map(asObject)
    .find((item) => item && nodeType(item) === "paper_category");
  return included ?? null;
}

/**
 * Reads the board papers Save My Exams indexes for a course. The PDF links
 * point at the exam board's own files; Save My Exams is the index, not a copy.
 */
export function parseSaveMyExamsPastPapers(
  html: string,
  filter: SaveMyExamsPaperFilter = {},
): SaveMyExamsPaper[] {
  const props = nextData(html);
  if (!props) return [];
  const breadcrumbs = asObject(props.breadcrumbs);
  const slugs = breadcrumbs ? asObject(breadcrumbs.slugs) : null;
  if (
    (filter.levelSlug && asString(slugs?.level) !== filter.levelSlug) ||
    (filter.subjectSlug && asString(slugs?.subject) !== filter.subjectSlug) ||
    (filter.boardSlug && asString(slugs?.board) !== filter.boardSlug)
  ) {
    return [];
  }

  const course = asObject(props.course);
  const included = course ? asArray(course.included) : [];
  const categories = new Map<string, JsonObject>();
  for (const raw of included) {
    const item = asObject(raw);
    const id = item ? asString(item.id) : undefined;
    if (item && id && nodeType(item) === "paper_category") {
      categories.set(id, item);
    }
  }

  const hasTieredPapers = [...categories.values()].some((category) =>
    Boolean(asString(asObject(category.attributes)?.tier)),
  );
  const wantedTier = normalise(filter.tier ?? "");
  const rows: Array<{
    paper: SaveMyExamsPaper;
    yearSort: number;
    monthSort: number;
    categoryOrder: number;
  }> = [];
  const seen = new Set<string>();

  for (const raw of included) {
    const paper = asObject(raw);
    if (!paper || nodeType(paper) !== "past_paper") continue;
    const attrs = asObject(paper.attributes);
    if (!attrs || asString(attrs.status) !== "published") continue;
    const questionUrl = safeUrl(asString(attrs.exam_paper));
    if (!questionUrl) continue;

    const category = paperCategory(paper, categories);
    const categoryAttrs = category ? asObject(category.attributes) : null;
    const categoryTier = categoryAttrs
      ? asString(categoryAttrs.tier)
      : undefined;
    if (
      hasTieredPapers &&
      (wantedTier === "higher" || wantedTier === "foundation")
    ) {
      if (!categoryTier || normalise(categoryTier) !== wantedTier) continue;
    }

    const isSpecimen = attrs.is_specimen_paper === true;
    const yearNumber = asNumber(attrs.year);
    const monthNumber = asNumber(attrs.month);
    const code = asString(attrs.code);
    const number =
      (categoryAttrs ? asString(categoryAttrs.number) : undefined) ??
      (categoryAttrs ? asString(categoryAttrs.name) : undefined) ??
      "Paper";
    const labelParts: string[] = [];
    if (isSpecimen) labelParts.push("Specimen");
    else if (monthNumber && MONTHS[monthNumber - 1]) {
      labelParts.push(MONTHS[monthNumber - 1]!);
    }
    labelParts.push(
      categoryTier ? `${number} (${categoryTier})` : number,
    );
    if (code) labelParts.push(code);

    const markSchemeUrl = safeUrl(asString(attrs.mark_scheme));
    const key = `${questionUrl}|${markSchemeUrl ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push({
      paper: {
        year: isSpecimen ? "Specimen" : yearNumber ? String(yearNumber) : "Undated",
        label: labelParts.join(" · "),
        questionUrl,
        ...(markSchemeUrl ? { markSchemeUrl } : {}),
      },
      yearSort: isSpecimen ? 0 : (yearNumber ?? 0),
      monthSort: isSpecimen ? 0 : (monthNumber ?? 0),
      categoryOrder: categoryAttrs
        ? (asNumber(categoryAttrs.order) ?? 0)
        : 0,
    });
  }

  rows.sort(
    (a, b) =>
      b.yearSort - a.yearSort ||
      b.monthSort - a.monthSort ||
      a.categoryOrder - b.categoryOrder ||
      a.paper.label.localeCompare(b.paper.label),
  );
  return rows.slice(0, MAX_PAPERS).map((row) => row.paper);
}

/* ------------------------------------------------------------------------- */
/* Network helpers used by the Convex actions                                */
/* ------------------------------------------------------------------------- */

export async function fetchSaveMyExamsPage(
  pathOrUrl: string,
): Promise<FetchResult> {
  return fetchPage(pathOrUrl.startsWith("http") ? pathOrUrl : `${SITE}${pathOrUrl}`);
}

export function saveMyExamsSiteOrigin(): string {
  return SITE;
}
