import { EVIDENCE_CLASSES, createClaim } from "./claims.js";

export function claimFromEvidence({ id, statement, evidence = [], reasoning = null } = {}) {
  return createClaim({ id, statement, evidence: evidence.map((item, index) => ({
    id: item.id || `${id}:e${index + 1}`,
    classification: item.classification,
    source: item.sources?.[0] || item.source || null
  })), reasoning });
}

export function claimEvidenceSummary(claims = []) {
  return Object.freeze({
    total: claims.length,
    direct: claims.filter((claim) => claim.status === "SUPPORTED").length,
    indirect: claims.filter((claim) => claim.status === "INFERRED").length,
    unverified: claims.filter((claim) => claim.status === "UNVERIFIED").length,
    contradicted: claims.filter((claim) => claim.status === "CONTRADICTED").length
  });
}

export function requireEvidenceForConfidence(claim, confidence = "high") {
  if (confidence === "high" && claim.status !== "SUPPORTED") {
    throw new Error("High-confidence claims require DIRECT evidence.");
  }
  return true;
}

export { EVIDENCE_CLASSES };
