# BharatGPilot 2.0 Architecture

## Positioning

**BharatGPilot — Your AI Copilot for Open Source**

Discover. Understand. Verify. Build. Contribute.

## Evidence-first operating principle

Important conclusions must carry an evidence classification:

- **DIRECT** — directly supported by repository, GitHub, execution, test, or other identified evidence.
- **INDIRECT** — a reasoned inference from available evidence; it must be presented as an inference.
- **NO EVIDENCE FOUND** — BharatGPilot could not verify the claim in the inspected scope. This does not mean the claim is false.

The system must preserve the distinction between observed evidence, inference, and conclusion.

## Controlled agent orchestration

Planner -> Researcher -> Repository Analyst -> Coding Agent -> Tester -> Security Reviewer -> Final Reviewer

The orchestrator owns sequencing, tool permissions, evidence collection, and final verification. Agents do not receive unrestricted access to all tools.

## GitHub action policy

| Action | Default |
|---|---|
| Read public repository | Automatic |
| Search repositories | Automatic |
| Analyze code/issues/PRs/releases | Automatic |
| Run isolated tests | Automatic |
| Generate report | Automatic |
| Create branch | Controlled |
| Modify code | Controlled |
| Create PR | Approval or configurable |
| Merge PR | Approval required |
| Production deployment | Approval required |
| Destructive operations | Blocked |

GitHub App permissions should follow least privilege and selected-repository access where appropriate.

## Initial module boundaries

- `src/evidence/` — evidence objects and summaries.
- `src/github/` — GitHub API and repository operations.
- `src/agents/` — specialized agents.
- `src/orchestrator/` — controlled workflow execution.
- `src/sandbox/` — isolated execution.
- `src/security/` — authorization, safety policy, and audit controls.
- `src/memory/` — user/project memory.
- `src/rag/` — repository/document retrieval.
- `tests/` — deterministic unit and integration tests.

This document describes the target architecture. A documented component is not evidence that the component is already implemented.
