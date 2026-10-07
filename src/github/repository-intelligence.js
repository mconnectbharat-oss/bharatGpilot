import { getRepository, getRepositoryContents } from "./github-client.js";
import { createEvidence, EVIDENCE_CLASSES } from "../evidence/index.js";

export function parseRepositoryRef(value) {
  const match = String(value || "").trim().match(/^([^/]+)\/([^/]+)$/);
  if (!match) throw new Error("Repository must use owner/name format.");
  return { owner: match[1], repo: match[2] };
}

export async function inspectRepository(repository) {
  const { owner, repo } = parseRepositoryRef(repository);
  const metadata = await getRepository(owner, repo);
  const root = await getRepositoryContents(owner, repo);
  const entries = Array.isArray(root) ? root : [];
  const names = entries.map((entry) => entry.name);

  const evidence = [
    createEvidence({
      claim: "GitHub directly returned repository metadata.",
      classification: EVIDENCE_CLASSES.DIRECT,
      sources: [{ type: "github_api", location: "/repos/" + owner + "/" + repo }]
    }),
    createEvidence({
      claim: "Repository root contents were returned by GitHub.",
      classification: EVIDENCE_CLASSES.DIRECT,
      sources: [{ type: "github_api", location: "/repos/" + owner + "/" + repo + "/contents/" }]
    })
  ];

  if (!names.includes("README.md")) {
    evidence.push(createEvidence({
      claim: "README.md presence could not be verified at repository root.",
      classification: EVIDENCE_CLASSES.NO_EVIDENCE_FOUND,
      sources: [{ type: "github_api", location: "/repos/" + owner + "/" + repo + "/contents/" }]
    }));
  }

  return {
    repository: metadata.full_name,
    visibility: metadata.visibility,
    defaultBranch: metadata.default_branch,
    language: metadata.language,
    stars: metadata.stargazers_count,
    forks: metadata.forks_count,
    openIssues: metadata.open_issues_count,
    rootEntries: names,
    evidence
  };
}
