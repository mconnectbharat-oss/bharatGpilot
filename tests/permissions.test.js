import test from "node:test";
import assert from "node:assert/strict";
import { ACTIONS, assertActionAllowed } from "../src/core/permissions.js";

test("destructive operations are blocked", () => {
  assert.throws(() => assertActionAllowed(ACTIONS.DESTRUCTIVE_OPERATION), /blocked/);
});

test("PR creation requires approval", () => {
  assert.throws(() => assertActionAllowed(ACTIONS.CREATE_PR), /approval/);
  assert.equal(assertActionAllowed(ACTIONS.CREATE_PR, { approved: true }), true);
});
