"use node";

/**
 * All NVIDIA calls live in this Node action file.
 *
 * Keys are read from the `NVIDIA_API_KEY` environment variable, which may hold
 * a comma- or newline-separated pool. They are never returned, logged, or sent
 * to the browser. Keep it that way when extending this file.
 */

import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { action, internalAction } from "./_generated/server";
import { requireUserId } from "./lib/requireUser";
import { fetchCognitoOutline, type CognitoOutline } from "./lib/cognito";
import {
  completeAnthology,
  type PathwayLike,
} from "./lib/poetryAnthologies";
import { buildRsPathway } from "./lib/rsPathways";
import {
  OPENROUTER_CHAT_URL,
  OPENROUTER_TUTOR_MODEL,
  readOpenRouterKey,
} from "./lib/openrouterConfig";
import { searchWeb, webResultsBlock, type WebResult } from "./lib/webSearch";
import {
  MAX_NOTES_CHARS,
  NVIDIA_CHAT_URL,
  NVIDIA_TEXT_MODEL,
  NVIDIA_VISION_MODEL,
  readNvidiaKeys,
} from "./lib/nvidiaConfig";
import { buildPaperCover } from "./lib/paperFormat";
import {
  buildPaperBlueprint,
  flattenPaperBlueprint,
  type PaperBlueprint,
} from "./lib/paperBlueprint";


type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: { url: string } };
type ContentPart = TextPart | ImagePart;
type ChatMessage = {
  role: "system" | "user";
  content: string | ContentPart[];
};

type Summary = {
  overview: string;
  keyPoints: string[];
  examFocus: string[];
};

type GeneratedCard = { front: string; back: string };
type GeneratedQuiz = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};
type GeneratedExam = {
  question: string;
  marks: number;
  modelAnswer: string;
  markingGuide: string[];
  /** Set for past papers: whether the answer is marked by points or levels. */
  marking?: "points" | "levels";
  // Past papers only: the label the board prints ("1 (a)", "0 1 . 1"), the
  // section the question sits in, the command word it opens with, and the
  // specification reference it tests. Study-set exam questions leave these
  // unset and render as a plain numbered list.
  label?: string;
  section?: string;
  sectionInstruction?: string;
  commandWord?: string;
  specReference?: string;
};

// ---------------------------------------------------------------------------
// Key resolution
// ---------------------------------------------------------------------------

function resolveNvidiaKeys(): string[] {
  const keys = readNvidiaKeys();
  if (keys.length === 0) {
    throw new Error(
      "NVIDIA_API_KEY is not set on this deployment. Add one or more keys to the server environment and retry.",
    );
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Key rotation
// ---------------------------------------------------------------------------

/** Keep a rate-limited key out of rotation briefly before trying it again. */
const KEY_COOLDOWN_MS = 45_000;

// These live in the action's process only. They hold key values, so never log
// or return them; they exist purely so bad or throttled keys are skipped.
const rejectedKeys = new Set<string>();
const coolingKeys = new Map<string, number>();
let keyCursor = 0;

/**
 * Picks the next usable key, advancing round-robin so back-to-back requests
 * are spread across the pool instead of exhausting one key at a time.
 */
function nextApiKey(keys: string[]): string {
  const active = keys.filter((key) => !rejectedKeys.has(key));
  if (active.length === 0) {
    throw new Error(
      "All NVIDIA_API_KEY values on this deployment were rejected. Update the server environment and retry.",
    );
  }

  const now = Date.now();
  const ready = active.filter((key) => (coolingKeys.get(key) ?? 0) <= now);
  // If every key is cooling down, try the pool again rather than fail early.
  const pool = ready.length > 0 ? ready : active;
  const key = pool[keyCursor % pool.length]!;
  keyCursor = (keyCursor + 1) % 10_000;
  return key;
}

// ---------------------------------------------------------------------------
// NVIDIA transport
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function friendlyHttpError(status: number): string {
  if (status === 401 || status === 403) {
    return "NVIDIA rejected the API key pool. Check NVIDIA_API_KEY on the deployment.";
  }
  if (status === 400) {
    return "NVIDIA rejected the request. Retry once, then check NVIDIA_TEXT_MODEL on the deployment if it persists.";
  }
  if (status === 402) {
    return "Your NVIDIA account has no available credits for this request.";
  }
  if (status === 404) {
    return "The configured NVIDIA model is not available. Try setting NVIDIA_TEXT_MODEL or NVIDIA_VISION_MODEL in the deployment environment.";
  }
  if (status === 410) {
    return "This NVIDIA model has reached end of life. Set NVIDIA_TEXT_MODEL or NVIDIA_VISION_MODEL to a model from build.nvidia.com and retry.";
  }
  if (status === 429) {
    return "The available NVIDIA API keys are rate-limited right now. Wait about a minute, then retry.";
  }
  if (status >= 500) {
    return "NVIDIA's service is having trouble right now. Try again in a moment.";
  }
  return `NVIDIA could not complete the request (HTTP ${status}). Please retry.`;
}

/**
 * Small OpenAI-compatible wrapper around NVIDIA's chat completions endpoint.
 * Each attempt takes the next key from the pool. A 429 cools that key down and
 * moves on immediately; rejected keys are removed from rotation. Server and
 * network errors get a short backoff, and every failure becomes a message that
 * is safe and useful to show in the UI.
 */
async function nvidiaChat(
  apiKeys: string[],
  options: {
    model: string;
    messages: ChatMessage[];
    maxTokens: number;
    temperature?: number;
    topP?: number;
    /**
     * Turn off chain-of-thought. Reasoning models otherwise spend most of
     * `maxTokens` on hidden thinking and can return an empty answer, which is
     * what was breaking the build pipeline.
     */
    disableThinking?: boolean;
    retries?: number;
    /** Pathway builds can produce a large JSON document, so they need longer. */
    timeoutMs?: number;
  },
): Promise<string> {
  const retries = options.retries ?? 2;
  // Try every key at least once, with a small cap so a large pool does not
  // hold one study set open indefinitely.
  const maxAttempts = Math.max(retries + 1, Math.min(apiKeys.length, 6));
  let lastStatus: number | null = null;
  // Flipped off once if the configured model does not understand the flag, so
  // a strict model can still answer instead of failing the whole build.
  let thinkingDisabled = options.disableThinking ?? false;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const apiKey = nextApiKey(apiKeys);
    let response: Response;
    try {
      response = await fetch(NVIDIA_CHAT_URL, {
        method: "POST",
        headers: {
          // Each key only exists in this process memory / request header.
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: options.model,
          messages: options.messages,
          temperature: options.temperature ?? 0,
          top_p: options.topP ?? 1,
          max_tokens: options.maxTokens,
          stream: false,
          // Nemotron reads this from its chat template. Plain models ignore the
          // template, so the 400 fallback below covers them.
          ...(thinkingDisabled
            ? { chat_template_kwargs: { enable_thinking: false } }
            : {}),
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 120_000),
      });
    } catch (error) {
      // Never include the request object: it contains the Authorization header.
      if (attempt < maxAttempts - 1) {
        await sleep(1200 * (attempt + 1));
        continue;
      }
      const reason =
        error instanceof Error && error.name === "TimeoutError"
          ? "NVIDIA took too long to respond. Please retry."
          : "Could not reach NVIDIA. Check the deployment's network connection and retry.";
      throw new Error(reason);
    }

    if (response.ok) {
      const payload = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
            reasoning_content?: string;
            reasoning?: string;
          };
        }>;
      };
      const message = payload.choices?.[0]?.message;
      const content = typeof message?.content === "string" ? message.content : "";
      if (content.trim().length > 0) return content;

      // Salvage a run that spent its budget thinking: some providers return the
      // visible answer in the reasoning field, or reasoning text that still
      // contains the JSON we asked for.
      const fallback = [message?.reasoning_content, message?.reasoning].find(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      );
      if (fallback) return fallback;

      throw new Error(
        "NVIDIA sent back an empty answer, which usually means the model used its whole token budget on reasoning. Retry the build.",
      );
    }

    lastStatus = response.status;

    if (response.status === 429) {
      // Throttled: park this key briefly and try the next one straight away.
      coolingKeys.set(apiKey, Date.now() + KEY_COOLDOWN_MS);
      if (attempt < maxAttempts - 1) {
        await sleep(400 * (attempt + 1));
        continue;
      }
    } else if (response.status === 401 || response.status === 403) {
      // Rejected: never use this key again in this process.
      rejectedKeys.add(apiKey);
      if (attempt < maxAttempts - 1) continue;
    } else if (response.status >= 500) {
      if (attempt < maxAttempts - 1) {
        await sleep(1200 * (attempt + 1));
        continue;
      }
    } else if (response.status === 400 && thinkingDisabled) {
      // The configured model doesn't take chat_template_kwargs. Drop the flag
      // and retry the same request once.
      thinkingDisabled = false;
      if (attempt < maxAttempts - 1) continue;
      throw new Error(friendlyHttpError(response.status));
    } else {
      throw new Error(friendlyHttpError(response.status));
    }
  }

  if (lastStatus !== null) throw new Error(friendlyHttpError(lastStatus));
  throw new Error("NVIDIA could not complete the request. Please retry.");
}

// ---------------------------------------------------------------------------
// JSON parsing / validation
// ---------------------------------------------------------------------------

/**
 * Escapes literal newlines/tabs that a model left inside a JSON string. They
 * are invalid JSON and appear most often in long science answers.
 */
function repairJsonControlChars(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const char of text) {
    if (inString) {
      if (escaped) {
        escaped = false;
        out += char;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        out += char;
        continue;
      }
      if (char === '"') {
        inString = false;
        out += char;
        continue;
      }
      if (char === "\n") {
        out += "\\n";
        continue;
      }
      if (char === "\r") {
        out += "\\r";
        continue;
      }
      if (char === "\t") {
        out += "\\t";
        continue;
      }
      out += char;
      continue;
    }
    if (char === '"') inString = true;
    out += char;
  }
  return out;
}

/**
 * Models put LaTeX in JSON without escaping the backslash — `\Delta`, `\frac`,
 * `\uparrow` — which is invalid JSON and made Physics sets fail while other
 * subjects parsed. Double only the escapes JSON does not recognise, leaving
 * real escapes such as `\n` and `\"` alone.
 */
function repairJsonEscapes(text: string): string {
  const backslash = String.fromCharCode(92);
  const valid = new Set(['"', backslash, "/", "b", "f", "n", "r", "t", "u"]);
  let out = "";
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char !== backslash) {
      out += char;
      continue;
    }
    const next = text[index + 1] ?? "";
    const isUnicode = next === "u";
    const unicodeValid =
      isUnicode && /^[0-9a-fA-F]{4}$/.test(text.slice(index + 2, index + 6));
    if (valid.has(next) && (!isUnicode || unicodeValid)) {
      // A real escape: copy the whole sequence so its own backslash is not
      // treated as another candidate.
      const length = isUnicode ? 6 : 2;
      out += text.slice(index, index + length);
      index += length - 1;
      continue;
    }
    // LaTeX commands and other unknown escapes: make the backslash literal.
    out += backslash + backslash;
  }
  return out;
}

