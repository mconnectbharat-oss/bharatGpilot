import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRepositorySignals } from "../src/github/repository-analysis.js";

test("produces evidence-backed signals and recommendations", () => {
  const result = analyzeRepositorySignals({
    repository: "owner/repo",
    treeTruncated: false,
    issues: [{ state: "open" }],
    pullRequests: [],
    projectStructure: {
      manifestFiles: ["package.json"],
      signals: { hasReadme: true, hasTestsDirectory: true, hasCiDirectory: false, hasSecurityPolicy: false }
    }
  });
  assert.equal(result.summary.coverage, "indexed");
  assert.ok(result.evidence.some((item) => item.classification === "DIRECT"));
  assert.ok(result.evidence.some((item) => item.classification === "NO EVIDENCE FOUND"));
  assert.ok(result.recommendations.length > 0);
});
