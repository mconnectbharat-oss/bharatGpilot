"""Process-local bridge for sanitized operational telemetry.

Only aggregate operational metadata is sent: never prompts, tokens, provider
responses, user IDs, or raw application logs. Keep one Uvicorn worker unless a
shared pub/sub transport is configured.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class TelemetryConnectionManager:
    def __init__(self) -> None:
        self.active_sockets: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def register_admin_socket(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self.active_sockets.add(websocket)

    async def sever_admin_socket(self, websocket: WebSocket) -> None:
        async with self._lock:
            self.active_sockets.discard(websocket)

    async def broadcast_live_metric_packet(self, metric_payload: dict[str, Any]) -> None:
        if not self.active_sockets:
            return
        frame = json.dumps(metric_payload, separators=(",", ":"), ensure_ascii=False)
        async with self._lock:
            sockets = tuple(self.active_sockets)
        results = await asyncio.gather(
            *(socket.send_text(frame) for socket in sockets),
            return_exceptions=True,
        )
        for socket, result in zip(sockets, results):
            if isinstance(result, Exception):
                logger.debug("Telemetry socket send failed (%s)", type(result).__name__)
                await self.sever_admin_socket(socket)


telemetry_bridge = TelemetryConnectionManager()
