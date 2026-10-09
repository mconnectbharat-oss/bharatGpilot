"""Rate-limited security email alerts for the research service.

Alerts contain operational metadata only. Raw prompts, tokens, and authorization
headers are never included. AWS credentials must be supplied by the runtime.
"""
from __future__ import annotations

import asyncio
import html
import logging
import os
import time
from collections import deque
from typing import Any

logger = logging.getLogger(__name__)


class SecurityAlertSystem:
    """Send SES alerts after repeated internal-service authentication failures."""

    def __init__(self, threshold: int = 5, window_seconds: int = 600) -> None:
        self.aws_region = os.getenv("AWS_REGION", "ap-south-1")
        self.sender_email = os.getenv("ALERT_SENDER_EMAIL", "").strip()
        self.admin_email = os.getenv("ALERT_ADMIN_EMAIL", "").strip()
        self.threshold = max(2, int(os.getenv("ALERT_FAILURE_THRESHOLD", str(threshold))))
        self.window_seconds = max(60, window_seconds)
        self._failures: dict[str, deque[float]] = {}
        self._last_alert: dict[str, float] = {}

    async def record_auth_failure(self, source_ip: str, endpoint: str) -> bool:
        """Count failed service-token checks and email only after a threshold.

        Returns True only when an alert was successfully delivered. Per-process
        throttling limits noise; multi-replica deployments should use shared
        Redis counters for cluster-wide rate limiting.
        """
        now = time.monotonic()
        key = source_ip or "unknown"
        failures = self._failures.setdefault(key, deque())
        while failures and now - failures[0] > self.window_seconds:
            failures.popleft()
        failures.append(now)

        if len(failures) < self.threshold:
            return False
        if now - self._last_alert.get(key, 0.0) < self.window_seconds:
            return False
        self._last_alert[key] = now
        return await self._send_alert(key, endpoint, len(failures))

    async def trigger_unauthorized_login_alert(
        self, user_ip: str, attempt_details: dict[str, Any]
    ) -> bool:
        """Explicit alert entry point for trusted security hooks."""
        endpoint = str(attempt_details.get("endpoint", "unknown"))[:200]
        count = int(attempt_details.get("attempt_count", self.threshold))
        return await self._send_alert(user_ip or "unknown", endpoint, count)

    async def _send_alert(self, source_ip: str, endpoint: str, count: int) -> bool:
        if not self.sender_email or not self.admin_email:
            logger.warning("Security alert skipped: SES sender or admin recipient is not configured.")
            return False

        # Lazy import lets local/test environments start without AWS configuration.
        try:
            import boto3
            from botocore.exceptions import BotoCoreError, ClientError
        except ImportError:
            logger.error("Security alert skipped: boto3 is not installed.")
            return False

        safe_ip = html.escape(source_ip[:100])
        safe_endpoint = html.escape(endpoint[:200])
        subject = "BharatGPilot security alert: repeated authentication failures"
        body = (
            "<html><body><h2>Security alert</h2>"
            "<p>Repeated internal-service authentication failures were detected.</p>"
            f"<p><b>Source IP:</b> {safe_ip}</p>"
            f"<p><b>Endpoint:</b> {safe_endpoint}</p>"
            f"<p><b>Failures in current window:</b> {count}</p>"
            "<p>No request body or credentials were included in this alert.</p>"
            "</body></html>"
        )

        def send() -> None:
            client = boto3.client("ses", region_name=self.aws_region)
            client.send_email(
                Source=self.sender_email,
                Destination={"ToAddresses": [self.admin_email]},
                Message={
                    "Subject": {"Charset": "UTF-8", "Data": subject},
                    "Body": {"Html": {"Charset": "UTF-8", "Data": body}},
                },
            )

        try:
            await asyncio.to_thread(send)
            return True
        except (ClientError, BotoCoreError) as exc:
            logger.error("SES security alert delivery failed (%s).", type(exc).__name__)
            return False
        except Exception as exc:
            logger.error("Security alert delivery failed (%s).", type(exc).__name__)
            return False
