"""Optional FastAPI sidecar exposing the LangGraph research workflow."""
from __future__ import annotations

import hmac
import json
import logging
import os
from typing import AsyncIterator

from fastapi import Depends, FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from pydantic import BaseModel, Field
from litellm import acompletion

from src.services.guardrails import PromptGuardrails
from src.services.alerts import SecurityAlertSystem
from src.services.normalization import IndicTextNormalizer
from src.services.cache import ResponseCacheService
from src.services.indic_router import AdvancedIndicRouter
from src.services.ws_bridge import telemetry_bridge
import time

from src.agents.research import research_agent
from fastapi import File, Form, UploadFile
from src.services.document_processor import (
    MAX_FILE_BYTES,
    DocumentProcessingError,
    process_and_index_document,
)
from src.services.rag_engine import RAGConfigurationError, RAGEngine


logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

app = FastAPI(title="BharatGPilot Research Service", version="0.1.0")
security_alerts = SecurityAlertSystem()
text_normalizer = IndicTextNormalizer()

HTTP_REQUESTS_TOTAL = Counter(
    "bharatgpilot_http_requests_total",
    "Total HTTP requests processed by the research service.",
    ["method", "endpoint", "status_code"],
)
INFERENCE_LATENCY = Histogram(
    "bharatgpilot_inference_latency_seconds",
    "Latency of non-streaming inference requests.",
    ["model", "status"],
)
MODEL_TOKENS_TOTAL = Counter(
    "bharatgpilot_model_tokens_total",
    "Provider-reported model tokens used by non-streaming inference.",
    ["model", "token_type"],
)


@app.middleware("http")
async def monitor_infrastructure_performance(request: Request, call_next):
    started = time.monotonic()
    status_code = "500"
    try:
        response = await call_next(request)
        status_code = str(response.status_code)
        return response
    finally:
        duration = time.monotonic() - started
        route = request.scope.get("route")
        endpoint = getattr(route, "path", "unmatched")
        HTTP_REQUESTS_TOTAL.labels(request.method, endpoint, status_code).inc()
        if endpoint == "/api/v1/chat/cached-inference":
            INFERENCE_LATENCY.labels("router-selected", status_code).observe(duration)
        # Send aggregate metadata only; never include request bodies, headers, or identities.
        try:
            await telemetry_bridge.broadcast_live_metric_packet({
                "type": "http_request",
                "method": request.method,
                "endpoint": endpoint,
                "status_code": int(status_code),
                "duration_seconds": round(duration, 4),
            })
        except Exception as exc:
            logger.debug("Telemetry broadcast skipped (%s)", type(exc).__name__)


@app.get("/metrics", include_in_schema=False)
async def expose_metrics_to_prometheus() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)



allowed_origins = [
    origin.strip()
    for origin in os.getenv("BGP_RESEARCH_CORS_ORIGINS", "").split(",")
    if origin.strip()
]
if allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=False,
        allow_methods=["POST", "GET", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept"],
    )


class ResearchRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=6000)


class MultilingualChatInput(BaseModel):
    prompt: str = Field(min_length=2, max_length=12000)


class CachedChatInput(BaseModel):
    prompt: str = Field(min_length=2, max_length=12000)


indic_router = AdvancedIndicRouter()
prompt_guardrails = PromptGuardrails()
response_cache = ResponseCacheService()


async def require_research_token(
    request: Request,
    authorization: str | None = Header(default=None),
) -> None:
    expected = os.getenv("BGP_RESEARCH_API_TOKEN", "")
    if not expected:
        if os.getenv("ENVIRONMENT", "").lower() == "production":
            raise HTTPException(status_code=503, detail="Research authentication is not configured.")
        return
    supplied = authorization.removeprefix("Bearer ").strip() if authorization else ""
    if not supplied or not hmac.compare_digest(supplied, expected):
        client_ip = request.client.host if request.client else "unknown"
        await security_alerts.record_auth_failure(client_ip, request.url.path)
        raise HTTPException(status_code=401, detail="Authentication required.")



