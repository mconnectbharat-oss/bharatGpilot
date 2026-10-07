import test from "node:test";
import assert from "node:assert/strict";
import { createInvestigationPlan, addEvidence, verificationSummary } from "../src/core/orchestrator.js";
import { EVIDENCE_CLASSES } from "../src/evidence/index.js";

test("creates a controlled investigation plan", () => {
  const plan = createInvestigationPlan("Analyze a repository");
  assert.equal(plan.steps.length, 7);
  assert.equal(plan.steps[0].agent, "planner");
});

test("keeps evidence classes distinct", () => {
  let plan = createInvestigationPlan("Verify repository health");
  plan = addEvidence(plan, { claim: "README exists", classification: EVIDENCE_CLASSES.DIRECT, sources: [{ type: "repository", location: "README.md" }] });
  plan = addEvidence(plan, { claim: "Project may be healthy", classification: EVIDENCE_CLASSES.INDIRECT, sources: [{ type: "repository", location: "package.json" }] });
  assert.deepEqual(verificationSummary(plan), { direct: 1, indirect: 1, noEvidence: 0, incompleteSteps: 7 });
});
