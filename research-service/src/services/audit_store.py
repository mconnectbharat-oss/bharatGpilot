"""Bounded MongoDB security audit storage.

Audit events are append-only. A capped collection provides bounded storage but
does not provide tamper-proof/WORM guarantees; export high-value events to a
separate immutable retention system if required by policy.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


class MongoDBAuditStore:
    COLLECTION_NAME = "audit_trails"

    def __init__(self) -> None:
        self.uri = os.getenv("MONGODB_ATLAS_URI", "").strip()
        self.database_name = os.getenv("MONGODB_AUDIT_DATABASE", "bharatgpilot_security_vault")
        self.collection_size_bytes = max(
            16 * 1024 * 1024,
            min(int(os.getenv("MONGODB_AUDIT_CAP_BYTES", str(256 * 1024 * 1024))), 5 * 1024**3),
        )
        self._client: Any = None
        self._collection: Any = None

    @property
    def enabled(self) -> bool:
        return bool(self.uri)

    async def initialize_audit_infrastructure(self) -> None:
        if not self.enabled:
            logger.warning("MongoDB audit store disabled: MONGODB_ATLAS_URI is not configured.")
            return
        try:
            from pymongo import ASCENDING, DESCENDING, IndexModel
            from pymongo import AsyncMongoClient
        except ImportError as exc:
            raise RuntimeError("Install the pymongo dependency to enable MongoDB audit storage.") from exc

        # Keep the active client alive until a candidate has pinged and all
        # required collection/index checks have completed successfully.
        candidate = AsyncMongoClient(
            self.uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            appname="BharatGPilot-SecurityAudit",
        )
        try:
            await candidate.admin.command("ping")
            db = candidate[self.database_name]
            names = await db.list_collection_names()
            if self.COLLECTION_NAME not in names:
                await db.create_collection(
                    self.COLLECTION_NAME,
                    capped=True,
                    size=self.collection_size_bytes,
                    max=1_000_000,
                )
            collection = db[self.COLLECTION_NAME]
            info = await db.command("collStats", self.COLLECTION_NAME)
            if not info.get("capped", False):
                raise RuntimeError(
                    "Existing audit_trails collection is not capped; migrate it deliberately before enabling audit writes."
                )
            await collection.create_indexes([
                IndexModel([("timestamp", DESCENDING)], name="audit_timestamp_desc"),
                IndexModel([("client_ip", ASCENDING), ("timestamp", DESCENDING)], name="audit_ip_timestamp"),
                IndexModel([("infraction_type", ASCENDING), ("timestamp", DESCENDING)], name="audit_type_timestamp"),
            ])
        except Exception:
            await candidate.close()
            raise

        old_client = self._client
        self._client = candidate
        self._collection = collection
        if old_client is not None:
            await old_client.close()
        logger.info("MongoDB security audit store initialized.")

    async def health_check(self) -> bool:
        if self._client is None or self._collection is None:
            return False
        await self._client.admin.command("ping")
        return True

    async def reconnect(self) -> None:
        await self.initialize_audit_infrastructure()

    async def close(self) -> None:
        if self._client is not None:
            await self._client.close()
            self._client = None
            self._collection = None

    async def log_security_alert(
        self,
        client_ip: str,
        infraction_type: str,
        metadata: dict[str, Any] | None = None,
    ) -> bool:
        if self._collection is None:
            return False
        safe_metadata = _safe_metadata(metadata or {})
        result = await self._collection.insert_one({
            "timestamp": datetime.now(timezone.utc),
            "client_ip": (client_ip or "unknown")[:64],
            "infraction_type": infraction_type[:100],
            "metadata": safe_metadata,
        })
        return result.inserted_id is not None

    async def query_security_logs(
        self,
        filters: dict[str, Any] | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> list[dict[str, Any]]:
        if self._collection is None:
            raise RuntimeError("MongoDB audit store is not configured or initialized.")
        page = max(1, page)
        page_size = max(1, min(page_size, 100))
        cursor = self._collection.find(filters or {}, projection={"metadata": 1, "timestamp": 1, "client_ip": 1, "infraction_type": 1}).sort(
            [("timestamp", -1), ("_id", -1)]
        ).skip((page - 1) * page_size).limit(page_size)
        logs = []
        async for document in cursor:
            document["_id"] = str(document["_id"])
            logs.append(document)
        return logs


def _safe_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    """Allow operational metadata only; never persist prompts or credentials."""
    allowed = {"target_endpoint", "reason_code", "status_code", "character_samples", "failure_count"}
    result: dict[str, Any] = {}
    for key in allowed:
        value = metadata.get(key)
        if isinstance(value, str):
            result[key] = value[:300]
        elif isinstance(value, int):
            result[key] = value
        elif isinstance(value, list):
            result[key] = [str(item)[:20] for item in value[:3]]
    return result
