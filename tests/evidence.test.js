import test from "node:test";
import assert from "node:assert/strict";
import {
  EVIDENCE_CLASSES,
  createEvidence,
  summarizeEvidence
} from "../src/evidence/index.js";

test("creates direct evidence only when a source is supplied", () => {
  const evidence = createEvidence({
    claim: "The repository has a README.",
    classification: EVIDENCE_CLASSES.DIRECT,
    sources: [{ type: "repository_file", location: "README.md" }],
    confidence: "high"
  });

  assert.equal(evidence.classification, EVIDENCE_CLASSES.DIRECT);
  assert.equal(evidence.sources.length, 1);
});

test("rejects unsupported evidence classifications", () => {
  assert.throws(() => createEvidence({
    claim: "Unknown",
    classification: "ASSUMED"
  }), /Invalid evidence classification/);
});

test("summarizes evidence without treating missing evidence as false", () => {
  const summary = summarizeEvidence([
    createEvidence({
      claim: "Observed claim",
      classification: EVIDENCE_CLASSES.DIRECT,
      sources: [{ type: "repository_file", location: "README.md" }]
    }),
    createEvidence({
      claim: "Reasonable inference",
      classification: EVIDENCE_CLASSES.INDIRECT,
      reasoning: "Derived from repository activity."
    }),
    createEvidence({
      claim: "Could not verify",
      classification: EVIDENCE_CLASSES.NO_EVIDENCE_FOUND
    })
  ]);

  assert.deepEqual(summary, { total: 3, direct: 1, indirect: 1, noEvidenceFound: 1 });
});
