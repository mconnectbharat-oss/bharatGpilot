# Tester and Verification Agent

BharatGPilot's Tester agent is deliberately evidence-first.

## Current behavior

The agent derives a bounded test plan from repository inspection and can record an actual sandbox result when a sandbox runner is available.

It does **not** claim tests passed because a test script or tests directory exists.

The output uses:

- `execution: NOT_EXECUTED` when no sandbox workspace is connected.
- `passed` only when an execution result is supplied by a sandbox runner.
- `failed` only when a sandbox runner reports failure.
- `NO EVIDENCE FOUND` when execution did not occur.

## Sandbox boundary

Future sandbox integration must enforce `RUN_SANDBOXED_TESTS` and execute commands in an isolated workspace. Repository-provided commands must never run directly inside the orchestration process.

GitHub Actions results can also be imported as external verification evidence. A workflow definition alone is not proof that its tests passed.

## Next integration

Connect `src/sandbox/runner.js` to `recordTestResult`, then add the security reviewer before final review.
