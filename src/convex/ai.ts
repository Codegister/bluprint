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
import {
  MAX_NOTES_CHARS,
  NVIDIA_CHAT_URL,
  NVIDIA_TEXT_MODEL,
  NVIDIA_VISION_MODEL,
  readNvidiaKeys,
} from "./lib/nvidiaConfig";
import {
  OPENROUTER_CHAT_URL,
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_MODELS_URL,
  OPENROUTER_PREFERRED_MODELS,
  readOpenRouterKey,
  readOpenRouterModelOverride,
} from "./lib/openrouterConfig";

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
        const value = JSON.parse(text.slice(start, i + 1));
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
      // Try the next candidate.
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
    const modelAnswer = asText(row.modelAnswer, 2500);
    const marks = Math.round(Number(row.marks));
    const markingGuide = Array.isArray(row.markingGuide)
      ? row.markingGuide.map((point) => asText(point, 400)).filter(Boolean).slice(0, 8)
      : [];
    if (
      question &&
      modelAnswer &&
      Number.isFinite(marks) &&
      marks >= 1 &&
      marks <= 12 &&
      markingGuide.length > 0
    ) {
      questions.push({ question, marks, modelAnswer, markingGuide });
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
const MAX_BATCH_ATTEMPTS = 4;

async function generateCards(
  apiKeys: string[],
  notes: string,
  target: number,
): Promise<GeneratedCard[]> {
  const cards: GeneratedCard[] = [];
  const seen = new Set<string>();

  for (
    let attempt = 0;
    attempt < MAX_BATCH_ATTEMPTS && cards.length < target;
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
    } catch (error) {
      if (cards.length === 0) throw error;
      break;
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
    // A model that ignores the "do not repeat" instruction would otherwise
    // loop until the attempt cap with no new cards.
    if (added === 0) break;
  }

  if (cards.length < 6) {
    throw new Error(
      "Not enough flashcards could be generated from this material. Add more notes and retry.",
    );
  }
  return cards.slice(0, target);
}

async function generateQuiz(
  apiKeys: string[],
  notes: string,
  target: number,
): Promise<GeneratedQuiz[]> {
  const questions: GeneratedQuiz[] = [];
  const seen = new Set<string>();

  for (
    let attempt = 0;
    attempt < MAX_BATCH_ATTEMPTS && questions.length < target;
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
    } catch (error) {
      if (questions.length === 0) throw error;
      break;
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
    if (added === 0) break;
  }

  if (questions.length < 3) {
    throw new Error(
      "Not enough quiz questions could be generated. Retry the build or add more material.",
    );
  }
  return questions.slice(0, target);
}

async function generateExams(
  apiKeys: string[],
  notes: string,
  context: StudyContext | undefined,
  target: number,
): Promise<GeneratedExam[]> {
  const qualification = qualificationText(context);
  const exams: GeneratedExam[] = [];
  const seen = new Set<string>();

  for (
    let attempt = 0;
    attempt < MAX_BATCH_ATTEMPTS && exams.length < target;
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
            `Create ${want} exam-style short-answer questions that ask the student to explain, compare, or apply ideas from the material. Each is worth 5-10 marks. Use the full depth of the material rather than one-line recall. ` +
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
    } catch (error) {
      if (exams.length === 0) throw error;
      break;
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
// Course pathways (larger model)
// ---------------------------------------------------------------------------

/**
 * A pathway is a whole qualification laid out as units and topics, so it needs
 * a stronger model than one page of notes. OpenRouter's free catalogue is the
 * default; NVIDIA is kept as a fallback so the app still builds a useful map if
 * only NVIDIA_API_KEY is configured.
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

let freeModelCache: { at: number; ids: string[] } | null = null;

/** Reads which `:free` models OpenRouter currently offers. Cached for 10 min. */
async function freeOpenRouterModels(): Promise<string[]> {
  if (freeModelCache && Date.now() - freeModelCache.at < 10 * 60 * 1000) {
    return freeModelCache.ids;
  }
  try {
    const response = await fetch(OPENROUTER_MODELS_URL, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as {
      data?: Array<{
        id?: string;
        pricing?: { prompt?: string; completion?: string };
      }>;
    };
    const ids = (payload.data ?? [])
      .filter((model) => {
        if (typeof model.id !== "string") return false;
        if (!model.id.endsWith(":free")) return false;
        // Guard against a catalogue entry labelled free but priced.
        const promptPrice = Number(model.pricing?.prompt ?? "0");
        const completionPrice = Number(model.pricing?.completion ?? "0");
        return promptPrice === 0 && completionPrice === 0;
      })
      .map((model) => model.id as string);
    freeModelCache = { at: Date.now(), ids };
    return ids;
  } catch {
    return [];
  }
}

/**
 * Picks up to four models, preferring the known-good free models. An
 * OPENROUTER_MODEL override is tried first, but the free fallbacks stay in the
 * list: a single model returning truncated JSON should not fail the build.
 */
async function pickOpenRouterModels(): Promise<string[]> {
  const override = readOpenRouterModelOverride();
  const free = await freeOpenRouterModels();
  const preferred: string[] = [...OPENROUTER_PREFERRED_MODELS].filter(
    (model) => free.length === 0 || free.includes(model),
  );
  const fallback = free.filter((model) => !preferred.includes(model));
  const chosen = preferred.length > 0 ? [...preferred, ...fallback] : free;
  const list = chosen.length > 0 ? chosen : [OPENROUTER_DEFAULT_MODEL];
  const pinned = override ? [override] : [];
  return [...new Set([...pinned, ...list])].slice(0, 4);
}

function openRouterError(status: number): string {
  if (status === 401 || status === 403) {
    return "OpenRouter rejected OPENROUTER_API_KEY. Check the key on the deployment.";
  }
  if (status === 402) {
    return "OpenRouter could not run that request. Check the account has free-model access and retry.";
  }
  if (status === 429) {
    return "OpenRouter's free models are rate-limited right now. Wait a minute, then retry the build.";
  }
  if (status >= 500) {
    return "OpenRouter's service is having trouble right now. Try again in a moment.";
  }
  return `OpenRouter could not build the pathway (HTTP ${status}). Please retry.`;
}

/**
 * Chat call against OpenRouter. Free models come and go, so a few candidates
 * are attempted in order. `reasoning` is capped where supported to stop hidden
 * thinking eating the JSON budget, and dropped if a model rejects the field.
 *
 * Each answer is parsed before it is accepted. A model that returns malformed
 * or truncated JSON is skipped in favour of the next candidate instead of
 * failing the whole build.
 */
async function openRouterChat<T>(
  messages: ChatMessage[],
  maxTokens: number,
  parse: (raw: string) => T,
): Promise<T> {
  const key = readOpenRouterKey();
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY is not set on this deployment. Add it to build course pathways.",
    );
  }

  const models = await pickOpenRouterModels();
  let lastError = "OpenRouter could not build the pathway. Please retry.";

  for (const model of models) {
    for (const withReasoning of [true, false]) {
      let response: Response;
      try {
        response = await fetch(OPENROUTER_CHAT_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://bluprint.local",
            "X-Title": "Bluprint",
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.2,
            max_tokens: maxTokens,
            stream: false,
            ...(withReasoning ? { reasoning: { effort: "low" } } : {}),
          }),
          // A 16k-token pathway can take longer than a page summary.
          signal: AbortSignal.timeout(180_000),
        });
      } catch (error) {
        lastError =
          error instanceof Error && error.name === "TimeoutError"
            ? "The pathway model took too long to respond. Please retry."
            : "Could not reach OpenRouter. Check the deployment's network connection and retry.";
        // Move to the next free model instead of waiting on the same one again.
        break;
      }

      if (response.ok) {
        const payload = (await response.json()) as {
          choices?: Array<{
            message?: { content?: string | null; reasoning?: string | null };
          }>;
        };
        const message = payload.choices?.[0]?.message;
        const content =
          typeof message?.content === "string" ? message.content.trim() : "";
        if (content.length > 0) {
          try {
            return parse(content);
          } catch (parseError) {
            lastError =
              parseError instanceof Error
                ? parseError.message
                : "A pathway model returned an incomplete course map.";
            // Move on to the next model rather than accepting bad JSON.
            break;
          }
        }
        lastError =
          "The pathway model returned an empty answer. Retry the build to try another free model.";
        break;
      }

      lastError = openRouterError(response.status);
      if (response.status === 401 || response.status === 403) throw new Error(lastError);
      if (response.status === 429) {
        // Try a different free model rather than hammering the same one.
        await sleep(1200);
        break;
      }
      if (response.status === 400 && withReasoning) continue;
      if (response.status === 404) break;
      if (response.status >= 500) {
        await sleep(800);
        break;
      }
    }
  }

  throw new Error(lastError);
}

