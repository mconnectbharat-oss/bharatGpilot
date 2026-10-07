import { createResearchPlan } from "./planner.js";
import { researchRepository } from "./researcher.js";
import { analyzeRepository } from "../agents/repository-analyst.js";

export async function runInvestigation({ request, repository } = {}, dependencies = {}) {
  const d = dependencies;
  const plan = (d.planner || createResearchPlan)({ request, repository });
  const researched = await (d.researcher || researchRepository)(plan);
  return (d.repositoryAnalyst || analyzeRepository)(researched.plan, researched.inspection);
}
