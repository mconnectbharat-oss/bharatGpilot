import test from "node:test";
import assert from "node:assert/strict";
import { verifyChangeManifest } from "../src/core/change-verifier.js";

test("verifier accepts exact manifest paths", () => {
 const r=verifyChangeManifest({manifest:{version:1,files:[{path:"src/a.js"}]},comparison:{base:"main",head:"b",files:[{filename:"src/a.js"}]}});
 assert.equal(r.status,"VERIFIED");
});
test("verifier rejects unexpected files", () => {
 const r=verifyChangeManifest({manifest:{version:1,files:[{path:"src/a.js"}]},comparison:{base:"main",head:"b",files:[{filename:"src/a.js"},{filename:"src/extra.js"}]}});
 assert.equal(r.status,"MISMATCH"); assert.deepEqual(r.unexpected,["src/extra.js"]);
});
test("verifier fails closed on oversized comparison", () => {
 const r=verifyChangeManifest({manifest:{version:1,files:[{path:"src/a.js"}]},comparison:{too_large:true}});
 assert.equal(r.status,"UNVERIFIED");
});