@app.websocket(
    "/api/v1/telemetry/stream-bridge",
    dependencies=[Depends(require_research_token)],
)
async def handle_telemetry_websocket_bridge(websocket: WebSocket) -> None:
    """Internal-only telemetry bridge. Authenticate via Authorization header.

    Browser clients cannot attach this service token safely; connect through a
    trusted authenticated gateway. Do not pass credentials in query parameters.
    """
    await telemetry_bridge.register_admin_socket(websocket)
    try:
        while True:
            await websocket.receive_text()  # gateway heartbeat / connection lifecycle
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.debug("Telemetry WebSocket closed (%s)", type(exc).__name__)
    finally:
        await telemetry_bridge.sever_admin_socket(websocket)


@app.post("/api/v1/chat/multilingual-stream", dependencies=[Depends(require_research_token)])
async def execute_multilingual_stream(payload: MultilingualChatInput) -> StreamingResponse:
    """Internal streaming chat route with language policy selection.

    Keep this sidecar behind the trusted API gateway; do not expose its shared
    service token or call it directly from the browser extension.
    """
    prompt = prompt_guardrails.validate_and_sanitize_prompt("service-request", payload.prompt)
    prompt = text_normalizer.enforce_script_guardrails(prompt)
    language = indic_router.determine_priority_language(prompt)
    runtime = indic_router.generate_localized_runtime_package(prompt, language)

    async def event_generator() -> AsyncIterator[str]:
        models = [runtime["model"]]
        fallback_model = runtime.get("fallback_model", "")
        if fallback_model:
            models.append(fallback_model)

        for attempt, model in enumerate(models):
            emitted_content = False
            try:
                stream = await acompletion(
                    model=model,
                    messages=[
                        {"role": "system", "content": runtime["system_instruction"]},
                        {"role": "user", "content": prompt},
                    ],
                    stream=True,
                    timeout=float(os.getenv("BGP_CHAT_TIMEOUT_SECONDS", "60")),
                )
                async for chunk in stream:
                    choices = getattr(chunk, "choices", None) or []
                    if not choices:
                        continue
                    delta = getattr(choices[0], "delta", None)
                    text = getattr(delta, "content", None) if delta is not None else None
                    if not isinstance(text, str) or not text:
                        continue
                    if not emitted_content:
                        emitted_content = True
                        yield f"data: {json.dumps({'language': language, 'model': model})}\n\n"
                    yield f"data: {json.dumps({'delta': text}, ensure_ascii=False)}\n\n"

                if not emitted_content and attempt + 1 < len(models):
                    logger.warning("Model returned no content; trying configured fallback.")
                    continue
                if not emitted_content:
                    yield f"data: {json.dumps({'language': language, 'model': model})}\n\n"
                yield "data: [DONE]\n\n"
                return
            except Exception as exc:
                logger.warning("Multilingual model request failed (%s)", type(exc).__name__)
                # Retrying after output starts could duplicate or contradict streamed text.
                if not emitted_content and attempt + 1 < len(models):
                    continue
                yield f"data: {json.dumps({'error': 'Multilingual response failed. Check service configuration.'})}\n\n"
                yield "data: [DONE]\n\n"
                return

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )

