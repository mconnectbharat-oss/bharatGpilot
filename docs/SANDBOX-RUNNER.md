# Sandbox Runner

The Sandbox Runner is the execution boundary for BharatGPilot's Tester agent.

## Security contract

- Only explicitly allowlisted test commands may execute.
- Commands are spawned with `shell: false`; user/repository strings are not interpolated into a shell.
- The runner uses a bounded timeout and output limit.
- The execution environment is reduced to the minimum environment currently required by Node.
- Network isolation is a deployment requirement, not something this Node process can safely claim to provide by itself.
- A sandbox workspace must be supplied explicitly.

The runner currently allows only:

- `npm test`
- `node --test`

This is intentionally narrower than arbitrary `package.json` scripts.

## Important deployment boundary

This runner is a policy layer, not a complete VM/container isolation mechanism. Running untrusted repository code still requires an isolated, ephemeral execution environment with no credentials and restricted network access.

GitHub's security guidance warns that compromised runners can expose secrets and repository data, and recommends ephemeral isolation for untrusted code. citeturn0search0turn0search2

Therefore BharatGPilot should deploy this runner behind a disposable container/VM or equivalent sandbox before enabling autonomous execution of untrusted repositories.

## Verification semantics

A successful process exit produces a `passed` result. A non-zero exit or timeout produces `failed`. The caller must convert these into the existing evidence model; no execution result should be inferred from repository metadata.
