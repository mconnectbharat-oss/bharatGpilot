import { createResearchPlan } from "./planner.js";
import { researchRepository } from "./researcher.js";
import { analyzeRepository } from "../agents/repository-analyst.js";
import { createTestPlan, recordTestResult } from "../agents/tester.js";
import { reviewSecurity } from "../agents/security-reviewer.js";
import { finalReview, actionDisposition } from "../agents/final-reviewer.js";
import { ACTIONS } from "./permissions.js";

export async function runInvestigation({ request, repository } = {}, dependencies = {}) {
  const d = dependencies;
  const plan = (d.planner || createResearchPlan)({ request, repository });
  const researched = await (d.researcher || researchRepository)(plan);
  const analyzed = await (d.repositoryAnalyst || analyzeRepository)(researched.plan, researched.inspection);
  const planned = (d.testPlanner || createTestPlan)(analyzed.plan, researched.inspection);
  const tested = (d.testRecorder || recordTestResult)(
    planned.plan,
    planned.testPlan,
    d.testResult || { status: "not_executed", claim: "Tests were not executed by the investigation pipeline.", source: "pipeline" }
  );
  const secured = (d.securityReviewer || reviewSecurity)(tested.plan, researched.inspection);
  const reviewed = (d.reviewer || finalReview)({
    plan: secured.plan,
    analysis: analyzed.analysis,
    testResult: tested.testResult,
    security: secured.security
  });
  const gate = (d.actionGate || actionDisposition)(reviewed.review, ACTIONS.CREATE_BRANCH);

  return {
    plan: reviewed.plan,
    analysis: analyzed.analysis,
    testPlan: planned.testPlan,
    testResult: tested.testResult,
    security: secured.security,
    review: reviewed.review,
    actionGate: gate,
    pipeline: {
      status: "completed",
      stages: ["planner","researcher","repository_analyst","tester","security_reviewer","final_reviewer","action_gate"]
    }
  };
}
