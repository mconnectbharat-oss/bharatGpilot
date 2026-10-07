import { createEvidence, EVIDENCE_CLASSES, createClaim } from "../evidence/index.js";
import { extractProjectUnderstanding } from "./semantic-analysis.js";
import { evaluateRepositoryHealth, rankContributionOpportunities } from "./health-contributions.js";

export function analyzeRepositorySignals(inspection) {
  const understanding = extractProjectUnderstanding(inspection);
  const health = evaluateRepositoryHealth(inspection);
  const contribution = rankContributionOpportunities(inspection, health);
  const structure = inspection.projectStructure || {};
  const signals = structure.signals || {};
  const evidence = [];
  const findings = [];
  const recommendations = [];
  const claims = [];

  function direct(claim, location, detail = null) {
    const item = createEvidence({ claim, classification: EVIDENCE_CLASSES.DIRECT, sources: [{ type: "github_analysis", location, detail }] });
    const id = `claim-${claims.length + 1}`;
    claims.push(createClaim({ id, statement: claim, evidence: [{ id: `${id}:e1`, classification: item.classification, source: item.sources[0] || null }] }));
    evidence.push(item);
  }

  function noEvidence(claim, location) {
    const item = createEvidence({ claim, classification: EVIDENCE_CLASSES.NO_EVIDENCE_FOUND, sources: [{ type: "github_analysis", location }] });
    const id = `claim-${claims.length + 1}`;
    claims.push(createClaim({ id, statement: claim, evidence: [{ id: `${id}:e1`, classification: item.classification, source: item.sources[0] || null }] }));
    evidence.push(item);
  }

  if (signals.hasReadme) {
    direct("A README file was indexed.", "repository/project-structure");
  } else {
    noEvidence("A README file could not be verified in the indexed repository.", "repository/project-structure");
    recommendations.push({ priority: "high", reason: "README could not be verified", action: "Review repository documentation coverage before choosing implementation work." });
  }

  if (signals.hasTestsDirectory) {
    direct("A test directory was detected in the indexed paths.", "repository/project-structure");
  } else {
    noEvidence("A test directory could not be verified in the indexed paths.", "repository/project-structure");
    findings.push({ area: "testing", status: "unverified", reason: "No test directory was detected in indexed paths." });
  }

  if (signals.hasCiDirectory) {
    direct("GitHub Actions workflow paths were detected.", "repository/project-structure");
  } else {
    noEvidence("GitHub Actions workflow paths could not be verified in indexed paths.", "repository/project-structure");
    findings.push({ area: "ci", status: "unverified", reason: "No GitHub Actions workflow path was detected." });
  }

  if (signals.hasSecurityPolicy) {
    direct("SECURITY.md was indexed.", "repository/project-structure");
  } else {
    noEvidence("SECURITY.md could not be verified in indexed paths.", "repository/project-structure");
  }

  if (structure.manifestFiles?.length) {
    direct("One or more project manifest files were indexed.", "repository/project-structure", structure.manifestFiles);
  } else {
    noEvidence("A supported project manifest could not be verified.", "repository/project-structure");
  }

  if (inspection.treeTruncated) {
    findings.push({ area: "coverage", status: "limited", reason: "GitHub reported a truncated repository tree." });
    recommendations.push({ priority: "high", reason: "Repository index is incomplete", action: "Continue with deeper or paginated inspection before making broad repository-wide claims." });
  }

  const openIssues = Array.isArray(inspection.issues) ? inspection.issues.filter((issue) => issue.state === "open") : [];
  const openPulls = Array.isArray(inspection.pullRequests) ? inspection.pullRequests.filter((pr) => pr.state === "open") : [];
  if (openIssues.length) {
    direct("Open issues were returned by GitHub.", "repository/issues", { count: openIssues.length });
    recommendations.push({ priority: "medium", reason: "Open issues are available", action: "Review open issues for contribution opportunities before creating duplicate work." });
  } else {
    noEvidence("No open issues were present in the inspected issue sample.", "repository/issues");
  }
  if (openPulls.length) {
    direct("Open pull requests were returned by GitHub.", "repository/pulls", { count: openPulls.length });
  } else {
    noEvidence("No open pull requests were present in the inspected pull-request sample.", "repository/pulls");
  }

  return {
    understanding,
    health,
    contribution,
    summary: {
      repository: inspection.repository,
      coverage: inspection.treeTruncated ? "partial" : "indexed",
      confidence: inspection.treeTruncated ? "limited" : "structural"
    },
    findings,
    recommendations,
    evidence
  };
}
