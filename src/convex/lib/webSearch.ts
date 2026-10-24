/**
 * Web grounding for the AI tutor.
 *
 * Two tiers, cheapest first:
 *
 *  1. Keyless — Wikipedia, Wikibooks, Stack Exchange and DuckDuckGo's Instant
 *     Answer API. Documented public endpoints, no account, no bill. They cover
 *     most study questions ("what is mitosis", "why does benzene delocalise").
 *  2. Keyed — Tavily, Exa and Serper, only called when the keyless tier could
 *     not find enough substance, and only when their key is set on the
 *     deployment. Each provider is skipped for a few minutes after a rate
 *     limit, so one exhausted free tier hands over to the next automatically.
 *
 * Every provider is best-effort: a failure is a missing source, never a failed
 * tutor answer. Results are normalised to `{ title, url, snippet }` and are safe
 * to show as citations.
 */

export type WebResult = { title: string; url: string; snippet: string };

export type SearchOutcome = {
  results: WebResult[];
  /** True when the results are substantial enough to answer from. */
  covered: boolean;
  /** Which providers actually contributed, for logs and debugging. */
  providers: string[];
};

const MAX_RESULTS = 5;
const SNIPPET_CHARS = 600;
const DISPLAY_CHARS = 320;

// Wikimedia's etiquette asks clients to identify themselves. Setting
// WIKIMEDIA_CONTACT to a real email or URL moves this client from the unnamed
// allowance (about ten requests a minute) to the higher bot allowance.
const USER_AGENT = [
  "BluprintStudy/1.0 (educational revision app)",
  process.env.WIKIMEDIA_CONTACT?.trim(),
]
  .filter(Boolean)
  .join(" ");

/**
 * Wikimedia throttles unnamed clients per IP, and a cloud egress IP is shared
 * with other traffic. A 429 parks the wiki providers for ten minutes instead of
 * retrying into the same wall; the rest of the tier carries on meanwhile.
 */
let wikiCooldownUntil = 0;
const WIKI_COOLDOWN_MS = 10 * 60 * 1000;

/** Repeat questions inside a conversation are common; answer them locally. */
const searchCache = new Map<string, { expiresAt: number; value: SearchOutcome }>();
const SEARCH_TTL_MS = 15 * 60 * 1000;

/** Words that make a Wikipedia keyword search worse, not better. */
const STOPWORDS = new Set([
  "a", "about", "after", "all", "also", "an", "and", "any", "are", "as", "at",
  "be", "before", "between", "both", "but", "by", "can", "could", "did", "do",
  "does", "doing", "during", "each", "explain", "for", "from", "give", "had",
  "has", "have", "how", "i", "if", "in", "into", "is", "it", "its", "just",
  "like", "many", "may", "me", "might", "more", "most", "much", "my", "need",
  "of", "on", "or", "other", "our", "out", "over", "please", "should", "show",
  "so", "some", "such", "tell", "than", "that", "the", "their", "them", "then",
  "there", "these", "they", "this", "those", "to", "under", "up", "use", "used",
  "very", "was", "we", "were", "what", "when", "where", "which", "while", "who",
  "why", "will", "with", "would", "you", "your",
]);

function plainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) return value;
  const cut = value.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 120 ? lastSpace : limit)}…`;
}

function dedupe(results: WebResult[]): WebResult[] {
  const seen = new Set<string>();
  const output: WebResult[] = [];
  for (const result of results) {
    const title = plainText(result.title);
    const snippet = truncate(plainText(result.snippet), SNIPPET_CHARS);
    if (!title || !result.url || snippet.length < 40) continue;
    if (seen.has(result.url)) continue;
    seen.add(result.url);
    output.push({ title, url: result.url, snippet });
  }
  return output;
}

/** Significant words from a natural question, best guesses first. */
function searchTerms(question: string): string[][] {
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word))
    .slice(0, 8);
  if (words.length === 0) return [];

  // Wikipedia search is keyword matching, so try the full phrase first and then
  // progressively looser versions. A long question otherwise matches nothing.
  const attempts: string[][] = [words];
  if (words.length > 5) attempts.push(words.slice(0, 5));
  if (words.length > 3) attempts.push(words.slice(0, 3));
  return attempts;
}

/* -------------------------------------------------------------------------- */
/* Keyless tier                                                               */
/* -------------------------------------------------------------------------- */

type MediaWikiHit = { title: string; snippet: string };

async function mediaWikiSearch(
  host: string,
  term: string,
  limit: number,
): Promise<MediaWikiHit[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    list: "search",
    srlimit: String(limit),
    srprop: "snippet",
    srsearch: term,
    origin: "*",
  });
  if (Date.now() < wikiCooldownUntil) return [];
  const response = await fetch(`https://${host}/w/api.php?${params}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(7000),
  });
  if (response.status === 429) {
    wikiCooldownUntil = Date.now() + WIKI_COOLDOWN_MS;
    return [];
  }
  if (!response.ok) return [];
  const payload = (await response.json()) as {
    query?: { search?: Array<{ title?: string; snippet?: string }> };
  };
  return (payload.query?.search ?? []).map((row) => ({
    title: row.title ?? "",
    snippet: row.snippet ?? "",
  }));
}

/** Introductions for the top hits, in one request, to give real substance. */
async function mediaWikiIntros(
  host: string,
  titles: string[],
): Promise<Map<string, string>> {
  const extracts = new Map<string, string>();
  if (titles.length === 0) return extracts;
  if (Date.now() < wikiCooldownUntil) return extracts;

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "extracts",
    exintro: "1",
    explaintext: "1",
    redirects: "1",
    titles: titles.slice(0, 3).join("|"),
    origin: "*",
  });
  try {
    const response = await fetch(`https://${host}/w/api.php?${params}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    });
    if (response.status === 429) {
      wikiCooldownUntil = Date.now() + WIKI_COOLDOWN_MS;
      return extracts;
    }
    if (!response.ok) return extracts;
    const payload = (await response.json()) as {
      query?: { pages?: Record<string, { title?: string; extract?: string }> };
    };
    for (const page of Object.values(payload.query?.pages ?? {})) {
      if (page.title && page.extract) extracts.set(page.title, page.extract);
    }
  } catch {
    // Search snippets alone are still useful.
  }
  return extracts;
}

/**
 * Does a provider's result actually talk about what was asked? Wikipedia will
 * happily return "GCSE" for "when is the AQA GCSE biology paper 1 exam 2027",
 * and grounding an answer in that would be worse than having no source at all.
 * Require half the question's significant words to appear, or one word when the
 * question only has one or two.
 */
function matchesQuestion(results: WebResult[], terms: string[]): boolean {
  if (terms.length === 0) return false;
  const haystack = results
    .slice(0, 3)
    .map((result) => `${result.title} ${result.snippet}`)
    .join(" ")
    .toLowerCase();
  const hits = terms.filter((term) => haystack.includes(term)).length;
  const required = terms.length <= 2 ? 1 : Math.max(2, Math.ceil(terms.length * 0.6));
  return hits >= required;
}

/**
 * Wikipedia (or Wikibooks) keyword search plus article introductions. This is
 * the backbone of the keyless tier: reliable from servers, openly licensed, and
 * usually the best single source for an explain-this-concept question.
 */
async function wikiProvider(
  host: string,
  question: string,
  limit: number,
): Promise<WebResult[]> {
  for (const terms of searchTerms(question)) {
    const hits = await mediaWikiSearch(host, terms.join(" "), limit).catch(
      () => [] as MediaWikiHit[],
    );
    if (hits.length === 0) continue;

    const intros = await mediaWikiIntros(
      host,
      hits.map((hit) => hit.title),
    );
    return hits.map((hit) => ({
      title: hit.title,
      url: `https://${host.replace(/^en\./, "en.")}/wiki/${encodeURIComponent(
        hit.title.replace(/ /g, "_"),
      )}`,
      snippet: intros.get(hit.title) ?? hit.snippet,
    }));
  }
  return [];
}

/**
 * DuckDuckGo's Instant Answer API. Keyless and genuinely allowed, but it only
 * answers when DuckDuckGo has a curated result — definitions, dates, famous
 * entities. It is a bonus source, never the only one.
 */
async function instantAnswerProvider(question: string): Promise<WebResult[]> {
  const params = new URLSearchParams({
    q: question,
    format: "json",
    no_html: "1",
    skip_disambig: "1",
  });
  const response = await fetch(`https://api.duckduckgo.com/?${params}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) return [];

  const payload = (await response.json()) as {
    Abstract?: string;
    AbstractURL?: string;
    Heading?: string;
    Answer?: string;
    Definition?: string;
    DefinitionURL?: string;
    RelatedTopics?: Array<
      | { FirstURL?: string; Text?: string }
      | { Topics?: Array<{ FirstURL?: string; Text?: string }> }
    >;
  };

  const results: WebResult[] = [];
  if (payload.Abstract && payload.AbstractURL) {
    results.push({
      title: payload.Heading || "DuckDuckGo summary",
      url: payload.AbstractURL,
      snippet: payload.Abstract,
    });
  }
  if (payload.Definition && payload.DefinitionURL) {
    results.push({
      title: payload.Heading ? `${payload.Heading} — definition` : "Definition",
      url: payload.DefinitionURL,
      snippet: payload.Definition,
    });
  }
  for (const topic of payload.RelatedTopics ?? []) {
    const entries = "Topics" in topic && topic.Topics ? topic.Topics : [topic];
    for (const entry of entries) {
      const row = entry as { FirstURL?: string; Text?: string };
      if (!row.FirstURL || !row.Text) continue;
      results.push({
        title: row.Text.split(" - ")[0] ?? row.Text,
        url: row.FirstURL,
        snippet: row.Text,
      });
    }
  }
  return results.slice(0, 3);
}

