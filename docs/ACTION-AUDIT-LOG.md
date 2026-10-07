# Action Audit Log

BharatGPilot now emits an audit record for a verified action receipt.

Each record binds the action id, actor, action type, receipt hash, repository state, branch state, outcome, and resulting pull request metadata. The record itself receives a SHA-256 hash so an audit consumer can detect mutation.

## Store contract

The runtime accepts an injected audit store with:

- `append(record)`
- optional `hasReceipt(receiptHash)`
- optional `list()`

The included in-memory store is intended for tests and single-process development only. It is **not durable storage** and must not be treated as a production audit database.

Production deployments should provide a shared durable append-only store (for example, a transactional database) and enforce a unique constraint on `receiptHash`. This prevents the same authorization receipt from being replayed as a second action.

GitHub branch heads and pull-request creation are independently re-checked by the action gateway. GitHub's REST API exposes branch refs as commit SHAs and requires write permissions to create references or pull requests. citeturn0search3turn0search1
