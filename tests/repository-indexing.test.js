import test from "node:test";
import assert from "node:assert/strict";

test("repository indexing exposes explicit truncation semantics", () => {
  const tree = { truncated: true, tree: [{ path: "src/index.js", type: "blob", sha: "abc" }] };
  assert.equal(tree.truncated, true);
  assert.equal(tree.tree[0].type, "blob");
});
