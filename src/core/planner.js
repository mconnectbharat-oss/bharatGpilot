import { ACTIONS } from "./permissions.js";
import { createInvestigationPlan } from "./orchestrator.js";

const SIGNALS = Object.freeze({
  purpose: ["what does", "purpose", "overview", "understand"],
  health: ["healthy", "health", "quality", "maintainable", "risk"],
  contribution: ["contribute", "contribution", "work on", "first issue", "where should i"],
  code: ["code", "architecture", "structure", "implementation"],
  issues: ["issue", "bug", "backlog", "open issue"],
  pullRequests: ["pull request", "pr", "review"],
  releases: ["release", "version", "changelog"],
  security: ["security", "vulnerability", "secure"]
});

const EVIDENCE_ACTIONS = Object.freeze({
  purpose: [ACTIONS.READ_PUBLIC_REPOSITORY, ACTIONS.ANALYZE_CODE],
  health: [ACTIONS.READ_PUBLIC_REPOSITORY, ACTIONS.ANALYZE_CODE, ACTIONS.ANALYZE_ISSUES],
  contribution: [ACTIONS.READ_PUBLIC_REPOSITORY, ACTIONS.ANALYZE_CODE, ACTIONS.ANALYZE_ISSUES],
  code: [ACTIONS.READ_PUBLIC_REPOSITORY, ACTIONS.ANALYZE_CODE],
  issues: [ACTIONS.ANALYZE_ISSUES],
  pullRequests: [ACTIONS.ANALYZE_ISSUES],
  releases: [ACTIONS.READ_PUBLIC_REPOSITORY],
  security: [ACTIONS.READ_PUBLIC_REPOSITORY, ACTIONS.ANALYZE_CODE, ACTIONS.ANALYZE_ISSUES]
});

function requestedSignals(request) {
  const text = request.toLowerCase();
  const matches = Object.keys(SIGNALS).filter((signal) => SIGNALS[signal].some((term) => text.includes(term)));
  return matches.length ? matches : ["purpose", "health", "contribution"];
}

export function createResearchPlan({ request, repository = null } = {}) {
  if (typeof request !== "string" || !request.trim()) {
    throw new Error("A non-empty investigation request is required.");
  }

  const base = createInvestigationPlan(request);
  const signals = requestedSignals(request);
  const actions = [...new Set(signals.flatMap((signal) => EVIDENCE_ACTIONS[signal]))];

  return {
    ...base,
    repository: repository || null,
    planner: {
      version: "planner-v1",
      requestedSignals: signals,
      evidenceActions: actions,
      verificationRequired: true
    },
    research: {
      status: "ready",
      evidenceTargets: signals.map((signal) => ({
        signal,
        actions: EVIDENCE_ACTIONS[signal]
      }))
    }
  };
}
