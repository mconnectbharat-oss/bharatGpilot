import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { verifyChangeManifest } from "../src/core/change-verifier.js";

const content = "export const ok = true;\n";
const hash = createHash("sha256").update(content, "utf8").digest("hex");
const manifest = { version: 1, files: [{ path: "src/a.js", contentSha256: hash, bytes: Buffer.byteLength(content, "utf8") }] };

test("verifier accepts exact manifest paths and content", async () => {
  const r = await verifyChangeManifest({
    manifest,
    comparison: { base: "main", head: "b", files: [{ filename: "src/a.js", status: "modified" }] },
    owner: "owner",
    repo: "repo",
    branchName: "b",
    getContent: async () => ({ content: Buffer.from(content, "utf8").toString("base64") })
  });
  assert.equal(r.status, "VERIFIED");
});

test("verifier rejects unexpected files", async () => {
  const r = await verifyChangeManifest({
    manifest,
    comparison: { base: "main", head: "b", files: [{ filename: "src/a.js", status: "modified" }, { filename: "src/extra.js", status: "added" }] },
    owner: "owner",
    repo: "repo",
    branchName: "b",
    getContent: async () => ({ content: Buffer.from(content, "utf8").toString("base64") })
  });
  assert.equal(r.status, "MISMATCH");
  assert.deepEqual(r.unexpected, ["src/extra.js"]);
});

test("verifier rejects deletions", async () => {
  const r = await verifyChangeManifest({
    manifest,
    comparison: { base: "main", head: "b", files: [{ filename: "src/a.js", status: "removed" }] },
    owner: "owner",
    repo: "repo",
    branchName: "b",
    getContent: async () => ({})
  });
  assert.equal(r.status, "MISMATCH");
  assert.deepEqual(r.unsupported, ["src/a.js"]);
});

test("verifier rejects content mismatch", async () => {
  const r = await verifyChangeManifest({
    manifest,
    comparison: { base: "main", head: "b", files: [{ filename: "src/a.js", status: "modified" }] },
    owner: "owner",
    repo: "repo",
    branchName: "b",
    getContent: async () => ({ content: Buffer.from("tampered", "utf8").toString("base64") })
  });
  assert.equal(r.status, "MISMATCH");
  assert.equal(r.reason, "CONTENT_MISMATCH");
});

test("verifier fails closed on oversized comparison", async () => {
  const r = await verifyChangeManifest({ manifest, comparison: { too_large: true } });
  assert.equal(r.status, "UNVERIFIED");
});
