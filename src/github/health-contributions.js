import { createEvidence, EVIDENCE_CLASSES } from "../evidence/index.js";

const WEIGHTS = Object.freeze({ documentation: 20, testing: 25, ci: 20, security: 15, structure: 20 });

function item(area, status, weight, reason) {
  return { area, status, weight, reason };
}

export function evaluateRepositoryHealth(inspection) {
  const s = inspection.projectStructure?.signals || {};
  const areas = [
    s.hasReadme ? item("documentation", "verified", WEIGHTS.documentation, "README.md was indexed.") : item("documentation", "unverified", WEIGHTS.documentation, "README.md was not verified."),
    s.hasTestsDirectory ? item("testing", "verified", WEIGHTS.testing, "A test directory was indexed.") : item("testing", "unverified", WEIGHTS.testing, "A test directory was not verified."),
    s.hasCiDirectory ? item("ci", "verified", WEIGHTS.ci, "GitHub Actions workflows were indexed.") : item("ci", "unverified", WEIGHTS.ci, "GitHub Actions workflows were not verified."),
    s.hasSecurityPolicy ? item("security", "verified", WEIGHTS.security, "SECURITY.md was indexed.") : item("security", "unverified", WEIGHTS.security, "SECURITY.md was not verified."),
    inspection.projectStructure?.manifestFiles?.length ? item("structure", "verified", WEIGHTS.structure, "A supported project manifest was indexed.") : item("structure", "unverified", WEIGHTS.structure, "A supported project manifest was not verified.")
  ];
  const verifiedWeight = areas.filter((a) => a.status === "verified").reduce((sum, a) => sum + a.weight, 0);
  const score = verifiedWeight;
  const evidence = areas.map((a) => createEvidence({
    claim: a.reason,
    classification: a.status === "verified" ? EVIDENCE_CLASSES.DIRECT : EVIDENCE_CLASSES.NO_EVIDENCE_FOUND,
    sources: [{ type: "github_analysis", location: "repository/project-structure" }]
  }));
  if (inspection.treeTruncated) {
    evidence.push(createEvidence({
      claim: "The repository-wide health assessment is limited because the GitHub tree was truncated.",
      classification: EVIDENCE_CLASSES.NO_EVIDENCE_FOUND,
      sources: [{ type: "github_analysis", location: "repository/tree" }]
    }));
  }
  return {
    methodology: "heuristic-observation-v1",
    score,
    scale: 100,
    interpretation: inspection.treeTruncated ? "limited coverage" : score >= 80 ? "strong observed foundations" : score >= 50 ? "mixed observed foundations" : "limited observed foundations",
    disclaimer: "This score measures observed project-structure signals only. It is not a security audit, quality proof, or production-readiness certification.",
    areas,
    evidence
  };
}

export function rankContributionOpportunities(inspection, health) {
  const opportunities = [];
  const s = inspection.projectStructure?.signals || {};
  if (!s.hasReadme) opportunities.push({ priority: "high", area: "documentation", title: "Improve repository documentation", rationale: "README presence was not verified in the indexed tree." });
  if (!s.hasTestsDirectory) opportunities.push({ priority: "high", area: "testing", title: "Add or strengthen tests", rationale: "A test directory was not verified in the indexed tree." });
  if (!s.hasCiDirectory) opportunities.push({ priority: "medium", area: "ci", title: "Add continuous integration", rationale: "GitHub Actions workflows were not verified in the indexed tree." });
  if (!s.hasSecurityPolicy) opportunities.push({ priority: "medium", area: "security", title: "Document security reporting", rationale: "SECURITY.md was not verified in the indexed tree." });
  const openIssues = Array.isArray(inspection.issues) ? inspection.issues.filter((i) => i.state === "open") : [];
  for (const issue of openIssues.slice(0, 5)) {
    opportunities.push({ priority: "medium", area: "existing-issue", title: issue.title, rationale: "This issue was directly returned as open by GitHub.", issueNumber: issue.number });
  }
  if (inspection.treeTruncated) {
    opportunities.push({ priority: "high", area: "analysis", title: "Complete repository indexing", rationale: "GitHub reported a truncated repository tree; contribution ranking may be incomplete." });
  }
  return { methodology: "evidence-prioritized-v1", opportunities, healthScoreContext: health.score };
}
