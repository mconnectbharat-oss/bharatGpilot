# Action Audit Log

BharatGPilot now emits an audit record for a verified action receipt.

Each record binds the action id, actor, action type, receipt hash, repository state, branch state, outcome, and resulting pull request metadata. The record itself receives a SHA-256 hash so an audit consumer can detect mutation.

## Store contract

The runtime accepts an injected audit store with:

- `append(record)`
- optional `hasReceipt(receiptHash)`
- optional `list()`

The included in-memory store is intended for tests and single-process development only. It is **not durable storage** and must not be treated as a production audit database.

Production deployments should provide a shared durable append-only store (for example, a transactional database) and enforce a unique constraint on `receiptHash`. The action flow claims the receipt before an irreversible PR operation; a second instance therefore cannot authorize the same receipt concurrently. For `createPr=true`, the claim is intentionally retained even if the downstream GitHub action fails, because releasing it after an irreversible external operation could enable replay.

GitHub branch heads and pull-request creation are independently re-checked by the action gateway. This keeps the application-level audit record separate from GitHub's own authorization and branch state.
