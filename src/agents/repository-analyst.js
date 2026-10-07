import { analyzeRepositorySignals } from "../github/repository-analysis.js";
import { addEvidence, markStep } from "../core/orchestrator.js";
import { ACTIONS, assertActionAllowed } from "../core/permissions.js";
import { createTestPlan, recordTestResult } from "./tester.js";
import { reviewSecurity } from "./security-reviewer.js";
import { finalReview, actionDisposition } from "./final-reviewer.js";
import { executeRepositoryTests } from "../sandbox/execution.js";
import { claimFromEvidence, claimEvidenceSummary } from "../evidence/claim-chain.js";
import { buildMajorClaimChains } from "../core/major-claim-gate.js";

export function analyzeRepository(plan, inspection, dependencies = {}) {
  if (!plan?.repository) throw new Error("A repository is required for repository analysis.");
  if (!inspection) throw new Error("Repository inspection is required for analysis.");
  assertActionAllowed(ACTIONS.ANALYZE_CODE);
  assertActionAllowed(ACTIONS.ANALYZE_ISSUES);

  const normalizedInspection = inspection.analyzedContents && !Array.isArray(inspection.analyzedContents)
    ? { ...inspection, analyzedContents: inspection.analyzedContents }
    : inspection;
  const analysis = analyzeRepositorySignals(normalizedInspection);
  const purposeClaims = (analysis.understanding?.purposeSignals || []).map((signal, index) => claimFromEvidence({ id: "purpose-" + (index + 1), statement: signal.value, evidence: [{ id: "purpose-" + (index + 1) + ":e1", classification: "DIRECT", source: signal.source }] }));
  const healthClaims = (analysis.health?.areas || []).map((area, index) => claimFromEvidence({ id: "health-" + (index + 1), statement: area.reason, evidence: (analysis.health.evidence || []).filter((item) => item.claim === area.reason) }));
  const contributionClaims = (analysis.contribution?.opportunities || []).map((item, index) => claimFromEvidence({ id: "contribution-" + (index + 1), statement: item.rationale, evidence: [{ id: "contribution-" + (index + 1) + ":e1", classification: item.area === "existing-issue" ? "DIRECT" : "NO EVIDENCE FOUND", source: item.area === "existing-issue" ? "repository/issues/" + item.issueNumber : "repository/project-structure" }] }));
  let next = markStep(plan, "repository", "running");
  for (const evidence of [
    ...(analysis.evidence || []),
    ...(analysis.understanding?.evidence || []),
    ...(analysis.health?.evidence || []),
    ...(analysis.contribution?.evidence || [])
  ]) next = addEvidence(next, evidence);
  next = markStep(next, "repository", "completed");

  const planned = createTestPlan(next, normalizedInspection);
  const owner = plan.repository.owner;
  const repo = plan.repository.repo || plan.repository.name;
  const testExecution = dependencies.executeRepositoryTests
    ? dependencies.executeRepositoryTests({
        owner,
        repo,
        ref: plan.repository.ref,
        command: planned.testPlan.command,
        adapters: dependencies.executionAdapters || {}
      })
    : { status: "not_executed", reason: "Sandbox execution is owned by the dedicated tester stage." };
  const tested = recordTestResult(planned.plan, planned.testPlan, {
    status: testExecution.status,
    claim: testExecution.status === "not_executed"
      ? "Sandbox execution was not performed by the repository analyst stage."
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
