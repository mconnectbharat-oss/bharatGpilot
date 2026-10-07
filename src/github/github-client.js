const API_BASE = "https://api.github.com";

function tokenFromEnv() {
  const token = process.env.GITHUB_TOKEN;
  if (!token || token.startsWith("your_")) throw new Error("GITHUB_TOKEN is not configured.");
  return token;
}

export async function githubRequest(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + tokenFromEnv(),
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || "GitHub request failed (" + response.status + ")");
  return data;
}

export async function getRepository(owner, repo) {
  return githubRequest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo));
}

export async function getRepositoryContents(owner, repo, path = "") {
  return githubRequest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/contents/" + path.split("/").map(encodeURIComponent).join("/"));
}

export async function getRepositoryTree(owner, repo, treeSha) {
  const encodedTree = encodeURIComponent(treeSha);
  return githubRequest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/git/trees/" + encodedTree + "?recursive=1");
}

export async function getRepositoryReadme(owner, repo) {
  return githubRequest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/readme");
}

export async function getRepositoryIssues(owner, repo) {
  return githubRequest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/issues?state=all&per_page=20");
}

export async function getRepositoryPulls(owner, repo) {
  return githubRequest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/pulls?state=all&per_page=20");
}

export async function getRepositoryReleases(owner, repo) {
  return githubRequest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/releases?per_page=20");
}