/**
 * Some models still print their reasoning inline when thinking can't be turned
 * off. Drop those blocks so JSON extraction looks at the answer only.
 */
function stripReasoning(raw: string): string {
  return raw
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");
}

/**
 * Returns every complete {...} object found in the text, outermost and nested.
 * A generation that runs out of tokens mid-array never closes its outer object,
 * but the items that finished are still balanced, so they can be read this way.
 */
function parsedObjects(text: string): Array<Record<string, unknown>> {
  const found: Array<{ start: number; value: Record<string, unknown> }> = [];
  const starts: number[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      starts.push(i);
    } else if (char === "}") {
      const start = starts.pop();
      if (start === undefined) continue;
      try {
        const value = JSON.parse(repairJsonEscapes(text.slice(start, i + 1)));
        if (value && typeof value === "object" && !Array.isArray(value)) {
          found.push({ start, value: value as Record<string, unknown> });
        }
      } catch {
        // Not a complete object — keep scanning.
      }
    }
  }

  return found.sort((a, b) => a.start - b.start).map((entry) => entry.value);
}

/** Lenient JSON reader: handles fences, chatter around the JSON, and truncation. */
function tryParseJson<T>(raw: string): T | null {
  const withoutFences = stripReasoning(raw)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const candidates = [withoutFences];
  const objectStart = withoutFences.indexOf("{");
  const objectEnd = withoutFences.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd > objectStart) {
    candidates.push(withoutFences.slice(objectStart, objectEnd + 1));
  }
  const arrayStart = withoutFences.indexOf("[");
  const arrayEnd = withoutFences.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    candidates.push(withoutFences.slice(arrayStart, arrayEnd + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // LaTeX-heavy answers (Physics, Chemistry) need their escapes repaired
      // before the second attempt.
      try {
        return JSON.parse(repairJsonEscapes(candidate)) as T;
      } catch {
        // Try the next candidate.
      }
    }
  }
  return null;
}

function parseModelJson<T>(raw: string): T {
  const parsed = tryParseJson<T>(raw);
  if (parsed === null) {
    throw new Error("NVIDIA returned a response we couldn't read. Please retry.");
  }
  return parsed;
}

/**
 * Reads `key` as a list of items, falling back to the individually recovered
 * objects when the outer JSON was cut off mid-stream. Without this, one lost
 * question would fail the whole build step.
 */
function collectionItems(
  raw: string,
  key: string,
  looksLikeItem: (row: Record<string, unknown>) => boolean,
): unknown[] {
  const parsed = tryParseJson<Record<string, unknown>>(raw);
  const list = parsed?.[key];
  if (Array.isArray(list)) return list;

  const recovered = parsedObjects(stripReasoning(raw)).filter(looksLikeItem);
  if (recovered.length > 0) return recovered;
  throw new Error("NVIDIA returned a response we couldn't read. Please retry.");
}

function asText(value: unknown, maxLength = 2000): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseSummary(raw: string): Summary {
  const parsed =
    tryParseJson<Partial<Summary>>(raw) ??
    (parsedObjects(stripReasoning(raw)).find((row) => "overview" in row) as
      | Partial<Summary>
      | undefined) ??
    {};
  const overview = asText(parsed.overview, 2500);
  const keyPoints = Array.isArray(parsed.keyPoints)
    ? parsed.keyPoints.map((point) => asText(point, 500)).filter(Boolean).slice(0, 10)
    : [];
  const examFocus = Array.isArray(parsed.examFocus)
    ? parsed.examFocus.map((point) => asText(point, 500)).filter(Boolean).slice(0, 6)
    : [];
  if (!overview || keyPoints.length < 2) {
    throw new Error("Bluprint could not build a useful summary from this material. Try a clearer photo or more notes.");
  }
  return { overview, keyPoints, examFocus };
}

function parseCards(raw: string, limit = 12): GeneratedCard[] {
  const items = collectionItems(raw, "cards", (row) => typeof row.front === "string");
  return items
    .map((card) => {
      const row = card as Partial<GeneratedCard>;
      return { front: asText(row.front, 400), back: asText(row.back, 1600) };
    })
    .filter((card) => card.front && card.back)
    .slice(0, limit);
}

function parseQuiz(raw: string, limit = 6): GeneratedQuiz[] {
  const items = collectionItems(
    raw,
    "questions",
    (row) => typeof row.question === "string" && Array.isArray(row.options),
  );
  const questions: GeneratedQuiz[] = [];
  for (const item of items) {
    const row = item as Partial<GeneratedQuiz>;
    const question = asText(row.question, 600);
    const options = Array.isArray(row.options)
      ? row.options.map((option) => asText(option, 300))
      : [];
    const correctIndex = Number(row.correctIndex);
    const explanation = asText(row.explanation, 900);
    if (
      question &&
      options.length === 4 &&
      options.every(Boolean) &&
      Number.isInteger(correctIndex) &&
      correctIndex >= 0 &&
      correctIndex < 4 &&
      explanation
    ) {
      questions.push({ question, options, correctIndex, explanation });
    }
  }
  return questions.slice(0, limit);
}

/** An optional short field: the trimmed value, or undefined when it is empty. */
function optionalText(value: unknown, limit: number): string | undefined {
  const text = asText(value, limit);
  return text.length > 0 ? text : undefined;
}

function parseExams(raw: string, limit = 4): GeneratedExam[] {
  const items = collectionItems(
    raw,
    "questions",
    (row) => typeof row.question === "string" && typeof row.modelAnswer === "string",
  );
  const questions: GeneratedExam[] = [];
  for (const item of items) {
    const row = item as Partial<GeneratedExam>;
    const question = asText(row.question, 800);
    const modelAnswer = asText(row.modelAnswer, 6000);
    const marks = Math.round(Number(row.marks));
    // A 40-mark English essay needs a full model essay and a levels-based mark
    // scheme, so both caps are high enough for a whole paper question.
    const markingGuide = Array.isArray(row.markingGuide)
      ? row.markingGuide.map((point) => asText(point, 600)).filter(Boolean).slice(0, 20)
      : [];
    if (
      question &&
      modelAnswer &&
      Number.isFinite(marks) &&
      marks >= 1 &&
      marks <= 60 &&
      markingGuide.length > 0
    ) {
      questions.push({
        question,
        marks,
        modelAnswer,
        markingGuide,
        label: optionalText(row.label, 24),
        section: optionalText(row.section, 80),
        sectionInstruction: optionalText(row.sectionInstruction, 240),
        commandWord: optionalText(row.commandWord, 40),
        specReference: optionalText(row.specReference, 40),
      });
    }
  }
  return questions.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
  "You are Bluprint, a study assistant. Answer directly with strict JSON and no markdown fences, commentary, or extra keys. " +
  "Do not plan, reason step by step, or narrate your thinking. Do not add keys that are not asked for.";

function materialBlock(notes: string): string {
  const clipped = notes.slice(0, MAX_NOTES_CHARS);
  return `<study_material>\n${clipped}\n</study_material>${
    notes.length > MAX_NOTES_CHARS ? "\n(The material was shortened to fit; work with what is here.)" : ""
  }`;
}

// ---------------------------------------------------------------------------
// Exam-board context
// ---------------------------------------------------------------------------

/** The qualification fields a study set carries, when it has any. */
type StudyContext = {
  course?: string;
  examBoard?: string;
  level?: string;
};

/** "AQA · A-Level · Biology", or an empty string when nothing is set. */
function qualificationText(context?: StudyContext): string {
  if (!context) return "";
  return [context.examBoard, context.level, context.course]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" · ");
}

/**
 * Each board writes and marks papers differently. These notes are appended to
 * the generation and marking prompts so a Cambridge answer is credited with
 * B1/M1/A1 points while an AQA answer is credited one mark per bullet, and an
 * IB extended response is judged against markbands instead of a checklist.
 */
function markSchemeStyle(board?: string): string {
  const value = (board ?? "").toLowerCase();
  if (value.includes("aqa")) {
    return "AQA conventions: point-mark each creditable idea as '1 mark: ...', use AQA command words precisely (describe, explain, evaluate, justify), and add 'accept ...' notes where equivalent wording earns the mark.";
  }
  if (value.includes("edexcel") || value.includes("pearson")) {
    return "Pearson Edexcel conventions: point-mark each creditable idea as '1 mark: ...', and distinguish AO1 knowledge, AO2 application and AO3 analysis where the question rewards them.";
  }
  if (value.includes("ocr")) {
    return "OCR conventions: point-mark short answers as '1 mark: ...', reference the assessment objective the point satisfies, and use levels of response descriptors for extended writing.";
  }
  if (value.includes("wjec") || value.includes("eduqas")) {
    return "WJEC / Eduqas conventions: point-mark each creditable idea as '1 mark: ...' with short 'accept ...' notes and no holistic wording.";
  }
  if (value.includes("cambridge") || value.includes("cie") || value.includes("caie")) {
    return "Cambridge International conventions: use B1 for a correct statement, M1 for a valid method or point and A1 for a correct final answer, with 'allow ...' notes for acceptable alternatives.";
  }
  if (value.startsWith("ib") || value.includes("baccalaureate")) {
    return "IB conventions: respect the command term's demand, point-mark short answers, and spell out 1-5 markband descriptors when the question needs an extended response.";
  }
  if (value.includes("sqa")) {
    return "SQA conventions: write marking instructions as '1 mark' bullets with explicit 'Accept ...' alternatives for equivalent answers.";
  }
  if (value.includes("college board") || value === "ap") {
    return "College Board AP conventions: point-mark each required short-answer element, and use explicit earned points if a free-response rubric is needed.";
  }
  return "Point-mark every creditable idea, one mark per bullet, and add 'accept ...' notes where equivalent wording earns the same mark.";
}

async function summariseNotes(
  apiKeys: string[],
  notes: string,
  context?: StudyContext,
): Promise<Summary> {
  const qualification = qualificationText(context);
  const raw = await nvidiaChat(apiKeys, {
    model: NVIDIA_TEXT_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          `${materialBlock(notes)}\n\n` +
          (qualification
            ? `This material is for ${qualification}. Angle the exam focus at that qualification and use its command words.\n`
            : "") +
          "Create a revision summary of the material. Return JSON shaped exactly like:\n" +
          '{"overview":"3-5 sentence overview","keyPoints":["6-10 specific points worth remembering"],"examFocus":["3-5 likely exam angles or things to memorise"]}\n' +
          "Be concrete and faithful to the material. No markdown inside values.",
      },
    ],
    maxTokens: 2200,
    temperature: 0.15,
    topP: 1.0,
    disableThinking: true,
  });
  return parseSummary(raw);
}

// Batches keep each JSON response short enough to finish. A 20-question quiz
// is built from three smaller calls instead of one response that would run out
// of tokens halfway through an array.
const CARD_BATCH_SIZE = 20;
const QUIZ_BATCH_SIZE = 20;
const EXAM_BATCH_SIZE = 10;
/** One deck can ask for up to this many of each item (see the builder sliders). */
const MAX_REQUESTED_ITEMS = 100;

