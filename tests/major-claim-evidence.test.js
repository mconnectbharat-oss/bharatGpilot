import test from "node:test";
import assert from "node:assert/strict";
import { createClaim } from "../src/evidence/claims.js";
import { requireEvidenceForConfidence } from "../src/evidence/claim-chain.js";

test("high confidence rejects indirect evidence", () => {
  const claim = createClaim({ id: "c", statement: "inferred", evidence: [{ id: "e", classification: "INDIRECT", source: "inference" }] });
  assert.throws(() => requireEvidenceForConfidence(claim, "high"), /DIRECT evidence/);
});

test("high confidence accepts direct evidence", () => {
  const claim = createClaim({ id: "c", statement: "verified", evidence: [{ id: "e", classification: "DIRECT", source: "README.md" }] });
  assert.equal(requireEvidenceForConfidence(claim, "high"), true);
});
