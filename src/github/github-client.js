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
      Authorization: "Bearer " + (options.token || tokenFromEnv()),
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || "GitHub request failed (" + response.status + ")");
  return data;
}

export async function getRepository(owner, repo, token) {
  return githubRequest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo), { token });
}

export async function getRepositoryRef(owner, repo, ref, token) {
  return githubRequest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/git/ref/heads/" + encodeURIComponent(ref), { token });
}

export async function compareRepositoryRefs(owner, repo, base, head, token) {
  return githubRequest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/compare/" + encodeURIComponent(base) + "..." + encodeURIComponent(head), { token });
}

export async function getRepositoryContents(owner, repo, path = "", token) {
  return githubRequest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/contents/" + path.split("/").map(encodeURIComponent).join("/"), { token });
}

export async function getRepositoryBlob(owner, repo, fileSha, token) {
  return githubRequest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/git/blobs/" + encodeURIComponent(fileSha), { token });
}

export async function getRepositoryTree(owner, repo, treeSha, token) {
  const encodedTree = encodeURIComponent(treeSha);
  return githubRequest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/git/trees/" + encodedTree + "?recursive=1", { token });
}

export async function getRepositoryReadme(owner, repo, token) {
  return githubRequest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/readme", { token });
}

export async function getRepositoryIssues(owner, repo, token) {
  return githubRequest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/issues?state=all&per_page=20", { token });
}

export async function getRepositoryPulls(owner, repo, token) {
  return githubRequest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/pulls?state=all&per_page=20", { token });
}

export async function getRepositoryReleases(owner, repo, token) {
  return githubRequest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/releases?per_page=20", { token });
}

export async function getCommitCheckRuns(owner, repo, ref, token) {
  return githubRequest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/commits/" + encodeURIComponent(ref) + "/check-runs?filter=latest&per_page=100", { token });
}