/** Reports batch completion to the build screen. Cosmetic; failures are ignored. */
type BatchProgress = (completed: number, target: number) => Promise<void> | void;

/**
 * How many items the material can honestly support. A student can ask for 100
 * of everything, but two paragraphs cannot yield 100 exam-style questions;
 * without this ceiling the pipeline spends minutes on calls that cannot succeed
 * and then reports a failed run. These ratios are deliberately generous.
 */
function materialLimits(notes: string): { cards: number; quiz: number; exam: number } {
  const words = notes.trim().split(/\s+/).filter(Boolean).length;
  const cap = (divisor: number) =>
    Math.max(1, Math.min(MAX_REQUESTED_ITEMS, Math.floor(words / divisor)));
  return { cards: cap(12), quiz: cap(30), exam: cap(90) };
}

/** A usable summary assembled from the notes when the summary call fails. */
function summaryFromNotes(notes: string): Summary {
  const clean = notes.replace(/\s+/g, " ").trim();
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20);
  const overview =
    sentences.slice(0, 3).join(" ") || clean.slice(0, 900) || "Your saved notes.";
  const keyPoints = (sentences.length > 0 ? sentences : [clean])
    .slice(0, 8)
    .map((sentence) => sentence.slice(0, 220));
  return {
    overview: overview.slice(0, 1500),
    keyPoints,
    examFocus: [],
  };
}

async function generateCards(
  apiKeys: string[],
  notes: string,
  target: number,
  // A wall-clock guard: Convex stops an action that runs too long, so stop
  // asking for new batches and save what exists instead.
  deadline = Number.POSITIVE_INFINITY,
  onProgress?: BatchProgress,
): Promise<GeneratedCard[]> {
  const cards: GeneratedCard[] = [];
  const seen = new Set<string>();

  // Enough calls to actually reach the requested count, plus spare attempts for
  // a malformed reply. A 100-card request needs five batches, not four.
  const maxAttempts = Math.min(8, Math.ceil(target / CARD_BATCH_SIZE) + 2);
  for (
    let attempt = 0;
    attempt < maxAttempts && cards.length < target && Date.now() < deadline;
    attempt += 1
  ) {
    const want = Math.min(CARD_BATCH_SIZE, target - cards.length);
    const previous = cards
      .slice(-12)
      .map((card) => `- ${card.front}`)
      .join("\n");

    const raw = await nvidiaChat(apiKeys, {
      model: NVIDIA_TEXT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `${materialBlock(notes)}\n\n` +
            `Create ${want} revision flashcards from this material. Cover the breadth of the material, but prioritise the niche, exam-distinguishing details a student could actually be tested on: exact figures and dates, names, formulas, precise definitions, exceptions to rules, named examples and case studies, cause-and-effect chains, and common confusions. ` +
            "Do not write generic cards whose answer is obvious from the topic name. Fronts must ask one specific question. Backs must be 2-4 sentences and include the precise detail, plus a caveat where one exists. " +
            (previous
              ? `These flashcards already exist; write different, non-overlapping ones:\n${previous}\n`
              : "") +
            'Return JSON exactly like: {"cards":[{"front":"...","back":"..."}]}',
        },
      ],
      maxTokens: 7000,
      temperature: 0.2,
      topP: 1.0,
      disableThinking: true,
    });

    let batch: GeneratedCard[] = [];
    try {
      batch = parseCards(raw, want);
    } catch {
      // A malformed batch costs one attempt, not the whole set. The next call
      // asks for whatever is still missing.
      continue;
    }

    let added = 0;
    for (const card of batch) {
      const key = card.front.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push(card);
      added += 1;
      if (cards.length >= target) break;
    }
    if (added > 0) {
      try {
        await onProgress?.(cards.length, target);
      } catch {
        // A progress write must never lose generated cards.
      }
    }
    // A model that ignores the "do not repeat" instruction would otherwise
    // loop until the attempt cap with no new cards.
    if (added === 0) break;
  }

  if (cards.length === 0) {
    throw new Error(
      "No flashcards could be generated from this material. Add more notes and retry.",
    );
  }
  return cards.slice(0, target);
}

async function generateQuiz(
  apiKeys: string[],
  notes: string,
  target: number,
  deadline = Number.POSITIVE_INFINITY,
  onProgress?: BatchProgress,
): Promise<GeneratedQuiz[]> {
  const questions: GeneratedQuiz[] = [];
  const seen = new Set<string>();

  const maxAttempts = Math.min(8, Math.ceil(target / QUIZ_BATCH_SIZE) + 2);
  for (
    let attempt = 0;
    attempt < maxAttempts &&
    questions.length < target &&
    Date.now() < deadline;
    attempt += 1
  ) {
    const want = Math.min(QUIZ_BATCH_SIZE, target - questions.length);
    const previous = questions
      .slice(-12)
      .map((question) => `- ${question.question}`)
      .join("\n");

    const raw = await nvidiaChat(apiKeys, {
      model: NVIDIA_TEXT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `${materialBlock(notes)}\n\n` +
            `Create ${want} multiple-choice quiz questions of increasing difficulty. Cover different parts of the material and include at least two questions that ask the student to apply a concept to a new example rather than recall a definition. Each question needs exactly 4 plausible options, one correct index (0-3), and a 1-2 sentence explanation of why the answer is right and the distractors are wrong. ` +
            (previous
              ? `Do not repeat these existing questions:\n${previous}\n`
              : "") +
            'Return JSON exactly like: {"questions":[{"question":"...","options":["a","b","c","d"],"correctIndex":0,"explanation":"..."}]}',
        },
      ],
      // A batch of eight with explanations needs far more room than the old
      // five-question call. Collection recovery handles any truncation.
      maxTokens: 9000,
      temperature: 0.2,
      topP: 1.0,
      disableThinking: true,
    });

    let batch: GeneratedQuiz[] = [];
    try {
      batch = parseQuiz(raw, want);
    } catch {
      continue;
    }

    let added = 0;
    for (const question of batch) {
      const key = question.question.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      questions.push(question);
      added += 1;
      if (questions.length >= target) break;
    }
    if (added > 0) {
      try {
        await onProgress?.(questions.length, target);
      } catch {
        // Cosmetic only.
      }
    }
    if (added === 0) break;
  }

  if (questions.length === 0) {
    throw new Error(
      "No quiz questions could be generated. Retry the build or add more material.",
    );
  }
  return questions.slice(0, target);
}

async function generateExams(
  apiKeys: string[],
  notes: string,
  context: StudyContext | undefined,
  target: number,
  deadline = Number.POSITIVE_INFINITY,
  onProgress?: BatchProgress,
): Promise<GeneratedExam[]> {
  const qualification = qualificationText(context);
  const exams: GeneratedExam[] = [];
  const seen = new Set<string>();

  const maxAttempts = Math.min(14, Math.ceil(target / EXAM_BATCH_SIZE) + 2);
  for (
    let attempt = 0;
    attempt < maxAttempts &&
    exams.length < target &&
    Date.now() < deadline;
    attempt += 1
  ) {
    const want = Math.min(EXAM_BATCH_SIZE, target - exams.length);
    const previous = exams
      .slice(-8)
      .map((exam) => `- ${exam.question}`)
      .join("\n");

    const raw = await nvidiaChat(apiKeys, {
      model: NVIDIA_TEXT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `${materialBlock(notes)}\n\n` +
            (qualification ? `This set is for ${qualification}.\n` : "") +

            "Write the marking guide the way a published past-paper mark scheme does: one bullet per mark, examiner phrasing such as '1 mark: states that …' or '2 marks: explains that …', an 'accept …' note where another wording earns the same mark, and no holistic or encouraging language. " +
            `Follow this board's published conventions: ${markSchemeStyle(context?.examBoard)} ` +
            "Every bullet must be a separable, creditable point and the bullets must add up exactly to the marks available. " +
            "Include a full-mark model answer that hits each bullet. " +
            (previous
              ? `Do not repeat these existing questions:\n${previous}\n`
              : "") +
            'Return JSON exactly like: {"questions":[{"question":"...","marks":6,"modelAnswer":"...","markingGuide":["1 mark: ..."]}]}',
        },
      ],
      maxTokens: 9000,
      temperature: 0.2,
      topP: 1.0,
      disableThinking: true,
    });

    let batch: GeneratedExam[] = [];
    try {
      batch = parseExams(raw, want);
    } catch {
      continue;
    }

    let added = 0;
    for (const exam of batch) {
      const key = exam.question.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      exams.push(exam);
      added += 1;
      if (exams.length >= target) break;
    }
    if (added > 0) {
      try {
        await onProgress?.(exams.length, target);
      } catch {
        // Cosmetic only.
      }
    }
    if (added === 0) break;
  }

  if (exams.length === 0) {
    throw new Error(
      "No exam-style questions could be generated from this material. Retry or add more notes.",
    );
  }
  return exams.slice(0, target);
}

// ---------------------------------------------------------------------------
// Past papers
// ---------------------------------------------------------------------------

/** The course fields a paper needs. The rest of the doc is not sent anywhere. */
type PaperCourse = {
  subject: string;
  level: string;
  examBoard: string;
  tier?: string;
  variant?: string;
  poetryTheme?: string;
  rsRoute?: string;
  rsReligion?: string;
  rsReligion2?: string;
  pathway?: {
    units: Array<{
      title: string;
      topics: Array<{ title: string; specReference?: string }>;
    }>;
  };
};

/**
 * The stored specification as plain lines. Topic names and references keep the
 * paper inside the qualification the student is actually studying, and the cap
 * keeps the prompt within the model's comfortable context.
 */
function specificationDigest(course: PaperCourse): string {
  const lines: string[] = [];
  for (const unit of course.pathway?.units ?? []) {
    lines.push(`## ${unit.title}`);
    for (const topic of unit.topics) {
      lines.push(
        `- ${topic.title}${topic.specReference ? ` [${topic.specReference}]` : ""}`,
      );
    }
  }
  return lines.join("\n").slice(0, 9000);
}

/**
 * The blueprint as prompt text: every question the paper must contain, in the
 * board's numbering, with its marks and its command word. This is what stops
 * the model turning an English essay paper into short-answer questions.
 */
function blueprintBrief(blueprint: PaperBlueprint): string {
  const slots = flattenPaperBlueprint(blueprint);
  const lines = [
    "PAPER FORMAT — this is the subject's real question structure. Follow it exactly.",
    `Total: ${slots.length} questions, ${blueprint.totalMarks} marks.`,
  ];
  let currentSection = "";
  for (const slot of slots) {
    if (slot.section !== currentSection) {
      currentSection = slot.section;
      lines.push("", `## ${slot.section}`, slot.sectionInstruction);
    }
    lines.push(
      `${slot.label} — ${slot.marks} mark${slot.marks === 1 ? "" : "s"} — command word: ${slot.command} — ${slot.marking === "levels" ? "levels-marked" : "point-marked"}`,
      `  ${slot.ask}`,
    );
  }
  lines.push("", "FORMAT RULES", ...blueprint.rules.map((rule) => `- ${rule}`));
  return lines.join("\n");
}

