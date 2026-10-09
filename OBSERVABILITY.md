# Local container observability stack

This stack is a deployment template, not a production deployment. It builds the Python research service from `research-service/Dockerfile`, runs Qdrant without publishing its port, scrapes Prometheus metrics, and provisions a Grafana datasource and starter dashboard.

## Configure

1. Copy `.env.example` to `.env`.
2. Replace the service token, Qdrant API key, and Grafana password with independently generated secrets. Do not commit `.env`.
3. Add the provider credentials required by your selected LiteLLM model. Configure `BGP_RAG_EMBEDDING_MODEL` if you plan to use document indexing.
4. Run `docker compose config` to validate interpolation and then `docker compose up --build -d`.

The research API container is not published on a host port by this Compose file; connect it through a trusted API gateway on the Docker network. Prometheus and Grafana bind to `127.0.0.1` only. Qdrant has no published host port. The application network permits outbound provider calls; the monitoring network is internal.

## Endpoints

- Grafana: `http://127.0.0.1:3000`
- Prometheus: `http://127.0.0.1:9090`
- Internal research health: `http://research-service:4000/health`
- Internal Prometheus scrape: `http://research-service:4000/metrics`

Grafana provisions the Prometheus datasource and the `BharatGPilot Service Overview` dashboard automatically. The dashboard reports HTTP request rate, p95 inference latency, and provider-reported token rate. These are operational metrics, not a monetary billing ledger; model pricing and cached-response accounting still need to be reconciled with the billing ledger before reporting actual spend.

## Telemetry bridge

`/api/v1/telemetry/stream-bridge` is an internal WebSocket route authenticated with the service bearer token in the Authorization header. A browser cannot safely hold that shared token, so a trusted gateway must authenticate administrators and proxy the connection. Credentials must not be put in the WebSocket URL. The bridge sends only sanitized HTTP request metadata and runs in one Uvicorn worker; do not scale it horizontally until a shared pub/sub transport is added.

## Before production

- Pin image digests and scan images/dependencies in CI.
- Configure TLS and authenticated network access at the trusted gateway.
- Rotate secrets and keep them in the deployment secret manager.
- Confirm backups, storage capacity, retention, alert rules, and restore procedures.
- Validate Compose against the target Docker Compose version and run the CI test suite.
- Do not assume an image-size target such as 140 MB; actual size depends on the dependency wheel set and base image.
