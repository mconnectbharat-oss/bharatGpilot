# Sandbox Execution Adapter

The execution adapter composes three controlled stages:

1. Provision an ephemeral workspace.
2. Materialize a bounded GitHub repository snapshot.
3. Execute an allowlisted test command through the sandbox runner.
4. Always clean up the workspace in a `finally` block.

The adapter is deliberately explicit that a temporary directory is not equivalent to a container or VM. Production must provide OS/process/filesystem/network isolation before untrusted repository code is executed.

The adapter accepts dependency-injected stages so tests can verify lifecycle behavior without executing remote repository code.
