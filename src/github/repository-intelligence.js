import { getRepository, getRepositoryContents, getRepositoryReadme, getRepositoryIssues, getRepositoryPulls, getRepositoryReleases } from "./github-client.js";
import { createEvidence, EVIDENCE_CLASSES } from "../evidence/index.js";

export function parseRepositoryRef(value) {
  const match = String(value || "").trim().match(/^([^/]+)\/([^/]+)$/);
  if (!match) throw new Error("Repository must use owner/name format.");
  return { owner: match[1], repo: match[2] };
}

function issueEvidence(owner, repo, issues, pulls, releases) {
  return [
    createEvidence({
      claim: "GitHub directly returned repository issue data.",
      classification: EVIDENCE_CLASSES.DIRECT,
      sources: [{ type: "github_api", location: "/repos/" + owner + "/" + repo + "/issues" }]
    }),
    createEvidence({
      claim: "GitHub directly returned repository pull request data.",
      classification: EVIDENCE_CLASSES.DIRECT,
      sources: [{ type: "github_api", location: "/repos/" + owner + "/" + repo + "/pulls" }]
    }),
    createEvidence({
      claim: "GitHub directly returned repository release data.",
      classification: EVIDENCE_CLASSES.DIRECT,
      sources: [{ type: "github_api", location: "/repos/" + owner + "/" + repo + "/releases" }]
    })
  ];
}

export async function inspectRepository(repository) {
  const { owner, repo } = parseRepositoryRef(repository);
  const metadata = await getRepository(owner, repo);
  const root = await getRepositoryContents(owner, repo);
  const [readme, issues, pulls, releases] = await Promise.all([
    getRepositoryReadme(owner, repo).catch(() => null),
    getRepositoryIssues(owner, repo),
    getRepositoryPulls(owner, repo),
    getRepositoryReleases(owner, repo)
  ]);
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

  if (!readme) {
    evidence.push(createEvidence({
      claim: "A repository README could not be retrieved from the GitHub API.",
      classification: EVIDENCE_CLASSES.NO_EVIDENCE_FOUND,
      sources: [{ type: "github_api", location: "/repos/" + owner + "/" + repo + "/readme" }]
    }));
  } else {
    evidence.push(createEvidence({
      claim: "GitHub directly returned the repository README.",
      classification: EVIDENCE_CLASSES.DIRECT,
      sources: [{ type: "github_api", location: "/repos/" + owner + "/" + repo + "/readme" }]
    }));
  }

  evidence.push(...issueEvidence(owner, repo, issues, pulls, releases));

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
    readmeAvailable: Boolean(readme),
    issues: issues.filter((item) => !item.pull_request).map(({ number, title, state, created_at, updated_at }) => ({ number, title, state, created_at, updated_at })),
    pullRequests: pulls.map(({ number, title, state, draft, created_at, updated_at }) => ({ number, title, state, draft, created_at, updated_at })),
    releases: releases.map(({ tag_name, name, draft, prerelease, published_at }) => ({ tag_name, name, draft, prerelease, published_at })),
    evidence
  };
}
