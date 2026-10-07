import { analyzeRepositorySignals } from "../github/repository-analysis.js";
import { addEvidence, markStep } from "../core/orchestrator.js";
import { ACTIONS, assertActionAllowed } from "../core/permissions.js";

export function analyzeRepository(plan, inspection) {
  if (!plan?.repository) throw new Error("A repository is required for repository analysis.");
  if (!inspection) throw new Error("Repository inspection is required for analysis.");

  assertActionAllowed(ACTIONS.ANALYZE_CODE);
  assertActionAllowed(ACTIONS.ANALYZE_ISSUES);

  const analysis = analyzeRepositorySignals(inspection);
  let next = markStep(plan, "repository", "running");

  for (const evidence of [
    ...(analysis.evidence || []),
    ...(analysis.understanding?.evidence || []),
    ...(analysis.health?.evidence || []),
    ...(analysis.contribution?.evidence || [])
  ]) {
    next = addEvidence(next, evidence);
  }

  next = markStep(next, "repository", "completed");

  return {
    plan: next,
    analysis
  };
}