function parsePathway(raw: string): CoursePathway {
  const parsed =
    tryParseJson<Record<string, unknown>>(raw) ??
    parsedObjects(stripReasoning(raw)).find((row) => Array.isArray(row.units)) ??
    null;
  if (!parsed) {
    throw new Error(
      "The pathway model returned something Bluprint couldn't read. Retry, or check OPENROUTER_MODEL on the deployment.",
    );
  }

  const overview = asText(parsed.overview, 1600);
  const examFormat = asText(parsed.examFormat, 1200);
  const rawUnits = Array.isArray(parsed.units) ? parsed.units : [];
  const units: PathwayUnit[] = [];

  for (const [unitIndex, entry] of rawUnits.slice(0, 12).entries()) {
    if (!entry || typeof entry !== "object") continue;
    const unit = entry as Record<string, unknown>;
    const unitTitle = asText(unit.title, 120);
    const rawTopics = Array.isArray(unit.topics) ? unit.topics : [];
    const topics: PathwayTopic[] = [];

    for (const [topicIndex, topicEntry] of rawTopics.slice(0, 8).entries()) {
      if (!topicEntry || typeof topicEntry !== "object") continue;
      const topic = topicEntry as Record<string, unknown>;
      const title = asText(topic.title, 140);
      const keyPoints = Array.isArray(topic.keyPoints)
        ? topic.keyPoints.map((point) => asText(point, 300)).filter(Boolean).slice(0, 5)
        : [];
      if (!title || keyPoints.length === 0) continue;
      const specReference = asText(topic.specReference, 40);
      topics.push({
        // Ids are generated here so they stay stable and unique even if the
        // model repeats a topic title.
        id: `u${unitIndex + 1}t${topicIndex + 1}`,
        title,
        ...(specReference ? { specReference } : {}),
        summary: asText(topic.summary, 500),
        keyPoints,
        examSkill: asText(topic.examSkill, 300),
      });
    }

    if (unitTitle && topics.length >= 2) {
      units.push({
        title: unitTitle,
        summary: asText(unit.summary, 600),
        topics,
      });
    }
  }

  const topicCount = units.reduce((sum, unit) => sum + unit.topics.length, 0);
  if (units.length < 3 || topicCount < 8) {
    throw new Error(
      "The pathway model returned an incomplete course map. Retry the build to try another free model.",
    );
  }

  return {
    overview:
      overview ||
      `A specification-led revision pathway for this course, split into ${units.length} units and ${topicCount} topics.`,
    examFormat:
      examFormat ||
      "Check your exam board's specification for the current paper structure and weightings.",
    units,
  };
}

