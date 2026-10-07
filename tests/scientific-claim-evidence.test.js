import test from "node:test";
import assert from "node:assert/strict";
import { EVIDENCE_CLASSES } from "../src/evidence/evidence.js";
import { CLAIM_STATUS, createClaim, assessClaims } from "../src/evidence/claims.js";

test("direct evidence produces a supported claim", () => {
  const claim = createClaim({ id: "c1", statement: "README exists", evidence: [{ id: "e1", classification: EVIDENCE_CLASSES.DIRECT, source: "README.md" }] });
  assert.equal(claim.status, CLAIM_STATUS.SUPPORTED);
});

test("indirect evidence produces an inferred claim", () => {
  const claim = createClaim({ id: "c2", statement: "Project is Node based", evidence: [{ id: "e1", classification: EVIDENCE_CLASSES.INDIRECT, source: "package.json" }] });
  assert.equal(claim.status, CLAIM_STATUS.INFERRED);
});

test("no evidence produces an unverified claim", () => {
  const claim = createClaim({ id: "c3", statement: "Project has CI", evidence: [{ id: "e1", classification: EVIDENCE_CLASSES.NO_EVIDENCE_FOUND, source: "repository/project-structure" }] });
  assert.equal(claim.status, CLAIM_STATUS.UNVERIFIED);
  assert.deepEqual(assessClaims([claim]), { total: 1, supported: 0, inferred: 0, unverified: 1, contradicted: 0 });
});
