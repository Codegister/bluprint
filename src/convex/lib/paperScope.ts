/**
 * Which pathway topics a timetable's paper choice may schedule.
 *
 * A course records the qualification's paper split as `pathway.papers`, with
 * the topic ids each paper examines. The timetable used to ignore it: choosing
 * "Paper 1" still walked every topic on the pathway, so an English Literature
 * plan for Paper 1 (Shakespeare and the 19th-century novel) also scheduled
 * Modern texts and the poetry anthology, which are Paper 2.
 *
 * The filter fails open. A course with no recorded split, a label that names no
 * paper, or a split whose topic ids no longer match the pathway keeps the whole
 * pathway, so old courses keep working rather than producing an empty plan.
 */

export type PaperSplit = {
  label: string;
  topicIds: readonly string[];
};

type LiteratureArea = "shakespeare" | "novel" | "modern" | "poetry";

/** Which set-text group a literature unit covers. */
function literatureArea(title: string): LiteratureArea | null {
  const key = title.toLowerCase();
  if (key.includes("shakespeare")) return "shakespeare";
  if (key.includes("19th century") || key.includes("19th-century") || key.includes("novel")) {
    return "novel";
  }
  if (key.includes("modern") || key.includes("post 1914") || key.includes("post-1914")) {
    return "modern";
  }
  if (key.includes("poetry")) return "poetry";
  return null;
}

/**
 * The text areas each paper examines, for the GCSE boards whose split is
 * fixed. AQA is the one the paper guide in this repo documents: Paper 1 is
 * Shakespeare and the 19th-century novel, Paper 2 is the modern text and
 * poetry, named and unseen. Board strings that also mention WJEC are left out
 * because the Welsh specification splits its texts differently.
 */
function literaturePaperAreas(
  board: string,
): [LiteratureArea[], LiteratureArea[]] | null {
  const key = board.toLowerCase();
  if (key.includes("aqa")) return [["shakespeare", "novel"], ["modern", "poetry"]];
  if (key.includes("edexcel")) return [["shakespeare", "modern"], ["novel", "poetry"]];
  if (key.includes("eduqas")) return [["shakespeare", "poetry"], ["novel", "modern"]];
  if (key.includes("ocr")) return [["modern", "novel"], ["shakespeare", "poetry"]];
  return null;
}

/**
 * The paper split of a GCSE English Literature pathway, read from its set-text
 * units.
 *
 * Literature pathways are not stored with `pathway.papers`: the specification
 * numbers topics from 1 again inside every text, so the generic paper map
 * cannot place them. Without this, choosing Paper 1 scheduled the modern text
 * and poetry too. Units the split does not recognise (exam skills) are kept on
 * both papers, as they apply to the whole qualification.
 */
export function literaturePaperSplit(
  course: { subject: string; level: string; examBoard: string },
  units: readonly { title: string; topics: readonly { id: string }[] }[],
): PaperSplit[] | undefined {
  if (!/english literature/i.test(course.subject)) return undefined;
  if (!/gcse/i.test(course.level)) return undefined;
  const areas = literaturePaperAreas(course.examBoard);
  if (!areas) return undefined;

  const groups: [string[], string[]] = [[], []];
  let recognised = false;
  for (const unit of units) {
    const area = literatureArea(unit.title);
    if (area) recognised = true;
    const ids = unit.topics.map((topic) => topic.id);
    groups.forEach((group, index) => {
      if (!area || areas[index]!.includes(area)) group.push(...ids);
    });
  }
  // A pathway with no text units at all (a Cognito outline, a course still
  // being built) has no split to read; keep it whole rather than dividing it
  // arbitrarily.
  if (!recognised) return undefined;
  if (groups[0].length === 0 || groups[1].length === 0) return undefined;
  return [
    { label: "Paper 1", topicIds: groups[0] },
    { label: "Paper 2", topicIds: groups[1] },
  ];
}

/**
 * "Paper 1", "paper 2: Modern texts and poetry" and "Paper one" resolve to a
 * paper. "Both", "Papers 1 and 2" and anything without a single named paper
 * resolve to null, which means no filter.
 */
function paperNumber(value: string): "1" | "2" | null {
  const text = value.toLowerCase();
  const one = /(?:^|[^a-z])paper\s*1\b/.test(text) || /\bpaper one\b/.test(text);
  const two = /(?:^|[^a-z])paper\s*2\b/.test(text) || /\bpaper two\b/.test(text);
  if (one && !two) return "1";
  if (two && !one) return "2";
  return null;
}

/**
 * The topics one paper covers, in their original order.
 *
 * `paper` is the builder's choice ("Paper 1", "Paper 2" or "Both"). Only a
 * paper with a matching entry in the course's split narrows the list.
 */
export function topicsInPaper<T extends { topicId: string }>(
  topics: readonly T[],
  split: readonly PaperSplit[] | undefined,
  paper: string | undefined,
): T[] {
  if (!split || split.length === 0) return [...topics];
  const wanted = paperNumber(paper ?? "");
  if (wanted === null) return [...topics];
  const entry = split.find((candidate) => paperNumber(candidate.label) === wanted);
  if (!entry) return [...topics];
  const ids = new Set(entry.topicIds);
  const filtered = topics.filter((topic) => ids.has(topic.topicId));
  // A pathway rebuilt under different topic ids would otherwise lose every
  // topic. Keep what the course has rather than plan an empty timetable.
  return filtered.length > 0 ? filtered : [...topics];
}
