import { analyzeRepositorySignals } from "../github/repository-analysis.js";
import { addEvidence, markStep } from "../core/orchestrator.js";
import { ACTIONS, assertActionAllowed } from "../core/permissions.js";
import { createTestPlan, recordTestResult } from "./tester.js";
import { reviewSecurity } from "./security-reviewer.js";
import { finalReview, actionDisposition } from "./final-reviewer.js";

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
  ]) next = addEvidence(next, evidence);
  next = markStep(next, "repository", "completed");

  const planned = createTestPlan(next, inspection);
  const tested = recordTestResult(planned.plan, planned.testPlan, {
    status: "not_executed",
    claim: "Sandbox execution was not performed during this investigation.",
    source: "authenticated investigation pipeline"
  });
  const secured = reviewSecurity(tested.plan, inspection);
  const reviewed = finalReview({
    plan: secured.plan,
    analysis,
    testResult: tested.testResult,
    security: secured.security
  });

  return {
    plan: reviewed.plan,
    analysis,
    testPlan: planned.testPlan,
    testResult: tested.testResult,
    security: secured.security,
    review: reviewed.review,
    actionGate: actionDisposition(reviewed.review, ACTIONS.CREATE_BRANCH),
    pipeline: {
      status: "completed",
      stages: ["planner", "researcher", "repository_analyst", "tester", "security_reviewer", "final_reviewer", "action_gate"],
      sandbox: "NOT_EXECUTED"
    }
  };
}
