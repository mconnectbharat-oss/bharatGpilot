import { createHash } from "node:crypto";
import { verifyActionReceipt } from "./action-receipt.js";

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export function createAuditRecord({
  actionId, action, actorId = "system", receipt, outcome, pullRequest = null, createdAt = new Date().toISOString()
} = {}) {
  if (!actionId || !action || !actorId || !receipt?.receiptHash) {
    throw new Error("Action id, action, actor, and receipt are required for an audit record.");
  }
  if (verifyActionReceipt(receipt).status !== "VERIFIED") {
    throw new Error("Cannot audit an invalid action receipt.");
  }
  const record = Object.freeze({
    version: 1,
    actionId,
    action,
    actorId,
    createdAt,
    receiptHash: receipt.receiptHash,
    repository: receipt.repository,
    baseSha: receipt.baseSha,
    branchName: receipt.branchName,
    branchHeadSha: receipt.branchHeadSha,
    outcome,
    pullRequest
  });
  return Object.freeze({ ...record, recordHash: digest(record) });
}

export async function appendAuditRecord(store, record) {
  if (!store || typeof store.append !== "function") throw new Error("An audit store with append(record) is required.");
  if (!record?.recordHash) throw new Error("A valid audit record is required.");
  return store.append(record);
}

export function createInMemoryAuditStore() {
  const records = [];
  const receiptHashes = new Set();

  return Object.freeze({
    async append(record) {
      if (receiptHashes.has(record.receiptHash)) throw new Error("Action receipt has already been audited.");
      records.push(Object.freeze({ ...record }));
      receiptHashes.add(record.receiptHash);
      return record;
    },
    async hasReceipt(receiptHash) {
      return receiptHashes.has(receiptHash);
    },
    async list() {
      return records.slice();
    }
  });
}
