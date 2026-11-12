import { api } from "@/convex/_generated/api";
import {
  previewDayView,
  previewFixtures,
  previewCourse,
  previewPaper,
  previewSet,
} from "@/dev/preview-fixtures";
import { getFunctionName } from "convex/server";

/**
 * A tiny Convex query surface for the visual preview. It is selected only by
 * vite.preview.config.ts; production and normal development still use Convex.
 *
 * Convex's generated `api` is a proxy that creates a fresh function reference
 * on every property access, so fixtures are selected by function name rather
 * than object identity.
 */
export function useQuery(query: unknown, args?: unknown): any {
  if (args === "skip") return undefined;

  const name = getFunctionName(query as never);

  if (name === "studySets:studyStats") return previewFixtures.studyStats;
  if (name === "studySets:listMine") return previewFixtures.sets;
  if (name === "studySets:sprintQueue") return [];
  if (name === "timetable:getMine") return previewFixtures.plan;
  if (name === "timetable:getDayView") {
    const date = (args as { date?: string } | undefined)?.date;
    return previewDayView(date);
  }
  if (name === "insights:calibration") return previewFixtures.calibration;
  if (name === "progressShares:mine") return previewFixtures.progressShares;
  if (name === "exports:forAccount") return previewFixtures.accountExport;
  if (name === "settings:aiStatus") return previewFixtures.aiStatus;
  if (name === "courses:listMine") return previewFixtures.courses;
  if (name === "studySets:getDetails") return previewSet;
  if (name === "courses:getDetails") return previewCourse;
  if (name === "coverage:forCourse") return null;
  if (name === "pastPapers:listForCourse") return [];
  if (name === "coverage:forSet") return { unmapped: true };
  if (name === "exports:forSet") return null;
  if (name === "realPapers:list") return [];
  if (name === "pastPapers:getDetails") return previewPaper;

  return undefined;
}

export function useMutation(_mutation: unknown) {
  return async (..._args: unknown[]) => ({ generated: true });
}

export function useAction(_action: unknown) {
  return async (..._args: unknown[]) => ({});
}

export function useConvex() {
  return {};
}
