const ALLOWED_NETWORK_MODES = new Set(["disabled"]);
const ALLOWED_ISOLATION = new Set(["container", "vm"]);

export const RUNTIME_STATUS = Object.freeze({
  READY: "ready",
  UNAVAILABLE: "unavailable",
  REJECTED: "rejected"
});

export function createRuntimeContract(options = {}) {
  const isolation = options.isolation;
  const network = options.network ?? "disabled";
  const credentials = options.credentials ?? "none";
  const ephemeral = options.ephemeral ?? true;
  const maxDurationMs = Math.min(Math.max(options.maxDurationMs ?? 120_000, 1_000), 120_000);

  if (!ALLOWED_ISOLATION.has(isolation)) {
    return Object.freeze({ status: RUNTIME_STATUS.UNAVAILABLE, reason: "ISOLATED_RUNTIME_REQUIRED" });
  }
  if (!ALLOWED_NETWORK_MODES.has(network) || credentials !== "none" || ephemeral !== true) {
    return Object.freeze({ status: RUNTIME_STATUS.REJECTED, reason: "RUNTIME_SECURITY_CONTRACT_VIOLATION" });
  }

  return Object.freeze({
    status: RUNTIME_STATUS.READY,
    isolation,
    network,
    credentials,
    ephemeral,
    maxDurationMs,
    filesystem: "workspace-only",
    cleanup: "mandatory"
  });
}

export function assertRuntimeContract(contract) {
  if (!contract || contract.status !== RUNTIME_STATUS.READY) {
    throw new Error(contract?.reason || "A compliant isolated runtime is required.");
  }
  return contract;
}

export function createRuntimeAdapter({ contract, execute } = {}) {
  assertRuntimeContract(contract);
  if (typeof execute !== "function") throw new Error("An isolated runtime execute function is required.");

  return Object.freeze({
    contract,
    async run(request = {}) {
      return execute(Object.freeze({ ...request, contract }));
    }
  });
}
