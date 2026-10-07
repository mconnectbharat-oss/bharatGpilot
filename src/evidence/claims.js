import { EVIDENCE_CLASSES, createEvidence } from "./evidence.js";
export { EVIDENCE_CLASSES };

export const CLAIM_STATUS = Object.freeze({
  SUPPORTED: "SUPPORTED",
  INFERRED: "INFERRED",
  UNVERIFIED: "UNVERIFIED",
  CONTRADICTED: "CONTRADICTED"
});

function normalizeEvidenceRefs(refs) {
  if (!Array.isArray(refs)) throw new Error("Evidence references must be an array.");
  return Object.freeze(refs.map((ref) => {
    if (!ref || typeof ref.id !== "string" || !ref.id.trim()) throw new Error("Every evidence reference requires an id.");
    if (!Object.values(EVIDENCE_CLASSES).includes(ref.classification)) throw new Error("Evidence reference classification is invalid.");
    return Object.freeze({ id: ref.id, classification: ref.classification, source: ref.source || null });
  }));
}

export function createClaim({ id, statement, evidence = [], reasoning = null } = {}) {
  if (!id || typeof id !== "string") throw new Error("Claim id is required.");
  if (!statement || typeof statement !== "string") throw new Error("Claim statement is required.");
  const refs = normalizeEvidenceRefs(evidence);
  const direct = refs.filter((ref) => ref.classification === EVIDENCE_CLASSES.DIRECT);
  const indirect = refs.filter((ref) => ref.classification === EVIDENCE_CLASSES.INDIRECT);
  const noEvidence = refs.filter((ref) => ref.classification === EVIDENCE_CLASSES.NO_EVIDENCE_FOUND);

  let status = CLAIM_STATUS.UNVERIFIED;
  if (direct.length) status = CLAIM_STATUS.SUPPORTED;
  else if (indirect.length) status = CLAIM_STATUS.INFERRED;
  if (noEvidence.length && !direct.length) status = CLAIM_STATUS.UNVERIFIED;

  return Object.freeze({
    id,
    statement,
    status,
    evidence: refs,
    reasoning,
    evidenceSummary: Object.freeze({
      direct: direct.length,
      indirect: indirect.length,
      noEvidenceFound: noEvidence.length
    })
  });
}

export function linkClaimEvidence(claim, evidenceItem, id) {
  if (!claim?.id || !evidenceItem) throw new Error("Claim and evidence are required.");
  const evidenceId = id || `${claim.id}:e${claim.evidence.length + 1}`;
  const item = createEvidence({ ...evidenceItem });
  return {
    ...claim,
    evidence: [...claim.evidence, Object.freeze({
      id: evidenceId,
      classification: item.classification,
      source: item.sources[0] || null
    })]
  };
}

export function assessClaims(claims) {
  if (!Array.isArray(claims)) throw new Error("Claims must be an array.");
  return Object.freeze({
    total: claims.length,
    supported: claims.filter((claim) => claim.status === CLAIM_STATUS.SUPPORTED).length,
    inferred: claims.filter((claim) => claim.status === CLAIM_STATUS.INFERRED).length,
    unverified: claims.filter((claim) => claim.status === CLAIM_STATUS.UNVERIFIED).length,
    contradicted: claims.filter((claim) => claim.status === CLAIM_STATUS.CONTRADICTED).length
  });
}
