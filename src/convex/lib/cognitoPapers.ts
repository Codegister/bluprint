/**
 * Cognito's published past-paper index.
 *
 * Cognito (cognito.org) organises every course's real board papers under
 * `…/past-papers/by-year` (whole papers, sorted by exam series) and
 * `…/past-papers/by-topic` (past-paper questions grouped by specification
 * topic). Each entry is a question paper plus its official mark scheme, and
 * the files are served from Cognito's own asset host.
 *
 * This module reads those two pages and returns the index: which papers exist
 * for a course, what year and specification they belong to, and where each
 * question paper and mark scheme lives. Only the index is read — the app links
 * to the official PDFs where Cognito publishes them rather than copying exam
 * board content into our own storage, because the papers and mark schemes
 * themselves are the boards' copyright.
 *
 * No model is involved. The index is exactly what Cognito publishes, so the
 * same course always produces the same list.
 *
 * Reading the pages: the list is server-rendered, and each element carries a
 * stable hook — an `<h3>` for a top-level group ("New 9-1 specification"), a
 * `<button aria-label="…">` for a group or a paper row ("Paper 1 — 2
 * downloads"), and an `<a href>` pointing at the PDF. The parser walks those in
 * document order, which is what keeps a paper attached to the right year group
 * even though the markup nests deeply and repeats each link for mobile.
 */

import {
  COGNITO_SITE,
  cognitoBoardSlug,
  cognitoLevelSlug,
  findSubjectSlug,
  routeSlugs,
  type CognitoCourse,
} from "./cognito";

/** One real board paper: the question paper and its official mark scheme. */
export type CognitoPaper = {
  /** "Paper 1", "Nov 21 Paper 1", "Specimen Paper 1". */
  label: string;
  /** The year or series group Cognito files it under, e.g. "2025". */
  year?: string;
  /** "New 9-1 specification" / "Old specification" / "Biology". */
  specification?: string;
  questionPaperUrl: string;
  markSchemeUrl?: string;
};

/** One set of past-paper questions, grouped by specification topic. */
export type CognitoTopicPaper = {
  /** "Cell Division 1". */
  topic: string;
  /** The unit Cognito groups it under, e.g. "Topic 1 - Cell Biology". */
  unit?: string;
  questionPaperUrl: string;
  markSchemeUrl?: string;
};

export type CognitoPaperIndex = {
  /** The by-year page this index was read from, for attribution. */
  sourceUrl: string;
  /** Cognito's own one-line description of the page. */
  description?: string;
  byYear: CognitoPaper[];
  byTopic: CognitoTopicPaper[];
};

const VIEW_TIMEOUT_MS = 25_000;
/** Real paper pages are around 600 KB; this is a guard, not a limit. */
const MAX_HTML_CHARS = 4_000_000;
const FILE_HOST = "https://files.cognitoedu.org";

/* -------------------------------------------------------------------------- */
/* Page reading                                                               */
/* -------------------------------------------------------------------------- */

async function fetchPage(
  url: string,
): Promise<{ url: string; html: string } | null> {
  // A plain controller plus a timer, rather than AbortSignal.timeout, so the
  // reader behaves the same in Convex's default runtime as it does in Node.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VIEW_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        // Cognito's robots.txt allows automated readers; identify plainly.
        "User-Agent": "BluprintStudyBot/1.0 (+past paper index)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const html = (await response.text()).slice(0, MAX_HTML_CHARS);
    return { url: response.url || url, html };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
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
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Cognito's own description of the page, shown as the attribution line. */
function metaDescription(html: string): string | undefined {
  const patterns = [
    /<meta\s+name="description"\s+content="([^"]*)"/i,
    /<meta\s+content="([^"]*)"\s+name="description"/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) {
      const text = decodeEntities(match[1]).trim();
      if (text) return text;
    }
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                    */
/* -------------------------------------------------------------------------- */

type Token =
  | { at: number; kind: "section"; text: string }
  | { at: number; kind: "group"; text: string }
  | { at: number; kind: "row"; text: string }
  | { at: number; kind: "link"; text: string; url: string };

/** "Paper 1 — 2 downloads" is the row hook; anything else on a button is a group. */
const ROW_LABEL = /^(.*?)\s*[\u2014-]\s*\d+\s*downloads?$/i;

/**
 * Reads the page into a flat list of positioned tokens. A fresh set of regular
 * expressions is built per call so repeated parses cannot inherit a lastIndex.
 */
