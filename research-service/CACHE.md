# Side-panel session recovery and response cache

## Extension session updates

`browser-extension/src/SidePanel.tsx` listens for changes to `chrome.storage.local.bgp_token`. Replacing a token updates only the session indicator; the message list, input draft, and current stream state are left untouched. Removing the token switches the indicator to guest and displays a sign-in-required notice.

This is a storage-change listener, not a token issuer or JWT verifier. It does not create or refresh credentials. The current backend's opaque `HttpOnly` cookie session and the extension's `bgp_token` bearer-token convention still need an end-to-end integration decision before claiming automatic session recovery is complete.

## Python response cache

The optional `ResponseCacheService` is used by the internal `POST /api/v1/chat/cached-inference` route in `research-service/main.py`.

Configuration:
- `BGP_REDIS_URL`: Redis URL for the async Redis client. If absent, caching is inactive.
- `BGP_RESPONSE_CACHE_ENABLED`: defaults to enabled; set to `false` to disable cache reads/writes.
- `BGP_RESPONSE_CACHE_TTL`: default TTL is 300 seconds; effective TTL is capped at 24 hours.
- `BGP_RESEARCH_API_TOKEN`: required in production for sidecar access.

The route requires `X-BGP-User-ID` from the trusted Express gateway. Do not expose the sidecar or let browser clients set this header directly. Cache keys are SHA-256 digests over tenant ID, selected model, normalized prompt, system instruction, and inference parameters. Tenant scoping prevents one user's cached answer from being served to another. Raw prompts are not included in Redis keys.

Redis is a best-effort optimization: connection/read/write failures fall back to normal inference. Empty model outputs are not cached. This implementation caches only the non-streaming sidecar route; the existing extension still calls the Express `/api/pilot/stream` route, so end-to-end cost savings require an explicit trusted-gateway integration. Do not cache responses across users or cache streaming output by concatenating partial frames.

## Verification status

Unit tests were added for cache round-trip, TTL, tenant isolation, key dimensions, prompt-key privacy, and Redis outage behavior. They have not been executed in this change. Before production rollout, test the gateway's authenticated user-ID forwarding, Redis connectivity/ACLs/TLS, cache-hit behavior, and response correctness in staging.
