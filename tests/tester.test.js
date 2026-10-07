import test from "node:test";
import assert from "node:assert/strict";
import { createTestPlan, recordTestResult } from "../src/agents/tester.js";

const inspection = {
  analyzedContents: [{ path: "package.json", content: '{"scripts":{"test":"node --test"}}' }],
  projectStructure: { signals: { hasTestsDirectory: true } }
};
const plan = { repository: { owner: "example", name: "repo" }, steps: [], evidence: [] };

test("creates a bounded test plan without claiming execution", () => {
  const result = createTestPlan({ ...plan, evidence: [] }, inspection);
  assert.equal(result.testPlan.command, "npm test");
  assert.equal(result.testPlan.execution, "NOT_EXECUTED");
  assert.equal(result.plan.steps.at(-1).name, "tester");
});

test("records explicit sandbox results as evidence", () => {
  const result = recordTestResult({ ...plan, evidence: [] }, { command: "npm test" }, {
    status: "passed",
    claim: "All tests passed in the sandbox.",
    source: "sandbox runner"
  });
  assert.equal(result.testResult.execution, "EXECUTED");
  assert.equal(result.plan.evidence.at(-1).class, "DIRECT");
});

test("does not convert non-execution into a pass", () => {
  const result = recordTestResult(plan, { command: "npm test" }, {
    status: "not_executed",
    claim: "Tests were not executed.",
    source: "sandbox runner unavailable"
  });
  assert.equal(result.testResult.status, "not_executed");
  assert.equal(result.plan.evidence.at(-1).class, "NO EVIDENCE FOUND");
});