/** The first way a parsed paper differs from its blueprint, or null if it fits. */
function blueprintMismatch(
  questions: GeneratedExam[],
  blueprint: PaperBlueprint,
): string | null {
  const slots = flattenPaperBlueprint(blueprint);
  if (questions.length !== slots.length) {
    return `The paper must have exactly ${slots.length} questions; this reply had ${questions.length}.`;
  }
  for (const [index, slot] of slots.entries()) {
    if (questions[index]?.marks !== slot.marks) {
      return `Question ${slot.label} must be worth ${slot.marks} marks; this reply made it ${questions[index]?.marks ?? "unmarked"}.`;
    }
  }
  return null;
}

/**
 * Writes the questions in the blueprint's order, but keeps the blueprint's
 * labels, sections, marks and marking style. Those are the parts a student can
 * see, so they must be exact even if the model rounds a mark or forgets a label.
 */
function applyBlueprint(
  questions: GeneratedExam[],
  blueprint: PaperBlueprint,
): GeneratedExam[] {
  const slots = flattenPaperBlueprint(blueprint);
  return questions.map((question, index) => {
    const slot = slots[index]!;
    return {
      ...question,
      marks: slot.marks,
      marking: slot.marking,
      label: slot.label,
      section: slot.section,
      sectionInstruction: slot.sectionInstruction,
      commandWord: slot.command,
    };
  });
}

/**
 * Writes one full practice paper from the saved pathway. The questions are
 * original — published papers and mark schemes are copyrighted — but the
 * subject's real question types, marks, command words and marking style are
 * fixed by the blueprint.
 */
async function generatePaperQuestions(
  apiKeys: string[],
  course: PaperCourse,
  paperTitle: string,
): Promise<GeneratedExam[]> {
  const blueprint = buildPaperBlueprint(course);
  const slots = flattenPaperBlueprint(blueprint);
  const qualification = qualificationText({
    course: course.subject,
    examBoard: course.examBoard,
    level: course.level,
  });
  const detail = [course.variant, course.tier, course.poetryTheme]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
  const digest = specificationDigest(course);
  const hasPoints = slots.some((slot) => slot.marking === "points");
  const hasLevels = slots.some((slot) => slot.marking === "levels");
  const schemeNotes = [
    hasPoints
      ? `For point-marked questions: ${markSchemeStyle(course.examBoard)}`
      : "",
    hasLevels
      ? "Levels-marked questions use level descriptors with mark ranges, not one mark per bullet."
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const basePrompt =
    `<qualification>${qualification}${detail ? ` · ${detail}` : ""}</qualification>\n` +
    `<specification>\n${digest}\n</specification>\n\n` +
    `${blueprintBrief(blueprint)}\n\n` +
    `Write one complete practice paper titled "${paperTitle}" for this qualification, using only the specification above. ` +
    `Write exactly ${slots.length} original exam-style question${slots.length === 1 ? "" : "s"} totalling ${blueprint.totalMarks} marks. ` +
    "Do not add, remove, reorder or re-mark a question: the paper format above is fixed. " +
    "Make every question unambiguous and answerable from the specification, and do not copy or paraphrase a published past paper. " +
    "Each question needs a full-mark model answer and a marking guide written the way the board writes it. " +
    `${schemeNotes} ` +
    `Return JSON exactly like: {"questions":[{"question":"...","marks":${slots[0]?.marks ?? 3},"modelAnswer":"...","markingGuide":["the mark scheme"],"commandWord":"Outline","specReference":"1.1"}]}`;

  let mismatch = "";
  // One retry is enough to recover a reply that drifted from the format, and
  // costs a second call only when the first paper is unusable.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await nvidiaChat(apiKeys, {
      model: NVIDIA_TEXT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            basePrompt +
            (attempt > 0
              ? `\n\nFORMAT CORRECTION: the previous reply did not match the paper format. ${mismatch} Rewrite the complete paper with exactly the questions, marks and order listed above.`
              : ""),
        },
      ],
      maxTokens: 14000,
      temperature: attempt === 0 ? 0.2 : 0.1,
      topP: 1.0,
      disableThinking: true,
      // A whole paper with model answers and mark schemes is a long reply.
      timeoutMs: 240_000,
    });

    // The paper uses the same validated question shape as a study set's exam
    // questions, so one parser keeps both honest. Parse more than the blueprint
    // expects so an extra question is caught as a mismatch instead of being
    // silently sliced off.
    const questions = parseExams(raw, slots.length + 4);
    mismatch = blueprintMismatch(questions, blueprint) ?? "";
    if (!mismatch) return applyBlueprint(questions, blueprint);
  }

  throw new Error(
    `NVIDIA returned a paper that did not match the ${blueprint.summary} format. Try building it again.`,
  );
}

/** Builds one saved past paper for a course. Scheduled by `pastPapers.create`. */
export const buildPastPaper = internalAction({
  args: { paperId: v.id("pastPapers") },
  handler: async (ctx, { paperId }): Promise<{ ok: boolean }> => {
    const paper = await ctx.runQuery(internal.pastPapers.getForBuild, { paperId });
    if (!paper) return { ok: false };
    if (paper.status === "ready") return { ok: true };

    const claim = await ctx.runMutation(internal.pastPapers.claimBuild, { paperId });
    if (!claim.claimed) return { ok: false };

    try {
      const course = await ctx.runQuery(internal.courses.getForBuild, {
        courseId: paper.courseId,
      });
      if (!course) throw new Error("The course for this paper no longer exists.");

      const apiKeys = resolveNvidiaKeys();
      const questions = await generatePaperQuestions(
        apiKeys,
        course,
        paper.title,
      );
      // The cover is built from the marks the paper actually carries, so the
      // total it prints is the total the student can score.
      const totalMarks = questions.reduce(
        (sum, question) => sum + question.marks,
        0,
      );
      const cover = buildPaperCover(
        {
          subject: course.subject,
          level: course.level,
          examBoard: course.examBoard,
          tier: course.tier,
          variant: course.variant,
          poetryTheme: course.poetryTheme,
        },
        paper.title,
        totalMarks,
        paper.durationMinutes,
      );
      await ctx.runMutation(internal.pastPapers.completeBuild, {
        paperId,
        cover,
        questions,
      });
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Bluprint could not build this paper. Please try again.";
      await ctx.runMutation(internal.pastPapers.failBuild, { paperId, message });
      return { ok: false };
    }
  },
});

/** Marks one answer from a saved past paper. */
export const gradePastPaperAnswer = action({
  args: {
    questionId: v.id("pastPaperQuestions"),
    answer: v.string(),
  },
  handler: async (
    ctx,
    { questionId, answer },
  ): Promise<{ awardedMarks: number; marks: number; feedback: string }> => {
    const userId = await requireUserId(ctx);
    const response = answer.trim();

    const data = await ctx.runQuery(
      internal.pastPapers.getQuestionForGrading,
      { questionId },
    );
    if (!data || data.paper.userId !== userId) {
      throw new Error("Past paper question not found.");
    }

    // A one-mark multiple-choice question can be answered with a single letter;
    // every longer question needs a real answer before an examiner can mark it.
    const minimum = data.question.marks <= 2 ? 1 : 15;
    if (response.length < minimum) {
      throw new Error("Write a fuller answer before sending it for grading.");
    }

    const course = await ctx.runQuery(internal.courses.getForBuild, {
      courseId: data.paper.courseId,
    });
    const apiKeys = resolveNvidiaKeys();
    const { awardedMarks, feedback } = await markExamAnswer(
      apiKeys,
      data.question,
      response,
      course
        ? {
            course: course.subject,
            examBoard: course.examBoard,
            level: course.level,
          }
        : undefined,
      // Older papers predate the stored marking flag; long answers were always
      // meant to be levels-marked, so fall back to their length.
      data.question.marking ??
        (data.question.marks >= 12 ? "levels" : "points"),
    );

    await ctx.runMutation(internal.pastPapers.saveQuestionResult, {
      questionId,
      answer: response,
      awardedMarks,
      feedback,
    });

    return { awardedMarks, marks: data.question.marks, feedback };
  },
});

// ---------------------------------------------------------------------------
// OCR / transcription of uploaded photos and video frames
// ---------------------------------------------------------------------------

async function transcribeImages(
  apiKeys: string[],
  images: Array<{ dataUrl: string }>,
): Promise<string> {
  const parts: ContentPart[] = [
    {
      type: "text",
      text:
        "These images are photos or frames of a student's handwritten or printed study notes. " +
        "Transcribe ALL legible study content faithfully. Preserve headings, bullet structure, definitions, formulas and examples. " +
        "Use plain text. If something is unclear, write [unclear]. Do not add commentary or invent missing content.",
    },
    ...images.map<ImagePart>((image) => ({
      type: "image_url",
      image_url: { url: image.dataUrl },
    })),
  ];

  const raw = await nvidiaChat(apiKeys, {
    model: NVIDIA_VISION_MODEL,
    messages: [{ role: "user", content: parts }],
    maxTokens: 2200,
    temperature: 0.1,
  });
  return raw.trim();
}

/**
 * Reads each uploaded image in its own vision request. One image per call is
 * slower than batching but works consistently across NVIDIA's vision models,
 * and preserves the order of pages in the extracted notes.
 */
