import { ACTIONS, assertActionAllowed } from "../core/permissions.js";
import { markStep, summarizeEvidence } from "../core/orchestrator.js";

export const REVIEW_DECISIONS = Object.freeze({
  VERIFIED: "VERIFIED",
  HUMAN_REVIEW_REQUIRED: "HUMAN_REVIEW_REQUIRED",
  BLOCKED: "BLOCKED"
});

function evidenceSummary(plan) {
  return summarizeEvidence(plan?.evidence || []);
}

export function finalReview({ plan, analysis, testResult, security } = {}) {
  if (!plan?.repository) throw new Error("A repository is required for final review.");

  const evidence = evidenceSummary(plan);
  const securityFindings = security?.findings || [];
  const testStatus = testResult?.status || "not_executed";

  let decision = REVIEW_DECISIONS.VERIFIED;
  const reasons = [];

  if (securityFindings.length > 0) {
    decision = REVIEW_DECISIONS.HUMAN_REVIEW_REQUIRED;
    reasons.push("Security findings require human review.");
  }

  if (testStatus === "failed") {
    decision = REVIEW_DECISIONS.BLOCKED;
    reasons.push("Sandboxed tests failed.");
  } else if (testStatus === "not_executed") {
    if (decision === REVIEW_DECISIONS.VERIFIED) decision = REVIEW_DECISIONS.HUMAN_REVIEW_REQUIRED;
    reasons.push("Tests were not executed, so verification is incomplete.");
  }

  if (evidence.noEvidenceFound > 0 && decision === REVIEW_DECISIONS.VERIFIED) {
    decision = REVIEW_DECISIONS.HUMAN_REVIEW_REQUIRED;
    reasons.push("Some requested claims remain unverified.");
  }

  let next = markStep(plan, "final_reviewer", decision === REVIEW_DECISIONS.VERIFIED ? "completed" : "blocked");
  return {
    plan: next,
    review: {
      decision,
      reasons,
      evidence,
      testStatus,
      securityFindingCount: securityFindings.length,
      recommendation: decision === REVIEW_DECISIONS.VERIFIED
        ? "The available evidence supports proceeding within the requested permission boundary."
        : "Do not perform higher-risk autonomous actions until the listed verification gaps or review requirements are resolved.",
      analysisSummary: analysis?.summary || null
    }
  };
}

export function assertAutonomousActionAllowed(review, action) {
  if (!review || review.decision !== REVIEW_DECISIONS.VERIFIED) {
    throw new Error("Autonomous action is blocked until final review is VERIFIED.");
  }

  assertActionAllowed(action);
  return true;
}

export function actionDisposition(review, action) {
  try {
    assertAutonomousActionAllowed(review, action);
    return { allowed: true, action };
  } catch (error) {
    return { allowed: false, action, reason: error.message };
  }
}
