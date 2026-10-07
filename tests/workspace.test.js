import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { provisionWorkspace, createWorkspacePolicy } from "../src/sandbox/workspace.js";

test("provisions an ephemeral workspace with no credentials", async () => {
  const workspace = await provisionWorkspace();
  try {
    assert.equal(workspace.lifecycle, "EPHEMERAL");
    assert.equal(workspace.credentials, "NONE");
    assert.equal(workspace.network, "DISABLED_BY_EXECUTION_CONTRACT");
    await access(workspace.path);
  } finally {
    await workspace.cleanup();
    await assert.rejects(access(workspace.path));
  }
});

test("workspace policy requires cleanup", () => {
  const policy = createWorkspacePolicy();
  assert.equal(policy.cleanupRequired, true);
  assert.equal(policy.credentials, "NONE");
});