async function readSourceImages(
  ctx: ActionCtx,
  apiKeys: string[],
  imageIds: Id<"_storage">[],
): Promise<string> {
  const sections: string[] = [];
  for (const imageId of imageIds) {
    const blob = await ctx.storage.get(imageId);
    if (!blob) continue;
    const buffer = Buffer.from(await blob.arrayBuffer());
    const mime = blob.type?.startsWith("image/") ? blob.type : "image/jpeg";
    const text = await transcribeImages(apiKeys, [
      { dataUrl: `data:${mime};base64,${buffer.toString("base64")}` },
    ]);
    if (text) sections.push(text);
  }
  return sections.join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// Course pathways (scraped from Cognito)
// ---------------------------------------------------------------------------

/**
 * A pathway is a whole qualification laid out as units and topics. It is read
 * from Cognito's published page for the course, never written by a model, so
 * its structure matches the specification exactly.
 */
type PathwayTopic = {
  id: string;
  title: string;
  specReference?: string;
  summary: string;
  keyPoints: string[];
  examSkill: string;
};
type PathwayUnit = { title: string; summary: string; topics: PathwayTopic[] };
type CoursePathway = { overview: string; examFormat: string; units: PathwayUnit[] };

// ---------------------------------------------------------------------------
// Turning a scraped outline into a pathway
// ---------------------------------------------------------------------------

/**
 * The outline is the scraped specification: units, topics and every subtopic.
 * The pathway shown to a student is a direct mapping of that outline, so it
 * cannot drop or invent a topic. Only study sets, which are built later from a
 * chosen topic, involve a model.
 */
type PathwayCourse = {
  subject: string;
  level: string;
  examBoard: string;
  tier?: string;
  variant?: string;
  poetryTheme?: string;
  rsRoute?: string;
  rsReligion?: string;
  rsReligion2?: string;
  rsSpec?: string;
  rsSpec2?: string;
};
type OutlineTopic = { title: string; reference?: string; subtopics: string[] };
type OutlineSection = { title: string; topics: OutlineTopic[] };
type CourseOutline = {
  sections: OutlineSection[];
  label?: string;
  specificationCode?: string;
  intro?: string;
};
type TopicDetail = { summary: string; keyPoints: string[]; examSkill: string };
/**
 * Bounds that keep one huge anthology manageable. They are generous: dropping
 * a scraped topic is exactly the failure this pathway builder exists to avoid.
 */
const MAX_OUTLINE_SECTIONS = 24;
const MAX_OUTLINE_TOPICS = 60;
const MAX_OUTLINE_SUBTOPICS = 50;

function cleanTitle(value: unknown, max = 140): string {
  return asText(value, max)
    .replace(/\s+/g, " ")
    .replace(/^[\s\-:\u2013\u2014]+/, "")
    .trim();
}

/** Turns the Cognito page into the outline shape the detail pass expects. */
function outlineFromPage(page: CognitoOutline): CourseOutline {
  return {
    label: page.label,
    ...(page.specificationCode ? { specificationCode: page.specificationCode } : {}),
    ...(page.intro ? { intro: page.intro } : {}),
    sections: page.sections
      .map((section) => ({
        title: cleanTitle(section.title, 160),
        topics: section.topics
          .map((topic) => ({
            title: cleanTitle(topic.title, 160),
            ...(topic.reference ? { reference: topic.reference.slice(0, 20) } : {}),
            subtopics: topic.subtopics
              .map((sub) =>
                [(sub.reference ?? "").trim(), cleanTitle(sub.title, 160)]
                  .filter(Boolean)
                  .join(" "),
              )
              .filter(Boolean)
              .slice(0, MAX_OUTLINE_SUBTOPICS),
          }))
          .filter((topic) => topic.title.length > 1)
          .slice(0, MAX_OUTLINE_TOPICS),
      }))
      .filter((section) => section.topics.length > 0)
      .slice(0, MAX_OUTLINE_SECTIONS),
  };
}

/** Groups subtopics so every one is named without exceeding the point limit. */
function subtopicPoints(subtopics: string[]): string[] {
  if (subtopics.length === 0) return [];
  const groups = Math.min(6, subtopics.length);
  const points: string[] = [];
  for (let index = 0; index < subtopics.length; index += 1) {
    const bucket = Math.min(groups - 1, Math.floor((index * groups) / subtopics.length));
    points[bucket] = points[bucket] ? `${points[bucket]}; ${subtopics[index]}` : subtopics[index]!;
  }
  return points;
}

/** The revision detail for one scraped topic, derived from its subtopics. */
function fallbackDetail(topic: OutlineTopic): TopicDetail {
  const points = subtopicPoints(topic.subtopics);
  return {
    summary:
      topic.subtopics.length > 0
        ? `Covers ${topic.subtopics.slice(0, 3).join(", ")}${
            topic.subtopics.length > 3 ? " and the rest of this topic" : ""
          }.`
        : `Core content for ${topic.title}.`,
    keyPoints:
      points.length > 0
        ? points
        : [
            `Define ${topic.title.toLowerCase()} precisely and explain how it works.`,
            `Give one worked example or exam-style application of ${topic.title.toLowerCase()}.`,
          ],
    examSkill: `Be ready to apply ${topic.title} to an exam question and justify each point.`,
  };
}

/**
 * Turns the scraped outline into the pathway the course page renders. Every
 * topic, summary and key point here comes from Cognito's published headings —
 * no model is consulted, so a pathway cannot contain an invented topic or miss
 * a published one. The AI is used later, to build a study set from a topic.
 */
function buildPathwayFromOutline(
  course: PathwayCourse,
  outline: CourseOutline,
): CoursePathway {
  const units: PathwayUnit[] = outline.sections.map((section) => {
    const topics: PathwayTopic[] = section.topics.map((topic, index) => {
      const detail = fallbackDetail(topic);
      return {
        id: `u0t${index}`,
        title: topic.title,
        ...(topic.reference ? { specReference: topic.reference } : {}),
        summary: detail.summary,
        keyPoints: detail.keyPoints,
        examSkill: detail.examSkill,
      };
    });
    return {
      title: section.title,
      summary:
        topics.length <= 4
          ? `Covers ${topics.map((topic) => topic.title).join(", ")}.`
          : `Covers ${topics
              .slice(0, 4)
              .map((topic) => topic.title)
              .join(", ")} and ${topics.length - 4} more topics.`,
      topics,
    };
  });

  // Ids are assigned after the fact so they stay unique across units, and stay
  // stable when the same course is scraped again.
  const withIds = units.map((unit, unitIndex) => ({
    ...unit,
    topics: unit.topics.map((topic, topicIndex) => ({
      ...topic,
      id: `u${unitIndex + 1}t${topicIndex + 1}`,
    })),
  }));

  const topicCount = withIds.reduce((sum, unit) => sum + unit.topics.length, 0);
  const label =
    outline.label || `${course.level} ${course.subject} (${course.examBoard})`;
  const code = outline.specificationCode
    ? ` (specification ${outline.specificationCode})`
    : "";

  return {
    overview:
      outline.intro?.trim() ||
      `${label}${code}: a complete pathway built from the published specification, split into ${withIds.length} unit${withIds.length === 1 ? "" : "s"} and ${topicCount} topics.`,
    examFormat: `Check the ${course.examBoard} specification${code} for paper structure, weighting and duration.`,
    units: withIds,
  };
}

/** The only source of a pathway: Cognito's published page for this course. */
async function scrapePathway(course: PathwayCourse): Promise<CoursePathway | null> {
  const page = await fetchCognitoOutline(course);
  if (!page || page.sections.length === 0) return null;
  return buildPathwayFromOutline(course, outlineFromPage(page));
}

/**
 * A deterministic map used only when Cognito has no page for a course. Courses
 * must stay usable: a student should never be told to retry a build. These
 * topics are broad enough to generate study sets from, and a rebuild replaces
 * them once Cognito covers the course.
 */
function fallbackPathway(course: {
  subject: string;
  level: string;
  examBoard: string;
  tier?: string;
  variant?: string;
  poetryTheme?: string;
}): CoursePathway {
  const subject = course.subject.trim() || "This course";
  const board = course.examBoard.trim() || "your exam board";
  const level = course.level.trim() || "your qualification";
  const tier = course.tier ? ` (${course.tier} tier)` : "";

  const unit = (
    title: string,
    summary: string,
    topics: Array<Omit<PathwayTopic, "id">>,
  ): PathwayUnit => ({
    title,
    summary,
    topics: topics.map((topic, index) => ({ ...topic, id: `t${index + 1}` })),
  });

  const units: PathwayUnit[] = [
    unit(
      `${subject}: specification essentials`,
      `The core framework of ${level} ${subject}${tier}, mapped to ${board}.`,
      [
        {
          title: "Specification structure and assessment objectives",
          summary: `How ${board} organises ${subject} and what the examiner rewards.`,
          keyPoints: [
            `List the papers, sections and assessment objectives for ${board} ${subject}.`,
            "Know which topics are examined in each paper.",
            "Check the current specification for set texts, practicals or case studies.",
          ],
          examSkill: "Read the command word and the mark allocation before you write.",
        },
        {
          title: "Core concepts and terminology",
          summary: `The definitions, processes and models that underpin ${subject}.`,
          keyPoints: [
            "Write precise definitions for the central terms in each unit.",
            "Explain each process as a sequence of cause and effect.",
            "Prepare one worked example or named case study per concept.",
          ],
          examSkill: "Use the technical term first, then explain it in a full sentence.",
        },
        {
          title: "Exam skills and command words",
          summary: `How ${board} phrases questions and what each command word requires.`,
          keyPoints: [
            "Match the command word to the depth of answer it requires.",
            "Plan longer answers before writing to avoid repetition.",
            "Check the number of marks against the number of points you make.",
          ],
          examSkill: "Underline the command word and the focus of every question.",
        },
      ],
    ),
    unit(
      `${subject}: exam practice`,
      `Turn specification knowledge into marks under exam conditions.`,
      [
        {
          title: "Past paper questions",
          summary: `Practice questions written for ${board} ${subject}.`,
          keyPoints: [
            "Work through papers in specification order, then mixed papers.",
            "Time each section to match the real paper.",
            "Mark every answer against the published mark scheme.",
          ],
          examSkill: "Attempt the question before reading the mark scheme.",
        },
        {
          title: "Mark scheme analysis",
          summary: "Learn how examiners award marks and where answers lose them.",
          keyPoints: [
            "Highlight the creditable point behind each mark-scheme bullet.",
            "Note the accepted alternatives and the required context.",
            "Rewrite weak answers using the mark-scheme wording.",
          ],
          examSkill: "Build answers from separable, credit-worthy points.",
        },
        {
          title: "Common mistakes and improvements",
          summary: "The recurring errors that separate a good answer from full marks.",
          keyPoints: [
            "Keep an error log from every practice paper.",
            "Identify whether each lost mark was knowledge, application or technique.",
            "Re-test the same weakness after a week.",
          ],
          examSkill: "Correct the cause of each lost mark, not just the answer.",
        },
      ],
    ),
  ];

  if (course.poetryTheme) {
    units.push(
      unit(
        `Poetry anthology: ${course.poetryTheme}`,
        `The poems, themes and comparisons for the ${course.poetryTheme} cluster.`,
        [
          {
            title: "Poems and their meanings",
            summary: `Know each poem in the ${course.poetryTheme} collection.`,
            keyPoints: [
              "Summarise each poem in two sentences.",
              "Learn three quotations per poem.",
              "Link form, structure and language to meaning.",
            ],
            examSkill: "Integrate short quotations into an argument rather than listing them.",
          },
          {
            title: "Themes and comparisons",
            summary: `Compare the poems around the central ideas of ${course.poetryTheme}.`,
            keyPoints: [
              "Group the poems by theme, tone and viewpoint.",
              "Prepare comparative pairs with contrasting interpretations.",
              "Use contextual detail only where it sharpens the reading.",
            ],
            examSkill: "Compare writers' methods, not just their subject matter.",
          },
        ],
      ),
    );
  }

  return {
    overview: `A starter revision pathway for ${level} ${subject}${tier} with ${board}. Open a topic to build a study set, or rebuild this map later for a fuller specification-specific version.`,
    examFormat: `Check the current ${board} specification for paper structure, durations and weightings.`,
    units: units.map((entry, unitIndex) => ({
      ...entry,
      topics: entry.topics.map((topic, topicIndex) => ({
        ...topic,
        id: `u${unitIndex + 1}t${topicIndex + 1}`,
      })),
    })),
  };
}

/**
 * Scrapes the pathway for one course. Cognito is the only source; the starter
 * map is used when the site does not publish that course, and no model is
 * asked to fill the gap.
 */
async function generateCoursePathway(
  course: PathwayCourse,
  allowFallback = true,
): Promise<CoursePathway> {
  // Religious Studies comes from the saved Edexcel A/B content in
  // lib/rsPathways. Cognito has no page for it, and the generic starter map
  // talked about mark schemes instead of the religion itself, so RS is never
  // scraped and never generated.
  const religiousStudies = buildRsPathway(course);
  if (religiousStudies) return religiousStudies;

  let pathway: CoursePathway | null = null;
  try {
    pathway = await scrapePathway(course);
  } catch {
    // Fall through to the starter map.
  }

  if (!pathway) {
    if (!allowFallback) {
      throw new Error("Cognito has no published outline for this course.");
    }
    pathway = fallbackPathway(course);
  }

  // English Literature always ends up with the full published poetry cluster,
  // exactly once, whatever the scrape happened to list.
  return completeAnthology(pathway as PathwayLike, course) as CoursePathway;
}

/**
 * Builds one course map. Scheduled by `courses.createMany`, so the browser can
 * queue nine courses and watch them complete without holding a request open.
 */
export const buildCoursePathway = internalAction({
  args: { courseId: v.id("courses") },
  handler: async (
    ctx,
    { courseId },
  ): Promise<{ ok: boolean; fallback?: boolean; retrying?: boolean }> => {
    const course = await ctx.runQuery(internal.courses.getForBuild, { courseId });
    if (!course) return { ok: false };
    if (course.status === "ready") return { ok: true };

    const claim = await ctx.runMutation(internal.courses.claimBuild, { courseId });
    if (!claim.claimed) return { ok: false };

    try {
      // A rebuild keeps its previous map if every model fails; only a brand-new
      // course is allowed to fall back to the starter outline.
      const pathway = await generateCoursePathway(course, !course.pathway);
      await ctx.runMutation(internal.courses.completeBuild, { courseId, pathway });
      return { ok: true };
    } catch {
      // Never leave a course in a state that asks the student to retry. Keep the
      // existing map when there is one; otherwise store a usable starter map.
      try {
        await ctx.runMutation(internal.courses.completeBuild, {
          courseId,
          pathway: course.pathway ?? fallbackPathway(course),
        });
        return { ok: true, fallback: !course.pathway };
      } catch {
        // If even the fallback cannot be saved, keep the build moving in the
        // background rather than surfacing an error.
        await ctx.runMutation(internal.courses.queueRetry, {
          courseId,
          message: "Preparing a fresh pathway…",
        });
        await ctx.scheduler.runAfter(45_000, internal.ai.buildCoursePathway, {
          courseId,
        });
        return { ok: false, retrying: true };
      }
    }
  },
});

/** Re-runs pathway generation for a course the signed-in student owns. */
export const rebuildCoursePathway = action({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const userId = await requireUserId(ctx);
    await ctx.runMutation(internal.courses.resetBuild, { courseId, userId });
    await ctx.scheduler.runAfter(0, internal.ai.buildCoursePathway, { courseId });
    return { queued: true };
  },
});

