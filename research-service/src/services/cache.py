"""Tenant-scoped, best-effort Redis cache for completed model responses.

Caching is optional: if Redis is absent or unavailable, inference continues without
using cached data. Cache keys are SHA-256 digests and never contain raw prompts.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from typing import Any

logger = logging.getLogger(__name__)


class ResponseCacheService:
    def __init__(self, redis_client: Any | None = None, default_ttl: int | None = None):
        self.default_ttl = max(1, min(int(default_ttl or os.getenv("BGP_RESPONSE_CACHE_TTL", "300")), 86400))
        self.enabled = os.getenv("BGP_RESPONSE_CACHE_ENABLED", "true").strip().lower() not in {"0", "false", "no", "off"}
        self.redis = redis_client
        if self.enabled and self.redis is None:
            redis_url = os.getenv("BGP_REDIS_URL", "").strip()
            if redis_url:
                try:
                    from redis.asyncio import Redis
                    self.redis = Redis.from_url(redis_url, decode_responses=True, socket_connect_timeout=0.5, socket_timeout=0.5)
                except Exception as exc:
                    logger.warning("Response cache unavailable (%s)", type(exc).__name__)

    @staticmethod
    def _generate_cache_key(
        user_id: str,
        model: str,
        prompt: str,
        system_instruction: str = "",
        parameters: dict[str, Any] | None = None,
    ) -> str:
        # Preserve case and wording; normalize only whitespace and Unicode.
        normalized_prompt = re.sub(r"\\s+", " ", prompt).strip()
        material = json.dumps(
            {
                "version": 1,
                "tenant": user_id,
                "model": model,
                "prompt": normalized_prompt,
                "system_instruction": system_instruction,
                "parameters": parameters or {},
            },
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        digest = hashlib.sha256(material.encode("utf-8")).hexdigest()
        return f"bgp:response-cache:v1:{digest}"

    async def get_cached_response(
        self, user_id: str, model: str, prompt: str, system_instruction: str = "",
        parameters: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        if not self.enabled or self.redis is None:
            return None
        key = self._generate_cache_key(user_id, model, prompt, system_instruction, parameters)
        try:
            cached = await self.redis.get(key)
            if not cached:
                return None
            value = json.loads(cached)
            if not isinstance(value, dict) or not isinstance(value.get("content"), str):
                await self.redis.delete(key)
                return None
            return value
        except Exception as exc:
            logger.warning("Response cache read failed; continuing uncached (%s)", type(exc).__name__)
            return None

    async def set_response_cache(
        self, user_id: str, model: str, prompt: str, response_payload: dict[str, Any],
        system_instruction: str = "", parameters: dict[str, Any] | None = None,
        ttl: int | None = None,
    ) -> None:
        if not self.enabled or self.redis is None:
            return
        if not isinstance(response_payload.get("content"), str) or not response_payload["content"].strip():
            return
        key = self._generate_cache_key(user_id, model, prompt, system_instruction, parameters)
        target_ttl = max(1, min(int(ttl if ttl is not None else self.default_ttl), 86400))
        try:
            await self.redis.set(key, json.dumps(response_payload, ensure_ascii=False), ex=target_ttl)
        except Exception as exc:
            logger.warning("Response cache write failed; continuing uncached (%s)", type(exc).__name__)

    async def close(self) -> None:
        if self.redis is not None:
            closer = getattr(self.redis, "aclose", None) or getattr(self.redis, "close", None)
            if closer is not None:
                result = closer()
                if hasattr(result, "__await__"):
                    await result