function pathwayPrompt(course: {
  subject: string;
  level: string;
  examBoard: string;
  tier?: string;
  variant?: string;
  poetryTheme?: string;
}): string {
  return (
    `Design a complete revision pathway for this course.\n` +
    `<course>${course.subject}</course>\n` +
    `<qualification>${course.level}</qualification>\n` +
    `<exam_board>${course.examBoard}</exam_board>\n` +
    // GCSE routes are separate subjects now (Combined Science is its own
    // entry), so ignore a legacy Triple/Combined variant on old courses.
    (course.level !== "GCSE" && course.variant
      ? `<route>${course.variant}</route>\n`
      : "") +
    (course.tier ? `<tier>${course.tier}</tier>\n` : "") +
    (course.poetryTheme
      ? `<poetry_theme>${course.poetryTheme}</poetry_theme>\n`
      : "") +
    "\nUse the official specification for this exact course, route, tier and board as your source. " +
    "Pitch the depth at the stated tier: Foundation omits higher-tier-only content, while Higher includes it. If a route is given, follow that route. " +
    (course.poetryTheme
      ? "Plan the poetry anthology around the stated poetry theme. Do not default to Power and Conflict when another theme is given. "
      : "") +
    "Choose the current specification, not an old syllabus. If you are not certain a topic or reference is on the current specification, leave the reference blank rather than inventing one.\n\n" +
    "Rules:\n" +
    "- 6 to 10 units in teaching order. 4 to 6 topics per unit. Cover the whole course, including required practicals, case studies or set texts where the specification requires them.\n" +
    "- Use official unit and topic names. Keep titles under 12 words.\n" +
    "- Each topic gets a one-sentence summary (max 30 words), 2 to 4 key points (max 22 words each), and one examSkill sentence describing how it is examined or what exam technique it demands.\n" +
    "- examFormat: name the papers/components and their weighting and duration where you are confident. Otherwise say: Check your specification for paper structure and weighting.\n" +
    "- overview: 2 to 3 sentences on what the course covers and the best way to revise it.\n" +
    "- No markdown, no commentary, no extra keys. Strict JSON only.\n\n" +
    "Return this exact shape:\n" +
    '{"overview":"...","examFormat":"...","units":[{"title":"...","summary":"...","topics":[{"title":"...","specReference":"4.1.2","summary":"...","keyPoints":["..."],"examSkill":"..."}]}]}'
  );
}

