import { createHash } from "node:crypto";

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalize(value[key])]));
  }
  return value;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(normalize(value)), "utf8").digest("hex");
}

export function createActionReceipt({
  review, repository, baseSha, manifest, branchName, changeVerification,
  testResult, security, finalReview, branchHeadSha
} = {}) {
  if (!review || !repository?.owner || !repository?.repo || !baseSha || !manifest?.version || !branchName) {
    throw new Error("Complete authorization context is required for an action receipt.");
  }
  const authorization = Object.freeze({
    version: 1,
    repository: Object.freeze({ owner: repository.owner, repo: repository.repo, ref: repository.ref || "main" }),
    baseSha,
    branchName,
    manifest,
    review,
    changeVerification: changeVerification || null,
    testResult: testResult || null,
    security: security || null,
    finalReview: finalReview || null,
    branchHeadSha: branchHeadSha || null
  });
  const receiptHash = digest(authorization);
  return Object.freeze({ ...authorization, receiptHash });
}

export function verifyActionReceipt(receipt) {
  if (!receipt?.receiptHash) return Object.freeze({ status: "INVALID", reason: "RECEIPT_HASH_MISSING" });
  const { receiptHash, ...authorization } = receipt;
  const expected = digest(authorization);
  return Object.freeze({
    status: expected === receiptHash ? "VERIFIED" : "INVALID",
    receiptHash,
    expectedHash: expected
  });
}
