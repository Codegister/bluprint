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
import { action } from "./_generated/server";
import { requireUserId } from "./lib/requireUser";
import {
  MAX_NOTES_CHARS,
  NVIDIA_CHAT_URL,
  NVIDIA_TEXT_MODEL,
  NVIDIA_VISION_MODEL,
  readNvidiaKeys,
} from "./lib/nvidiaConfig";

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
        signal: AbortSignal.timeout(120_000),
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

function parseCards(raw: string): GeneratedCard[] {
  const items = collectionItems(raw, "cards", (row) => typeof row.front === "string");
  const cards = items
    .map((card) => {
      const row = card as Partial<GeneratedCard>;
      return { front: asText(row.front, 400), back: asText(row.back, 1200) };
    })
    .filter((card) => card.front && card.back)
    .slice(0, 12);
  if (cards.length < 3) {
    throw new Error("Not enough flashcards could be generated from this material. Add more notes and retry.");
  }
  return cards;
}

function parseQuiz(raw: string): GeneratedQuiz[] {
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
  const trimmed = questions.slice(0, 6);
  if (trimmed.length < 3) {
    throw new Error("Not enough quiz questions could be generated. Retry the build or add more material.");
  }
  return trimmed;
}

function parseExams(raw: string): GeneratedExam[] {
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
  const trimmed = questions.slice(0, 4);
  if (trimmed.length === 0) {
    throw new Error("No exam-style questions could be generated from this material. Retry or add more notes.");
  }
  return trimmed;
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

async function summariseNotes(apiKeys: string[], notes: string): Promise<Summary> {
  const raw = await nvidiaChat(apiKeys, {
    model: NVIDIA_TEXT_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          `${materialBlock(notes)}\n\n` +
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

async function generateCards(apiKeys: string[], notes: string): Promise<GeneratedCard[]> {
  const raw = await nvidiaChat(apiKeys, {
    model: NVIDIA_TEXT_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          `${materialBlock(notes)}\n\n` +
          "Create 10 revision flashcards covering the whole material. Fronts should be one clear question or term; backs should be a complete but concise answer (1-3 sentences). " +
          'Return JSON exactly like: {"cards":[{"front":"...","back":"..."}]}',
      },
    ],
    maxTokens: 2600,
    temperature: 0.15,
    topP: 1.0,
    disableThinking: true,
  });
  return parseCards(raw);
}

async function generateQuiz(apiKeys: string[], notes: string): Promise<GeneratedQuiz[]> {
  const raw = await nvidiaChat(apiKeys, {
    model: NVIDIA_TEXT_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          `${materialBlock(notes)}\n\n` +
          "Create 5 multiple-choice quiz questions of increasing difficulty. Each question needs exactly 4 plausible options, one correct index (0-3), and a 1-2 sentence explanation of why the answer is right. " +
          'Return JSON exactly like: {"questions":[{"question":"...","options":["a","b","c","d"],"correctIndex":0,"explanation":"..."}]}',
      },
    ],
    // Five questions with explanations overflowed the old 2.8k budget, which
    // truncated the JSON. Keep headroom; leftover truncation is recovered by
    // collectionItems.
    maxTokens: 4200,
    temperature: 0.15,
    topP: 1.0,
    disableThinking: true,
  });
  return parseQuiz(raw);
}

async function generateExams(apiKeys: string[], notes: string): Promise<GeneratedExam[]> {
  const raw = await nvidiaChat(apiKeys, {
    model: NVIDIA_TEXT_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          `${materialBlock(notes)}\n\n` +
          "Create 3 exam-style short-answer questions that ask the student to explain, compare, or apply ideas from the material. Each is worth 4-8 marks. " +
          "Include a strong model answer and a marking guide whose bullet points add up to the available marks. " +
          'Return JSON exactly like: {"questions":[{"question":"...","marks":6,"modelAnswer":"...","markingGuide":["1 mark: ..."]}]}',
      },
    ],
    maxTokens: 3800,
    temperature: 0.15,
    topP: 1.0,
    disableThinking: true,
  });
  return parseExams(raw);
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

      await ctx.runMutation(internal.studySets.setProgress, {
        setId,
        progress: "Writing your summary…",
      });
      const summary = await summariseNotes(apiKeys, notes);

      await ctx.runMutation(internal.studySets.setProgress, {
        setId,
        progress: "Building flashcards…",
      });
      const cards = await generateCards(apiKeys, notes);

      await ctx.runMutation(internal.studySets.setProgress, {
        setId,
        progress: "Writing quiz questions…",
      });
      const quiz = await generateQuiz(apiKeys, notes);

      await ctx.runMutation(internal.studySets.setProgress, {
        setId,
        progress: "Drafting exam questions…",
      });
      const exams = await generateExams(apiKeys, notes);

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
    const { exam } = data;

    const raw = await nvidiaChat(apiKeys, {
      model: NVIDIA_TEXT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `<question>${exam.question}</question>\n` +
            `<marks_available>${exam.marks}</marks_available>\n` +
            `<marking_guide>${exam.markingGuide.join("\n")}</marking_guide>\n` +
            `<model_answer>${exam.modelAnswer}</model_answer>\n` +
            `<student_answer>${response.slice(0, 5000)}</student_answer>\n\n` +
            "Mark the student's answer strictly but fairly. Award whole marks only for ideas that are actually present. " +
            'Return JSON exactly like: {"awardedMarks": 4, "feedback": "..."} where feedback is under 120 words and names what earned marks and what is missing.',
        },
      ],
      maxTokens: 700,
      temperature: 0.2,
      disableThinking: true,
    });

    const parsed = parseModelJson<{ awardedMarks?: number; feedback?: string }>(raw);
    const awardedRaw = Number(parsed.awardedMarks);
    const feedback = asText(parsed.feedback, 2500);
    if (!Number.isFinite(awardedRaw) || !feedback) {
      throw new Error("The model couldn't grade that answer cleanly. Retry the grade.");
    }

    const awardedMarks = Math.max(0, Math.min(exam.marks, Math.round(awardedRaw)));
    await ctx.runMutation(internal.studySets.saveExamResult, {
      examId,
      answer: response,
      awardedMarks,
      feedback,
    });

    return { awardedMarks, marks: exam.marks, feedback };
  },
});
