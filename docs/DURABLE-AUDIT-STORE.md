# Durable action receipt store

BharatGPilot uses PostgreSQL as the production persistence boundary for action receipts and audit state.

## Why PostgreSQL

The receipt claim is persisted with a primary-key/unique constraint on `receipt_hash`. PostgreSQL therefore provides the shared serialization boundary required when multiple BharatGPilot instances attempt the same action concurrently.

The persisted row contains the authorization receipt, actor, action id, lifecycle status, and audit record. A successful GitHub action transitions the receipt to `COMPLETED`.

## Configuration

Set one of:

- `DATABASE_URL`
- `POSTGRES_URL`

The application must not fall back to the in-memory store for autonomous production actions.

Run `ensureAuditSchema()` during deployment/migration, not on every request.

## Lifecycle

`CLAIMED -> AUTHORIZED -> COMPLETED`

A failed external GitHub action does **not** release an AUTHORIZED receipt. This prevents replay after an ambiguous external failure. Operational recovery must inspect the durable record and GitHub state before taking another action.

The in-memory store remains available for unit tests only.

PostgreSQL transactions and serialized writes provide the persistence/concurrency boundary; GitHub branch state is still independently verified before the action.

## Runtime wiring

When `createPr=true`, the verified change flow creates the PostgreSQL audit store automatically unless an explicit `dependencies.auditStore` is injected. Autonomous PR creation therefore fails closed when `DATABASE_URL`/`POSTGRES_URL` is not configured. Unit tests may inject the in-memory store.