@app.post("/api/v1/chat/cached-inference", dependencies=[Depends(require_research_token)])
async def execute_cached_inference(
    payload: CachedChatInput,
    x_bgp_user_id: str | None = Header(default=None),
) -> dict[str, object]:
    """Internal, tenant-scoped non-streaming inference with best-effort Redis caching.

    The trusted Express gateway must set X-BGP-User-ID from its authenticated session.
    Never accept this header directly from an untrusted browser or expose this sidecar.
    """
    if not x_bgp_user_id or not x_bgp_user_id.strip():
        raise HTTPException(status_code=401, detail="Authenticated user context required.")

    prompt = prompt_guardrails.validate_and_sanitize_prompt(x_bgp_user_id, payload.prompt)
    prompt = text_normalizer.enforce_script_guardrails(prompt)
    language = indic_router.determine_priority_language(prompt)
    runtime = indic_router.generate_localized_runtime_package(prompt, language)
    model = runtime["model"]
    system_instruction = runtime["system_instruction"]
    parameters = {"temperature": 0}

    cached = await response_cache.get_cached_response(
        x_bgp_user_id, model, prompt, system_instruction, parameters
    )
    if cached is not None:
        return {"source": "cache", "language": language, "model": model, "data": cached}

    try:
        response = await acompletion(
            model=model,
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt},
            ],
            temperature=0,
            timeout=float(os.getenv("BGP_CHAT_TIMEOUT_SECONDS", "60")),
        )
        choices = getattr(response, "choices", None) or []
        content = getattr(getattr(choices[0], "message", None), "content", None) if choices else None
        if not isinstance(content, str) or not content.strip():
            raise HTTPException(status_code=502, detail="The model returned an empty response.")
        usage = getattr(response, "usage", None)
        tokens = getattr(usage, "total_tokens", None) if usage is not None else None
        if isinstance(tokens, int) and tokens > 0:
            MODEL_TOKENS_TOTAL.labels(model, "total").inc(tokens)
        result = {"content": content, "tokens": tokens}
        await response_cache.set_response_cache(
            x_bgp_user_id, model, prompt, result, system_instruction, parameters
        )
        return {"source": "upstream", "language": language, "model": model, "data": result}
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Cached inference failed (%s)", type(exc).__name__)
        raise HTTPException(status_code=502, detail="Inference failed. Check service configuration.") from None


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "bharatgpilot-research"}


@app.post("/api/v1/agent/research", dependencies=[Depends(require_research_token)])
async def run_deep_research(request: ResearchRequest) -> StreamingResponse:
    initial_state = {
        "original_prompt": request.prompt.strip(),
        "search_queries": [],
        "scraped_raw_markdown": [],
        "sources": [],
        "final_synthesis": "",
        "iteration_count": 0,
    }

    async def event_generator() -> AsyncIterator[str]:
        try:
            async for update in research_agent.astream(initial_state, stream_mode="updates"):
                for node_name, state_update in update.items():
                    yield f"data: {json.dumps({'node': node_name, 'status': 'processing'})}\n\n"
                    if node_name == "scraper":
                        yield f"data: {json.dumps({'sources': state_update.get('sources', [])})}\n\n"
                    if node_name == "synthesizer":
                        yield f"data: {json.dumps({'result': state_update.get('final_synthesis', '')})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            logger.warning("Research workflow failed (%s)", type(exc).__name__)
            # Avoid returning provider errors, credentials, or internal stack traces to clients.
            yield f"data: {json.dumps({'error': 'Research workflow failed. Check service configuration and logs.'})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/v1/memo/documents", dependencies=[Depends(require_research_token)])
async def upload_memo_document(
    user_id: str = Form(min_length=1, max_length=256),
    document_id: str = Form(min_length=1, max_length=128),
    file: UploadFile = File(...),
) -> dict[str, object]:
    """Internal-service upload route; user_id must come from the trusted Express gateway.

    Never expose this shared-token-protected sidecar directly to the browser.
    The Express gateway must authenticate the user and supply req.user.id.
    """
    filename = (file.filename or "").strip()
    if not filename:
        raise HTTPException(status_code=400, detail="A filename is required.")
    try:
        content = await file.read(MAX_FILE_BYTES + 1)
        if len(content) > MAX_FILE_BYTES:
            raise HTTPException(status_code=413, detail="Files must be no larger than 10 MB.")
        engine = RAGEngine()
        try:
            await engine.ensure_collection_exists()
            result = await process_and_index_document(
                engine,
                user_id=user_id,
                document_id=document_id,
                filename=filename,
                content=content,
            )
            return {"status": "indexed", **result}
        finally:
            await engine.close()
    except DocumentProcessingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    except RAGConfigurationError:
        logger.exception("Memo RAG configuration error")
        raise HTTPException(status_code=503, detail="Memo indexing is not configured correctly.") from None
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Memo indexing failed (%s)", type(exc).__name__)
        raise HTTPException(status_code=502, detail="Document indexing failed. Check service configuration and logs.") from None
    finally:
        await file.close()
