"use node";

/**
 * All NVIDIA calls live in this Node action file.
 *
 * The key is read from the `NVIDIA_API_KEY` environment variable (or a saved
 * server-only fallback) and is never returned, logged, or sent to the browser.
 * Keep it that way when extending this file.
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

/**
 * Prefer the deployment environment variable, then fall back to the value the
 * user saved from the AI setup screen (stored in a server-only Convex table).
 */
async function resolveNvidiaKey(ctx: ActionCtx): Promise<string> {
  const envKey = (process.env.NVIDIA_API_KEY ?? "").trim();
  if (envKey) return envKey;

  const saved = await ctx.runQuery(internal.settings.getSavedKey, {});
  if (saved) return saved;

  throw new Error(
    "NVIDIA_API_KEY is not set. Open AI setup and add your NVIDIA API key to start generating study material.",
  );
}

// ---------------------------------------------------------------------------
// NVIDIA transport
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function friendlyHttpError(status: number): string {
  if (status === 401 || status === 403) {
    return "NVIDIA rejected the API key. Open AI setup and check that NVIDIA_API_KEY is valid.";
  }
  if (status === 400) {
    return "NVIDIA rejected the request. Retry once, then check NVIDIA_TEXT_MODEL in AI setup if it persists.";
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
    return "NVIDIA is rate-limiting requests right now. Wait about a minute, then retry.";
  }
  if (status >= 500) {
    return "NVIDIA's service is having trouble right now. Try again in a moment.";
  }
  return `NVIDIA could not complete the request (HTTP ${status}). Please retry.`;
}

/**
 * Small OpenAI-compatible wrapper around NVIDIA's chat completions endpoint.
 * Retries throttling and server errors with a short backoff, and converts every
 * failure into a message that is safe and useful to show in the UI.
 */
async function nvidiaChat(
  apiKey: string,
  options: {
    model: string;
    messages: ChatMessage[];
    maxTokens: number;
    temperature?: number;
    retries?: number;
    /** Key verification only needs a successful HTTP response. */
    allowEmpty?: boolean;
  },
): Promise<string> {
  const retries = options.retries ?? 2;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(NVIDIA_CHAT_URL, {
        method: "POST",
        headers: {
          // The key only ever exists in this process memory / header.
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: options.model,
          messages: options.messages,
          temperature: options.temperature ?? 0.4,
          top_p: 0.9,
          max_tokens: options.maxTokens,
          stream: false,
        }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      // Never include the request object: it contains the Authorization header.
      if (attempt < retries) {
        await sleep(1500 * (attempt + 1));
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
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        if (options.allowEmpty) return "";
        throw new Error("NVIDIA returned an empty response. Please retry.");
      }
      if (content.trim().length === 0 && !options.allowEmpty) {
        throw new Error("NVIDIA returned an empty response. Please retry.");
      }
      return content;
    }

    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < retries) {
      await sleep(response.status === 429 ? 4000 * (attempt + 1) : 1500 * (attempt + 1));
      continue;
    }
    throw new Error(friendlyHttpError(response.status));
  }

  throw new Error("NVIDIA could not complete the request. Please retry.");
}

// ---------------------------------------------------------------------------
// JSON parsing / validation
// ---------------------------------------------------------------------------

function parseModelJson<T>(raw: string): T {
  const withoutFences = raw
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
  throw new Error("NVIDIA returned a response we couldn't read. Please retry.");
}

