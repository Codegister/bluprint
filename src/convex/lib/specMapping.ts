/**
 * Specification mapping.
 *
 * Every card and question is tied to the specification statement it teaches, so
 * a course can report what it actually covers instead of a percentage with no
 * content behind it. Matching is deterministic: the same item always maps to the
 * same statement, no model call is involved, and the result can be checked by
 * reading the two texts side by side.
 */

import { criterionKeywords, criterionText } from "./markingCriteria";

export type SpecPoint = { id: string; text: string };

export type SpecMatch = {
  /** The statement this item teaches, or null when nothing is close enough. */
  id: string | null;
  /** Share of the statement's own terms the item uses, 0–1. */
  score: number;
};

/** Below this share the item is not claiming to cover the statement. */
const MATCH_THRESHOLD = 0.25;

/**
 * Removes a specification reference from the front of a statement. The numbers
 * in "4.1.2 diffusion…" are a citation, not content, and would otherwise be
 * counted as three of the statement's terms.
 */
function stripReference(text: string): string {
  return text.replace(/^\s*\d+(?:\.\d+)*\s+/, "");
}

/** The terms of one text, using the same stemmer the marker uses. */
function terms(text: string): string[] {
  return criterionKeywords(criterionText(stripReference(text))).filter(
    (term) => !/^\d+$/.test(term),
  );
}

/**
 * The share of a statement's own terms an item uses. Scored against at most six
 * terms: a long statement should not make one clear match disappear, and a short
 * one should not be satisfied by any single shared word.
 */
function scoreFor(itemTerms: Set<string>, pointTerms: string[]): number {
  if (pointTerms.length === 0) return 0;
  let matched = 0;
  for (const term of pointTerms) {
    if (itemTerms.has(term)) {
      matched += 1;
      continue;
    }
    // A stem match counts: "photosynthes" covers "photosynthesis".
    for (const word of itemTerms) {
      if (
        word.length >= 5 &&
        term.length >= 5 &&
        (word.startsWith(term.slice(0, 5)) || term.startsWith(word.slice(0, 5)))
      ) {
        matched += 1;
        break;
      }
    }
  }
  return matched / Math.max(1, Math.min(6, pointTerms.length));
}

/** The best specification statement for one item, or a null match. */
export function matchSpecPoint(itemText: string, points: SpecPoint[]): SpecMatch {
  if (points.length === 0) return { id: null, score: 0 };
  const itemTerms = new Set(terms(itemText));
  let best: SpecMatch = { id: null, score: 0 };
  for (const point of points) {
    const score = scoreFor(itemTerms, terms(point.text));
    if (score > best.score) best = { id: point.id, score };
  }
  return best.score >= MATCH_THRESHOLD ? best : { id: null, score: best.score };
}

export type SpecCoverage = {
  total: number;
  covered: SpecPoint[];
  uncovered: SpecPoint[];
  percent: number;
};

/**
 * Which statements the set's items cover. A statement counts as covered when at
 * least one card, quiz question or exam question maps to it.
 */
export function specCoverage(
  points: SpecPoint[],
  items: Array<{ specRef?: string | null }>,
): SpecCoverage {
  if (points.length === 0) {
    return { total: 0, covered: [], uncovered: [], percent: 0 };
  }
  const coveredIds = new Set(
    items
      .map((item) => item.specRef)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );
  const covered = points.filter((point) => coveredIds.has(point.id));
  const uncovered = points.filter((point) => !coveredIds.has(point.id));
  return {
    total: points.length,
    covered,
    uncovered,
    percent: Math.round((covered.length / points.length) * 100),
  };
}

/** How many specification statements one set keeps, across all its topics. */
export const SET_SPEC_POINT_LIMIT = 60;

/**
 * The statements kept with a set, taken a slice at a time from every topic it
 * covers. A flat `slice(0, 60)` spent the whole allowance on the first topics,
 * so cards written for later topics had no statement to match against and the
 * coverage panel stopped part-way through the selection. One point is taken per
 * topic in each pass, then the next, so every topic is represented up to the
 * limit and a topic with fewer statements does not hold up the rest. The result
 * is returned in topic order for a stable, readable checklist.
 */
export function selectSpecPoints(
  topicPoints: ReadonlyArray<readonly SpecPoint[]>,
  limit: number = SET_SPEC_POINT_LIMIT,
): SpecPoint[] {
  if (limit <= 0) return [];
  const picked: Array<{ topic: number; index: number; point: SpecPoint }> = [];
  const depth = topicPoints.reduce(
    (max, points) => Math.max(max, points.length),
    0,
  );
  for (let index = 0; index < depth && picked.length < limit; index += 1) {
    for (
      let topic = 0;
      topic < topicPoints.length && picked.length < limit;
      topic += 1
    ) {
      const point = topicPoints[topic]![index];
      if (point !== undefined) picked.push({ topic, index, point });
    }
  }
  return picked
    .sort((left, right) => left.topic - right.topic || left.index - right.index)
    .map(({ point }) => point);
}

/**
 * Tags a batch of items in order, reusing a tag when the same statement is the
 * best match so a set does not scatter one statement across several ids.
 */
export function tagItems<T extends { front?: string; question?: string }>(
  items: T[],
  points: SpecPoint[],
): Array<SpecMatch> {
  return items.map((item) =>
    matchSpecPoint(item.front ?? item.question ?? "", points),
  );
}
