import test from "node:test";
import assert from "node:assert/strict";
import { createActionReceipt, verifyActionReceipt } from "../src/core/action-receipt.js";

const context = {
  actionId: "action-1", action: "CREATE_PR", actorId: "user-1", issuedAt: "2026-10-07T00:00:00.000Z",
  review: { decision: "VERIFIED", reasons: [] },
  repository: { owner: "owner", repo: "repo", ref: "main" },
  baseSha: "base-123",
  manifest: { version: 1, files: [{ path: "src/a.js", bytes: 1, contentFingerprint: "eA==", message: "change" }] },
  branchName: "feature/a",
  changeVerification: { status: "VERIFIED", approved: ["src/a.js"], unexpected: [], missing: [] },
  testResult: { status: "passed" },
  security: { findings: [] },
  finalReview: { decision: "VERIFIED" },
  branchHeadSha: "head-456"
};

test("receipt is content-addressed and verifies unchanged", () => {
  const receipt = createActionReceipt(context);
  assert.equal(verifyActionReceipt(receipt).status, "VERIFIED");
  assert.equal(receipt.receiptHash.length, 64);
});

test("receipt detects authorization tampering", () => {
  const receipt = createActionReceipt(context);
  const tampered = { ...receipt, branchHeadSha: "other-head" };
  assert.equal(verifyActionReceipt(tampered).status, "INVALID");
});


test("receipt binds action identity", () => {
  const receipt = createActionReceipt(context);
  assert.equal(receipt.actionId, "action-1");
  assert.equal(receipt.action, "CREATE_PR");
  assert.equal(receipt.actorId, "user-1");
  assert.equal(verifyActionReceipt(receipt).status, "VERIFIED");
});