/** Uses OpenRouter first, then NVIDIA, so a missing free-model key is not fatal. */
async function generateCoursePathway(course: {
  subject: string;
  level: string;
  examBoard: string;
  tier?: string;
  variant?: string;
  poetryTheme?: string;
}): Promise<CoursePathway> {
  const prompt = pathwayPrompt(course);
  const system: ChatMessage = {
    role: "system",
    content:
      "You are an experienced curriculum designer and examiner who knows current specifications. " +
      "Return strict JSON only, with no markdown fences or commentary.",
  };

  if (readOpenRouterKey()) {
    try {
      // 16k leaves room for a full 10-unit map without the JSON being cut off
      // mid-topic. Each candidate model is parse-checked inside openRouterChat.
      return await openRouterChat(
        [system, { role: "user", content: prompt }],
        16_000,
        parsePathway,
      );
    } catch (error) {
      const nvidiaKeys = readNvidiaKeys();
      if (nvidiaKeys.length === 0) throw error;
      // Fall through to NVIDIA rather than failing a whole course on a free
      // model's rate limit.
    }
  }

  const nvidiaKeys = readNvidiaKeys();
  if (nvidiaKeys.length === 0) {
    throw new Error(
      "Course pathways need OPENROUTER_API_KEY (or NVIDIA_API_KEY as a fallback). Add one to the server environment and retry.",
    );
  }
  const raw = await nvidiaChat(nvidiaKeys, {
    model: NVIDIA_TEXT_MODEL,
    messages: [system, { role: "user", content: prompt }],
    maxTokens: 12_000,
    temperature: 0.2,
    disableThinking: true,
    timeoutMs: 180_000,
  });
  return parsePathway(raw);
}

/**
 * Builds one course map. Scheduled by `courses.createMany`, so the browser can
 * queue nine courses and watch them complete without holding a request open.
 */
