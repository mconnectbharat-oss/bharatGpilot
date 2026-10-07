import test from "node:test";
import assert from "node:assert/strict";
import { createResearchPlan } from "../src/core/planner.js";
import { researchRepository } from "../src/core/researcher.js";

test("planner derives evidence targets without inventing findings", () => {
  const plan = createResearchPlan({
    request: "Analyze this repository, tell me whether it is healthy and what I should contribute first.",
    repository: "mconnectbharat-oss/bharatGpilot"
  });

  assert.equal(plan.repository, "mconnectbharat-oss/bharatGpilot");
  assert.deepEqual(plan.planner.requestedSignals, ["health", "contribution"]);
  assert.equal(plan.planner.verificationRequired, true);
  assert.equal(plan.research.status, "ready");
  assert.ok(plan.research.evidenceTargets.length > 0);
});

test("researcher requires a repository before collecting evidence", async () => {
  await assert.rejects(
    () => researchRepository(createResearchPlan({ request: "Explain this project" })),
    /repository is required/
  );
});
