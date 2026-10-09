"""Async MongoDB connectivity monitor with bounded, atomic client replacement."""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

from pymongo import AsyncMongoClient
from pymongo.errors import PyMongoError

from src.services.chat_notifier import ChatNotifierService

logger = logging.getLogger(__name__)


class MongoSelfHealingWorker:
    def __init__(self, telemetry_bridge: Any, audit_store: Any) -> None:
        self.audit_store = audit_store
        self.uri = os.getenv("MONGODB_ATLAS_URI", "").strip()
        self.check_interval = max(5, int(os.getenv("MONGODB_HEALTH_CHECK_INTERVAL_SECONDS", "15")))
        self._bridge = telemetry_bridge
        self._healthy = False
        self._running = False
        self._task: asyncio.Task | None = None
        self._notifier = ChatNotifierService()
        self._failure_count = 0
        self._last_error: str | None = None

    @property
    def enabled(self) -> bool:
        return bool(self.uri)

    def status(self) -> dict[str, object]:
        return {
            "configured": self.enabled,
            "status": "connected" if self._healthy else ("disabled" if not self.enabled else "degraded"),
            "failure_count": self._failure_count,
            "last_error": self._last_error,
        }

    async def _emit(self, event_type: str, message: str) -> None:
        event = {
            "type": "database_recovery",
            "event_type": event_type,
            "system": "MongoDB-Atlas-Mesh",
            "message": message[:1000],
        }
        try:
            await self._bridge.broadcast_live_metric_packet(event)
        except Exception as exc:
            logger.debug("Recovery telemetry broadcast skipped (%s).", type(exc).__name__)
        await self._notifier.dispatch_unified_incident_report(
            "MongoDB-Atlas-Mesh", event_type, message[:1000]
        )

    async def check_once(self) -> bool:
        if not self.enabled:
            self._healthy = False
            return False
        try:
            if await self.audit_store.health_check():
                if not self._healthy:
                    self._healthy = True
                    self._failure_count = 0
                    self._last_error = None
                    await self._emit("recovery_success", "MongoDB Atlas audit-store connection is healthy again.")
                return True
        except Exception as exc:
            self._last_error = type(exc).__name__
            self._failure_count += 1
            if self._healthy or self._failure_count == 1:
                await self._emit(
                    "degradation_detected",
                    "MongoDB Atlas audit-store ping failed. Attempting to establish and verify a replacement connection.",
                )
            self._healthy = False
            logger.warning("MongoDB health check failed (%s).", type(exc).__name__)

        # The audit store swaps its live client only after the replacement has
        # passed ping, collection validation, and index checks.
        try:
            await self.audit_store.reconnect()
        except Exception as exc:
            self._last_error = type(exc).__name__
            self._failure_count += 1
            return False
        self._healthy = True
        self._last_error = None
        self._failure_count = 0
        await self._emit("recovery_success", "MongoDB Atlas audit-store client was safely replaced and verified.")
        return True

    async def start(self) -> None:
        if not self.enabled:
            logger.info("MongoDB health worker disabled: MONGODB_ATLAS_URI is not configured.")
            return
        if self._running:
            return
        self._running = True
        self._task = asyncio.current_task()
        delay = self.check_interval
        try:
            while self._running:
                await self.check_once()
                await asyncio.sleep(delay)
                delay = min(self.check_interval * 4, max(self.check_interval, delay))
                if not self._healthy:
                    delay = min(60, max(self.check_interval, delay * 2))
                else:
                    delay = self.check_interval
        except asyncio.CancelledError:
            raise
        finally:
            self._running = False

    async def stop(self) -> None:
        self._running = False
        self._healthy = False