/** Stack Exchange site for a course, so physics questions hit Physics SE. */
function stackSite(course?: string): string | null {
  const value = (course ?? "").toLowerCase();
  if (/biol/.test(value)) return "biology";
  if (/chem/.test(value)) return "chemistry";
  if (/phys/.test(value)) return "physics";
  if (/math/.test(value)) return "math";
  if (/comput|cs\b|ict/.test(value)) return "cs";
  if (/english|literature|lang/.test(value)) return "ell";
  if (/history/.test(value)) return "history";
  return null;
}

/**
 * Stack Exchange Q&A. Anonymous access gets a small daily quota; a missing or
 * exhausted quota simply returns nothing.
 */
async function stackExchangeProvider(
  course: string | undefined,
  query: string,
): Promise<WebResult[]> {
  const site = stackSite(course);
  if (!site) return [];
  const params = new URLSearchParams({
    order: "desc",
    sort: "relevance",
    q: truncate(query, 120),
    site,
    pagesize: "3",
    filter: "withbody",
  });
  const response = await fetch(
    `https://api.stackexchange.com/2.3/search/advanced?${params}`,
    {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    },
  );
  if (!response.ok) return [];
  const payload = (await response.json()) as {
    items?: Array<{ title?: string; link?: string; body?: string }>;
  };
  return (payload.items ?? []).map((item) => ({
    title: item.title ?? "",
    url: item.link ?? "",
    snippet: item.body ?? "",
  }));
}

/**
 * Questions that encyclopedias cannot answer: exam dates, timetables, prices,
 * this year's specification. A Wikipedia article will exist for "GCSE" but it
 * says nothing about the 2027 paper, so these skip the keyless tier and go to a
 * provider that can actually search the live web.
 */
const LIVE_INTENT =
  /\b(latest|current|currently|today|tonight|this (year|month|week)|next (year|week|month)|deadline|timetable|exam dates?|results day|news|updates?|pricing|price|cost|fees?|admissions?|application|specification changes?)\b|\b20(?:2[5-9]|[3-9]\d)\b/i;

