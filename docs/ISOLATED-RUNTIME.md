# Isolated Runtime Contract

BharatGPilot must never execute untrusted repository code merely because an ephemeral filesystem workspace exists.

A runtime is eligible only when all of these are true:

- **Isolation:** container or VM.
- **Ephemeral:** one execution lifecycle; no persistent workspace reuse.
- **Credentials:** none available to repository processes.
- **Network:** disabled by default.
- **Filesystem:** repository workspace only.
- **Duration:** bounded to at most 120 seconds by the contract.
- **Cleanup:** mandatory after execution.

The runtime adapter is intentionally provider-neutral. A production deployment can implement it with a hardened container runtime, microVM, or an equivalent isolated service. The adapter must report a compliant contract before execution is allowed.

GitHub's security guidance emphasizes ephemeral isolated compute for untrusted code and warns that ordinary persistent self-hosted runners do not provide that guarantee. See the project's security notes and GitHub's current secure-use guidance.
