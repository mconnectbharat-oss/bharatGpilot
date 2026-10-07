import test from "node:test";
import assert from "node:assert/strict";
import { buildDockerRunArgs, createDockerRuntimeContract } from "../src/sandbox/docker-runtime.js";

test("docker contract is isolated and credential-free", () => {
  const contract = createDockerRuntimeContract();
  assert.equal(contract.status, "ready");
  assert.equal(contract.isolation, "container");
  assert.equal(contract.network, "disabled");
  assert.equal(contract.credentials, "none");
});

test("docker arguments enforce sandbox hardening", () => {
  const args = buildDockerRunArgs({ workspacePath: "/tmp/workspace", command: "npm test", contract: createDockerRuntimeContract() });
  for (const value of ["--network", "none", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "--memory", "--cpus", "--mount"]) assert.ok(args.includes(value));
});

test("runtime command is passed as a single argv item", () => {
  const args = buildDockerRunArgs({ workspacePath: "/tmp/workspace", command: "node --test", contract: createDockerRuntimeContract() });
  assert.equal(args.at(-2), "sh");
  assert.equal(args.at(-1), "node --test");
});

test("Docker runtime rejects unpinned images", () => {
  const contract = createDockerRuntimeContract();
  assert.throws(() => buildDockerRunArgs({ image: "node:20-bookworm-slim", workspacePath: "/tmp/workspace", contract }), /immutable image digest/);
});

test("Docker runtime rejects non-allowlisted commands", () => {
  const contract = createDockerRuntimeContract();
  const image = "node:20-bookworm-slim@sha256:" + "a".repeat(64);
  assert.throws(() => buildDockerRunArgs({ image, workspacePath: "/tmp/workspace", command: "node -e process.exit(1)", contract }), /not allowed/);
});
