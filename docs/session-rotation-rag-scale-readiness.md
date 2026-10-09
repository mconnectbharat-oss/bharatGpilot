# Session rotation and RAG scale readiness

## Session rotation

BharatGPilot's web backend uses opaque, random session tokens stored as SHA-256 hashes in PostgreSQL and delivered through an HttpOnly `bgp_session` cookie. It does not use the proposed browser-held `bgp_token` JWT. The `POST /api/auth/refresh` endpoint rotates the opaque session token for an authenticated request and updates the database hash before setting the replacement cookie. The old token hash is no longer valid after a successful rotation.

The extension background worker must not decode a JWT or store a long-lived bearer token. Automatic background renewal is intentionally not enabled until the extension's cookie/CORS/session transport is verified end-to-end. The current CORS policy is based on `FRONTEND_URL`, and an extension origin is not automatically covered. Do not add an hourly refresh loop without a server-side renewal threshold: unconditional rotation would cause avoidable database writes and concurrent requests could race.

Before enabling the extension alarm:
1. Decide whether the extension will use a cookie-backed session or a narrowly scoped, revocable extension credential. Do not mix the two models.
2. Explicitly allow only the packaged extension origin in the relevant CORS policy if cookie-backed cross-origin requests are supported; retain credentials restrictions and test SameSite behavior in Chrome.
3. Make renewal idempotent or threshold-based (renew only near expiry), rate-limit it, and handle concurrent refreshes safely.
4. Test expired, revoked, concurrent, and network-failure cases. Network errors must not clear a still-valid session.
5. Keep `Cache-Control: no-store` on authentication responses and never log session tokens.

## PostgreSQL and vector indexing

The existing migrations already create:
- `sessions(token_hash)` as a unique index via the unique constraint, plus `sessions(user_id)` and `sessions(expires_at)` indexes.
- `conversations(user_id, updated_at DESC)`.
- `messages(conversation_id, created_at)`.
- `credit_ledger(user_id, created_at DESC)`.

The current RAG engine stores embeddings in Qdrant, not in PostgreSQL. It filters retrieval by `user_id` and creates a Qdrant keyword payload index for `user_id` and `document_id`. Therefore, a PostgreSQL IVFFlat/HNSW index on `credit_ledger.meta_data` would be invalid and must not be applied.

Do not add speculative GIN/vector indexes until the actual queried JSONB/vector columns and query plans are known. For production scale:
- Capture representative query plans with `EXPLAIN (ANALYZE, BUFFERS)` in staging.
- Confirm tenant filters are always applied from authenticated server identity, never request JSON.
- Measure Qdrant filter selectivity, collection size, latency percentiles, and recall before changing HNSW/index settings.
- Run index builds using an operational migration plan; use `CREATE INDEX CONCURRENTLY` where appropriate (it cannot run inside a transaction block).
- Avoid `CLUSTER` as a claimed continuous tenant optimization; it takes a table lock and physical order is not maintained automatically.

No production database commands are executed by this document.
