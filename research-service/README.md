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
