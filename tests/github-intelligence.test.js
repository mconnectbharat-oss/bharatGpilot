import test from "node:test";
import assert from "node:assert/strict";
import { parseRepositoryRef } from "../src/github/repository-intelligence.js";

test("accepts owner/name repository references", () => {
  assert.deepEqual(parseRepositoryRef("mconnectbharat-oss/bharatGpilot"), {
    owner: "mconnectbharat-oss",
    repo: "bharatGpilot"
  });
});

test("rejects malformed repository references", () => {
  assert.throws(() => parseRepositoryRef("not-a-repository"), /owner\/name/);
});
