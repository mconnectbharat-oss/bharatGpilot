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
    version: 2,
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

export async function claimAuditReceipt(store, receiptHash, actionId, receipt) {
  if (!store || typeof store.claim !== "function") throw new Error("A transactional audit store with claim(receiptHash, actionId) is required.");
  if (!receiptHash || !actionId) throw new Error("Receipt hash and action id are required.");
  return store.claim(receiptHash, actionId, receipt);
}

export async function completeAuditReceipt(store, receiptHash, actionId, pullRequest) {\n  if (!store || typeof store.complete !== "function") throw new Error("A durable audit store with complete(receiptHash, actionId, pullRequest) is required.");\n  return store.complete(receiptHash, actionId, pullRequest);\n}\n\nexport async function releaseAuditReceipt(store, receiptHash, actionId) {
  if (!store || typeof store.release !== "function") throw new Error("A transactional audit store with release(receiptHash, actionId) is required.");
  return store.release(receiptHash, actionId);
}

export function createInMemoryAuditStore() {
  const records = new Map();
  const claims = new Map();

  return Object.freeze({
    async claim(receiptHash, actionId) {
      if (claims.has(receiptHash) || records.has(receiptHash)) {
        throw new Error("Action receipt has already been claimed.");
      }
      claims.set(receiptHash, actionId);
      return true;
    },
    async release(receiptHash, actionId) {
      if (claims.get(receiptHash) === actionId) claims.delete(receiptHash);
      return true;
    },
    async append(record) {
      if (records.has(record.receiptHash)) throw new Error("Action receipt has already been audited.");
      if (claims.get(record.receiptHash) && claims.get(record.receiptHash) !== record.actionId) {
        throw new Error("Action receipt is claimed by another action.");
      }
      records.set(record.receiptHash, Object.freeze({ ...record }));
      claims.delete(record.receiptHash);
      return record;
    },
    async hasReceipt(receiptHash) {
      return records.has(receiptHash) || claims.has(receiptHash);
    },
    async list() {
      return Array.from(records.values());
    }
  });
}

/*
 * Adapter contract for a shared transactional store.
 *
 * claim() must atomically insert a unique receiptHash/actionId claim and fail
 * if that receipt is already claimed or committed. Implementations should use
 * a database UNIQUE constraint on receiptHash inside a transaction.
 */
export function createTransactionalAuditStore(adapter) {
  if (!adapter || typeof adapter.claim !== "function" || typeof adapter.append !== "function" || typeof adapter.release !== "function") {
    throw new Error("Transactional audit adapter requires claim, append, and release.");
  }
  return Object.freeze({
    claim: (receiptHash, actionId, receipt) => adapter.claim(receiptHash, actionId, receipt),\n    complete: (receiptHash, actionId, pullRequest) => adapter.complete(receiptHash, actionId, pullRequest),
    append: (record) => adapter.append(record),
    release: (receiptHash, actionId) => adapter.release(receiptHash, actionId),
    hasReceipt: adapter.hasReceipt ? (receiptHash) => adapter.hasReceipt(receiptHash) : undefined,
    list: adapter.list ? () => adapter.list() : undefined
  });
}
