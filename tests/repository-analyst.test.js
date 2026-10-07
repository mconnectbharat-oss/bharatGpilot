import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRepository } from "../src/agents/repository-analyst.js";
import { createResearchPlan } from "../src/core/planner.js";

test("repository analyst requires inspection evidence", () => {
  const plan = createResearchPlan({
    request: "Analyze repository health",
    repository: "owner/name"
  });

  assert.throws(
    () => analyzeRepository(plan),
    /inspection is required/
  );
});

test("repository analyst produces structured analysis from inspection", () => {
  const plan = createResearchPlan({
    request: "Analyze repository health and contribution opportunities",
    repository: "owner/name"
  });

  const inspection = {
    repository: "owner/name",
    treeTruncated: false,
    projectStructure: {
      signals: {
        hasReadme: true,
        hasTestsDirectory: true,
        hasCiDirectory: true,
        hasSecurityPolicy: false
      },
      manifestFiles: ["package.json"],
      extensionCounts: { js: 4 },
      entrypoints: ["Server.js"]
    },
    analyzedContents: {
      "README.md": "# Example project",
      "package.json": JSON.stringify({ name: "example", version: "1.0.0", description: "Example project" })
    },
    issues: [],
    pullRequests: []
  };

  const result = analyzeRepository(plan, inspection);
  assert.equal(result.analysis.summary.repository, "owner/name");
  assert.equal(result.analysis.understanding.projectName, "example");
  assert.equal(result.analysis.health.score, 85);
  assert.ok(result.analysis.contribution);
  assert.equal(result.plan.steps.find((step) => step.id === "repository").status, "completed");
});
