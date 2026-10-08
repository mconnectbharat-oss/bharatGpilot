import assert from "node:assert/strict";
import test from "node:test";
import { answerRepositoryQuestion, buildRepositoryBrief } from "../src/github/repository-brief.js";

const inspection = {
  repository: "example/demo",
  ref: "main",
  language: "JavaScript",
  stars: 12,
  forks: 3,
  treeTruncated: false,
  projectStructure: { entrypoints: ["server.js"] },
  analyzedContents: {
    "README.md": "# Demo"
  },
  evidence: [{ classification: "DIRECT" }]
};

const analysis = {
  understanding: {
    purposeSignals: [{ value: "An example service", evidence: "DIRECT", source: "package.json" }],
    stack: [{ technology: "Node.js ecosystem", evidence: "DIRECT", source: "package.json" }],
    entrypoints: ["server.js"]
  },
  evidence: [{ classification: "NO_EVIDENCE_FOUND" }],
  health: { score: 80 }
};

test("builds a traceable repository brief", () => {
  const brief = buildRepositoryBrief(inspection, analysis);
  assert.equal(brief.repository, "example/demo");
  assert.equal(brief.evidenceSummary.direct, 1);
  assert.equal(brief.evidenceSummary.noEvidence, 1);
  assert.equal(brief.summary.purpose, "An example service");
});

test("answers supported purpose questions", () => {
  const brief = buildRepositoryBrief(inspection, analysis);
  const result = answerRepositoryQuestion("What does this project do?", brief);
  assert.match(result.answer, /An example service/);
  assert.equal(result.evidence.length, 1);
});

test("refuses unsupported repository questions", () => {
  const brief = buildRepositoryBrief(inspection, analysis);
  const result = answerRepositoryQuestion("Who is the best contributor?", brief);
  assert.match(result.answer, /More targeted GitHub evidence is required/);
});
