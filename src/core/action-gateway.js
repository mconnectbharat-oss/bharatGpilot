import { githubRequest, getRepository, getRepositoryContents, getRepositoryRef } from "../github/github-client.js";
import { ACTIONS, assertActionAllowed } from "./permissions.js";
import { verifyActionReceipt } from "./action-receipt.js";

const MAX_FILES = 10;
const MAX_FILE_BYTES = 100_000;
const SENSITIVE_PREFIXES = [".github/workflows/", ".gitmodules"];
const SENSITIVE_FILES = new Set(["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml"]);

function assertSafePath(path) {
  if (!path || path.startsWith("/") || path.includes("\0") || path.split("/").includes("..")) throw new Error("Unsafe repository path.");
}

function assertVerified(review) {
  if (review?.decision !== "VERIFIED") throw new Error("A VERIFIED final review is required before autonomous code changes.");
}

function assertChangePolicy(path, approved = false) {
  assertSafePath(path);
  const normalized = path.replaceAll("\\", "/");
  if ((SENSITIVE_PREFIXES.some((prefix) => normalized.startsWith(prefix)) || SENSITIVE_FILES.has(normalized)) && !approved) {
    throw new Error("Sensitive repository changes require explicit approval.");
  }
}

function createManifest(changes) {
  if (!Array.isArray(changes) || changes.length === 0 || changes.length > MAX_FILES) throw new Error("Change manifest file limit exceeded.");
  const files = changes.map((change) => {
    if (!change?.path || typeof change.content !== "string" || !change.message) throw new Error("Each change requires path, content, and message.");
    assertChangePolicy(change.path, Boolean(change.approved));
    if (Buffer.byteLength(change.content, "utf8") > MAX_FILE_BYTES) throw new Error("Change manifest file size exceeded.");
    return Object.freeze({
      path: change.path,
      contentFingerprint: Buffer.from(change.content, "utf8").toString("base64"),
      bytes: Buffer.byteLength(change.content, "utf8"),
      message: change.message
    });
  });
  return Object.freeze({ version: 1, files: Object.freeze(files) });
}

function assertBranchName(branchName) {
  if (!/^[a-z0-9][a-z0-9._/-]{0,80}$/.test(branchName || "") || branchName.includes("..")) throw new Error("Unsafe branch name.");
}

export async function createActionBranch({ owner, repo, baseRef, branchName, review } = {}) {
  assertVerified(review);
  assertActionAllowed(ACTIONS.CREATE_BRANCH);
  if (!owner || !repo || !branchName) throw new Error("owner, repo, and branchName are required.");
  assertBranchName(branchName);
  const metadata = await getRepository(owner, repo);
  const sourceRef = baseRef || metadata.default_branch;
  const ref = await githubRequest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/git/ref/heads/" + encodeURIComponent(sourceRef));
  await githubRequest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/git/refs", {
    method: "POST",
    body: JSON.stringify({ ref: "refs/heads/" + branchName, sha: ref.object.sha }),
    headers: { "Content-Type": "application/json" }
  });
  return Object.freeze({ owner, repo, branchName, baseRef: sourceRef, baseSha: ref.object.sha });
}

export async function applyFileChange({ owner, repo, branchName, path, content, message, review, approved = false, expectedSha, expectedBranchSha, changeManifest } = {}) {
  assertVerified(review);
  assertActionAllowed(ACTIONS.CREATE_BRANCH);
  assertChangePolicy(path, approved);
  if (!expectedBranchSha) throw new Error("Expected branch SHA is required for optimistic concurrency.");
  const branchRef = await getRepositoryRef(owner, repo, branchName);
  if (branchRef?.object?.sha !== expectedBranchSha) throw new Error("Target branch changed since the action was planned.");
  if (typeof content !== "string" || !message) throw new Error("content and message are required.");

  let existing = null;
  try { existing = await getRepositoryContents(owner, repo, path, branchName); }
  catch (error) { if (!String(error.message).includes("Not Found")) throw error; }
  if (expectedSha && existing?.sha !== expectedSha) throw new Error("Repository file changed since the action was planned.");

  const payload = { message, content: Buffer.from(content, "utf8").toString("base64"), branch: branchName };
  if (existing?.sha) payload.sha = existing.sha;

  const result = await githubRequest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/contents/" + path.split("/").map(encodeURIComponent).join("/"), {
    method: "PUT", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" }
  });
  return Object.freeze({ path, branchName, commitSha: result.commit?.sha || null });
}

export function validateChangeManifest(changes) {
  return createManifest(changes);
}

export async function createActionPullRequest({ owner, repo, branchName, baseRef, title, body, review, approved = false, changeManifest, expectedBranchSha, actionReceipt, expectedAction = ACTIONS.CREATE_PR, expectedActorId } = {}) {
  assertVerified(review);
  assertActionAllowed(ACTIONS.CREATE_PR, { approved });
  if (!owner || !repo || !branchName || !title) throw new Error("owner, repo, branchName, and title are required.");
  if (!expectedBranchSha) throw new Error("Expected branch SHA is required before PR creation.");
  const receiptCheck = verifyActionReceipt(actionReceipt);
  if (receiptCheck.status !== "VERIFIED") throw new Error("Immutable action receipt is invalid.");
  if (actionReceipt.finalReview?.decision !== "VERIFIED" || actionReceipt.changeVerification?.status !== "VERIFIED") throw new Error("Action receipt does not contain verified authorization results.");
  if (actionReceipt.action !== expectedAction || (expectedActorId && actionReceipt.actorId !== expectedActorId)) throw new Error("Action receipt identity does not match the requested action.");
  if (JSON.stringify(actionReceipt.manifest) !== JSON.stringify(changeManifest)) throw new Error("Action receipt manifest does not match the requested manifest.");
  if (actionReceipt.repository.owner !== owner || actionReceipt.repository.repo !== repo || actionReceipt.repository.ref !== (baseRef || "main") || actionReceipt.branchName !== branchName || actionReceipt.branchHeadSha !== expectedBranchSha) throw new Error("Action receipt does not match the requested repository state.");
  const branchRef = await getRepositoryRef(owner, repo, branchName);
  if (branchRef?.object?.sha !== expectedBranchSha) throw new Error("Target branch changed after verification.");
  const baseRefState = await getRepositoryRef(owner, repo, baseRef || "main");
  if (baseRefState?.object?.sha !== actionReceipt.baseSha) throw new Error("Base branch changed since authorization.");
  if (!changeManifest?.version || !Array.isArray(changeManifest.files) || changeManifest.files.length === 0) throw new Error("A change manifest is required before PR creation.");
  const result = await githubRequest("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/pulls", {
    method: "POST",
    body: JSON.stringify({ title, body: body || "", head: branchName, base: baseRef || "main", draft: true }),
    headers: { "Content-Type": "application/json" }
  });
  return Object.freeze({ number: result.number, url: result.html_url, state: result.state, draft: result.draft, changeManifest, actionReceipt });
}
