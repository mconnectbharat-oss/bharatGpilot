# Authentication and controlled orchestration

This implementation slice adds two security boundaries for BharatGPilot 2.0.

## Authentication

- Passwords use Node's built-in scrypt password hashing.
- Sessions use signed bearer tokens with HMAC-SHA256 and expiration.
- Protected routes can use the requireAuth middleware.
- Provider API keys remain server-side.
- Invalid credentials use one generic authentication error.

### Current limitation

The user/session store is process-local memory. This is intentionally a foundation implementation and deterministic test target. It is **not yet production-ready for multiple replicas or serverless instances**. A persistent identity/session adapter must be added before claiming production-ready authentication.

Required environment variable: AUTH_SESSION_SECRET (minimum 32 characters).

## Controlled orchestration

The orchestrator defines a deterministic sequence:

Planner → Researcher → Repository Analyst → Coding Agent → Tester → Security Reviewer → Final Reviewer

Agents are components invoked by the orchestrator; they do not create an uncontrolled swarm.

Evidence remains classified as DIRECT, INDIRECT, or NO EVIDENCE FOUND.

## Action policy

| Action | Default |
|---|---|
| Read public repository | automatic |
| Search repositories | automatic |
| Analyze code/issues | automatic |
| Run sandboxed tests | automatic |
| Create analysis report | automatic |
| Create branch | automatic |
| Create PR | approval |
| Merge PR | approval |
| Production deployment | approval |
| Destructive operation | blocked |

This policy is a control contract, not evidence that the corresponding GitHub or sandbox integrations already exist.
