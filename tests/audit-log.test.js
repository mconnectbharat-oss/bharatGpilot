import test from "node:test";
import assert from "node:assert/strict";
import { createActionReceipt } from "../src/core/action-receipt.js";
import { createAuditRecord, createInMemoryAuditStore, appendAuditRecord, claimAuditReceipt, releaseAuditReceipt } from "../src/core/audit-log.js";

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


test("audit store atomically claims a receipt before an action", async () => {
  const store = createInMemoryAuditStore();
  await claimAuditReceipt(store, receipt.receiptHash, "action-claim");
  await assert.rejects(
    () => claimAuditReceipt(store, receipt.receiptHash, "action-other"),
    /already been claimed/
  );
  await releaseAuditReceipt(store, receipt.receiptHash, "action-claim");
  await claimAuditReceipt(store, receipt.receiptHash, "action-other");
});


test("transactional audit adapter exposes durable receipt lifecycle", async () => {
  const calls = [];
  const adapter = {
    async claim(hash, actionId, receipt) { calls.push(["claim", hash, actionId, receipt.receiptHash]); return true; },
    async append(record) { calls.push(["append", record.receiptHash]); return record; },
    async complete(hash, actionId, pr) { calls.push(["complete", hash, actionId, pr.number]); return true; },
    async release(hash, actionId) { calls.push(["release", hash, actionId]); return true; },
    async hasReceipt(hash) { return hash === receipt.receiptHash; }
  };
  const store = (await import("../src/core/audit-log.js")).createTransactionalAuditStore(adapter);
  await store.claim(receipt.receiptHash, "action-1", receipt);
  await store.append({ receiptHash: receipt.receiptHash, actionId: "action-1" });
  await store.complete(receipt.receiptHash, "action-1", { number: 123 });
  assert.deepEqual(calls.map(([name]) => name), ["claim", "append", "complete"]);
  assert.equal(await store.hasReceipt(receipt.receiptHash), true);
});