// ---------------------------------------------------------------------------
// Public actions
// ---------------------------------------------------------------------------

/**
 * Runs the whole pipeline for a set: read images if needed, then summary,
 * flashcards, quiz and exam questions. Progress is written back so the set page
 * can show live steps. Safe to retry.
 */
export const processStudySet = action({
  args: { setId: v.id("studySets") },
  handler: async (ctx, { setId }) => {
    const userId = await requireUserId(ctx);

    const existing = await ctx.runQuery(internal.studySets.getForProcessing, { setId });
    if (!existing || existing.userId !== userId) {
      throw new Error("Study set not found.");
    }

    const claim = await ctx.runMutation(internal.studySets.claimForProcessing, { setId });
    if (!claim.claimed || !claim.set) {
      return { started: false };
    }

    try {
      const apiKeys = resolveNvidiaKeys();
      let notes = existing.notes.trim();

      if (existing.sourceImageIds.length > 0) {
        await ctx.runMutation(internal.studySets.setProgress, {
          setId,
          progress: "Reading the text in your uploads…",
          percent: 8,
        });
        const extracted = await readSourceImages(ctx, apiKeys, existing.sourceImageIds);
        if (extracted.trim().length > notes.length) {
          notes = extracted.trim();
          await ctx.runMutation(internal.studySets.saveExtractedNotes, {
            setId,
            notes,
          });
        }
      }

      if (notes.length < 40) {
        throw new Error(
          "Bluprint couldn't find enough readable text in this upload. Try brighter, closer photos or add a little pasted text.",
        );
      }

      const context: StudyContext = {
        course: existing.course,
        examBoard: existing.examBoard,
        level: existing.level,
      };

      // Sets created before the sliders existed fall back to the old defaults;
      // every set is capped at 100 and at whatever the notes can support.
      const requestedCards = Math.min(
        MAX_REQUESTED_ITEMS,
        Math.max(1, existing.targetCardCount ?? 20),
      );
      const requestedQuiz = Math.min(
        MAX_REQUESTED_ITEMS,
        Math.max(1, existing.targetQuizCount ?? 10),
      );
      const requestedExam = Math.min(
        MAX_REQUESTED_ITEMS,
        Math.max(1, existing.targetExamCount ?? 4),
      );
      const limits = materialLimits(notes);
      const targetCards = Math.min(requestedCards, limits.cards);
      const targetQuiz = Math.min(requestedQuiz, limits.quiz);
      const targetExam = Math.min(requestedExam, limits.exam);
      // Leave room inside Convex's action limit for the final writes.
      const deadline = Date.now() + 8 * 60 * 1000;

      // Percentages are stage boundaries; batches report their own progress
      // inside the cards, quiz and exam stages.
      await ctx.runMutation(internal.studySets.setProgress, {
        setId,
        progress: "Writing your summary…",
        percent: 14,
      });
      const generatedSummary = await summariseNotes(apiKeys, notes, context).catch(
        () => null,
      );

      await ctx.runMutation(internal.studySets.setProgress, {
        setId,
        progress: `Building ${targetCards} detail-heavy flashcards…`,
        percent: 24,
      });
      const reportCards: BatchProgress = async (done, target) => {
        await ctx.runMutation(internal.studySets.setProgress, {
          setId,
          progress: `Building flashcards… ${done} of ${target}`,
          percent: 24 + (done / Math.max(1, target)) * 32,
        });
      };
      const cards = await generateCards(
        apiKeys,
        notes,
        targetCards,
        deadline,
        reportCards,
      ).catch(() => []);

      await ctx.runMutation(internal.studySets.setProgress, {
        setId,
        progress: `Writing ${targetQuiz} quiz questions…`,
        percent: 58,
      });
      const reportQuiz: BatchProgress = async (done, target) => {
        await ctx.runMutation(internal.studySets.setProgress, {
          setId,
          progress: `Writing quiz questions… ${done} of ${target}`,
          percent: 58 + (done / Math.max(1, target)) * 20,
        });
      };
      const quiz = await generateQuiz(
        apiKeys,
        notes,
        targetQuiz,
        deadline,
        reportQuiz,
      ).catch(() => []);

      await ctx.runMutation(internal.studySets.setProgress, {
        setId,
        progress: `Drafting ${targetExam} exam questions…`,
        percent: 80,
      });
      const reportExams: BatchProgress = async (done, target) => {
        await ctx.runMutation(internal.studySets.setProgress, {
          setId,
          progress: `Drafting exam questions… ${done} of ${target}`,
          percent: 80 + (done / Math.max(1, target)) * 14,
        });
      };
      const exams = await generateExams(
        apiKeys,
        notes,
        context,
        targetExam,
        deadline,
        reportExams,
      ).catch(() => []);

      // A failed stage should not lose the rest of the set. Only a run where
      // nothing at all came back is a real failure, and it gets a clear message.
      const summary = generatedSummary ?? summaryFromNotes(notes);
      if (
        !generatedSummary &&
        cards.length === 0 &&
        quiz.length === 0 &&
        exams.length === 0
      ) {
        throw new Error(
          "NVIDIA did not return any usable material for this set. Your notes are saved; rebuild in a moment.",
        );
      }

      const missed: string[] = [];
      if (!generatedSummary) missed.push("the summary");
      if (cards.length === 0) missed.push("the flashcards");
      if (quiz.length === 0) missed.push("the quiz");
      if (exams.length === 0) missed.push("the exam questions");
      const capped =
        requestedCards > limits.cards ||
        requestedQuiz > limits.quiz ||
        requestedExam > limits.exam;
      const note = [
        capped
          ? `The notes support about ${limits.cards} flashcards, ${limits.quiz} quiz questions and ${limits.exam} exam questions, so Bluprint built the maximum it could.`
          : "",
        missed.length > 0
          ? `NVIDIA could not finish ${missed.join(", ")}. Everything that did generate is saved; rebuild to fill the gaps.`
          : "",
        Date.now() >= deadline
          ? "The build reached its time limit before every batch finished. Rebuild to add the rest."
          : "",
      ]
        .filter(Boolean)
        .join(" ");

      await ctx.runMutation(internal.studySets.setProgress, {
        setId,
        progress: "Saving your set…",
        percent: 97,
      });
      await ctx.runMutation(internal.studySets.completeGeneration, {
        setId,
        summary,
        cards,
        quiz,
        exams,
        generationNote: note || undefined,
      });
      return { started: true };
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Generation failed. Please retry.";
      await ctx.runMutation(internal.studySets.failGeneration, { setId, message });
      throw new Error(message);
    }
  },
});

// ---------------------------------------------------------------------------
// Exam marking
// ---------------------------------------------------------------------------

/**
 * Examiner persona. The rules below follow how published UK mark schemes work
 * (AQA, Edexcel, OCR, Cambridge): point-marked, whole marks only, no benefit of
 * the doubt, and contradictions cancelling a point. The goal is a mark a real
 * examiner would defend, not an encouraging estimate.
 */
const EXAMINER_SYSTEM_PROMPT =
  "You are a senior examiner marking a written exam answer against the mark scheme provided. " +
  "You are rigorous and ungenerous: a mark is only earned by evidence in the answer. " +
  "Answer with strict JSON only, no markdown fences, no commentary.";

function examinerRules(marksAvailable: number): string {
  return (
    "MARK EXACTLY AS A REAL EXAMINER WOULD:\n" +
    "1. Mark point by point against the marking guide above. A point scores only when the student states it explicitly. " +
    "If you have to infer it, finish their sentence, or give benefit of the doubt, it scores 0.\n" +
    "2. Accept wording that carries the same meaning. Do not accept a vague generality, a topic name with no explanation, " +
    "or a partly correct version of the point.\n" +
    "3. No marks for restating the question, for repeating one idea in different words, or for content the question did not ask for.\n" +
    "4. A contradiction cancels the mark for that point even if it was stated correctly elsewhere. " +
    "Wrong extra detail earns no credit and no leniency.\n" +
    `5. The model answer is a reference for you, not a second mark scheme. Credit only what the marking guide lists.\n` +
    `6. Award whole marks only. Total = the marks you award per point, capped at ${marksAvailable}. Never round up.\n` +
    "7. Calibrate against a real cohort: a thin or 'on topic' answer scores 0-2 even if it sounds confident; " +
    `full marks require every creditable point; ${Math.ceil(marksAvailable / 2)} out of ${marksAvailable} is a strong answer.\n` +
    "8. Do not reward effort, length, structure, or enthusiasm. Report marked evidence only."
  );
}

