import { inspectRepository, parseRepositoryRef } from "./repository-intelligence.js";
import { analyzeRepositorySignals } from "./repository-analysis.js";
import { buildRepositoryBrief, answerRepositoryQuestion } from "./repository-brief.js";

export async function buildGitHubIntelligence(repository, question = "") {
  const ref = parseRepositoryRef(repository);
  const inspection = await inspectRepository(`${ref.owner}/${ref.repo}`);
  const analysis = analyzeRepositorySignals(inspection);
  const brief = buildRepositoryBrief(inspection, analysis);
  const response = question
    ? answerRepositoryQuestion(question, brief)
    : null;

  return {
    repository: brief.repository,
    ref: brief.ref,
    inspection,
    analysis,
    brief,
    response,
    sources: [
      `https://github.com/${ref.owner}/${ref.repo}`,
      `https://github.com/${ref.owner}/${ref.repo}/blob/${brief.ref}/README.md`
    ]
  };
}
