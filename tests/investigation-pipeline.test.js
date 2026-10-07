import test from "node:test";
import assert from "node:assert/strict";
import { runInvestigation } from "../src/core/investigation-pipeline.js";

test("pipeline executes all stages", async () => {
  const calls = [];
  const result = await runInvestigation({ request: "health", repository: "owner/repo" }, {
    planner: () => { calls.push("planner"); return { repository: "owner/repo" }; },
    researcher: async plan => { calls.push("researcher"); return { plan, inspection: {} }; },
    repositoryAnalyst: plan => { calls.push("analyst"); return { plan, analysis: {} }; },
    testPlanner: plan => { calls.push("tester"); return { plan, testPlan: { command: "npm test" } }; },
    testRecorder: plan => { calls.push("record"); return { plan, testResult: { status: "not_executed" } }; },
    securityReviewer: plan => { calls.push("security"); return { plan, security: { findings: [] } }; },
    reviewer: ({ plan }) => { calls.push("review"); return { plan, review: { decision: "HUMAN_REVIEW_REQUIRED" } }; },
    actionGate: () => { calls.push("gate"); return { allowed: false }; }
  });
  assert.deepEqual(calls, ["planner", "researcher", "analyst", "tester", "record", "security", "review", "gate"]);
  assert.equal(result.actionGate.allowed, false);
});
