# BharatGPilot Research Service

Optional Python sidecar for evidence-oriented web research. It is separate from the existing Node.js API and does not replace existing routes.

## Local setup

Use Python 3.11+ in a virtual environment:

```bash
cd research-service
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Set environment variables in the service environment (never commit secrets):

- `FIRECRAWL_API_KEY`: required for web search/extraction.
- `BGP_RESEARCH_PLANNER_MODEL`: LiteLLM model ID or configured proxy alias; defaults to `openrouter/free`.
- `BGP_RESEARCH_SYNTHESIS_MODEL`: LiteLLM model ID or configured proxy alias; defaults to `openrouter/free`.
- Provider credentials / LiteLLM proxy settings required by the selected model.
- `BGP_RESEARCH_API_TOKEN`: recommended bearer token. In `ENVIRONMENT=production`, the service fails closed if this token is not configured.
- `BGP_RESEARCH_CORS_ORIGINS`: comma-separated exact origins if browser access is required.

Run locally with:

```bash
uvicorn main:app --app-dir research-service --host 127.0.0.1 --port 8100
```

The endpoint is `POST /api/v1/agent/research` with JSON `{"prompt":"..." }`; it returns Server-Sent Events. A health endpoint is available at `GET /health`.

## Security and integration notes

- This service is not yet wired into the existing Express authentication/session middleware. Do not expose it publicly or place a shared service token in browser-extension code. Route calls through an authenticated server-side proxy before production use.
- Firecrawl results are treated as untrusted text. The graph limits query count, result count, excerpt length, and total context size.
- Research model names are configurable; a model alias works only if it exists in the LiteLLM proxy configuration. Provider availability and price depend on that configuration.
- The stream reports graph stages and source URLs, then emits the final synthesis. It does not stream individual model tokens.
- Build, dependency resolution, live API behavior, and browser integration have not been verified in this change.


## Optional MongoDB security audit trail

MongoDB audit storage is disabled unless `MONGODB_ATLAS_URI` is configured. The service uses the supported PyMongo asynchronous client (Motor is deprecated in favor of PyMongo Async) and creates a bounded capped collection with timestamp, source-IP, and infraction-type indexes. Capped collections are append-only, so this implementation does not expose a resolution/update action.

Set `MONGODB_ATLAS_URI`, `MONGODB_AUDIT_DATABASE`, and `MONGODB_AUDIT_CAP_BYTES` in the private runtime environment. Start with the 256 MiB default and tune after estimating event volume and retention needs. Use a dedicated least-privilege database user; do not reuse an exporter/read-only account. The audit URI is passed only to the backend container, never to the browser.

To enable the private `GET /api/v1/super-admin/logs` endpoint, configure `BGP_AUDIT_ADMIN_TOKEN` to a long random secret. The endpoint requires `Authorization: Bearer <token>`; it does not trust email-domain claims or user-supplied role fields. Keep the research service on the private Compose network and route access through the authenticated server-side gateway. If the token is absent, the endpoint fails closed with 503. Audit event metadata is allowlisted; raw prompts and credentials are not stored.

Set `MONGODB_AUDIT_REQUIRED=true` only when the environment has been provisioned and an audit database outage should prevent the research service from starting. Otherwise, audit-store initialization failures are logged and normal service startup continues. Security audit write failures are best-effort and must be paired with external alerting/monitoring for high-assurance environments.

Tests (mocked; no Atlas connection or live email required):

```sh
python -m unittest discover -s tests -v
```

The existing Prometheus/Grafana stack is preserved. Atlas metrics exporting is intentionally not wired to the same application URI: use a separate read-only metrics database identity and verify the chosen exporter version/flags before enabling it. Do not put Atlas API keys or database credentials in the Compose file.
