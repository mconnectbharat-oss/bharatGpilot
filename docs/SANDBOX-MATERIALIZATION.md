# Repository Materialization

The sandbox materializer copies a bounded GitHub repository snapshot into an ephemeral workspace.

## Safety contract

- Only GitHub repository paths are accepted.
- Absolute paths and parent traversal are rejected.
- Truncated Git trees are rejected instead of silently producing a partial workspace.
- Materialization is bounded to 200 files and 1 MB per file by default.
- Files use exclusive-write semantics.
- The materializer never executes repository code.
- Execution still requires an isolated container, VM, or equivalent deployment boundary.

Materialization is source acquisition, not proof that execution is safe. GitHub recommends ephemeral isolation for untrusted code.
