import test from "node:test";
import assert from "node:assert/strict";
import { reviewSecurity } from "../src/agents/security-reviewer.js";

test("flags privileged workflow and process execution signals", () => {
  const result = reviewSecurity(
    { repository: { owner: "example", name: "repo" }, steps: [], evidence: [] },
    { analyzedContents: [
      { path: ".github/workflows/ci.yml", content: "on: pull_request_target\njobs:\n  test:\n    run: node test.js" },
      { path: "src/run.js", content: "import { exec } from 'node:child_process';" }
    ] }
  );
  assert.equal(result.security.status, "review_required");
  assert.equal(result.security.findings.length, 2);
  assert.equal(result.plan.steps.at(-1).id, "security");
});

test("does not treat a clean bounded scan as proof of security", () => {
  const result = reviewSecurity(
    { repository: { owner: "example", name: "repo" }, steps: [], evidence: [] },
    { analyzedContents: [{ path: "README.md", content: "# Example" }] }
  );
  assert.equal(result.security.status, "no_high_risk_pattern_observed");
  assert.match(result.security.disclaimer, /not a complete security audit/);
  assert.equal(result.plan.evidence.at(-1).classification, "NO EVIDENCE FOUND");
});
