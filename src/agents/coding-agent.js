import { ACTIONS, assertActionAllowed } from "../core/permissions.js";
import { createActionBranch, applyFileChange, createActionPullRequest, validateChangeManifest } from "../core/action-gateway.js";

const MAX_FILES = 10;
const MAX_FILE_BYTES = 100_000;

function assertVerified(review) {
  if (review?.decision !== "VERIFIED") throw new Error("A VERIFIED final review is required before coding actions.");
}

function validateChanges(changes = []) {
  if (!Array.isArray(changes) || changes.length === 0) throw new Error("At least one code change is required.");
  if (changes.length > MAX_FILES) throw new Error("Coding agent file limit exceeded.");
  for (const change of changes) {
    if (!change?.path || typeof change.content !== "string" || !change.message) {
      throw new Error("Each code change requires path, content, and message.");
    }
    if (Buffer.byteLength(change.content, "utf8") > MAX_FILE_BYTES) {
      throw new Error("Coding agent file size limit exceeded.");
    }
  }
  return changes;
}

export async function executeCodingPlan({ owner, repo, baseRef, branchName, changes, review, createPr = false, prTitle, prBody, approved = false } = {}) {
  assertVerified(review);
  assertActionAllowed(ACTIONS.CREATE_BRANCH);
  const safeChanges = validateChanges(changes);
  const changeManifest = validateChangeManifest(safeChanges);
  const branch = await createActionBranch({ owner, repo, baseRef, branchName, review });

  const commits = [];
  for (const change of safeChanges) {
    commits.push(await applyFileChange({ owner, repo, branchName: branch.branchName, path: change.path, content: change.content, message: change.message, review, approved: Boolean(change.approved), expectedSha: change.expectedSha }));
  }

  let pullRequest = null;
  if (createPr) {
    pullRequest = await createActionPullRequest({
      owner, repo, branchName: branch.branchName, baseRef: branch.baseRef,
      title: prTitle, body: prBody, review, approved, changeManifest
    });
  }

  return Object.freeze({ branch, changeManifest, commits, pullRequest });
}