const EXAMINER_OUTPUT_SHAPE =
  'Return JSON exactly like: {"pointChecks":[{"point":"the mark scheme bullet","marks":1,"awarded":0,"evidence":"exact student words or empty string"}],' +
  '"awardedMarks":0,"feedback":"terse examiner note"}. ' +
  "Include one pointCheck per marking-guide bullet, in order. awardedMarks must equal the sum of the awarded fields. " +
  "The feedback is at most 90 words and names what was credited and exactly which marks were lost — no praise, no encouragement.";

type PointCheck = { point: string; marks: number; awarded: number };

/**
 * Levels marking is how essays and long responses are assessed: the examiner
 * chooses the highest level the whole answer consistently reaches, then a mark
 * inside that band. It cannot be reduced to one mark per bullet.
 */
function levelsExaminerRules(marksAvailable: number): string {
  return (
    "MARK EXACTLY AS A REAL EXAMINER WOULD:\n" +
    "1. Read the whole answer before choosing a level. Use the level descriptors as the mark scheme.\n" +
    "2. Choose the highest level the answer consistently reaches. One good sentence does not lift an otherwise weak answer into the next level;\n" +
    "a whole answer that meets the descriptors does not stay in the level below because it is short.\n" +
    "3. Choose a mark inside the level: the top of the band when the answer meets every descriptor, the bottom when it only just meets them.\n" +
    "4. Judge the whole essay: argument, analysis of the writer's methods or the evidence, use of supporting detail, and technical accuracy where the board assesses it.\n" +
    "5. Do not reward length, effort, confidence or a list of facts that does not answer the question.\n" +
    `6. Award whole marks only, between 0 and ${marksAvailable}. Never exceed the level's upper mark.\n` +
    "7. The feedback must name the level awarded, what lifted the answer, and the single change that would move it into the next level. No praise, no encouragement."
  );
}

const LEVELS_OUTPUT_SHAPE =
  'Return JSON exactly like: {"level":3,"awardedMarks":14,"feedback":"terse examiner note"}. ' +
  "awardedMarks must sit inside the level's mark range and must not exceed the marks available. " +
  "The feedback is at most 110 words.";

/**
 * Sends one answer to NVIDIA for marking and reconciles the model's totals with
 * its own point ledger (for point-marked questions) or its chosen level (for
 * essays). The ledger acts as a ceiling: an answer cannot be awarded more marks
 * than the credits it can point to.
 */
async function markExamAnswer(
  apiKeys: string[],
  exam: {
    question: string;
    marks: number;
    modelAnswer: string;
    markingGuide: string[];
  },
  response: string,
  context?: StudyContext,
  marking: "points" | "levels" = "points",
): Promise<{ awardedMarks: number; feedback: string }> {
  const qualification = qualificationText(context);
  const levels = marking === "levels";
  const raw = await nvidiaChat(apiKeys, {
    model: NVIDIA_TEXT_MODEL,
    messages: [
      { role: "system", content: EXAMINER_SYSTEM_PROMPT },
      {
        role: "user",
        content: levels
          ? `<qualification>${qualification || "Not specified"}</qualification>\n` +
            `<question>${exam.question}</question>\n` +
            `<marks_available>${exam.marks}</marks_available>\n` +
            `<level_descriptors>\n${exam.markingGuide.join("\n")}\n</level_descriptors>\n` +
            `<model_answer_reference_only>${exam.modelAnswer}</model_answer_reference_only>\n` +
            `<student_answer>${response.slice(0, 8000)}</student_answer>\n\n` +
            `${levelsExaminerRules(exam.marks)}\n\n` +
            LEVELS_OUTPUT_SHAPE
          : `<qualification>${qualification || "Not specified"}</qualification>\n` +
            `<question>${exam.question}</question>\n` +
            `<marks_available>${exam.marks}</marks_available>\n` +
            `<marking_guide>\n${exam.markingGuide.join("\n")}\n</marking_guide>\n` +
            `<model_answer_reference_only>${exam.modelAnswer}</model_answer_reference_only>\n` +
            `<student_answer>${response.slice(0, 5000)}</student_answer>\n\n` +
            `${examinerRules(exam.marks)}\n\n` +
            `BOARD CONVENTIONS — apply these when deciding whether a point is creditable:\n${markSchemeStyle(context?.examBoard)}\n\n` +
            EXAMINER_OUTPUT_SHAPE,
      },
    ],
    // Point-by-point marking plus the note needs more room than a bare score,
    // and a decisive temperature keeps the same answer scoring the same way.
    maxTokens: levels ? 2000 : 1400,
    temperature: 0,
    disableThinking: true,
  });

  const parsed = parseModelJson<{
    awardedMarks?: number;
    feedback?: string;
    level?: number;
    pointChecks?: unknown;
  }>(raw);

  if (levels) {
    const awarded = Math.round(Number(parsed.awardedMarks));
    const feedback = asText(parsed.feedback, 2500);
    if (!Number.isFinite(awarded) || !feedback) {
      throw new Error("The model couldn't grade that answer cleanly. Retry the grade.");
    }
    return {
      awardedMarks: Math.max(0, Math.min(exam.marks, awarded)),
      feedback,
    };
  }

  const checks: PointCheck[] = Array.isArray(parsed.pointChecks)
    ? parsed.pointChecks
        .map((entry) => {
          const row = entry as { point?: unknown; marks?: unknown; awarded?: unknown };
          const point = asText(row.point, 400);
          const marks = Math.max(1, Math.min(4, Math.round(Number(row.marks) || 1)));
          const awarded = Math.max(0, Math.min(marks, Math.floor(Number(row.awarded) || 0)));
          return point ? { point, marks, awarded } : null;
        })
        .filter((check): check is PointCheck => check !== null)
    : [];

  const ledgerTotal = checks.reduce((sum, check) => sum + check.awarded, 0);
  const claimed = Number(parsed.awardedMarks);
  const reported = Number.isFinite(claimed) ? Math.round(claimed) : ledgerTotal;
  // Take the stricter of the reported total and the ledger, then the paper limit.
  const awardedMarks = Math.max(
    0,
    Math.min(exam.marks, checks.length > 0 ? Math.min(reported, ledgerTotal) : reported),
  );

  const credited = checks.filter((check) => check.awarded > 0).map((check) => check.point);
  const missed = checks.filter((check) => check.awarded === 0).map((check) => check.point);
  const fallbackFeedback = [
    credited.length > 0
      ? `Credited: ${credited.join("; ")}`
      : "No mark-scheme points were credited in this answer.",
    missed.length > 0 ? `Marks lost: ${missed.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const feedback = asText(parsed.feedback, 2500) || fallbackFeedback;
  if (!feedback) {
    throw new Error("The model couldn't grade that answer cleanly. Retry the grade.");
  }

  return { awardedMarks, feedback };
}

/** AI-marks one written exam answer against the stored marking guide. */
export const gradeExamAnswer = action({
  args: {
    examId: v.id("examQuestions"),
    answer: v.string(),
  },
  handler: async (
    ctx,
    { examId, answer },
  ): Promise<{ awardedMarks: number; marks: number; feedback: string }> => {
    const userId = await requireUserId(ctx);
    const response = answer.trim();
    if (response.length < 15) {
      throw new Error("Write a fuller answer before sending it for grading.");
    }

    const data = await ctx.runQuery(internal.studySets.getExamForGrading, { examId });
    if (!data || data.set.userId !== userId) {
      throw new Error("Exam question not found.");
    }

    const apiKeys = resolveNvidiaKeys();
    const { exam, set } = data;
    const { awardedMarks, feedback } = await markExamAnswer(apiKeys, exam, response, {
      course: set.course,
      examBoard: set.examBoard,
      level: set.level,
    });

    await ctx.runMutation(internal.studySets.saveExamResult, {
      examId,
      answer: response,
      awardedMarks,
      feedback,
    });

    return { awardedMarks, marks: exam.marks, feedback };
  },
});

// ---------------------------------------------------------------------------
// AI tutor
// ---------------------------------------------------------------------------

/**
 * The tutor teaches instead of only answering: it explains the reasoning, ties
 * the idea back to the material it was pointed at, and speaks in the command
 * words of the student's exam board. Plain text keeps the chat rendering simple.
 */
const TUTOR_SYSTEM_PROMPT =
  "You are Bluprint's AI tutor: a patient, precise subject teacher working one-to-one with a student. " +
  "Explain the reasoning rather than only the conclusion, and use a concrete example when it helps. " +
  "Use the provided study material as the primary source. If it does not cover something, say so plainly before giving the standard explanation, and never invent content and attribute it to the material. " +
  "When you can search the web, use it for anything recent, exam-board specific, or outside the study material, and name the site you took the fact from. " +
  "Never cite a page you did not actually read, and never invent a source. " +
  "Answer in plain text with short paragraphs and hyphen bullets. No markdown headings, tables, or code fences. " +
  "Be direct and warm, not effusive. Keep answers under 250 words unless the student asks for a model answer or a step-by-step walkthrough.";

/** What the tutor is pointed at, already reduced to plain text. */
type TutorContext = {
  /** Set title, or "Subject · Unit" for a pathway conversation. */
  title: string;
  material: string;
  course?: string;
  examBoard?: string;
  level?: string;
  messages: Array<{ role: string; content: string }>;
};

/** The question as the tutor's prompt, with the material and any web results. */
function tutorPrompt(
  context: TutorContext,
  question: string,
  web: WebResult[] = [],
): ChatMessage[] {
  const qualification = qualificationText(context);
  const history = context.messages
    .map(
      (message) =>
        `${message.role === "user" ? "Student" : "Tutor"}: ${message.content.slice(0, 1200)}`,
    )
    .join("\n\n");

  return [
    { role: "system", content: TUTOR_SYSTEM_PROMPT },
    {
      role: "user",
      content:
        `${materialBlock(context.material)}\n\n` +
        (web.length > 0 ? `${webResultsBlock(web)}\n\n` : "") +
        `<material_title>${context.title}</material_title>\n` +
        `<qualification>${qualification || "Not specified"}</qualification>\n` +
        (context.examBoard
          ? `<mark_scheme_style>${markSchemeStyle(context.examBoard)}</mark_scheme_style>\n`
          : "") +
        (context.level
          ? `Pitch the explanation at ${context.level} depth and use that qualification's command words when discussing exam technique.\n`
          : "") +
        `<conversation>\n${history || "(this is the student's first question)"}\n</conversation>\n\n` +
        `<student_question>${question}</student_question>\n\n` +
        "Answer as the tutor. If the student asks for exam practice, give one question at a time and wait for their answer before marking it.",
    },
  ];
}

/** A page an answer cited, stored beside the message. */
type StreamSource = { title: string; url: string };

/** What one streamed answer produced. */
type StreamResult = { text: string; sources: StreamSource[] };

type Snapshot = (fullText: string, sources: StreamSource[]) => Promise<void>;

/**
 * The chat renders plain text, so markdown links and emphasis are flattened.
 * A link becomes its label; the full URL is still shown in the source list.
 */
