import { provisionWorkspace } from "./workspace.js";
import { materializeRepository } from "./materializer.js";
import { runSandboxedTest } from "./runner.js";

export async function executeRepositoryTests({ owner, repo, ref, command = "npm test", adapters = {} } = {}) {
  if (!owner || !repo) throw new Error("owner and repo are required.");

  if (adapters.isolatedRuntime !== true) {
    return Object.freeze({
      status: "not_executed",
      execution: "NOT_EXECUTED",
      reason: "ISOLATED_RUNTIME_UNAVAILABLE",
      contract: createExecutionContract()
    });
  }

  const workspace = await (adapters.provisionWorkspace || provisionWorkspace)();
  try {
    const materialization = await (adapters.materializeRepository || materializeRepository)({
      owner,
      repo,
      ref,
      workspacePath: workspace.path
    });

    const execution = await (adapters.runSandboxedTest || runSandboxedTest)({
      command,
      cwd: workspace.path,
      workspacePolicy: workspace
    });

    return Object.freeze({
      status: execution.status,
      materialization,
      execution,
      cleanup: "REQUIRED_AND_COMPLETED"
    });
  } finally {
    await workspace.cleanup();
  }
}

export function createExecutionContract() {
  return Object.freeze({
    source: "github",
    workspace: "ephemeral",
    credentials: "none",
    cleanup: "guaranteed",
    execution: "deployment-isolated-runtime-required"
  });
}
