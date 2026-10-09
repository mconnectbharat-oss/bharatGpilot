"""Low-cost input validation guardrails for model requests.

Injection detection is intentionally not a blanket deny-list: ordinary requests
about system prompts or security can be legitimate. Treat user content as data
in the model policy and apply authorization/tool permissions separately.
"""
from __future__ import annotations

import hashlib
import re
from typing import Any

from fastapi import HTTPException


_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")


class PromptGuardrails:
    def __init__(self, redis_client: Any | None = None, max_chars: int = 12_000):
        self.redis = redis_client
        self.max_chars = max(1, min(int(max_chars), 100_000))

    def validate_and_sanitize_prompt(self, user_id: str, prompt: str) -> str:
        if not isinstance(user_id, str) or not user_id.strip():
            raise HTTPException(status_code=401, detail="Authenticated user required.")
        if not isinstance(prompt, str):
            raise HTTPException(status_code=400, detail="Prompt must be text.")
        cleaned = _CONTROL_CHARS.sub("", prompt).strip()
        if len(cleaned) < 2:
            raise HTTPException(status_code=400, detail="Prompt payload is empty.")
        if len(cleaned) > self.max_chars:
            raise HTTPException(status_code=413, detail="Prompt exceeds the allowed size.")
        if self.redis is not None:
            # SHA-256 avoids retaining raw prompt text in Redis keys.
            digest = hashlib.sha256((user_id + "\0" + cleaned).encode("utf-8")).hexdigest()
            try:
                accepted = self.redis.set(f"bgp:prompt-dedupe:{digest}", "1", ex=4, nx=True)
            except Exception:
                # Fail closed: a configured dedupe service must not silently bypass limits.
                raise HTTPException(status_code=503, detail="Request protection is temporarily unavailable.") from None
            if not accepted:
                raise HTTPException(status_code=429, detail="Duplicate request throttled.")
        return cleaned