function tidyTutorText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "");
}

/**
 * Reads an OpenAI-compatible server-sent-event chat stream, calling `onSnapshot`
 * roughly eight times a second with the text written so far. OpenRouter's web
 * plugin also streams url_citation annotations; those become the saved sources,
 * so the chat can show exactly which pages the answer used.
 */
async function readChatStream(
  response: Response,
  onSnapshot: Snapshot,
): Promise<StreamResult> {
  if (!response.body) throw new Error("The AI response had no body to read.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const sources: StreamSource[] = [];
  let buffer = "";
  let answer = "";
  let lastEmit = 0;

  const addSource = (candidate: unknown) => {
    const citation = (candidate as { url_citation?: { url?: unknown; title?: unknown } })
      ?.url_citation;
    const url = typeof citation?.url === "string" ? citation.url.trim() : "";
    if (!url) return;
    if (sources.some((source) => source.url === url)) return;
    const title = typeof citation?.title === "string" ? citation.title.trim() : "";
    sources.push({ title: title || url, url });
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const payload = JSON.parse(data) as {
          choices?: Array<{
            delta?: { content?: string; annotations?: unknown[] };
            message?: { annotations?: unknown[] };
          }>;
        };
        const choice = payload.choices?.[0];
        const piece = choice?.delta?.content;
        if (typeof piece === "string" && piece) answer += piece;
        for (const annotation of [
          ...(choice?.delta?.annotations ?? []),
          ...(choice?.message?.annotations ?? []),
        ]) {
          addSource(annotation);
        }
      } catch {
        // A malformed keep-alive frame is not worth failing the answer over.
      }
    }

    if (answer && Date.now() - lastEmit > 120) {
      lastEmit = Date.now();
      await onSnapshot(tidyTutorText(answer), sources);
    }
  }

  return { text: tidyTutorText(answer).trim(), sources };
}

/**
 * Streams one tutor answer from NVIDIA. Each attempt takes the next key; a 429
 * cools that key and moves on. The answer is retried only while nothing has
 * been written, because a half-streamed answer cannot be resumed.
 */
async function streamNvidiaAnswer(
  apiKeys: string[],
  messages: ChatMessage[],
  onSnapshot: Snapshot,
): Promise<StreamResult> {
  const maxAttempts = Math.max(2, Math.min(apiKeys.length + 1, 4));
  let thinkingDisabled = true;
  let lastStatus: number | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const apiKey = nextApiKey(apiKeys);
    let response: Response;
    try {
      response = await fetch(NVIDIA_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          model: NVIDIA_TEXT_MODEL,
          messages,
          temperature: 0.3,
          top_p: 1,
          max_tokens: 1500,
          stream: true,
          ...(thinkingDisabled
            ? { chat_template_kwargs: { enable_thinking: false } }
            : {}),
        }),
        signal: AbortSignal.timeout(90_000),
      });
    } catch {
      if (attempt < maxAttempts - 1) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw new Error(
        "Could not reach NVIDIA. Check the deployment's network connection and retry.",
      );
    }

    if (!response.ok || !response.body) {
      lastStatus = response.status;
      if (response.status === 429) {
        coolingKeys.set(apiKey, Date.now() + KEY_COOLDOWN_MS);
        if (attempt < maxAttempts - 1) {
          await sleep(400 * (attempt + 1));
          continue;
        }
      } else if (response.status === 401 || response.status === 403) {
        rejectedKeys.add(apiKey);
        if (attempt < maxAttempts - 1) continue;
      } else if (response.status >= 500) {
        if (attempt < maxAttempts - 1) {
          await sleep(1000 * (attempt + 1));
          continue;
        }
      } else if (response.status === 400 && thinkingDisabled) {
        // The model does not understand the thinking flag; drop it and retry.
        thinkingDisabled = false;
        if (attempt < maxAttempts - 1) continue;
      }
      throw new Error(friendlyHttpError(response.status));
    }

    const result = await readChatStream(response, onSnapshot);
    if (result.text.length > 0) {
      return { text: stripReasoning(result.text).trim(), sources: result.sources };
    }
    if (attempt < maxAttempts - 1) continue;
    throw new Error(
      "NVIDIA sent back an empty answer, which usually means the model used its whole token budget on reasoning. Ask again.",
    );
  }

  if (lastStatus !== null) throw new Error(friendlyHttpError(lastStatus));
  throw new Error("NVIDIA could not complete the answer. Please retry.");
}

/**
 * Streams a web-connected answer from OpenRouter with its web plugin, which
 * researches the question and returns url_citation annotations. Used only when
 * the student asks for web access and the deployment has an OpenRouter key.
 */
async function streamWebAnswer(
  messages: ChatMessage[],
  onSnapshot: Snapshot,
): Promise<StreamResult> {
  const apiKey = readOpenRouterKey();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set on this deployment.");

  const response = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "HTTP-Referer": "https://bluprint.study",
      "X-Title": "Bluprint",
    },
    body: JSON.stringify({
      model: OPENROUTER_TUTOR_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 1500,
      stream: true,
      plugins: [{ id: "web", max_results: 4 }],
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok || !response.body) {
    throw new Error(`OpenRouter could not search the web (HTTP ${response.status}).`);
  }

  const result = await readChatStream(response, onSnapshot);
  if (result.text.length === 0) {
    throw new Error("OpenRouter returned an empty answer.");
  }
  return result;
}

/** Turns search hits into the citation list saved beside the message. */
function sourcesFrom(results: WebResult[]): StreamSource[] {
  return results.map((result) => ({ title: result.title, url: result.url }));
}

/**
 * Answers as the tutor, streaming into `onSnapshot`.
 *
 * With web access on, the free sources are searched first: Wikipedia, Wikibooks,
 * Stack Exchange and DuckDuckGo's instant answers. If they cover the question,
 * NVIDIA writes the answer from them and the pages become the citations. If they
 * cannot, a keyed provider (Tavily, Exa, Serper) is tried by `searchWeb`; if the
 * question still has no sources, OpenRouter's browsing model gets a go; and if
 * that is unavailable the tutor answers from the student's material alone, so a
 * web failure never breaks the conversation.
 */
async function streamTutorAnswer(
  apiKeys: string[],
  context: TutorContext,
  question: string,
  useWeb: boolean,
  onSnapshot: Snapshot,
): Promise<StreamResult> {
  if (!useWeb) {
    return await streamNvidiaAnswer(
      apiKeys,
      tutorPrompt(context, question),
      onSnapshot,
    );
  }

  const search = await searchWeb(question, context.course).catch(() => null);
  const results = search?.results ?? [];

  if (results.length > 0) {
    const grounded = await streamNvidiaAnswer(
      apiKeys,
      tutorPrompt(context, question, results),
      onSnapshot,
    );
    return { text: grounded.text, sources: sourcesFrom(results) };
  }

  try {
    return await streamWebAnswer(tutorPrompt(context, question), onSnapshot);
  } catch {
    return await streamNvidiaAnswer(
      apiKeys,
      tutorPrompt(context, question),
      onSnapshot,
    );
  }
}

/** Trims and validates a tutor question; the UI and the action agree on limits. */
function readQuestion(question: string): string {
  const text = question.trim();
  if (text.length < 3) {
    throw new Error("Write a question for the tutor first.");
  }
  if (text.length > 1200) {
    throw new Error("Keep the question under 1,200 characters.");
  }
  return text;
}

/**
 * Answers one tutor question using the set's notes and recent saved turns.
 *
 * The reply is streamed: the question and an empty assistant row are saved
 * first, then the text is written to that row as NVIDIA sends it, so the chat
 * fills in live. Web search runs before the model is called, and the pages it
 * found are saved with the answer so citations survive a reload.
 */
export const askTutor = action({
  args: {
    setId: v.id("studySets"),
    question: v.string(),
    useWeb: v.optional(v.boolean()),
  },
  handler: async (ctx, { setId, question, useWeb }): Promise<{ reply: string }> => {
    const userId = await requireUserId(ctx);
    const text = readQuestion(question);

    const context = await ctx.runQuery(internal.tutor.getTutorContext, {
      setId,
      userId,
    });
    if (!context) throw new Error("Study set not found.");

    const apiKeys = resolveNvidiaKeys();
    const messageId = await ctx.runMutation(internal.tutor.beginTutorExchange, {
      setId,
      userId,
      question: text,
    });

    try {
      const tutorContext: TutorContext = {
        title: context.set.title,
        material: context.set.notes,
        course: context.set.course,
        examBoard: context.set.examBoard,
        level: context.set.level,
        messages: context.messages,
      };
      const result = await streamTutorAnswer(
        apiKeys,
        tutorContext,
        text,
        useWeb !== false,
        async (content, sources) => {
          await ctx.runMutation(internal.tutor.appendTutorAnswer, {
            messageId,
            content,
            ...(sources.length > 0 ? { sources } : {}),
          });
        },
      );

      // One last write carries the final text and every page that was cited.
      await ctx.runMutation(internal.tutor.appendTutorAnswer, {
        messageId,
        content: result.text,
        ...(result.sources.length > 0 ? { sources: result.sources } : {}),
      });
      await ctx.runMutation(internal.tutor.finishTutorExchange, { messageId });
      return { reply: result.text };
    } catch (error) {
      await ctx.runMutation(internal.tutor.discardTutorAnswer, { messageId });
      throw error;
    }
  },
});

/**
 * Answers a question pointed at a whole course or one unit of it, using that
 * scope's scraped pathway as context. A unit thread and a course thread are
 * stored separately, so follow-ups stay about what the student opened. Streams
 * exactly like the study-set tutor.
 */
export const askCourseTutor = action({
  args: {
    courseId: v.id("courses"),
    unitTitle: v.optional(v.string()),
    question: v.string(),
    useWeb: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { courseId, unitTitle, question, useWeb },
  ): Promise<{ reply: string }> => {
    const userId = await requireUserId(ctx);
    const text = readQuestion(question);

    const context = await ctx.runQuery(internal.tutor.getCourseTutorContext, {
      courseId,
      unitTitle,
      userId,
    });
    if (!context) throw new Error("Course not found.");

    const apiKeys = resolveNvidiaKeys();
    const messageId = await ctx.runMutation(
      internal.tutor.beginCourseTutorExchange,
      { courseId, userId, unitTitle, question: text },
    );

    try {
      const result = await streamTutorAnswer(
        apiKeys,
        context,
        text,
        useWeb !== false,
        async (content, sources) => {
          await ctx.runMutation(internal.tutor.appendCourseTutorAnswer, {
            messageId,
            content,
            ...(sources.length > 0 ? { sources } : {}),
          });
        },
      );

      await ctx.runMutation(internal.tutor.appendCourseTutorAnswer, {
        messageId,
        content: result.text,
        ...(result.sources.length > 0 ? { sources: result.sources } : {}),
      });
      await ctx.runMutation(internal.tutor.finishCourseTutorExchange, {
        messageId,
      });
      return { reply: result.text };
    } catch (error) {
      await ctx.runMutation(internal.tutor.discardCourseTutorAnswer, { messageId });
      throw error;
    }
  },
});

