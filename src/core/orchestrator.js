import { createEvidence, EVIDENCE_CLASSES } from "../evidence/index.js";

export const AGENTS = Object.freeze([
  "planner",
  "researcher",
  "repository_analyst",
  "coding_agent",
  "tester",
  "security_reviewer",
  "final_reviewer"
]);

export function createInvestigationPlan(request) {
  if (typeof request !== "string" || !request.trim()) throw new Error("A non-empty investigation request is required.");
  return {
    request: request.trim(),
    status: "planned",
    steps: [
      { id: "understand", agent: "planner", status: "pending" },
      { id: "research", agent: "researcher", status: "pending" },
      { id: "repository", agent: "repository_analyst", status: "pending" },
      { id: "implementation", agent: "coding_agent", status: "pending" },
      { id: "tests", agent: "tester", status: "pending" },
      { id: "security", agent: "security_reviewer", status: "pending" },
      { id: "verification", agent: "final_reviewer", status: "pending" }
    ],
    evidence: []
  };
}

export function addEvidence(plan, input) {
  return { ...plan, evidence: [...plan.evidence, createEvidence(input)] };
}

export function markStep(plan, stepId, status) {
  const allowed = new Set(["pending", "running", "completed", "blocked"]);
  if (!allowed.has(status)) throw new Error("Invalid step status.");
  const found = plan.steps.some((step) => step.id === stepId);
  const steps = found
    ? plan.steps.map((step) => step.id === stepId ? { ...step, status } : step)
    : [...plan.steps, { id: stepId, agent: stepId, status }];
  return { ...plan, steps, status: steps.some((s) => s.status === "blocked") ? "blocked" : plan.status };
}

export function verificationSummary(plan) {
  return {
    direct: plan.evidence.filter((e) => e.classification === EVIDENCE_CLASSES.DIRECT).length,
    indirect: plan.evidence.filter((e) => e.classification === EVIDENCE_CLASSES.INDIRECT).length,
    noEvidence: plan.evidence.filter((e) => e.classification === EVIDENCE_CLASSES.NO_EVIDENCE_FOUND).length,
    incompleteSteps: plan.steps.filter((step) => step.status !== "completed").length
  };
}