function needsLiveSources(question: string): boolean {
  return LIVE_INTENT.test(question);
}

async function searchKeyless(
  question: string,
  course: string | undefined,
): Promise<{ results: WebResult[]; providers: string[] }> {
  const providers: string[] = [];
  const results: WebResult[] = [];
  const terms = searchTerms(question)[0] ?? [];

  const wiki = await wikiProvider("en.wikipedia.org", question, 3).catch(() => []);
  const relevantWiki = matchesQuestion(wiki, terms) ? wiki : [];
  if (relevantWiki.length > 0) {
    providers.push("wikipedia");
    results.push(...relevantWiki);
  }

  const instant = await instantAnswerProvider(question).catch(() => []);
  if (instant.length > 0) {
    providers.push("duckduckgo-answers");
    results.push(...instant);
  }

  // Only spend the second Wikimedia request when Wikipedia did not answer.
  const books =
    relevantWiki.length > 0
      ? []
      : await wikiProvider("en.wikibooks.org", question, 2).catch(() => []);
  const relevantBooks = matchesQuestion(books, terms) ? books : [];
  if (relevantBooks.length > 0) {
    providers.push("wikibooks");
    results.push(...relevantBooks);
  }

  const stack = await stackExchangeProvider(course, question).catch(() => []);
  if (stack.length > 0) {
    providers.push("stackexchange");
    results.push(...stack);
  }

  return { results: dedupe(results), providers };
}

/* -------------------------------------------------------------------------- */
/* Keyed tier                                                                 */
/* -------------------------------------------------------------------------- */

class ProviderError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Skip a provider for a while after it reports a rate limit or no credit. */
const providerCooldownUntil = new Map<string, number>();
const providerDisabled = new Set<string>();
const COOLDOWN_MS = 10 * 60 * 1000;

function readKey(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

async function tavilySearch(query: string): Promise<WebResult[]> {
  const key = readKey("TAVILY_API_KEY");
  if (!key) return [];
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      max_results: MAX_RESULTS,
      search_depth: "basic",
      include_answer: false,
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new ProviderError(response.status, `Tavily HTTP ${response.status}`);
  }
  const payload = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  return (payload.results ?? []).map((row) => ({
    title: row.title ?? "",
    url: row.url ?? "",
    snippet: row.content ?? "",
  }));
}

async function exaSearch(query: string): Promise<WebResult[]> {
  const key = readKey("EXA_API_KEY");
  if (!key) return [];
  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      numResults: MAX_RESULTS,
      contents: { text: { maxCharacters: 600 } },
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new ProviderError(response.status, `Exa HTTP ${response.status}`);
  }
  const payload = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; text?: string }>;
  };
  return (payload.results ?? []).map((row) => ({
    title: row.title ?? "",
    url: row.url ?? "",
    snippet: row.text ?? "",
  }));
}

async function serperSearch(query: string): Promise<WebResult[]> {
  const key = readKey("SERPER_API_KEY");
  if (!key) return [];
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: MAX_RESULTS }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new ProviderError(response.status, `Serper HTTP ${response.status}`);
  }
  const payload = (await response.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>;
  };
  return (payload.organic ?? []).map((row) => ({
    title: row.title ?? "",
    url: row.link ?? "",
    snippet: row.snippet ?? "",
  }));
}

/** Every keyed provider, in the order they are tried. */
const KEYED_PROVIDERS: Array<{ name: string; run: (q: string) => Promise<WebResult[]> }> = [
  { name: "tavily", run: tavilySearch },
  { name: "exa", run: exaSearch },
  { name: "serper", run: serperSearch },
];

/** True when at least one keyed provider has a key configured. */
export function hasKeyedProvider(): boolean {
  return KEYED_PROVIDERS.some((provider) => {
    switch (provider.name) {
      case "tavily":
        return Boolean(readKey("TAVILY_API_KEY"));
      case "exa":
        return Boolean(readKey("EXA_API_KEY"));
      case "serper":
        return Boolean(readKey("SERPER_API_KEY"));
      default:
        return false;
    }
  });
}

