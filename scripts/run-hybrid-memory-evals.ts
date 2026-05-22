import { runHybridMemoryEval } from "@/lib/ai/evals/hybrid-memory-eval";
import type { ProviderId } from "@/lib/types";

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

function readOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function parseFixtureIds(argv: string[]) {
  const fixtureFlagIndex = argv.findIndex((arg) => arg === "--fixture");
  if (fixtureFlagIndex === -1) {
    return undefined;
  }

  const raw = argv[fixtureFlagIndex + 1];
  if (!raw) {
    throw new Error("Expected a comma-separated value after --fixture.");
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function main() {
  const fixtureIds = parseFixtureIds(process.argv.slice(2));
  const report = await runHybridMemoryEval({
    provider: readRequiredEnv("OPEN_FANTASIA_EVAL_PROVIDER") as ProviderId,
    modelId: readRequiredEnv("OPEN_FANTASIA_EVAL_MODEL"),
    apiKey: readRequiredEnv("OPEN_FANTASIA_EVAL_API_KEY"),
    baseUrl: readOptionalEnv("OPEN_FANTASIA_EVAL_BASE_URL"),
    judgeModelId: readOptionalEnv("OPEN_FANTASIA_EVAL_JUDGE_MODEL"),
    fixtureIds,
  });

  console.log("");
  console.log("Hybrid memory eval report");
  console.log("=========================");
  console.log(`Fixtures: ${report.comparedFixtureIds.join(", ")}`);
  console.log(
    `Baseline avg total: ${report.baselineAverage.total} | Hybrid avg total: ${report.hybridAverage.total}`,
  );
  console.log(
    `Baseline avg forward progress: ${report.baselineAverage.forwardProgress} | Hybrid: ${report.hybridAverage.forwardProgress}`,
  );
  console.log(
    `Baseline avg non-repetition: ${report.baselineAverage.nonRepetition} | Hybrid: ${report.hybridAverage.nonRepetition}`,
  );
  console.log(
    `Baseline avg continuity retention: ${report.baselineAverage.continuityRetention} | Hybrid: ${report.hybridAverage.continuityRetention}`,
  );
  console.log(
    `Baseline avg character consistency: ${report.baselineAverage.characterConsistency} | Hybrid: ${report.hybridAverage.characterConsistency}`,
  );
  console.log("");

  for (const result of report.caseResults) {
    console.log(`${result.fixtureId}: ${result.title}`);
    console.log(
      `  baseline=${result.baseline.total} (${result.baseline.summary})`,
    );
    console.log(
      `  hybrid=${result.hybrid.total} (${result.hybrid.summary})`,
    );
  }

  console.log("");
  console.log(report.passed ? "PASS: hybrid memory beats the baseline." : "FAIL: hybrid memory did not clear the baseline gate.");

  if (!report.passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Hybrid memory eval failed.",
  );
  process.exitCode = 1;
});
