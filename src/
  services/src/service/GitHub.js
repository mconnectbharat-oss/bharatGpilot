// GitHub service for BharatGPilot: a small, reusable client for GitHub's public REST API.
// Works without a token (60 requests/hour). Set GITHUB_TOKEN to raise the limit to 5000/hour.

const GITHUB_API = "https://api.github.com";

/* ---------- tiny TTL cache to save GitHub quota ---------- */
const cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.val;
  const val = await fn();
  cache.set(key, { val, exp: Date.now() + ttlMs });
  return val;
}

/* ---------- core request helper ---------- */
export async function gh(path, params = {}) {
  const url = new URL(GITHUB_API + path);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, String(v));
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "BharatGPilot/1.0",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message || `GitHub error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/* ---------- shapers: keep only what the app needs ---------- */
export const slimRepo = (r) => ({
  name: r.full_name,
  description: r.description,
  url: r.html_url,
  stars: r.stargazers_count,
  forks: r.forks_count,
  openIssues: r.open_issues_count,
  language: r.language,
  license: r.license?.spdx_id ?? null,
  topics: r.topics ?? [],
  updatedAt: r.updated_at,
});

export const slimIssue = (i) => ({
  number: i.number,
  title: i.title,
  url: i.html_url,
  labels: i.labels.map((l) => (typeof l === "string" ? l : l.name)),
  comments: i.comments,
  createdAt: i.created_at,
});

/* ---------- public functions ---------- */

// Search repositories by keyword, optionally filtered by language.
export async function searchRepos({ q, language, sort = "stars", page = 1 }) {
  if (!q) throw Object.assign(new Error("Search term 'q' is required"), { status: 400 });
  const query = language ? `${q} language:${language}` : q;
  const data = await cached(`search:${query}:${sort}:${page}`, 5 * 60_000, () =>
    gh("/search/repositories", { q: query, sort, order: "desc", per_page: 10, page })
  );
  return { total: data.total_count, items: data.items.map(slimRepo) };
}

// Most-starred repositories created in the last N days.
export async function getTrending({ language, days = 7 } = {}) {
  const span = Math.min(parseInt(days) || 7, 90);
  const since = new Date(Date.now() - span * 864e5).toISOString().slice(0, 10);
  const q = `created:>${since}${language ? ` language:${language}` : ""}`;
  const data = await cached(`trend:${q}`, 15 * 60_000, () =>
    gh("/search/repositories", { q, sort: "stars", order: "desc", per_page: 15 })
  );
  return { since, items: data.items.map(slimRepo) };
}

// Repo details + language breakdown + README excerpt (used as context for the AI).
export function getRepoBundle(owner, repo) {
  return cached(`repo:${owner}/${repo}`, 10 * 60_000, async () => {
    const [info, languages, readme] = await Promise.all([
      gh(`/repos/${owner}/${repo}`),
      gh(`/repos/${owner}/${repo}/languages`),
      gh(`/repos/${owner}/${repo}/readme`).catch(() => null),
    ]);
    const readmeExcerpt = readme
      ? Buffer.from(readme.content, "base64").toString("utf8").slice(0, 6000)
      : null;
    return { ...slimRepo(info), languages, defaultBranch: info.default_branch, readmeExcerpt };
  });
}

// Open issues (pull requests are filtered out), optionally by label.
export async function getIssues(owner, repo, label) {
  const issues = await cached(`issues:${owner}/${repo}:${label || ""}`, 5 * 60_000, () =>
    gh(`/repos/${owner}/${repo}/issues`, { state: "open", labels: label, per_page: 15 })
  );
  return issues.filter((i) => !i.pull_request).map(slimIssue);
}

// Beginner-friendly issues first; falls back to any open issues.
export async function getStarterIssues(owner, repo) {
  const starter = await getIssues(owner, repo, "good first issue");
  return starter.length ? starter : getIssues(owner, repo);
}

// Developer profile + most recently updated repos.
export async function getUser(username) {
  const [user, repos] = await Promise.all([
    cached(`user:${username}`, 10 * 60_000, () => gh(`/users/${username}`)),
    cached(`userrepos:${username}`, 10 * 60_000, () =>
      gh(`/users/${username}/repos`, { sort: "updated", per_page: 10 })
    ),
  ]);
  return {
    login: user.login,
    name: user.name,
    bio: user.bio,
    location: user.location,
    followers: user.followers,
    publicRepos: user.public_repos,
    url: user.html_url,
    recentRepos: repos.map(slimRepo),
  };
}