import type { ProviderId } from "@/lib/types";

// --- Public types ---

export type EvalScoreCard = {
  total: number;
  forwardProgress: number;
  nonRepetition: number;
  continuityRetention: number;
  characterConsistency: number;
  summary: string;
};

export type EvalCaseResult = {
  fixtureId: string;
  title: string;
  baseline: EvalScoreCard;
  hybrid: EvalScoreCard;
};

export type EvalReport = {
  comparedFixtureIds: string[];
  baselineAverage: EvalScoreCard;
  hybridAverage: EvalScoreCard;
  caseResults: EvalCaseResult[];
  passed: boolean;
};

export type EvalConfig = {
  provider: ProviderId;
  modelId: string;
  apiKey: string;
  baseUrl?: string;
  judgeModelId?: string;
  fixtureIds?: string[];
};

// --- Entry point ---

export async function runHybridMemoryEval(
  _config: EvalConfig,
): Promise<EvalReport> {
  // TODO: Implement in Phase 3 — HCE evaluation framework.
  // This stub satisfies the type contract so the runner script and typecheck pass.
  throw new Error(
    "Hybrid memory evals are not yet implemented. This is planned for Phase 3.",
  );
}
