import test from "node:test";
import assert from "node:assert/strict";
import { SANDBOX_COMMANDS, createSandboxPolicy, runSandboxedTest } from "../src/sandbox/runner.js";

test("allows only explicit test commands", () => {
  assert.deepEqual(Object.keys(SANDBOX_COMMANDS), ["npm test", "node --test"]);
  assert.throws(() => runSandboxedTest({ command: "npm install", cwd: process.cwd() }), /not allowed/);
});

test("clamps sandbox policy limits", () => {
  const policy = createSandboxPolicy({ timeoutMs: 999999, maxOutputBytes: 9999999 });
  assert.equal(policy.timeoutMs, 120000);
  assert.equal(policy.maxOutputBytes, 200000);
});

test("requires an explicit workspace for allowed execution", async () => {
  await assert.rejects(() => runSandboxedTest({ command: "node --test" }), /workspace directory is required/);
});
