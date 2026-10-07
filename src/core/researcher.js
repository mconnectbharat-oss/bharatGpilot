import { ACTIONS, assertActionAllowed } from "./permissions.js";
import { addEvidence, markStep } from "./orchestrator.js";
import { inspectRepository, parseRepositoryRef } from "../github/repository-intelligence.js";

function copyEvidence(plan, evidence = []) {
  return evidence.reduce((current, item) => addEvidence(current, item), plan);
}

export async function researchRepository(plan) {
  if (!plan?.repository) throw new Error("A repository is required for repository research.");

  const { owner, repo } = parseRepositoryRef(plan.repository);
  assertActionAllowed(ACTIONS.READ_PUBLIC_REPOSITORY);
  assertActionAllowed(ACTIONS.ANALYZE_CODE);
  assertActionAllowed(ACTIONS.ANALYZE_ISSUES);

  let next = markStep(plan, "understand", "completed");
  next = markStep(next, "research", "running");

  const inspection = await inspectRepository(owner + "/" + repo);
  next = copyEvidence(next, inspection.evidence);

  next = markStep(next, "research", "completed");
  next = markStep(next, "repository", "completed");

  return { plan: next, inspection };
}