function asText(value: unknown, maxLength = 2000): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseSummary(raw: string): Summary {
  const parsed = parseModelJson<Partial<Summary>>(raw);
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
  const parsed = parseModelJson<{ cards?: unknown }>(raw);
  if (!Array.isArray(parsed.cards)) {
    throw new Error("The model returned unreadable flashcards. Retry the build.");
  }
  const cards = parsed.cards
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
  const parsed = parseModelJson<{ questions?: unknown }>(raw);
  if (!Array.isArray(parsed.questions)) {
    throw new Error("The model returned an unreadable quiz. Retry the build.");
  }
  const questions: GeneratedQuiz[] = [];
  for (const item of parsed.questions) {
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
  const parsed = parseModelJson<{ questions?: unknown }>(raw);
  if (!Array.isArray(parsed.questions)) {
    throw new Error("The model returned unreadable exam questions. Retry the build.");
  }
  const questions: GeneratedExam[] = [];
  for (const item of parsed.questions) {
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
  "You are Bluprint, a precise study assistant for university students. " +
  "You only use the supplied study material. Respond with strict JSON and no markdown fences, commentary, or extra keys.";

function materialBlock(notes: string): string {
  const clipped = notes.slice(0, MAX_NOTES_CHARS);
  return `<study_material>\n${clipped}\n</study_material>${
    notes.length > MAX_NOTES_CHARS ? "\n(The material was shortened to fit; work with what is here.)" : ""
  }`;
}

async function summariseNotes(apiKey: string, notes: string): Promise<Summary> {
  const raw = await nvidiaChat(apiKey, {
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
    maxTokens: 1000,
    temperature: 0.3,
  });
  return parseSummary(raw);
}

async function generateCards(apiKey: string, notes: string): Promise<GeneratedCard[]> {
  const raw = await nvidiaChat(apiKey, {
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
    maxTokens: 1800,
    temperature: 0.4,
  });
  return parseCards(raw);
}

async function generateQuiz(apiKey: string, notes: string): Promise<GeneratedQuiz[]> {
  const raw = await nvidiaChat(apiKey, {
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
    maxTokens: 2200,
    temperature: 0.4,
  });
  return parseQuiz(raw);
}

async function generateExams(apiKey: string, notes: string): Promise<GeneratedExam[]> {
  const raw = await nvidiaChat(apiKey, {
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
    maxTokens: 2600,
    temperature: 0.45,
  });
  return parseExams(raw);
}

// ---------------------------------------------------------------------------
// OCR / transcription of uploaded photos and video frames
// ---------------------------------------------------------------------------

async function transcribeImages(
  apiKey: string,
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

  const raw = await nvidiaChat(apiKey, {
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
  apiKey: string,
  imageIds: Id<"_storage">[],
): Promise<string> {
  const sections: string[] = [];
  for (const imageId of imageIds) {
    const blob = await ctx.storage.get(imageId);
    if (!blob) continue;
    const buffer = Buffer.from(await blob.arrayBuffer());
    const mime = blob.type?.startsWith("image/") ? blob.type : "image/jpeg";
    const text = await transcribeImages(apiKey, [
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
      const apiKey = await resolveNvidiaKey(ctx);
      let notes = existing.notes.trim();

      if (existing.sourceImageIds.length > 0) {
        await ctx.runMutation(internal.studySets.setProgress, {
          setId,
          progress: "Reading the text in your uploads…",
        });
        const extracted = await readSourceImages(ctx, apiKey, existing.sourceImageIds);
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
      const summary = await summariseNotes(apiKey, notes);

      await ctx.runMutation(internal.studySets.setProgress, {
        setId,
        progress: "Building flashcards…",
      });
      const cards = await generateCards(apiKey, notes);

      await ctx.runMutation(internal.studySets.setProgress, {
        setId,
        progress: "Writing quiz questions…",
      });
      const quiz = await generateQuiz(apiKey, notes);

      await ctx.runMutation(internal.studySets.setProgress, {
        setId,
        progress: "Drafting exam questions…",
      });
      const exams = await generateExams(apiKey, notes);

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

/**
 * Verifies and saves a key pasted into the AI setup screen. The key is checked
 * with a tiny NVIDIA request before it is stored server-side.
 */
export const saveNvidiaKey = action({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    await requireUserId(ctx);
    const candidate = key.trim();
    if (candidate.length < 20 || /\s/.test(candidate)) {
      throw new Error("That doesn't look like a valid NVIDIA API key. Copy the whole key and try again.");
    }

    // Actually generate a few tokens: NVIDIA's model-listing route can answer
    // without validating the key, so a real completion is the reliable check.
    // The error messages from nvidiaChat are already user-safe.
    await nvidiaChat(candidate, {
      model: NVIDIA_TEXT_MODEL,
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      maxTokens: 8,
      temperature: 0,
      retries: 0,
      allowEmpty: true,
    });

    await ctx.runMutation(internal.settings.saveKey, { value: candidate });
    return { ok: true };
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

    const apiKey = await resolveNvidiaKey(ctx);
    const { exam } = data;

    const raw = await nvidiaChat(apiKey, {
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
