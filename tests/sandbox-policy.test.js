import test from "node:test";
import assert from "node:assert/strict";
import { createSandboxPolicy } from "../src/sandbox/runner.js";

test("runner policy records workspace isolation properties", () => {
  const policy = createSandboxPolicy();
  assert.equal(policy.network, "disabled-by-runner-contract");
  assert.deepEqual(policy.allowedCommands, ["npm test", "node --test"]);
});
