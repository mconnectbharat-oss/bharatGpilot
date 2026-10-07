import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRepositoryHealth, rankContributionOpportunities } from "../src/github/health-contributions.js";

const inspection = {
  repository: "owner/repo",
  treeTruncated: false,
  issues: [{ number: 7, title: "Improve docs", state: "open" }],
  projectStructure: {
    manifestFiles: ["package.json"],
    signals: { hasReadme: true, hasTestsDirectory: false, hasCiDirectory: false, hasSecurityPolicy: false }
  }
};

test("health evaluation is explainable and bounded", () => {
  const result = evaluateRepositoryHealth(inspection);
  assert.equal(result.score, 40);
  assert.match(result.methodology, /heuristic/);
  assert.match(result.disclaimer, /not a security audit/);
});

test("contribution ranking includes observed gaps and open issues", () => {
  const health = evaluateRepositoryHealth(inspection);
  const result = rankContributionOpportunities(inspection, health);
  assert.ok(result.opportunities.some((item) => item.area === "existing-issue"));
  assert.ok(result.opportunities.some((item) => item.area === "testing"));
});