function tokenize(html: string, groupClass: string): Token[] {
  const tokens: Token[] = [];

  for (const match of html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)) {
    tokens.push({
      at: match.index ?? 0,
      kind: "section",
      text: stripTags(match[1] ?? ""),
    });
  }

  for (const match of html.matchAll(/<button\b[^>]*aria-label="([^"]*)"[^>]*>/gi)) {
    const label = decodeEntities(match[1] ?? "").trim();
    const row = ROW_LABEL.exec(label);
    tokens.push(
      row
        ? { at: match.index ?? 0, kind: "row", text: (row[1] ?? "").trim() }
        : { at: match.index ?? 0, kind: "group", text: label },
    );
  }

  // Group headings are plain spans: the year on the by-year page and the unit
  // name ("Topic 1 - Cell Biology") on the by-topic page.
  const groupSpan = new RegExp(
    `<span class="[^"]*${groupClass}[^"]*"[^>]*>([^<]+)</span>`,
    "gi",
  );
  for (const match of html.matchAll(groupSpan)) {
    tokens.push({
      at: match.index ?? 0,
      kind: "group",
      text: decodeEntities(match[1] ?? "").trim(),
    });
  }

  const link = new RegExp(
    `<a\\b[^>]*href="(${FILE_HOST}[^"]*)"[^>]*>([\\s\\S]*?)<\\/a>`,
    "gi",
  );
  for (const match of html.matchAll(link)) {
    tokens.push({
      at: match.index ?? 0,
      kind: "link",
      url: decodeEntities(match[1] ?? ""),
      text: stripTags(match[2] ?? ""),
    });
  }

  return tokens.sort((a, b) => a.at - b.at);
}

/**
 * Walks the token stream, attaching each question paper and mark scheme to the
 * row it follows. The same link appears twice in the markup (once for the mobile
 * row and once for the desktop row), so the first URL for each slot wins.
 */
export function parseYearPage(html: string): CognitoPaper[] {
  const papers: CognitoPaper[] = [];
  let specification: string | undefined;
  let year: string | undefined;
  let label: string | undefined;
  let questionPaperUrl: string | undefined;
  let markSchemeUrl: string | undefined;

  const flush = () => {
    if (label && questionPaperUrl) {
      papers.push({
        label,
        ...(year ? { year } : {}),
        ...(specification ? { specification } : {}),
        questionPaperUrl,
        ...(markSchemeUrl ? { markSchemeUrl } : {}),
      });
    }
    label = undefined;
    questionPaperUrl = undefined;
    markSchemeUrl = undefined;
  };

  for (const token of tokenize(html, "text-text-brand-bold")) {
    if (token.kind === "section") {
      flush();
      specification = token.text || undefined;
      year = undefined;
      continue;
    }
    if (token.kind === "group") {
      flush();
      year = token.text || undefined;
      continue;
    }
    if (token.kind === "row") {
      flush();
      label = token.text || undefined;
      continue;
    }
    if (token.kind === "link" && label) {
      if (/^mark\s*scheme/i.test(token.text)) markSchemeUrl ??= token.url;
      else if (/^paper/i.test(token.text)) questionPaperUrl ??= token.url;
    }
  }
  flush();

  return papers;
}

/** The same walk over the by-topic page, where rows are topic question sets. */
export function parseTopicPage(html: string): CognitoTopicPaper[] {
  const topicPapers: CognitoTopicPaper[] = [];
  let unit: string | undefined;
  let topic: string | undefined;
  let questionPaperUrl: string | undefined;
  let markSchemeUrl: string | undefined;

  const flush = () => {
    if (topic && questionPaperUrl) {
      topicPapers.push({
        topic,
        ...(unit ? { unit } : {}),
        questionPaperUrl,
        ...(markSchemeUrl ? { markSchemeUrl } : {}),
      });
    }
    topic = undefined;
    questionPaperUrl = undefined;
    markSchemeUrl = undefined;
  };

  for (const token of tokenize(html, "text-text-ink-primary")) {
    if (token.kind === "section" || token.kind === "group") {
      flush();
      unit = token.text || undefined;
      continue;
    }
    if (token.kind === "row") {
      flush();
      topic = token.text || undefined;
      continue;
    }
    if (token.kind === "link" && topic) {
      if (/^mark\s*scheme/i.test(token.text)) markSchemeUrl ??= token.url;
      else if (/^paper/i.test(token.text)) questionPaperUrl ??= token.url;
    }
  }
  flush();

  return topicPapers;
}

/* -------------------------------------------------------------------------- */
/* URL building and fetching                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The folder paths a course's papers can live under. Cognito redirects older
 * paths (biology → biology-triple) itself, so the candidates are tried in order
 * and the first one that returns papers wins.
 */
