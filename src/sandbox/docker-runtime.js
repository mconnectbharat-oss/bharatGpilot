import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { RUNTIME_STATUS, assertRuntimeContract, createRuntimeContract } from "./runtime.js";

const DEFAULT_IMAGE = process.env.BHARATGPILOT_DOCKER_IMAGE || "";
const ALLOWED_COMMANDS = Object.freeze({ "npm test": ["npm", ["test"]], "node --test": ["node", ["--test"]] });
const MAX_OUTPUT_BYTES = 200_000;

function assertPinnedImage(image) {
  if (!image || !/@sha256:[a-f0-9]{64}$/i.test(image)) throw new Error("Docker runtime requires an immutable image digest.");
  return image;
}

function normalizeCommand(command) {
  const key = String(command || "").trim();
  if (!Object.hasOwn(ALLOWED_COMMANDS, key)) throw new Error("Command is not allowed by the Docker sandbox policy.");
  return key;
}

function bounded(value, min, max, fallback) {
  return Math.min(Math.max(value ?? fallback, min), max);
}

export function createDockerRuntimeContract(options = {}) {
  return createRuntimeContract({ isolation: "container", network: "disabled", credentials: "none", ephemeral: true, maxDurationMs: bounded(options.maxDurationMs, 1000, 120000, 120000) });
}

export function buildDockerRunArgs({ image = DEFAULT_IMAGE, workspacePath, command = "npm test", contract } = {}) {
  assertRuntimeContract(contract);
  if (!workspacePath) throw new Error("workspacePath is required.");
  const pinnedImage = assertPinnedImage(image);
  const normalized = normalizeCommand(command);
  return ["run", "--rm", "--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "128", "--memory", "512m", "--cpus", "1", "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=64m", "--mount", `type=bind,src=${workspacePath},dst=/workspace,rw`, "--workdir", "/workspace", "--user", "65532:65532", "--env", "NODE_ENV=test", "--pull", "never", pinnedImage, "sh", "-lc", normalized === "npm test" ? "npm test" : "node --test"];
}

export async function runDockerRuntime({ workspacePath, command = "npm test", image = DEFAULT_IMAGE, contract = createDockerRuntimeContract() } = {}) {
  assertRuntimeContract(contract);
  const args = buildDockerRunArgs({ image: assertPinnedImage(image), workspacePath, command, contract });
  const containerName = `bharatgpilot-${randomUUID()}`;
  args.splice(1, 0, "--name", containerName);
  return await new Promise((resolve) => {
    const child = spawn("docker", args, { shell: false, env: { PATH: process.env.PATH || "" } });
    let output = ""; let timedOut = false;
    const append = (chunk) => { if (Buffer.byteLength(output) < MAX_OUTPUT_BYTES) output = (output + chunk.toString()).slice(0, MAX_OUTPUT_BYTES); };
    child.stdout.on("data", append); child.stderr.on("data", append);
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, contract.maxDurationMs);
    child.on("error", (error) => { clearTimeout(timer); resolve({ status: "not_executed", execution: "NOT_EXECUTED", reason: "DOCKER_RUNTIME_UNAVAILABLE", error: error.message }); });
    child.on("close", (exitCode, signal) => { clearTimeout(timer); resolve({ status: timedOut ? "failed" : exitCode === 0 ? "passed" : "failed", execution: "EXECUTED", exitCode, signal, timedOut, output, contract }); });
  });
}

export function createDockerRuntimeAdapter(options = {}) {
  const contract = createDockerRuntimeContract(options);
  assertPinnedImage(options.image || DEFAULT_IMAGE);
  if (contract.status !== RUNTIME_STATUS.READY) throw new Error(contract.reason);
  return Object.freeze({ contract, run: (request) => runDockerRuntime({ ...request, contract }) });
}