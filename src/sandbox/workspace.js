import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const WORKSPACE_PREFIX = "bharatgpilot-";
const MAX_WORKSPACES = 1;

export async function provisionWorkspace({ root = tmpdir() } = {}) {
  const safeRoot = resolve(root);
  const path = await mkdtemp(join(safeRoot, WORKSPACE_PREFIX));
  return Object.freeze({
    path,
    lifecycle: "EPHEMERAL",
    credentials: "NONE",
    network: "DISABLED_BY_EXECUTION_CONTRACT",
    cleanup: async () => {
      await rm(path, { recursive: true, force: true });
    }
  });
}

export function createWorkspacePolicy() {
  return Object.freeze({
    maxConcurrentWorkspaces: MAX_WORKSPACES,
    lifecycle: "EPHEMERAL",
    credentials: "NONE",
    network: "DISABLED_BY_EXECUTION_CONTRACT",
    cleanupRequired: true
  });
}
