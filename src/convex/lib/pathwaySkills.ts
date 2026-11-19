/**
 * Exam technique is guidance, not subject content.
 *
 * Notes sites publish teaching pages and exam-technique pages side by side, so
 * a scraped outline gives both the same shape. Copied into a pathway verbatim,
 * a guide such as "How to Answer the 19th-Century Novel Question" looks exactly
 * like a topic — it is selectable in the set builder, and a set built from the
 * part it sits in writes questions about essay structure instead of the text.
 * That is the complaint this module fixes: technique pages stay available to
 * the student, but they are moved out of the content topics into their unit's
 * `skills` list, which the builder never sees.
 *
 * Classification is by title and runs for every pathway source (Save My Exams,
 * Cognito, the starter map, RS and specification maps), so the notes site's
 * page list no longer decides what Bluprint treats as content.
 */

export type PathwaySkill = {
  title: string;
  summary: string;
  keyPoints: string[];
};

type ContentTopic = {
  title: string;
  summary: string;
  keyPoints: string[];
};

type UnitLike = {
  title: string;
  topics: ContentTopic[];
  skills?: PathwaySkill[];
};

/**
 * Titles that name technique rather than the subject. Anchored where a word
 * could otherwise appear inside real content ("Overview" is only a guide when
 * it is the whole title, so "Romeo & Juliet: Overview" stays content).
 */
const SKILL_TITLE_PATTERNS: ReadonlyArray<RegExp> = [
  /^how to (?:answer|write|structure|plan|approach|revise)\b/,
  /\bexam (?:technique|techniques|skills?|tips?|practice|preparation)\b/,
  /\bcommand words?\b/,
  /\bassessment objectives?\b/,
  /\bmark schemes?\b/,
  /\bpaper (?:structure|overview)\b/,
  /\bquestion types?\b/,
  /\bwriting frames?\b/,
  /\bmodel answers?\b/,
  /\bexaminers?\b/,
  /\bcommon (?:mistakes|errors)\b/,
  /\bpast papers?\b/,
  /\bspecification (?:structure|overview|essentials)\b/,
  /\brevision (?:guide|guides|tips?|techniques?)\b/,
  /^overview$/,
  /^an overview$/,
];

/** Normalises a title for matching: curly quotes, punctuation and spacing. */
function titleKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Whether a published page title is exam technique rather than content. */
export function isExamTechniqueTitle(title: string): boolean {
  const key = titleKey(title);
  if (!key) return false;
  return SKILL_TITLE_PATTERNS.some((pattern) => pattern.test(key));
}

function skillKey(title: string): string {
  return titleKey(title);
}

function dedupeSkills(skills: PathwaySkill[]): PathwaySkill[] {
  const seen = new Set<string>();
  const kept: PathwaySkill[] = [];
  for (const skill of skills) {
    const key = skillKey(skill.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    kept.push(skill);
  }
  return kept;
}

/**
 * Moves every technique page out of `topics` and into `skills`, keeping the
 * technique beside the part it belongs to.
 *
 * A unit made only of guides is folded into the content unit above it (or
 * below it, when it is first), so the pathway never shows an empty part and
 * never loses a guide. Idempotent: splitting a split pathway changes nothing,
 * which is what lets every builder call it without special casing.
 */
export function splitPathwaySkills<P extends { units: UnitLike[] }>(pathway: P): P {
  const units: UnitLike[] = [];
  let carried: PathwaySkill[] = [];

  for (const unit of pathway.units) {
    const { skills: existing, ...rest } = unit as UnitLike;
    const topics: ContentTopic[] = [];
    const skills: PathwaySkill[] = [...(existing ?? []), ...carried];
    carried = [];

    for (const topic of unit.topics) {
      if (isExamTechniqueTitle(topic.title)) {
        skills.push({
          title: topic.title,
          summary: topic.summary,
          keyPoints: topic.keyPoints,
        });
      } else {
        topics.push(topic);
      }
    }

    const deduped = dedupeSkills(skills);
    if (topics.length === 0) {
      // A technique-only part: attach its guides to the part before it so they
      // stay reachable, and leave no empty unit on the pathway.
      if (units.length > 0) {
        const previous = units[units.length - 1]!;
        previous.skills = dedupeSkills([...(previous.skills ?? []), ...deduped]);
      } else {
        carried = deduped;
      }
      continue;
    }

    const next: UnitLike = { ...rest, topics };
    if (deduped.length > 0) next.skills = deduped;
    units.push(next);
  }

  // Guides at the very top of a pathway whose every unit is technique have no
  // content to sit beside; they are dropped rather than inventing a part.
  return { ...pathway, units } as P;
}
