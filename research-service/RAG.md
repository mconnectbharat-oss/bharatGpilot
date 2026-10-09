# Memo / RAG foundation

This is the retrieval foundation for the future Memo knowledge vault. It is
intentionally **not wired to an HTTP upload or chat route yet**: the existing
Express service owns user authentication, while this Python service currently
uses a separate shared service token. A browser-supplied `user_id` is not an
acceptable tenant identity. Before exposing RAG, add a server-side Express
proxy that validates the user's session and passes the trusted identity over
an authenticated private service connection.

## Local Qdrant

Set a strong local-only key, then start the optional Qdrant service:

```sh
export QDRANT_API_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
docker compose -f docker-compose.qdrant.yml up -d
```

On Windows PowerShell, set `$env:QDRANT_API_KEY` to a securely generated
random value before running Docker Compose. Do not commit the value. The
published HTTP port binds to loopback, and the service does not publish the
gRPC port.

Configure the Python service with:

- `QDRANT_URL=http://127.0.0.1:6333` for a host-run service; use
  `http://qdrant:6333` when both containers share a private Docker network.
- `QDRANT_API_KEY`: the same key used by Qdrant.
- `BGP_RAG_EMBEDDING_MODEL`: an explicitly chosen LiteLLM-compatible embedding
  model. No embedding model is silently selected because provider support,
  cost, and free-tier availability vary.
- `BGP_RAG_VECTOR_SIZE`: the exact dimension returned by the selected model
  (1536 is common for OpenAI text-embedding-3-small, but must not be assumed for
  other models).

Call `await RAGEngine.ensure_collection_exists()` during controlled service
startup before using the engine. Use `upsert_document_chunks` after validating
and extracting an allowed document type; use `retrieve_context` before
synthesis. The engine requires tenant and document identifiers, applies a
Qdrant user filter, checks returned tenant IDs again, and uses deterministic
UUID point IDs rather than Python's process-randomized `hash()`.

## Required work before production

- Integrate only behind existing Express `requireAuth`; derive tenant identity
  from `req.user.id`, never from request JSON.
- Add authenticated document upload/list/delete APIs with ownership checks,
  file-size/type limits, safe PDF/DOCX extraction, and document/chunk deletion.
- Ensure retrieved passages are untrusted reference data, not system instructions.
- Choose and test an embedding provider/model and dimension; confirm its cost and
  data-handling terms before indexing private documents.
- Add automated tests for tenant isolation, malformed embeddings, empty input,
  timeouts, and document lifecycle; verify actual Docker health and API behavior.
- Keep Qdrant private; do not expose port 6333 publicly or place its API key in
  the browser extension.
