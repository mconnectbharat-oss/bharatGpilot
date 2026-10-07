import test from "node:test";
import assert from "node:assert/strict";
import { executeRepositoryTests, createExecutionContract } from "../src/sandbox/execution.js";

test("execution contract requires cleanup and isolated deployment", () => {
  const contract = createExecutionContract();
  assert.equal(contract.workspace, "ephemeral");
  assert.equal(contract.credentials, "none");
  assert.equal(contract.cleanup, "guaranteed");
  assert.equal(contract.execution, "deployment-isolated-runtime-required");
});

test("execution adapter always cleans up the workspace", async () => {
  let cleaned = false;
  const result = await executeRepositoryTests({
    owner: "owner",
    repo: "repo",
    adapters: {
      provisionWorkspace: async () => ({
        path: "/tmp/bharatgpilot-test",
        cleanup: async () => { cleaned = true; }
      }),
      materializeRepository: async () => ({ materializedFiles: 1 }),
      runSandboxedTest: async () => ({ status: "passed", output: "ok" })
    }
  });
  assert.equal(result.status, "passed");
  assert.equal(cleaned, true);
});
