import { claimFromEvidence, claimEvidenceSummary } from "../evidence/claim-chain.js";

export function buildMajorClaimChains({ analysis, security, review, evidence = [] } = {}) {
  const purposeClaims = (analysis?.understanding?.purposeSignals || []).map((signal, index) =>
    claimFromEvidence({ id: "purpose-" + (index + 1), statement: signal.value, evidence: [{ id: "purpose-" + (index + 1) + ":e1", classification: "DIRECT", source: signal.source }] })
  );
  const healthClaims = (analysis?.health?.areas || []).map((area, index) =>
    claimFromEvidence({ id: "health-" + (index + 1), statement: area.reason, evidence: (analysis.health.evidence || []).filter((item) => item.claim === area.reason) })
  );
  const contributionClaims = (analysis?.contribution?.opportunities || []).map((item, index) =>
    claimFromEvidence({ id: "contribution-" + (index + 1), statement: item.rationale, evidence: [{ id: "contribution-" + (index + 1) + ":e1", classification: item.area === "existing-issue" ? "DIRECT" : "NO EVIDENCE FOUND", source: item.area === "existing-issue" ? "repository/issues/" + item.issueNumber : "repository/project-structure" }] })
  );
  const securityClaims = (security?.findings || []).map((finding, index) =>
    claimFromEvidence({ id: "security-" + (index + 1), statement: finding.claim, evidence: [{ id: "security-" + (index + 1) + ":e1", classification: "DIRECT", source: finding.source }] })
  );
  if (!securityClaims.length) securityClaims.push(claimFromEvidence({ id: "security-clean-scan", statement: "No high-risk pattern was detected in the bounded content sample; this is not proof of security.", evidence: [{ id: "security-clean-scan:e1", classification: "NO EVIDENCE FOUND", source: "bounded static security scan" }] }));
  const decisionClaim = claimFromEvidence({
    id: "action-decision",
    statement: "Autonomous action decision: " + (review?.decision || "UNVERIFIED"),
    evidence: evidence.map((item, index) => ({ id: "action-decision:e" + (index + 1), classification: item.classification, source: item.sources?.[0] || item.source || null }))
  });
  return Object.freeze({
    purpose: Object.freeze({ claims: purposeClaims, claimEvidence: claimEvidenceSummary(purposeClaims) }),
    health: Object.freeze({ claims: healthClaims, claimEvidence: claimEvidenceSummary(healthClaims) }),
    contribution: Object.freeze({ claims: contributionClaims, claimEvidence: claimEvidenceSummary(contributionClaims) }),
    security: Object.freeze({ claims: securityClaims, claimEvidence: claimEvidenceSummary(securityClaims) }),
    action: Object.freeze({ claims: [decisionClaim], claimEvidence: claimEvidenceSummary([decisionClaim]) })
  });
}

export function assertMajorActionEvidence(chains) {
  const decision = chains?.action?.claims?.[0];
  if (!decision || decision.status !== "SUPPORTED") throw new Error("Autonomous action requires a DIRECTLY supported action-decision evidence chain.");
  return true;
}
