import { ACTIONS, assertActionAllowed } from "../core/permissions.js";
import { addEvidence, markStep } from "../core/orchestrator.js";
import { claimFromEvidence, claimEvidenceSummary } from "../evidence/claim-chain.js";

const HIGH_RISK_PATTERNS = Object.freeze([
  { id: "privileged-workflow", pattern: /pull_request_target|workflow_run/gi, claim: "A privileged GitHub Actions trigger was observed and requires review when handling untrusted code." },
  { id: "shell-interpolation", pattern: /run:\s*.*\$\{\{.*(title|body|message|name|ref|head_ref)/gi, claim: "A workflow may interpolate untrusted GitHub context into a shell command." },
  { id: "credential-reference", pattern: /process\.env\.(GITHUB_TOKEN|.*SECRET.*|.*TOKEN.*)/gi, claim: "Code references environment credentials and requires credential-boundary review." },
  { id: "unsafe-child-process", pattern: /child_process|spawn\(|exec\(|execFile\(/gi, claim: "Process execution APIs were observed and require input and isolation review." }
]);

function scanText(path, content) {
  const findings = [];
  for (const rule of HIGH_RISK_PATTERNS) {
    if (rule.pattern.test(content || "")) {
      rule.pattern.lastIndex = 0;
      findings.push({
        id: rule.id, path, classification: "DIRECT",
        claim: rule.claim, source: "repository file: " + path
      });
    }
    rule.pattern.lastIndex = 0;
  }
  return findings;
}

export function reviewSecurity(plan, inspection) {
  if (!plan?.repository) throw new Error("A repository is required for security review.");
  if (!inspection) throw new Error("Repository inspection is required for security review.");
  assertActionAllowed(ACTIONS.ANALYZE_CODE);

  const findings = [];
  for (const item of inspection.analyzedContents || []) findings.push(...scanText(item.path, item.content));

  let next = markStep(plan, "security", "running");
  for (const finding of findings) next = addEvidence(next, finding);

  if (findings.length === 0) {
    next = addEvidence(next, {
      classification: "NO EVIDENCE FOUND",
      claim: "No high-risk pattern was detected in the bounded content sample; this is not proof of security.",
      source: "bounded static security scan"
    });
  }

  next = markStep(next, "security", "completed");
  return {
    plan: next,
    security: {
      status: findings.length ? "review_required" : "no_high_risk_pattern_observed",
      findings,
      methodology: "bounded-pattern-scan-v1",
      disclaimer: "This is not a complete security audit and cannot establish absence of vulnerabilities."
    }
  };
}
