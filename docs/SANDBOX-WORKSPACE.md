# Ephemeral Sandbox Workspace

BharatGPilot now has an explicit workspace lifecycle contract around sandbox execution.

## Guarantees

- Workspace is temporary and cleaned recursively after use.
- No provider credentials or GitHub credentials are placed in the workspace contract.
- Network access is declared disabled by the execution contract.
- Cleanup is required even when test execution fails.

This module provisions a filesystem workspace; it does **not** itself create an operating-system container or VM. The production deployment must enforce process, filesystem, network, and credential isolation outside this module.

GitHub recommends ephemeral clean environments for untrusted execution and warns that persistent self-hosted runners can be compromised by untrusted code. citeturn0search0turn0search4
