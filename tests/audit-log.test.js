import test from "node:test";
import assert from "node:assert/strict";
import { createActionReceipt } from "../src/core/action-receipt.js";
import { createAuditRecord, createInMemoryAuditStore, appendAuditRecord } from "../src/core/audit-log.js";

const receipt = createActionReceipt({
  review: { decision: "VERIFIED" },
  repository: { owner: "owner", repo: "repo", ref: "main" },
  baseSha: "base",
  manifest: { version: 1, files: [] },
  branchName: "feature/a",
  changeVerification: { status: "VERIFIED" },
  testResult: { status: "passed" },
  security: { findings: [] },
  finalReview: { decision: "VERIFIED" },
  branchHeadSha: "head"
});

test("audit records are content-addressed", () => {
  const record = createAuditRecord({
    actionId: "action-1",
    action: "CREATE_PR",
    actorId: "user-1",
    receipt,
    outcome: "VERIFIED"
  });
  assert.equal(record.receiptHash, receipt.receiptHash);
  assert.equal(record.recordHash.length, 64);
});

test("audit store rejects receipt replay", async () => {
  const store = createInMemoryAuditStore();
  const record = createAuditRecord({
    actionId: "action-1",
    action: "CREATE_PR",
    actorId: "user-1",
    receipt,
    outcome: "VERIFIED"
  });
  await appendAuditRecord(store, record);
  await assert.rejects(() => appendAuditRecord(store, record), /already been audited/);
  assert.equal(await store.hasReceipt(receipt.receiptHash), true);
});
