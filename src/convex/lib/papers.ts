import type { CognitoPaperMap } from "./cognito";

/**
 * Papers are the top-level split of a qualification: Biology has Paper 1 and
 * Paper 2, Geography has three, and each one examines a different set of
 * topics. This module turns a scraped pathway plus Cognito's specification
 * page into those groups, so a practice paper can be built for one paper and
 * stays inside the topics that paper actually examines.
 *
 * Nothing here is written by a model. A topic joins a paper only because the
 * pathway or the specification says so.
 */

export type PaperGroup = { label: string; topicIds: string[] };

export type PaperUnitLike = {
  title: string;
  topics: Array<{ id: string; title: string; specReference?: string }>;
};

/** "Paper 1 - Computer Systems", "Paper 2: second religion — Islam". */
const UNIT_PAPER_RE = /^paper\s+([0-9]{1,2}|[a-z])\b/i;

/** The paper a unit heading names, if it names one. */
function labelForUnitTitle(title: string): string | null {
  const match = UNIT_PAPER_RE.exec(title.trim());
  if (!match) return null;
  return `Paper ${match[1]!.toUpperCase()}`;
}

function paperOrder(label: string): number {
  const parsed = Number(label.replace(/\D+/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 99;
}

/**
 * The papers the specification assigns to one topic reference. A pathway topic
 * can be numbered more coarsely than the specification ("3" against "3.1"), so
 * the exact reference is tried first and its base second.
 */
function labelsForTopic(
  map: CognitoPaperMap | null | undefined,
  specReference: string | undefined,
): string[] | null {
  const reference = specReference?.trim();
  if (!map || !reference) return null;
  const exact = map.byTopicRef[reference];
  if (exact && exact.length > 0) return exact;
  const base = reference.split(".")[0];
  if (!base) return null;
  const coarse = map.byTopicRef[base];
  return coarse && coarse.length > 0 ? coarse : null;
}

/**
 * The paper groups for a pathway, or undefined when the qualification does not
 * publish a paper split the app can read. Groups are only returned when at
 * least two papers exist and enough topics are mapped, so a subject with one
 * paper (or a set-text course the specification does not split) keeps the
 * plain "whole course" paper instead of a misleading choice.
 */
export function derivePaperGroups(
  units: PaperUnitLike[],
  map: CognitoPaperMap | null | undefined,
): PaperGroup[] | undefined {
  const labels = new Set<string>(map?.labels ?? []);
  const unitPaper = new Map<number, string>();
  units.forEach((unit, index) => {
    const label = labelForUnitTitle(unit.title);
    if (!label) return;
    labels.add(label);
    unitPaper.set(index, label);
  });
  if (labels.size < 2) return undefined;

  const ordered = [...labels].sort((a, b) => paperOrder(a) - paperOrder(b));
  const groups = new Map<string, string[]>(
    ordered.map((label) => [label, [] as string[]]),
  );

  // Pathway references are only specification topic numbers when they are
  // unique and mostly known to the specification. Some courses number topics
  // per unit instead (English Literature restarts at 1 in every text, and
  // Geography numbers its sections 1-18), and those numbers must never be read
  // as paper assignments.
  const refCounts = new Map<string, number>();
  for (const unit of units) {
    for (const topic of unit.topics) {
      const reference = topic.specReference?.trim();
      if (!reference) continue;
      refCounts.set(reference, (refCounts.get(reference) ?? 0) + 1);
    }
  }
  const distinctRefs = [...refCounts.keys()];
  const knownRefs = distinctRefs.filter((reference) => {
    const base = reference.split(".")[0]!;
    return Boolean(
      map?.byTopicRef[reference]?.length || map?.byTopicRef[base]?.length,
    );
  });
  const referencesAlign =
    Boolean(map) &&
    distinctRefs.length > 0 &&
    distinctRefs.every((reference) => refCounts.get(reference) === 1) &&
    knownRefs.length / distinctRefs.length >= 0.7;

  let total = 0;
  let mapped = 0;
  const assigned = new Set<string>();
  units.forEach((unit, index) => {
    for (const topic of unit.topics) {
      total += 1;
      const unitLabel = unitPaper.get(index);
      const topicLabels = unitLabel
        ? [unitLabel]
        : referencesAlign
          ? labelsForTopic(map, topic.specReference)
          : null;
      if (!topicLabels || topicLabels.length === 0) continue;
      const targets = topicLabels.filter((label) => groups.has(label));
      if (targets.length === 0) continue;
      mapped += 1;
      assigned.add(topic.id);
      for (const label of targets) groups.get(label)!.push(topic.id);
    }
  });

  // A specification page that only accounts for a handful of topics is not a
  // reliable paper map; a whole-course paper is better than a wrong split.
  if (total === 0 || mapped / total < 0.5) return undefined;

  // Topics the map does not place — required practicals, exam skills, an
  // anthology cluster — are examined across the qualification, so they belong
  // to every paper rather than disappearing from all of them.
  units.forEach((unit) => {
    for (const topic of unit.topics) {
      if (assigned.has(topic.id)) continue;
      for (const ids of groups.values()) ids.push(topic.id);
    }
  });

  const filled = ordered
    .map((label) => ({ label, topicIds: groups.get(label) ?? [] }))
    .filter((group) => group.topicIds.length > 0);
  if (filled.length < 2) return undefined;
  const signatures = new Set(
    filled.map((group) => [...group.topicIds].sort().join(",")),
  );
  return signatures.size > 1 ? filled : undefined;
}
