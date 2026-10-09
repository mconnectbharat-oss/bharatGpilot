# IndicRouter and multilingual fallback

The internal FastAPI sidecar exposes `POST /api/v1/chat/multilingual-stream`. It is protected by the same service-token dependency as the research endpoints; route browser requests through a trusted server gateway and never expose `BGP_RESEARCH_API_TOKEN` to an extension.

## Language policy

The router supports Hindi (`hi`), Marathi (`mr`), Bengali (`bn`), Tamil (`ta`), Indian English (`en-in`), and Global English (`en-global`). Explicit language requests take precedence. Bengali and Tamil are recognized by distinct Unicode blocks. Hindi and Marathi share Devanagari, so automatic classification between them is heuristic; use an explicit language request when accuracy matters.

## Model configuration

Set model names to actual LiteLLM-compatible chat models on the sidecar only:

- `BGP_MODEL_NATIVE_INDIC`: primary model for Hindi, Marathi, Bengali and Tamil.
- `BGP_MODEL_NATIVE_INDIC_FALLBACK`: optional fallback for those four languages.
- `BGP_MODEL_INDIAN_EN` / `BGP_MODEL_INDIAN_EN_FALLBACK`: Indian English primary/fallback.
- `BGP_MODEL_GLOBAL_EN` / `BGP_MODEL_GLOBAL_EN_FALLBACK`: Global English primary/fallback.
- `BGP_DEFAULT_CHAT_MODEL`: default when a primary route is not configured (defaults to `openrouter/free`).
- `BGP_CHAT_TIMEOUT_SECONDS`: provider timeout (defaults to 60 seconds).

Fallback is opt-in and never silently chooses a different paid provider. Set each fallback only after confirming provider access, language quality, data handling and cost. The stream retries a configured fallback only before emitting response text; once text has been sent, it will not restart and risk duplicating or contradicting the answer.

## Provider compatibility caution

Do not configure `huggingface/ai4bharat/IndicTrans2-en-indic` as if it were a general chat-completion model without verifying the actual serving API: IndicTrans2 is a translation model, and `https://bhashini.gov.in` is not by itself a confirmed LiteLLM-compatible inference endpoint. Choose a verified chat-capable provider/model or build a dedicated translation adapter before production.

## Guardrails

The prompt guardrails reject blank/invalid identity input, strip control characters, bound prompt length, and optionally use atomic Redis `SET NX EX` duplicate suppression. They deliberately do not block broad phrases like “system prompt” using a brittle regex deny-list: that creates false positives and does not secure tools. Keep system instructions separate, treat quoted documents as untrusted data, enforce authorization independently, and configure Redis if duplicate suppression is required.

## Deployment status

This change does not deploy to production. The repository currently has no verified root production Dockerfile/Compose deployment target for this mixed Node.js + Python service. Add a deployment workflow only after the actual container build contexts, registry, target host/platform, health checks, secret names, and approval gate have been confirmed. A CI workflow should test the Python sidecar first.
