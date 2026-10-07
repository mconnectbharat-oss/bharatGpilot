import { createHash } from "node:crypto";
import { compareRepositoryRefs, getRepositoryContents } from "../github/github-client.js";

function normalizePath(path) { return String(path || "").replaceAll("\\", "/"); }

export async function verifyChangeManifest({ manifest, comparison, owner, repo, branchName, getContent = getRepositoryContents } = {}) {
  if (!manifest?.version || !Array.isArray(manifest.files)) throw new Error("A valid change manifest is required.");
  if (!comparison || comparison.too_large) return Object.freeze({ status:"UNVERIFIED", reason:"COMPARE_UNAVAILABLE", approved:[], unexpected:[], missing:[] });
  const approved = new Set(manifest.files.map((file) => normalizePath(file.path)));
  const files = comparison.files || [];
  const actual = files.map((file) => normalizePath(file.filename));
  const unsupported = files.filter((file) => !["added", "modified"].includes(file.status)).map((file) => normalizePath(file.filename));
  const unexpected = actual.filter((path) => !approved.has(path));
  const missing = [...approved].filter((path) => !actual.includes(path));
  if (unsupported.length > 0) return Object.freeze({ status: "MISMATCH", reason: "UNSUPPORTED_CHANGE_STATUS", approved: actual.filter((path) => approved.has(path)), unexpected, missing, unsupported });
  if (!owner || !repo || !branchName) return Object.freeze({ status: "UNVERIFIED", reason: "CONTENT_CONTEXT_REQUIRED", approved: actual.filter((path) => approved.has(path)), unexpected, missing, unsupported });
  for (const entry of manifest.files) {
    const content = await getContent(owner, repo, entry.path, branchName);
    const encoded = String(content?.content || "").replace(/\n/g, "");
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const digest = createHash("sha256").update(decoded, "utf8").digest("hex");
    if (digest !== entry.contentSha256 || Buffer.byteLength(decoded, "utf8") !== entry.bytes) return Object.freeze({ status: "MISMATCH", reason: "CONTENT_MISMATCH", path: entry.path, approved: actual.filter((path) => approved.has(path)), unexpected, missing, unsupported });
  }
  return Object.freeze({
    status: unexpected.length === 0 && missing.length === 0 ? "VERIFIED" : "MISMATCH",
    approved: actual.filter((path) => approved.has(path)), unexpected, missing,
    comparison: Object.freeze({ base: comparison.base, head: comparison.head, aheadBy: comparison.ahead_by ?? null, totalCommits: comparison.total_commits ?? null })
  });
}

export async function verifyBranchAgainstManifest({ owner, repo, baseRef, branchName, manifest, compare = compareRepositoryRefs } = {}) {
  if (!owner || !repo || !baseRef || !branchName) throw new Error("owner, repo, baseRef, and branchName are required.");
  const comparison = await compare(owner, repo, baseRef, branchName);
  return verifyChangeManifest({ manifest, comparison, owner, repo, branchName });
}
