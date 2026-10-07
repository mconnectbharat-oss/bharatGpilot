import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { getRepository, getRepositoryBlob, getRepositoryTree } from "../github/github-client.js";

export const DEFAULT_FILE_LIMIT = 200;
export const MAX_FILE_BYTES = 1_000_000;

function assertSafePath(path) {
  if (!path || path.includes("\0") || path.startsWith("/") || path.split("/").includes("..")) {
    throw new Error("Repository path is not safe to materialize.");
  }
}

export function createMaterializationPolicy(options = {}) {
  return Object.freeze({
    maxFiles: Math.min(Math.max(options.maxFiles ?? DEFAULT_FILE_LIMIT, 1), DEFAULT_FILE_LIMIT),
    maxFileBytes: Math.min(Math.max(options.maxFileBytes ?? MAX_FILE_BYTES, 1024), MAX_FILE_BYTES)
  });
}

export async function materializeRepository({ owner, repo, ref, workspacePath, maxFiles, maxFileBytes } = {}) {
  if (!owner || !repo || !workspacePath) throw new Error("owner, repo, and workspacePath are required.");
  const policy = createMaterializationPolicy({ maxFiles, maxFileBytes });
  const metadata = await getRepository(owner, repo);
  const resolvedRef = ref || metadata.default_branch;
  const tree = await getRepositoryTree(owner, repo, resolvedRef);
  const files = (tree.tree || []).filter(entry =>
    entry.type === "blob" &&
    typeof entry.path === "string" &&
    !entry.path.includes("\0") &&
    !entry.path.startsWith("/") &&
    !entry.path.split("/").includes("..")
  );

  if (tree.truncated) {
    throw new Error("Repository tree is truncated; materialization requires a complete tree.");
  }
  if (files.length > policy.maxFiles) {
    throw new Error("Repository exceeds the sandbox materialization file limit.");
  }

  let materializedFiles = 0;
  for (const entry of files) {
    if (!entry.sha) continue;
    const blob = await getRepositoryBlob(owner, repo, entry.sha);
    const content = Buffer.from(blob.content || "", blob.encoding === "base64" ? "base64" : "utf8");
    if (content.length > policy.maxFileBytes) {
      throw new Error("Repository contains a file larger than the sandbox materialization limit.");
    }
    const destination = join(workspacePath, entry.path);
    const rootRelative = relative(workspacePath, destination);
    if (!rootRelative || rootRelative.startsWith(".." + sep) || rootRelative === "..") {
      throw new Error("Materialized path escaped the workspace.");
    }
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, content, { flag: "wx" });
    materializedFiles += 1;
  }

  return Object.freeze({
    owner,
    repo,
    ref: resolvedRef,
    materializedFiles,
    truncated: false,
    policy
  });
}