function candidateBases(
  levelSlug: string,
  subjectSlug: string,
  boardSlug: string | null,
  routes: string[],
): string[] {
  const bases: string[] = [];
  if (boardSlug) {
    for (const route of routes) {
      bases.push(`/courses/${levelSlug}/${subjectSlug}/${boardSlug}/${route}`);
    }
    bases.push(`/courses/${levelSlug}/${subjectSlug}/${boardSlug}`);
  }
  for (const route of routes) {
    bases.push(`/courses/${levelSlug}/${subjectSlug}/${route}`);
  }
  if (!boardSlug) bases.push(`/courses/${levelSlug}/${subjectSlug}`);
  return [...new Set(bases)];
}

/** Combined Science keeps one paper list per component subject. */
const COMBINED_SCIENCE_COMPONENTS = ["biology", "chemistry", "physics"] as const;

type ViewResult<T> = { url: string; description?: string; items: T[] };

async function readYearView(base: string): Promise<ViewResult<CognitoPaper> | null> {
  const page = await fetchPage(`${COGNITO_SITE}${base}/past-papers/by-year`);
  if (!page) return null;
  const items = parseYearPage(page.html);
  if (items.length === 0) return null;
  return {
    url: page.url,
    description: metaDescription(page.html),
    items,
  };
}

async function readTopicView(
  base: string,
): Promise<ViewResult<CognitoTopicPaper>> {
  const page = await fetchPage(`${COGNITO_SITE}${base}/past-papers/by-topic`);
  if (!page) return { url: `${COGNITO_SITE}${base}/past-papers/by-topic`, items: [] };
  return { url: page.url, items: parseTopicPage(page.html) };
}

/**
 * Reads a course's whole past-paper index: the papers by year and the same
 * questions grouped by topic. Returns null when Cognito publishes nothing for
 * the course, so the caller can simply show no papers rather than an error.
 */
export async function fetchCognitoPapers(
  course: CognitoCourse,
): Promise<CognitoPaperIndex | null> {
  const levelSlug = cognitoLevelSlug(course.level);
  if (!levelSlug) return null;

  const subjectSlug = await findSubjectSlug(levelSlug, course.subject);
  if (!subjectSlug) return null;

  const boardSlug = cognitoBoardSlug(course.examBoard);
  const routes = routeSlugs(course);

  // Combined Science is split into Biology, Chemistry and Physics before the
  // board, so its papers are read from each component and merged. The component
  // name is kept on the entry so the UI can separate them.
  if (subjectSlug === "combined-science") {
    if (!boardSlug || routes.length === 0) return null;
    const route = routes[0]!;
    const components = COMBINED_SCIENCE_COMPONENTS.map((component) => ({
      name: component.charAt(0).toUpperCase() + component.slice(1),
      // The menu path redirects to Cognito's canonical `…-combined` course, so
      // both spellings are offered and the first that returns papers is used.
      bases: [
        ...candidateBases(levelSlug, `${component}-combined`, boardSlug, [route]),
        ...candidateBases(levelSlug, `combined-science/${component}`, boardSlug, [route]),
      ],
    }));

    const byYear: CognitoPaper[] = [];
    const byTopic: CognitoTopicPaper[] = [];
    let sourceUrl: string | undefined;
    let description: string | undefined;

    for (const component of components) {
      let year: ViewResult<CognitoPaper> | null = null;
      let base: string | undefined;
      for (const candidate of component.bases) {
        year = await readYearView(candidate);
        if (year) {
          base = candidate;
          break;
        }
      }
      if (!year || !base) continue;

      sourceUrl ??= year.url;
      description ??= year.description;
      byYear.push(
        ...year.items.map((paper) => ({ ...paper, specification: component.name })),
      );
      const topic = await readTopicView(base);
      byTopic.push(...topic.items.map((paper) => ({ ...paper, unit: component.name })));
    }

    if (byYear.length === 0) return null;
    return {
      sourceUrl: sourceUrl ?? `${COGNITO_SITE}/courses/${levelSlug}/combined-science`,
      ...(description ? { description } : {}),
      byYear,
      byTopic,
    };
  }

  for (const base of candidateBases(levelSlug, subjectSlug, boardSlug, routes)) {
    const year = await readYearView(base);
    if (!year) continue;
    const topic = await readTopicView(base);
    return {
      sourceUrl: year.url,
      ...(year.description ? { description: year.description } : {}),
      byYear: year.items,
      byTopic: topic.items,
    };
  }

  return null;
}
