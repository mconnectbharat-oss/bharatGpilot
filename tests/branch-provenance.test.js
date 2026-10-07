import test from "node:test";
import assert from "node:assert/strict";
import { createActionPullRequest } from "../src/core/action-gateway.js";

const review = { decision: "VERIFIED" };

test("PR gate requires the expected branch SHA", async () => {
  await assert.rejects(
    () => createActionPullRequest({
      owner: "owner", repo: "repo", branchName: "feature/test", baseRef: "main",
      title: "test", review, approved: true,
      changeManifest: { version: 1, files: [{ path: "src/a.js" }] }
    }),
    /Expected branch SHA/
  );
});
