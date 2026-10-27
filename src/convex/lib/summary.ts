/**
 * The summary a build produces, and the single schema that describes it.
 *
 * This module exists because the generator and the validator drifted once:
 * the summary parser returned a `title` while `completeGeneration` declared a
 * summary without one, so every build died in Convex argument validation with
 * "Object contains extra field `title`". Both sides now import this file, and
 * `toSummaryArgs` builds the object from the validator's own field list, so a
 * field can never appear on one side only. `src/convex/lib/summary.test.ts`
 * runs a captured model response through the same path.
 */

import { v } from "convex/values";
import { cleanTopicTitle, shortTitle } from "./titles";

export type Summary = {
  /** A short topic name, e.g. "Osmosis and Active Transport". */
  title: string;
  overview: string;
  keyPoints: string[];
  examFocus: string[];
};

/**
 * The one description of a summary. The validator is built from these fields
 * and `toSummaryArgs` copies exactly these fields, so the parser can grow a
 * field only by declaring it here.
 */
const SUMMARY_SHAPE = {
  title: v.string(),
  overview: v.string(),
  keyPoints: v.array(v.string()),
  examFocus: v.array(v.string()),
} as const;

export const SUMMARY_FIELDS = Object.keys(SUMMARY_SHAPE) as Array<
  keyof Summary
>;

export const summaryValidator = v.object(SUMMARY_SHAPE);

/** Removes reasoning blocks some models wrap around their JSON. */
function stripReasoning(raw: string): string {
  return raw
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");
}

function asText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

/** Every complete {...} object in the text, used when the outer JSON is cut off. */
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
        // Not a complete object yet; keep scanning.
      }
    }
  }

  return found.sort((a, b) => a.start - b.start).map((entry) => entry.value);
}

/** Lenient JSON reader for one object: fences, chatter and truncation. */
function readObject(raw: string): Record<string, unknown> | null {
  const text = stripReasoning(raw)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  const candidates = [text];
  if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
    } catch {
      // Try the next candidate, then the recovered objects.
    }
  }
  return parsedObjects(text).find((row) => "overview" in row) ?? null;
}

/** A clean subject label to fall back on, never a sentence from the notes. */
export function fallbackSummaryTitle(label?: string | null): string {
  const clean = shortTitle((label ?? "").trim());
  return clean || "Study notes";
}

/**
 * Reads one model response into a summary. The title is always a string: the
 * model's own topic name when it reads like one, otherwise the subject label.
 * Every other field is rebuilt from scratch, so unknown keys in the response
 * (the exact failure that broke builds) are dropped here rather than reaching
 * the validator.
 */
export function parseSummary(raw: string, fallbackLabel?: string | null): Summary {
  const parsed = readObject(raw) ?? {};
  const title = cleanTopicTitle(
    asText(parsed.title, 120),
    fallbackSummaryTitle(fallbackLabel),
  );
  const overview = asText(parsed.overview, 2500);
  const keyPoints = Array.isArray(parsed.keyPoints)
    ? parsed.keyPoints
        .map((point) => asText(point, 500))
        .filter(Boolean)
        .slice(0, 10)
    : [];
  const examFocus = Array.isArray(parsed.examFocus)
    ? parsed.examFocus
        .map((point) => asText(point, 500))
        .filter(Boolean)
        .slice(0, 6)
    : [];

  if (!overview || keyPoints.length < 2) {
    throw new Error(
      "Bluprint could not build a useful summary from this material. Try a clearer photo or more notes.",
    );
  }
  return { title, overview, keyPoints, examFocus };
}

/**
 * The summary exactly as `completeGeneration` declares it: same fields, same
 * order, nothing extra. Built from `SUMMARY_FIELDS` so it cannot drift.
 */
export function toSummaryArgs(summary: Summary): Summary {
  const shaped = {} as Summary;
  for (const field of SUMMARY_FIELDS) {
    (shaped as Record<string, unknown>)[field] = summary[field];
  }
  return shaped;
}
