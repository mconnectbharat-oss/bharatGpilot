import test from "node:test";
import assert from "node:assert/strict";
import { executeRepositoryTests } from "../src/sandbox/execution.js";

test("execution fails closed without an isolated runtime", async () => {
  const result = await executeRepositoryTests({ owner: "o", repo: "r" });
  assert.equal(result.status, "not_executed");
  assert.equal(result.reason, "ISOLATED_RUNTIME_UNAVAILABLE");
});

test("execution adapter can use an injected isolated runtime", async () => {
  let cleaned = false;
  const result = await executeRepositoryTests({
    owner: "o",
    repo: "r",
    adapters: {
      runtimeAdapter: {
        contract: { isolation: "container", network: "disabled", credentials: "none" },
        run: async ({ command, workspacePath }) => ({ status: "passed", execution: "EXECUTED", command, workspacePath })
      },
      provisionWorkspace: async () => ({ path: "/tmp/workspace", cleanup: async () => { cleaned = true; } }),
      materializeRepository: async () => ({ materializedFiles: 1 })
    }
  });
  assert.equal(result.status, "passed");
  assert.equal(result.execution.execution, "EXECUTED");
  assert.equal(cleaned, true);
});
