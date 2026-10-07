import test from "node:test";
import assert from "node:assert/strict";
import { extractProjectUnderstanding } from "../src/github/semantic-analysis.js";

test("extracts direct purpose and stack signals", () => {
  const result = extractProjectUnderstanding({
    repository: "owner/repo",
    analyzedContents: {
      "README.md": "# Example Project\nBuild tools for developers.",
      "package.json": JSON.stringify({ name: "example", version: "1.0.0", description: "Developer tooling" })
    },
    projectStructure: { extensionCounts: { js: 4 }, manifestFiles: ["package.json"], entrypoints: ["src/index.js"] }
  });
  assert.equal(result.projectName, "example");
  assert.equal(result.purposeSignals[0].value, "Developer tooling");
  assert.ok(result.stack.some((item) => item.technology === "JavaScript"));
});
