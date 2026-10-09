"""Best-effort asynchronous incident notifications via configured HTTPS webhooks."""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)


def _webhook_url(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        return ""
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc:
        logger.error("%s must be an HTTPS URL; notifier disabled for this destination.", name)
        return ""
    return value


class ChatNotifierService:
    """Send bounded, sanitized events; never include credentials or user content."""

    def __init__(self) -> None:
        self.slack_webhook_url = _webhook_url("SLACK_MONITOR_WEBHOOK_URL")
        self.discord_webhook_url = _webhook_url("DISCORD_MONITOR_WEBHOOK_URL")
        self._timeout = httpx.Timeout(5.0, connect=2.0)

    async def _post(self, url: str, payload: dict) -> None:
        if not url:
            return
        try:
            async with httpx.AsyncClient(timeout=self._timeout, follow_redirects=False) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
        except Exception as exc:
            # Do not log the webhook URL or response body; they may contain secrets.
            logger.warning("Operational webhook delivery failed (%s).", type(exc).__name__)

    async def send_slack_alert(self, system: str, event_type: str, message: str) -> None:
        if not self.slack_webhook_url:
            return
        success = event_type == "recovery_success"
        payload = {
            "text": f"{'✅' if success else '🚨'} BharatGPilot: {event_type.replace('_', ' ').upper()}",
            "attachments": [{
                "color": "#10b981" if success else "#ef4444",
                "fields": [
                    {"title": "System", "value": system[:100], "short": True},
                    {"title": "UTC", "value": datetime.now(timezone.utc).isoformat(), "short": True},
                    {"title": "Details", "value": message[:1500], "short": False},
                ],
            }],
        }
        await self._post(self.slack_webhook_url, payload)

    async def send_discord_alert(self, system: str, event_type: str, message: str) -> None:
        if not self.discord_webhook_url:
            return
        success = event_type == "recovery_success"
        payload = {
            "username": "BharatGPilot Operations",
            "embeds": [{
                "title": f"{'✅' if success else '🚨'} {event_type.replace('_', ' ').upper()}",
                "description": message[:3500],
                "color": 0x10B981 if success else 0xEF4444,
                "fields": [{"name": "System", "value": system[:100], "inline": True}],
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "footer": {"text": "BharatGPilot infrastructure telemetry"},
            }],
        }
        await self._post(self.discord_webhook_url, payload)

    async def dispatch_unified_incident_report(self, system: str, event_type: str, message: str) -> None:
        results = await asyncio.gather(
            self.send_slack_alert(system, event_type, message),
            self.send_discord_alert(system, event_type, message),
            return_exceptions=True,
        )
        for result in results:
            if isinstance(result, Exception):
                logger.warning("Incident notification task failed (%s).", type(result).__name__)
