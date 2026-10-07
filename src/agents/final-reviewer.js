import { ACTIONS, assertActionAllowed } from "../core/permissions.js";
import { markStep, verificationSummary } from "../core/orchestrator.js";
import { claimFromEvidence, claimEvidenceSummary } from "../evidence/claim-chain.js";

export const REVIEW_DECISIONS = Object.freeze({ VERIFIED: "VERIFIED", HUMAN_REVIEW_REQUIRED: "HUMAN_REVIEW_REQUIRED", BLOCKED: "BLOCKED" });

export function finalReview({ plan, analysis, testResult, security } = {}) {
  if (!plan?.repository) throw new Error("A repository is required for final review.");
  const evidence = verificationSummary(plan);
  const findings = security?.findings || [];
  const status = testResult?.status || "not_executed";
  let decision = REVIEW_DECISIONS.VERIFIED;
  const reasons = [];
  if (findings.length) { decision = REVIEW_DECISIONS.HUMAN_REVIEW_REQUIRED; reasons.push("Security findings require human review."); }
  if (status === "failed") { decision = REVIEW_DECISIONS.BLOCKED; reasons.push("Sandboxed tests failed."); }
  if (status === "not_executed") { decision = decision === REVIEW_DECISIONS.VERIFIED ? REVIEW_DECISIONS.HUMAN_REVIEW_REQUIRED : decision; reasons.push("Tests were not executed."); }
  if (evidence.noEvidenceFound > 0 && (evidence.direct + evidence.indirect > 0) && decision === REVIEW_DECISIONS.VERIFIED) { decision = REVIEW_DECISIONS.HUMAN_REVIEW_REQUIRED; reasons.push("Some requested claims remain unverified."); }
  const decisionClaim = claimFromEvidence({ id: "action-decision", statement: "Autonomous action decision: " + decision, evidence: (plan.evidence || []).map((item, index) => ({ id: "action-decision:e" + (index + 1), classification: item.classification, source: item.sources?.[0] || item.source || null })), reasoning: reasons.join(" ") || "All reviewed evidence and verification gates passed." });
  if (decision === REVIEW_DECISIONS.VERIFIED && (plan.evidence || []).length > 0 && decisionClaim.status !== "SUPPORTED") { decision = REVIEW_DECISIONS.HUMAN_REVIEW_REQUIRED; reasons.push("A VERIFIED action decision requires DIRECT evidence."); }
  const next = markStep(plan, "verification", decision === REVIEW_DECISIONS.VERIFIED ? "completed" : "blocked");
  return { plan: next, review: { decision, reasons, evidence, claims: [decisionClaim], claimEvidence: claimEvidenceSummary([decisionClaim]), testStatus: status, securityFindingCount: findings.length, analysisSummary: analysis?.summary || null } };
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