/**
 * Tries the keyed providers in order until one returns results. A 429, 402 or
 * 403 cools that provider down for ten minutes so the next question goes
 * straight to the one that still has quota; a rejected key is dropped entirely.
 */
async function searchKeyed(
  query: string,
): Promise<{ results: WebResult[]; providers: string[] }> {
  const used: string[] = [];
  for (const provider of KEYED_PROVIDERS) {
    if (providerDisabled.has(provider.name)) continue;
    if ((providerCooldownUntil.get(provider.name) ?? 0) > Date.now()) continue;

    try {
      const results = await provider.run(query);
      if (results.length === 0) continue;
      used.push(provider.name);
      return { results: dedupe(results), providers: used };
    } catch (error) {
      const status = error instanceof ProviderError ? error.status : 0;
      if (status === 401 || status === 403) {
        // A wrong key is not worth retrying until the deployment changes.
        providerDisabled.add(provider.name);
      } else if (status === 402 || status === 429 || status >= 500) {
        providerCooldownUntil.set(provider.name, Date.now() + COOLDOWN_MS);
      } else {
        providerCooldownUntil.set(provider.name, Date.now() + 60_000);
      }
    }
  }
  return { results: [], providers: used };
}

/* -------------------------------------------------------------------------- */
/* Public entry point                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Enough substance to answer from: a couple of sources, at least one with a
 * real paragraph rather than a one-line search snippet.
 */
function isCovered(results: WebResult[]): boolean {
  const substantial = results.filter(
    (result) => result.snippet.length >= 150,
  );
  const total = results.reduce((sum, result) => sum + result.snippet.length, 0);
  return results.length >= 2 && substantial.length >= 1 && total >= 280;
}

/**
 * Searches for one question, cheapest tier first.
 *
 * Keyless sources run every time. When they return enough substance the answer
 * is written from them and no paid provider is touched. Otherwise the keyed
 * providers are tried — and if none is configured or all are exhausted, the
 * tutor still receives the thin keyless results rather than nothing.
 */
export async function searchWeb(
  question: string,
  course?: string,
): Promise<SearchOutcome> {
  const query = question.trim().slice(0, 240);
  if (query.length < 3) return { results: [], covered: false, providers: [] };

  const cacheKey = `${course ?? ""}|${query.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const remember = (value: SearchOutcome): SearchOutcome => {
    // Keep the map small in a long-lived server process.
    if (searchCache.size > 300) {
      const oldest = searchCache.keys().next().value;
      if (oldest) searchCache.delete(oldest);
    }
    searchCache.set(cacheKey, { expiresAt: Date.now() + SEARCH_TTL_MS, value });
    return value;
  };

  // Live-information questions go straight past the encyclopedias.
  const keyless = needsLiveSources(query)
    ? { results: [] as WebResult[], providers: [] as string[] }
    : await searchKeyless(query, course);
  if (isCovered(keyless.results)) {
    return remember({
      results: keyless.results.slice(0, MAX_RESULTS),
      covered: true,
      providers: keyless.providers,
    });
  }

  const keyed = await searchKeyed(query);
  const merged = dedupe([...keyed.results, ...keyless.results]).slice(
    0,
    MAX_RESULTS,
  );
  return remember({
    results: merged,
    covered: isCovered(merged),
    providers: [...keyed.providers, ...keyless.providers],
  });
}

/**
 * Renders results as a prompt block, numbered to match the citations the chat
 * shows beneath the answer.
 */
export function webResultsBlock(results: WebResult[]): string {
  if (results.length === 0) return "";
  const lines = results.map(
    (result, index) =>
      `[${index + 1}] ${result.title}\n${result.url}\n${truncate(
        result.snippet,
        DISPLAY_CHARS,
      )}`,
  );
  return `<web_results>\n${lines.join("\n\n")}\n</web_results>`;
}
