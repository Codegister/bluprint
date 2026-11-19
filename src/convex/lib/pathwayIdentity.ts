/**
 * A stable fingerprint of a pathway's content.
 *
 * Rebuilding a course re-scrapes its source. When the published outline has not
 * changed, the rebuilt map is identical and the rebuild must not touch the
 * stored course: rewriting it drops every cached note and past-paper list, so
 * the same course would look different (and be prepared again) after a rebuild
 * that should have changed nothing.
 *
 * Keys are sorted before serialising because the stored document and the fresh
 * map can hold the same fields in a different order. Undefined fields are
 * skipped, matching how Convex stores an absent optional field.
 */

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const entry = record[key];
      if (entry === undefined) continue;
      sorted[key] = canonical(entry);
    }
    return sorted;
  }
  return value;
}

export function pathwaySignature(pathway: unknown): string {
  return JSON.stringify(canonical(pathway));
}

/** Whether two maps have exactly the same content. */
export function samePathway(a: unknown, b: unknown): boolean {
  return pathwaySignature(a) === pathwaySignature(b);
}
