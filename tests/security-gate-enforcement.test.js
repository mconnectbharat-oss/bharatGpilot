import test from "node:test";
import assert from "node:assert/strict";
import { createActionReceipt } from "../src/core/action-receipt.js";
import { createActionPullRequest } from "../src/core/action-gateway.js";
import { ACTIONS } from "../src/core/permissions.js";

function receiptWithDecision(decision, evidenceClassification = "INDIRECT") {
  return createActionReceipt({
    actionId: "ci-security-test",
    action: ACTIONS.CREATE_PR,
    actorId: "ci",
    review: { decision: "VERIFIED" },
    repository: { owner: "mconnectbharat-oss", repo: "bharatGpilot", ref: "main" },
    baseSha: "a".repeat(40),
    manifest: { version: 1, files: [{ path: "src/example.js", contentFingerprint: "x", bytes: 1, message: "test" }] },
    branchName: "ci-test",
    changeVerification: { status: "VERIFIED" },
    testResult: { status: "passed" },
    security: { findings: [] },
    finalReview: {
      decision: "VERIFIED",
      claims: [{
        id: "action-decision",
        status: decision,
        evidence: [{ id: "e1", classification: evidenceClassification, source: "ci" }]
      }]
    },
    branchHeadSha: "b".repeat(40)
  });
}

test("action gateway rejects an unsupported action-decision claim", async () => {
  const receipt = receiptWithDecision("INFERRED");
  await assert.rejects(
    () => createActionPullRequest({
      owner: "mconnectbharat-oss",
      repo: "bharatGpilot",
      branchName: "ci-test",
      baseRef: "main",
      title: "should not create",
      review: { decision: "VERIFIED" },
      changeManifest: receipt.manifest,
      expectedBranchSha: receipt.branchHeadSha,
      approved: true,
      actionReceipt: receipt
    }),
    /DIRECTLY supported action-decision evidence chain/
  );
});

test("action gateway verifies receipt integrity after the evidence gate", async () => {
  const receipt = { ...receiptWithDecision("SUPPORTED", "DIRECT"), receiptHash: "0".repeat(64) };
  await assert.rejects(
    () => createActionPullRequest({
      owner: "mconnectbharat-oss",
      repo: "bharatGpilot",
      branchName: "ci-test",
      baseRef: "main",
      title: "should not create",
      review: { decision: "VERIFIED" },
      changeManifest: receipt.manifest,
      expectedBranchSha: receipt.branchHeadSha,
      actionReceipt: receipt
    }),
    /Immutable action receipt is invalid/
  );
});
