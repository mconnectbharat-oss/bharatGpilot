export const EVIDENCE_CLASSES = Object.freeze({
  DIRECT: "DIRECT",
  INDIRECT: "INDIRECT",
  NO_EVIDENCE_FOUND: "NO EVIDENCE FOUND"
});

export function createEvidence({ claim, classification, sources = [], reasoning = null, confidence = "unknown" }) {
  if (!claim || typeof claim !== "string") throw new Error("Evidence claim must be a non-empty string.");
  if (!Object.values(EVIDENCE_CLASSES).includes(classification)) throw new Error("Invalid evidence classification.");
  if (!Array.isArray(sources)) throw new Error("Evidence sources must be an array.");
  if (classification === EVIDENCE_CLASSES.DIRECT && sources.length === 0) {
    throw new Error("DIRECT evidence requires at least one source.");
  }

  return Object.freeze({
    claim,
    classification,
    sources: sources.map((source) => Object.freeze({
      type: source.type || "unknown",
      location: source.location || null,
      detail: source.detail || null
    })),
    reasoning,
    confidence
  });
}

export function summarizeEvidence(evidenceItems) {
  if (!Array.isArray(evidenceItems)) throw new Error("Evidence items must be an array.");
  return {
    total: evidenceItems.length,
    direct: evidenceItems.filter((item) => item.classification === EVIDENCE_CLASSES.DIRECT).length,
    indirect: evidenceItems.filter((item) => item.classification === EVIDENCE_CLASSES.INDIRECT).length,
    noEvidenceFound: evidenceItems.filter(
      (item) => item.classification === EVIDENCE_CLASSES.NO_EVIDENCE_FOUND
    ).length
  };
}
