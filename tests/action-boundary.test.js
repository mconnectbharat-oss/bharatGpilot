import test from "node:test";
import assert from "node:assert/strict";
import { validateChangeManifest } from "../src/core/action-gateway.js";

test("change manifest rejects oversized sets", () => {
  assert.throws(() => validateChangeManifest(Array.from({length:11},(_,i)=>({path:"x"+i+".js",content:"x",message:"m"}))), /file limit/);
});
test("sensitive workflow changes require approval", () => {
  assert.throws(() => validateChangeManifest([{path:".github/workflows/ci.yml",content:"x",message:"m"}]), /approval/);
});
test("manifest accepts bounded ordinary changes", () => {
  const m=validateChangeManifest([{path:"src/a.js",content:"x",message:"m"}]);
  assert.equal(m.version,1); assert.equal(m.files.length,1);
});
