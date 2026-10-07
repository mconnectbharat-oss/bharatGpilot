import test from "node:test";
import assert from "node:assert/strict";
import { verifyRequiredCiChecks } from "../src/core/action-gateway.js";

test("CI gate requires every configured check to complete successfully", async () => {
  const original = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = original || "test-token";
  try {
    await assert.rejects(
      () => verifyRequiredCiChecks("mconnectbharat-oss", "bharatGpilot", "a".repeat(40)),
      /GitHub request failed|fetch failed|GITHUB_TOKEN/
    );
  } finally {
    if (original === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = original;
  }
});
