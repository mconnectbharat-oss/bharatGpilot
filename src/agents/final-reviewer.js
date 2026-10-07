import { ACTIONS, assertActionAllowed } from "../core/permissions.js";
import { markStep, summarizeEvidence } from "../core/orchestrator.js";

export const REVIEW_DECISIONS = Object.freeze({ VERIFIED: "VERIFIED", HUMAN_REVIEW_REQUIRED: "HUMAN_REVIEW_REQUIRED", BLOCKED: "BLOCKED" });

export function finalReview({ plan, analysis, testResult, security } = {}) {
  if (!plan?.repository) throw new Error("A repository is required for final review.");
  const evidence = summarizeEvidence(plan.evidence || []);
  const findings = security?.findings || [];
  const status = testResult?.status || "not_executed";
  let decision = REVIEW_DECISIONS.VERIFIED;
  const reasons = [];
  if (findings.length) { decision = REVIEW_DECISIONS.HUMAN_REVIEW_REQUIRED; reasons.push("Security findings require human review."); }
  if (status === "failed") { decision = REVIEW_DECISIONS.BLOCKED; reasons.push("Sandboxed tests failed."); }
  if (status === "not_executed") { decision = decision === REVIEW_DECISIONS.VERIFIED ? REVIEW_DECISIONS.HUMAN_REVIEW_REQUIRED : decision; reasons.push("Tests were not executed."); }
  if (evidence.noEvidenceFound > 0 && decision === REVIEW_DECISIONS.VERIFIED) { decision = REVIEW_DECISIONS.HUMAN_REVIEW_REQUIRED; reasons.push("Some requested claims remain unverified."); }
  const next = markStep(plan, "verification", decision === REVIEW_DECISIONS.VERIFIED ? "completed" : "blocked");
  return { plan: next, review: { decision, reasons, evidence, testStatus: status, securityFindingCount: findings.length, analysisSummary: analysis?.summary || null } };
}

export function assertAutonomousActionAllowed(review, action) {
  if (review?.decision !== REVIEW_DECISIONS.VERIFIED) throw new Error("Autonomous action is blocked until final review is VERIFIED.");
  assertActionAllowed(action);
  return true;
}

export function actionDisposition(review, action) {
  try { assertAutonomousActionAllowed(review, action); return { allowed: true, action }; }
  catch (error) { return { allowed: false, action, reason: error.message }; }
}
