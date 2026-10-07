import { spawn } from "node:child_process";

export const SANDBOX_COMMANDS = Object.freeze({
  "npm test": Object.freeze(["npm", ["test"]]),
  "node --test": Object.freeze(["node", ["--test"]])
});

export const DEFAULT_TIMEOUT_MS = 120000;
export const MAX_OUTPUT_BYTES = 200000;

function normalizeCommand(command) {
  const key = String(command || "").trim();
  if (!Object.hasOwn(SANDBOX_COMMANDS, key)) {
    throw new Error("Command is not allowed by the sandbox policy.");
  }
  return key;
}

export function createSandboxPolicy(options = {}) {
  return Object.freeze({
    network: "disabled-by-runner-contract",
    environment: "minimal",
    timeoutMs: Math.min(Math.max(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 1000), DEFAULT_TIMEOUT_MS),
    maxOutputBytes: Math.min(Math.max(options.maxOutputBytes ?? MAX_OUTPUT_BYTES, 1000), MAX_OUTPUT_BYTES),
    allowedCommands: Object.freeze(Object.keys(SANDBOX_COMMANDS))
  });
}

export function runSandboxedTest({ command = "npm test", cwd, timeoutMs, maxOutputBytes, workspacePolicy } = {}) {
  if (!cwd) throw new Error("A sandbox workspace directory is required.");

  const normalized = normalizeCommand(command);
  const policy = Object.freeze({
    ...createSandboxPolicy({ timeoutMs, maxOutputBytes }),
    workspaceLifecycle: workspacePolicy?.lifecycle || "UNKNOWN",
    credentials: workspacePolicy?.credentials || "UNKNOWN",
    network: workspacePolicy?.network || "disabled-by-runner-contract"
  });
  const [executable, args] = SANDBOX_COMMANDS[normalized];

  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env: {
        PATH: process.env.PATH || "",
        NODE_ENV: "test"
      },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let output = "";
    let truncated = false;
    const append = (chunk) => {
      if (output.length >= policy.maxOutputBytes) {
        truncated = true;
        return;
      }
      output += chunk.toString("utf8").slice(0, policy.maxOutputBytes - output.length);
      if (output.length >= policy.maxOutputBytes) truncated = true;
    };

    child.stdout.on("data", append);
    child.stderr.on("data", append);

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({
        status: "failed",
        command: normalized,
        exitCode: null,
        signal: "SIGKILL",
        timedOut: true,
        output,
        outputTruncated: truncated,
        policy
      });
    }, policy.timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        status: code === 0 ? "passed" : "failed",
        command: normalized,
        exitCode: code,
        signal,
        timedOut: false,
        output,
        outputTruncated: truncated,
        policy
      });
    });
  });
}
