import { analyzeRepositorySignals } from "../github/repository-analysis.js";
import { addEvidence, markStep } from "../core/orchestrator.js";
import { ACTIONS, assertActionAllowed } from "../core/permissions.js";
import { createTestPlan, recordTestResult } from "./tester.js";
import { reviewSecurity } from "./security-reviewer.js";
import { finalReview, actionDisposition } from "./final-reviewer.js";
import { executeRepositoryTests } from "../sandbox/execution.js";
import { claimFromEvidence, claimEvidenceSummary } from "../evidence/claim-chain.js";

export async function analyzeRepository(plan, inspection, dependencies = {}) {
  if (!plan?.repository) throw new Error("A repository is required for repository analysis.");
  if (!inspection) throw new Error("Repository inspection is required for analysis.");
  assertActionAllowed(ACTIONS.ANALYZE_CODE);
  assertActionAllowed(ACTIONS.ANALYZE_ISSUES);

  const analysis = analyzeRepositorySignals(inspection);\n  const healthClaims = (analysis.health?.areas || []).map((area, index) => claimFromEvidence({ id: "health-" + (index + 1), statement: area.reason, evidence: (analysis.health.evidence || []).filter((item) => item.claim === area.reason) }));\n  const contributionClaims = (analysis.contribution?.opportunities || []).map((item, index) => claimFromEvidence({ id: "contribution-" + (index + 1), statement: item.rationale, evidence: [{ id: "contribution-" + (index + 1) + ":e1", classification: item.area === "existing-issue" ? "DIRECT" : "NO EVIDENCE FOUND", source: item.area === "existing-issue" ? "repository/issues/" + item.issueNumber : "repository/project-structure" }] }));
  let next = markStep(plan, "repository", "running");
  for (const evidence of [
    ...(analysis.evidence || []),
    ...(analysis.understanding?.evidence || []),
    ...(analysis.health?.evidence || []),
    ...(analysis.contribution?.evidence || [])
  ]) next = addEvidence(next, evidence);
  next = markStep(next, "repository", "completed");

  const planned = createTestPlan(next, inspection);
  const owner = plan.repository.owner;
  const repo = plan.repository.repo;
  const testExecution = await (dependencies.executeRepositoryTests || executeRepositoryTests)({
    owner,
    repo,
    ref: plan.repository.ref,
    command: planned.testPlan.command,
    adapters: dependencies.executionAdapters || {}
  });
  const tested = recordTestResult(planned.plan, planned.testPlan, {
    status: testExecution.status,
    claim: testExecution.status === "not_executed"
      ? "Sandbox execution was not performed because an isolated runtime was unavailable."
      : "Sandbox test execution completed with an explicit result.",
    source: testExecution.status === "not_executed" ? testExecution.reason : "isolated sandbox execution",
    output: testExecution.execution?.output || null
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
      sandbox: testExecution.execution === "NOT_EXECUTED" ? "NOT_EXECUTED" : "EXECUTED"
    }
  };
}
