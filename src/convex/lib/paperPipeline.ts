/**
 * Plan → fill → validate → render.
 *
 * The fill function is injected so the pipeline can be tested without a model
 * call. It receives one line and no paper total, question count, section name,
 * cover text or numbering. Validation is code; a failed gate cannot render.
 */

import type { GeneratedLine } from "./paperGates";
import { runGates } from "./paperGates";
import { buildLinePrompt, parseLineOutput, type LineInput } from "./paperPrompt";
import { renderCover, renderPaper, type RenderedPaper } from "./paperRender";
import {
  assertPlan,
  refusal,
  resolvePaperRequest,
  type PaperPlan,
  type PlanRefusal,
  type PlanRequest,
} from "./paperPlan";
import type { BlueprintLine } from "./paperIndex";

export type FillLine = (input: {
  plan: PaperPlan;
  line: BlueprintLine;
  prompt: string;
}) => Promise<string>;

export type PaperBuildResult =
  | {
      ok: true;
      plan: PaperPlan;
      paper: RenderedPaper;
      gateLog: string;
    }
  | PlanRefusal;

const lineIsUsable = (line: BlueprintLine, parsed: GeneratedLine): boolean => {
  if (!parsed.stem.trim()) return false;
  if (parsed.parts && parsed.parts.length > 0) {
    const sum = parsed.parts.reduce((total, part) => total + part.tariff, 0);
    if (sum !== line.tariff) return false;
  }
  if (parsed.markScheme && parsed.markScheme.length > 0) {
    const pointTotal = parsed.markScheme.reduce((total, point) => total + point.mark, 0);
    const levels = line.type === "essay" || (line.command === "Evaluate" && line.tariff >= 6);
    if (!levels && pointTotal !== line.tariff) return false;
    if (levels && parsed.markScheme.every((point) => !point.bands?.length)) return false;
  }
  return true;
};

const promptFor = (
  plan: PaperPlan,
  line: BlueprintLine,
  usedTopics: string[],
  specificationExtract: string,
  correction?: string,
): string => {
  const input: LineInput = {
    paper: plan.key,
    line: line.line,
    tariff: line.tariff,
    command: line.command,
    topic: line.slot,
    stimulus: line.stim ?? "none",
    usedTopics,
    specificationExtract,
    voice: plan.voice,
  };
  const base = buildLinePrompt(input);
  return correction ? `${base}\n\nFORMAT CORRECTION: ${correction}` : base;
};

export async function buildPaper(
  request: PlanRequest,
  fill: FillLine,
  options: { specificationExtract?: string } = {},
): Promise<PaperBuildResult> {
  const planned = resolvePaperRequest(request);
  if (!planned.ok) return planned;
  const plan = planned.plan;
  assertPlan(plan);

  const specificationExtract = options.specificationExtract ?? "";
  const usedTopics: string[] = [];
  const questions: GeneratedLine[] = [];

  for (const line of plan.blueprint) {
    let accepted: GeneratedLine | null = null;
    let lastProblem = "the reply did not match the line";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const raw = await fill({
        plan,
        line,
        prompt: promptFor(
          plan,
          line,
          usedTopics,
          specificationExtract,
          attempt === 0 ? undefined : lastProblem,
        ),
      });
      const parsed = parseLineOutput(raw);
      if (parsed.status !== "ok") {
        lastProblem =
          parsed.status === "infeasible"
            ? `This line is infeasible: ${parsed.message}`
            : parsed.status === "needs_data"
              ? `This line needs data: ${parsed.message}`
              : parsed.status === "partial"
                ? `The previous reply was partial: ${parsed.message}`
                : `The previous reply was invalid: ${parsed.message}`;
        continue;
      }
      if (!lineIsUsable(line, parsed.line)) {
        lastProblem =
          "The parts must sum to the line's tariff, a point scheme must have one mark per point, and a levels question needs bands.";
        continue;
      }
      accepted = {
        ...parsed.line,
        ...(parsed.line.markScheme ? { markScheme: parsed.line.markScheme } : {}),
        ...(line.type === "essay" || (line.command === "Evaluate" && line.tariff >= 6)
          ? { levels: true }
          : {}),
      };
      break;
    }

    if (!accepted) {
      return refusal(
        plan.key,
        "GATE_24",
        [`line ${line.line}`, lastProblem],
        [],
        "Regenerate the line once; do not reduce its tariff or change the paper shape.",
      );
    }
    questions.push(accepted);
    usedTopics.push(line.slot);
  }

  const cover = renderCover(plan);
  const report = runGates({ plan, questions, cover });
  if (!report.pass) {
    return refusal(
      plan.key,
      `GATE_${report.failures[0]!.id.replace(/^G/, "")}`,
      report.failures.map((failure) => `${failure.id}: ${failure.detail ?? "failed"}`),
      [],
      "Regenerate the offending line once; never delete a question to make the count fit.",
    );
  }

  const paper = renderPaper(plan, questions, report);
  return { ok: true, plan, paper, gateLog: report.log };
}
