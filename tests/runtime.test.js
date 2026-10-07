import test from "node:test";
import assert from "node:assert/strict";
import { assertRuntimeContract, createRuntimeAdapter, createRuntimeContract, RUNTIME_STATUS } from "../src/sandbox/runtime.js";

test("runtime contract fails closed without container or VM isolation", () => {
  const contract = createRuntimeContract();
  assert.equal(contract.status, RUNTIME_STATUS.UNAVAILABLE);
  assert.equal(contract.reason, "ISOLATED_RUNTIME_REQUIRED");
});

test("runtime contract rejects credentials or network access", () => {
  assert.equal(createRuntimeContract({ isolation: "container", network: "enabled" }).status, RUNTIME_STATUS.REJECTED);
  assert.equal(createRuntimeContract({ isolation: "container", credentials: "github" }).status, RUNTIME_STATUS.REJECTED);
});

test("runtime adapter accepts only a compliant isolated contract", async () => {
  const contract = createRuntimeContract({ isolation: "container" });
  assert.equal(contract.status, RUNTIME_STATUS.READY);
  const adapter = createRuntimeAdapter({
    contract,
    execute: async ({ command }) => ({ status: "passed", command })
  });
  assert.deepEqual(await adapter.run({ command: "npm test" }), { status: "passed", command: "npm test" });
});

test("assertRuntimeContract rejects non-ready runtimes", () => {
  assert.throws(() => assertRuntimeContract({ status: RUNTIME_STATUS.UNAVAILABLE }));
});
