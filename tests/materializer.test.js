import test from "node:test";
import assert from "node:assert/strict";
import { createMaterializationPolicy } from "../src/sandbox/materializer.js";

test("materialization policy is bounded", () => {
  const policy = createMaterializationPolicy({ maxFiles: 9999, maxFileBytes: 99999999 });
  assert.equal(policy.maxFiles, 200);
  assert.equal(policy.maxFileBytes, 1_000_000);
});
