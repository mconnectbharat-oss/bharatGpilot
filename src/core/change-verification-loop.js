import { executeCodingPlan } from "./coding-agent.js";
import { executeRepositoryTests } from "../sandbox/execution.js";
import { createTestPlan, recordTestResult } from "./tester.js";
import { reviewSecurity } from "./security-reviewer.js";
import { finalReview, actionDisposition } from "./final-reviewer.js";
import { ACTIONS } from "../core/permissions.js";
import { inspectRepository } from "../github/repository-intelligence.js";
import { verifyBranchAgainstManifest } from "./change-verifier.js";
import { createActionPullRequest } from "./action-gateway.js";

export async function executeVerifiedChange({
  plan, inspection, analysis, changes, branchName, dependencies = {},
  createPr = false, prTitle, prBody, approved = false
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

  let pullRequest = null;
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
      expectedBranchSha: coding.expectedBranchSha
    });
  }

  return Object.freeze({
    status: reviewed.review.decision === "VERIFIED" ? "verified" : "review_required",
    coding,
    testResult: recorded.testResult,
    postChangeInspection,
    security: secured.security,
    review: reviewed.review,
    actionGate: actionDisposition(reviewed.review, ACTIONS.CREATE_PR),
    pullRequest
  });
}
