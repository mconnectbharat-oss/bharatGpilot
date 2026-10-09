"""Optional FastAPI sidecar exposing the LangGraph research workflow."""
from __future__ import annotations

import hmac
import json
import logging
import os
from typing import AsyncIterator

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from src.agents.research import research_agent

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

app = FastAPI(title="BharatGPilot Research Service", version="0.1.0")

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


async def require_research_token(authorization: str | None = Header(default=None)) -> None:
    expected = os.getenv("BGP_RESEARCH_API_TOKEN", "")
    if not expected:
        if os.getenv("ENVIRONMENT", "").lower() == "production":
            raise HTTPException(status_code=503, detail="Research authentication is not configured.")
        return
    supplied = authorization.removeprefix("Bearer ").strip() if authorization else ""
    if not supplied or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Authentication required.")


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