export const buildCoursePathway = internalAction({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const course = await ctx.runQuery(internal.courses.getForBuild, { courseId });
    if (!course) return { ok: false };
    if (course.status === "ready") return { ok: true };

    const claim = await ctx.runMutation(internal.courses.claimBuild, { courseId });
    if (!claim.claimed) return { ok: false };

    try {
      const pathway = await generateCoursePathway(course);
      await ctx.runMutation(internal.courses.completeBuild, { courseId, pathway });
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "The pathway could not be built. Please retry.";
      await ctx.runMutation(internal.courses.failBuild, { courseId, message });
      return { ok: false };
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

      // Sets created before the sliders existed fall back to the longer
      // defaults; older sets stay readable and can be rebuilt at any length.
      const targetCards = Math.min(30, Math.max(10, existing.targetCardCount ?? 20));
      const targetQuiz = Math.min(20, Math.max(5, existing.targetQuizCount ?? 10));
      const targetExam = Math.min(10, Math.max(2, existing.targetExamCount ?? 4));

      await ctx.runMutation(internal.studySets.setProgress, {
        setId,
        progress: "Writing your summary…",
      });
      const summary = await summariseNotes(apiKeys, notes, context);

      await ctx.runMutation(internal.studySets.setProgress, {
        setId,
        progress: `Building ${targetCards} detail-heavy flashcards…`,
      });
      const cards = await generateCards(apiKeys, notes, targetCards);

      await ctx.runMutation(internal.studySets.setProgress, {
        setId,
        progress: `Writing ${targetQuiz} quiz questions…`,
      });
      const quiz = await generateQuiz(apiKeys, notes, targetQuiz);

      await ctx.runMutation(internal.studySets.setProgress, {
        setId,
        progress: `Drafting ${targetExam} exam questions…`,
      });
      const exams = await generateExams(apiKeys, notes, context, targetExam);

      await ctx.runMutation(internal.studySets.completeGeneration, {
        setId,
        summary,
        cards,
        quiz,
        exams,
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
  "You are a senior examiner marking a written exam answer against an official past-paper mark scheme. " +
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
 * Sends one answer to NVIDIA for marking and reconciles the model's totals with
 * its own point ledger. The ledger acts as a ceiling: an answer cannot be
 * awarded more marks than the credits it can point to.
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
): Promise<{ awardedMarks: number; feedback: string }> {
  const qualification = qualificationText(context);
  const raw = await nvidiaChat(apiKeys, {
    model: NVIDIA_TEXT_MODEL,
    messages: [
      { role: "system", content: EXAMINER_SYSTEM_PROMPT },
      {
        role: "user",
        content:
          `<qualification>${qualification || "Not specified"}</qualification>\n` +
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
    maxTokens: 1400,
    temperature: 0,
    disableThinking: true,
  });

  const parsed = parseModelJson<{
    awardedMarks?: number;
    feedback?: string;
    pointChecks?: unknown;
  }>(raw);

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
 * the idea back to the set's notes, and speaks in the command words of the
 * student's exam board. Plain text keeps the chat rendering simple.
 */
const TUTOR_SYSTEM_PROMPT =
  "You are Bluprint's AI tutor: a patient, precise subject teacher working one-to-one with a student. " +
  "Explain the reasoning rather than only the conclusion, and use a concrete example when it helps. " +
  "Use the student's notes as the primary source. If the notes do not cover something, say so plainly before giving the standard explanation, and never invent content and attribute it to the notes. " +
  "Answer in plain text with short paragraphs and hyphen bullets. No markdown headings, tables, or code fences. " +
  "Be direct and warm, not effusive. Keep answers under 250 words unless the student asks for a model answer or a step-by-step walkthrough.";

async function answerAsTutor(
  apiKeys: string[],
  context: {
    set: {
      title: string;
      notes: string;
      course?: string;
      examBoard?: string;
      level?: string;
    };
    messages: Array<{ role: string; content: string }>;
  },
  question: string,
): Promise<string> {
  const qualification = qualificationText(context.set);
  const history = context.messages
    .map(
      (message) =>
        `${message.role === "user" ? "Student" : "Tutor"}: ${message.content.slice(0, 1200)}`,
    )
    .join("\n\n");

  const raw = await nvidiaChat(apiKeys, {
    model: NVIDIA_TEXT_MODEL,
    messages: [
      { role: "system", content: TUTOR_SYSTEM_PROMPT },
      {
        role: "user",
        content:
          `${materialBlock(context.set.notes)}\n\n` +
          `<set_title>${context.set.title}</set_title>\n` +
          `<qualification>${qualification || "Not specified"}</qualification>\n` +
          (context.set.examBoard
            ? `<mark_scheme_style>${markSchemeStyle(context.set.examBoard)}</mark_scheme_style>\n`
            : "") +
          (context.set.level
            ? `Pitch the explanation at ${context.set.level} depth and use that qualification's command words when discussing exam technique.\n`
            : "") +
          `<conversation>\n${history || "(this is the student's first question)"}\n</conversation>\n\n` +
          `<student_question>${question}</student_question>\n\n` +
          "Answer as the tutor. If the student asks for exam practice, give one question at a time and wait for their answer before marking it.",
      },
    ],
    maxTokens: 1500,
    temperature: 0.3,
    disableThinking: true,
  });

  return stripReasoning(raw).trim();
}

/**
 * Answers one tutor question using the set's notes and recent saved turns,
 * then stores the exchange. The key never leaves this action.
 */
export const askTutor = action({
  args: { setId: v.id("studySets"), question: v.string() },
  handler: async (ctx, { setId, question }): Promise<{ reply: string }> => {
    const userId = await requireUserId(ctx);
    const text = question.trim();
    if (text.length < 3) {
      throw new Error("Write a question for the tutor first.");
    }
    if (text.length > 1200) {
      throw new Error("Keep the question under 1,200 characters.");
    }

    const context = await ctx.runQuery(internal.tutor.getTutorContext, {
      setId,
      userId,
    });
    if (!context) throw new Error("Study set not found.");

    const apiKeys = resolveNvidiaKeys();
    const reply = await answerAsTutor(apiKeys, context, text);

    await ctx.runMutation(internal.tutor.saveExchange, {
      setId,
      userId,
      question: text,
      answer: reply,
    });

    return { reply };
  },
});

