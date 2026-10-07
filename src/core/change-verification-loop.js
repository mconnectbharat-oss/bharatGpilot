import { randomUUID } from "node:crypto";
import { executeCodingPlan } from "./coding-agent.js";
import { executeRepositoryTests } from "../sandbox/execution.js";
import { createTestPlan, recordTestResult } from "./tester.js";
import { reviewSecurity } from "./security-reviewer.js";
import { finalReview, actionDisposition } from "./final-reviewer.js";
import { ACTIONS } from "../core/permissions.js";
import { inspectRepository } from "../github/repository-intelligence.js";
import { verifyBranchAgainstManifest } from "./change-verifier.js";
import { createActionPullRequest } from "./action-gateway.js";
import { createActionReceipt } from "./action-receipt.js";
import { createAuditRecord, appendAuditRecord, claimAuditReceipt, releaseAuditReceipt } from "./audit-log.js";

export async function executeVerifiedChange({
  plan, inspection, analysis, changes, branchName, dependencies = {},
  createPr = false, prTitle, prBody, approved = false, actorId = "system"
} = {}) {
  if (!plan?.repository || !inspection) throw new Error("A repository plan and inspection are required.");
  if (!plan.evidence?.length) throw new Error("Evidence is required before a coding action.");

  const initialReview = finalReview({
    plan,
    analysis,
    testResult: { status: "not_executed" },
    security: { findings: [] }
  }).review;

  if (initialReview.decision !== "VERIFIED") {
    return Object.freeze({
      status: "blocked",
      stage: "pre_change_review",
      review: initialReview,
      actionGate: actionDisposition(initialReview, ACTIONS.CREATE_BRANCH)
    });
  }

  const coding = await (dependencies.codingAgent || executeCodingPlan)({
    owner: plan.repository.owner,
    repo: plan.repository.repo,
    baseRef: plan.repository.ref,
    branchName,
    changes,
    review: initialReview,
    createPr: false
  });

  const changeVerification = await (dependencies.verifyBranchAgainstManifest || verifyBranchAgainstManifest)({
    owner: plan.repository.owner,
    repo: plan.repository.repo,
    baseRef: plan.repository.ref,
    branchName: coding.branch.branchName,
    manifest: coding.changeManifest
  });
  if (changeVerification.status !== "VERIFIED") {
    return Object.freeze({ status: "blocked", stage: "change_verification", coding, changeVerification });
  }

  const tested = await (dependencies.executeRepositoryTests || executeRepositoryTests)({
    owner: plan.repository.owner,
    repo: plan.repository.repo,
    ref: coding.branch.branchName,
    command: "npm test",
    adapters: dependencies.executionAdapters || {}
  });

  const testPlan = createTestPlan(plan, inspection).testPlan;
  const recorded = recordTestResult(plan, testPlan, {
    status: tested.status,
    claim: "Post-change isolated test execution completed with an explicit result.",
    source: tested.execution?.output ? "isolated sandbox execution" : tested.reason || "isolated sandbox execution",
    output: tested.execution?.output || null
  });

  const postChangeInspection = await (dependencies.inspectRepository || inspectRepository)(
    `${plan.repository.owner}/${plan.repository.repo}`,
    coding.branch.branchName
  );
  const secured = reviewSecurity(recorded.plan, postChangeInspection);
  const reviewed = finalReview({
    plan: secured.plan,
    analysis,
    changeVerification,
    testResult: recorded.testResult,
    security: secured.security
  });

  const actionReceipt = createActionReceipt({
    review: initialReview,
    repository: plan.repository,
    baseSha: coding.branch.baseSha,
    manifest: coding.changeManifest,
    branchName: coding.branch.branchName,
    changeVerification,
    testResult: recorded.testResult,
    security: secured.security,
    finalReview: reviewed.review,
    branchHeadSha: coding.expectedBranchSha
  });

  const auditRecord = createAuditRecord({
    actionId: randomUUID(),
    action: ACTIONS.CREATE_PR,
    actorId,
    receipt: actionReceipt,
    outcome: reviewed.review.decision,
    pullRequest: null
  });

  const auditStore = dependencies.auditStore;
  const claimRequired = Boolean(auditStore && typeof auditStore.claim === "function" && typeof auditStore.release === "function");
  if (createPr && reviewed.review.decision === "VERIFIED" && !claimRequired) {
    return Object.freeze({ status: "blocked", stage: "audit_claim", reason: "TRANSACTIONAL_AUDIT_STORE_REQUIRED", actionReceipt, auditRecord, review: reviewed.review });
  }
  if (claimRequired) await claimAuditReceipt(auditStore, actionReceipt.receiptHash, auditRecord.actionId);

  let pullRequest = null;
  try {
  if (createPr && reviewed.review.decision === "VERIFIED") {
    pullRequest = await createActionPullRequest({
      owner: plan.repository.owner,
      repo: plan.repository.repo,
      branchName: coding.branch.branchName,
      baseRef: plan.repository.ref,
      title: prTitle,
      body: prBody,
      review: reviewed.review,
      approved,
      changeManifest: coding.changeManifest,
      expectedBranchSha: coding.expectedBranchSha,
      actionReceipt
    });
  }

  if (auditStore && typeof auditStore.append === "function") await appendAuditRecord(auditStore, { ...auditRecord, pullRequest });
  if (claimRequired && !createPr) await releaseAuditReceipt(auditStore, actionReceipt.receiptHash, auditRecord.actionId);

  return Object.freeze({
    status: reviewed.review.decision === "VERIFIED" ? "verified" : "review_required",
    coding,
    actionReceipt,
    auditRecord,
    testResult: recorded.testResult,
    postChangeInspection,
    security: secured.security,
    review: reviewed.review,
    actionGate: actionDisposition(reviewed.review, ACTIONS.CREATE_PR),
    pullRequest
  });
  } catch (error) {
    if (claimRequired) await releaseAuditReceipt(auditStore, actionReceipt.receiptHash, auditRecord.actionId);
    throw error;
  }
}
