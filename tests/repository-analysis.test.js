import test from "node:test";
import assert from "node:assert/strict";
import { parseRepositoryRef } from "../src/github/repository-intelligence.js";

test("parses repository references before any network call", () => {
  assert.deepEqual(parseRepositoryRef("owner/repo"), { owner: "owner", repo: "repo" });
});

test("rejects references with extra path segments", () => {
  assert.throws(() => parseRepositoryRef("owner/repo/issues"), /owner\/name/);
});
