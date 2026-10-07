import { githubRequest, getRepository, getRepositoryContents } from "../github/github-client.js";
import { ACTIONS, assertActionAllowed } from "./permissions.js";

function assertSafePath(path) {
  if (!path || path.startsWith("/") || path.includes("\0") || path.split("/").includes("..")) {
    throw new Error("Unsafe repository path.");
  }
}

function assertVerified(review) {
  if (review?.decision !== "VERIFIED") {
    throw new Error("A VERIFIED final review is required before autonomous code changes.");
  }
}

export async function createActionBranch({ owner, repo, baseRef, branchName, review } = {}) {
  assertVerified(review);
  assertActionAllowed(ACTIONS.CREATE_BRANCH);
  if (!owner || !repo || !branchName) throw new Error("owner, repo, and branchName are required.");

  const metadata = await getRepository(owner, repo);
  const sourceRef = baseRef || metadata.default_branch;
  const ref = await githubRequest(
    "/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) +
    "/git/ref/heads/" + encodeURIComponent(sourceRef)
  );
  await githubRequest(
    "/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/git/refs",
    { method: "POST", body: JSON.stringify({ ref: "refs/heads/" + branchName, sha: ref.object.sha }), headers: { "Content-Type": "application/json" } }
  );
  return Object.freeze({ owner, repo, branchName, baseRef: sourceRef, baseSha: ref.object.sha });
}

export async function applyFileChange({ owner, repo, branchName, path, content, message, review } = {}) {
  assertVerified(review);
  assertActionAllowed(ACTIONS.CREATE_BRANCH);
  assertSafePath(path);
  if (typeof content !== "string" || !message) throw new Error("content and message are required.");

  let existing = null;
  try {
    existing = await getRepositoryContents(owner, repo, path);
  } catch (error) {
    if (!String(error.message).includes("Not Found")) throw error;
  }

  const payload = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch: branchName
  };
  if (existing?.sha) payload.sha = existing.sha;

  const result = await githubRequest(
    "/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/contents/" +
    path.split("/").map(encodeURIComponent).join("/"),
    { method: "PUT", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } }
  );

  return Object.freeze({ path, branchName, commitSha: result.commit?.sha || null });
}

export async function createActionPullRequest({ owner, repo, branchName, baseRef, title, body, review, approved = false } = {}) {
  assertVerified(review);
  assertActionAllowed(ACTIONS.CREATE_PR, { approved });
  if (!owner || !repo || !branchName || !title) throw new Error("owner, repo, branchName, and title are required.");

  const result = await githubRequest(
    "/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/pulls",
    {
      method: "POST",
      body: JSON.stringify({ title, body: body || "", head: branchName, base: baseRef || "main", draft: true }),
      headers: { "Content-Type": "application/json" }
    }
  );
  return Object.freeze({ number: result.number, url: result.html_url, state: result.state, draft: result.draft });
}
