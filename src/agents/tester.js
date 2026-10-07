import { addEvidence, markStep } from "../core/orchestrator.js";
import { ACTIONS, assertActionAllowed } from "../core/permissions.js";

const DEFAULT_TEST_COMMAND = "npm test";

export function createTestPlan(plan, inspection) {
  if (!plan?.repository) throw new Error("A repository is required for test planning.");
  if (!inspection) throw new Error("Repository inspection is required for test planning.");
  assertActionAllowed(ACTIONS.RUN_SANDBOXED_TESTS);

  const packageContent = (inspection.analyzedContents || []).find((item) => item.path === "package.json")?.content;
  let testCommand = DEFAULT_TEST_COMMAND;
  let packageScripts = {};

  if (packageContent) {
    try {
      const pkg = JSON.parse(packageContent);
      packageScripts = pkg.scripts || {};
    } catch {
      // Safe default remains npm test.
    }
  }

  const testDirectoryObserved = Boolean(inspection.projectStructure?.signals?.hasTestsDirectory);
  let next = markStep(plan, "tests", "running");
  next = addEvidence(next, {
    classification: testDirectoryObserved ? "DIRECT" : "NO EVIDENCE FOUND",
    claim: testDirectoryObserved
      ? "A repository test directory was directly observed."
      : "A repository test directory could not be directly verified.",
    source: testDirectoryObserved ? "repository project structure" : "bounded repository inspection"
  });

  return {
    plan: next,
    testPlan: {
      status: testDirectoryObserved ? "ready" : "limited",
      command: testCommand,
      packageScripts,
      execution: "NOT_EXECUTED",
      executionReason: "A sandbox workspace/runner is not yet connected to this agent.",
      verificationRequired: true
    }
  };
}

export function recordTestResult(plan, testPlan, result) {
  if (!plan?.repository) throw new Error("A repository is required for test results.");
  if (!testPlan) throw new Error("A test plan is required.");
  if (!result || !["passed", "failed", "not_executed"].includes(result.status)) {
    throw new Error("Test result status must be passed, failed, or not_executed.");
  }

  let next = markStep(plan, "tests", result.status === "passed" ? "completed" : "running");
  next = addEvidence(next, {
    classification: result.status === "not_executed" ? "NO EVIDENCE FOUND" : "DIRECT",
    claim: result.claim || "Sandbox test execution completed with an explicit result.",
    source: result.source || "sandbox test runner"
  });

  return {
    plan: next,
    testResult: {
      status: result.status,
      command: testPlan.command,
      execution: result.status === "not_executed" ? "NOT_EXECUTED" : "EXECUTED",
      output: result.output || null
    }
  };
}
