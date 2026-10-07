import { compareRepositoryRefs } from "./github-client.js";

function normalizePath(path) { return String(path || "").replaceAll("\\", "/"); }

export function verifyChangeManifest({ manifest, comparison } = {}) {
  if (!manifest?.version || !Array.isArray(manifest.files)) throw new Error("A valid change manifest is required.");
  if (!comparison || comparison.too_large) return Object.freeze({ status:"UNVERIFIED", reason:"COMPARE_UNAVAILABLE", approved:[], unexpected:[], missing:[] });
  const approved = new Set(manifest.files.map((file) => normalizePath(file.path)));
  const actual = (comparison.files || []).map((file) => normalizePath(file.filename));
  const unexpected = actual.filter((path) => !approved.has(path));
  const missing = [...approved].filter((path) => !actual.includes(path));
  return Object.freeze({
    status: unexpected.length === 0 && missing.length === 0 ? "VERIFIED" : "MISMATCH",
    approved: actual.filter((path) => approved.has(path)), unexpected, missing,
    comparison: Object.freeze({ base: comparison.base, head: comparison.head, aheadBy: comparison.ahead_by ?? null, totalCommits: comparison.total_commits ?? null })
  });
}

export async function verifyBranchAgainstManifest({ owner, repo, baseRef, branchName, manifest, compare = compareRepositoryRefs } = {}) {
  if (!owner || !repo || !baseRef || !branchName) throw new Error("owner, repo, baseRef, and branchName are required.");
  const comparison = await compare(owner, repo, baseRef, branchName);
  return verifyChangeManifest({ manifest, comparison });
}
