import test from "node:test";
import assert from "node:assert/strict";
import { analyzeProjectStructure, decodeBlob, selectContentCandidates } from "../src/github/content-analysis.js";

test("selects manifests and supported source files within the size bound", () => {
  const files = [
    { path: "package.json", type: "blob", size: 100 },
    { path: "src/index.js", type: "blob", size: 200 },
    { path: "image.png", type: "blob", size: 200 },
    { path: "large.js", type: "blob", size: 1000001 }
  ];
  assert.deepEqual(selectContentCandidates(files).map((file) => file.path), ["package.json", "src/index.js"]);
});

test("decodes GitHub base64 blob content", () => {
  assert.equal(decodeBlob({ encoding: "base64", content: "aGVsbG8=" }), "hello");
});

test("extracts deterministic project structure signals", () => {
  const result = analyzeProjectStructure(
    [{ path: "package.json" }, { path: "README.md" }, { path: "tests/a.test.js" }, { path: ".github/workflows/ci.yml" }],
    { "package.json": "{}" }
  );
  assert.equal(result.signals.hasPackageManifest, true);
  assert.equal(result.signals.hasTestsDirectory, true);
  assert.equal(result.signals.hasCiDirectory, true);
});
