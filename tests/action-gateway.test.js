import test from "node:test";
import assert from "node:assert/strict";
import { ACTIONS } from "../src/core/permissions.js";
import { createActionPullRequest } from "../src/core/action-gateway.js";

test("PR creation requires verified review and explicit approval", async () => {
  await assert.rejects(
    () => createActionPullRequest({ owner: "o", repo: "r", branchName: "b", title: "t", review: { decision: "HUMAN_REVIEW_REQUIRED" }, approved: true }),
    /VERIFIED/
  );
  await assert.rejects(
    () => createActionPullRequest({ owner: "o", repo: "r", branchName: "b", title: "t", review: { decision: "VERIFIED" } }),
    /Explicit approval/
  );
  assert.equal(ACTIONS.CREATE_PR, "create_pr");
});
