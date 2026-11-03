/**
 * Saved papers keep their creation order, but their display number must be
 * contiguous after a deletion. A paper removed from the middle must not leave
 * "Practice paper 1" and "Practice paper 3" with no paper 2.
 */
export function displayPaperTitles<
  T extends { paper?: string; title: string },
>(papers: T[]): string[] {
  const counts = new Map<string, number>();
  return papers.map((paper) => {
    const key = paper.paper ?? "";
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    return paper.paper
      ? `${paper.paper} practice paper ${next}`
      : `Practice paper ${next}`;
  });
}
