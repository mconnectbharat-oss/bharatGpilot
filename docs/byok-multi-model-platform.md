# Bring-your-own-key multi-model platform

## Goal

BharatGPilot should let each authenticated user connect API credentials they are authorized to use, discover supported models, choose a model, and optionally let the router select among connected providers. This is a staged capability, not a claim that 1,000 providers/models are already integrated.

## Product principles

- **BYOK:** provider credentials belong to the individual user. Never ask for provider account passwords, cookies, or browser session tokens.
- **Server-side only:** never return a saved secret to the browser after it has been stored; never put provider secrets in client-side JavaScript, URLs, logs, analytics, or error responses.
- **Explicit consent and billing:** tell users that provider API billing and subscription entitlements are separate. Never silently switch a request to a paid provider or model.
- **Provider independence:** normalize supported chat requests and responses, but expose provider-specific capabilities and limitations rather than pretending every model supports the same features.
- **Verified catalogue:** distinguish provider-discovered models from curated, tested models. A model appearing in a catalogue does not prove that a user's key has access or that the model supports every capability.
- **Evidence and privacy:** only send the minimum task context to the selected provider; disclose when a task will be sent to multiple providers for review.

## Proposed architecture

1. **Credential vault** — authenticated CRUD for provider connections; encrypt secrets at rest with AES-256-GCM using a 32-byte key supplied through a deployment secret such as `USER_PROVIDER_KEYS_ENCRYPTION_KEY`. Store ciphertext, nonce, authentication tag, provider, user ID, key version, and timestamps. Do not store plaintext keys. Do not log request headers.
2. **Connection tester** — validate provider and key format, make a low-impact provider-specific test, return only status and sanitized errors, and never echo the key.
3. **Model registry** — combine curated metadata with provider discovery where supported. Store provider/model ID, capability flags, context limits only when sourced, status, and last-verified time. Do not hardcode daily quotas as guaranteed facts.
4. **Request gateway** — use the authenticated user's chosen credential, enforce provider/model allowlists, timeouts, input/output limits, and rate limits. User-supplied base URLs are not accepted by default to prevent SSRF.
5. **Smart router** — select models by task capability, user preference, provider health, latency, and budget. Explicit provider/model requests remain strict. Automatic fallback is permitted only within the user's configured allowed-provider and allowed-spend policy.
6. **Quality workflow** — optional parallel draft/review/finalize stages for complex tasks. Default to one model for ordinary requests to reduce latency and cost. Multi-model agreement is not proof of truth.
7. **Usage and controls** — track request count, latency, token usage where providers report it, errors, and estimated cost where reliable. Provide per-provider disable, key deletion, usage caps, and a clear free-only mode.
8. **Admin and operations** — tests, audit events without secrets, provider health monitoring, migration checks, and documented incident/key-rotation procedures.

## API shape (proposed, not yet implemented)

- `GET /api/pilot/connections` — list provider names and connection status; never return secrets.
- `POST /api/pilot/connections` — add a supported provider key over HTTPS; validate input and encrypt before storage.
- `POST /api/pilot/connections/:id/test` — test the saved connection.
- `DELETE /api/pilot/connections/:id` — delete the user's own connection.
- `GET /api/pilot/connections/:id/models` — list verified/discovered models accessible through that connection where the provider supports discovery.
- `GET /api/pilot/usage` — show usage and policy enforcement.
- Existing chat API can later accept a connection ID or routing policy; the server must verify ownership on every request.

## Delivery sequence

### Phase 1 — Safe credential storage
- Add a database migration for user-scoped provider connections.
- Add an encryption/decryption service using authenticated encryption and strict key validation.
- Add authenticated CRUD routes with ownership checks, input validation, redacted responses, and deletion.
- Add unit tests for encryption round trips, tamper detection, missing/invalid encryption configuration, provider allowlists, and secret redaction.
- Do not expose credential-management routes in production until the encryption secret is configured and tests pass.

### Phase 2 — Connection testing and model discovery
- Implement provider adapters one by one, starting with the existing OpenAI-compatible providers and then provider-specific APIs.
- Test only against the configured provider; never fall back during a connection test.
- Cache model discovery with a timestamp and label the source.

### Phase 3 — User-aware model routing
- Integrate a selected user's connection into the router without mutating process-wide environment variables.
- Preserve existing server-managed provider configuration as an optional platform fallback.
- Respect free-only mode and user-approved spend limits on every route.

### Phase 4 — Agent orchestration and quality evaluation
- Add optional plan/research/review/finalize workflows, with a maximum model-call budget, timeout, cancellation, and source-grounded evidence checks.
- Benchmark quality and latency on a reproducible test set before claiming measurable improvement.

### Phase 5 — Scale the catalogue
- Add providers through a tested adapter contract. Target broad coverage over time; do not claim 1,000 live integrations until the registry, tests, and connection paths prove that coverage.

## Acceptance criteria

- A user can only list, test, or delete their own provider connections.
- A saved secret is never included in API responses, logs, or error messages.
- Secrets cannot be decrypted without the configured encryption key; tampered ciphertext fails closed.
- Invalid providers, arbitrary URLs, oversized payloads, and unsupported models are rejected safely.
- Free-only mode cannot route to a paid connection or paid model.
- Provider failures and quota limits produce sanitized errors and bounded retries.
- Tests cover access control, encryption, provider routing, and fallback policy before production release.

## Current status

This document is a design and implementation plan. It does not mean BYOK credential storage, user-aware routing, dynamic discovery, or 1,000 model integrations are already implemented. The repository currently has a server-managed model router and catalogue; implementation should proceed incrementally on a feature branch and remain unmerged until validation passes.
