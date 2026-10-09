import unittest
from unittest.mock import AsyncMock

from src.services.alerts import SecurityAlertSystem


class SecurityAlertSystemTests(unittest.IsolatedAsyncioTestCase):
    async def test_alert_only_after_failure_threshold(self):
        alerts = SecurityAlertSystem(threshold=3, window_seconds=600)
        alerts._send_alert = AsyncMock(return_value=True)
        self.assertFalse(await alerts.record_auth_failure("127.0.0.1", "/private"))
        self.assertFalse(await alerts.record_auth_failure("127.0.0.1", "/private"))
        self.assertTrue(await alerts.record_auth_failure("127.0.0.1", "/private"))
        alerts._send_alert.assert_awaited_once_with("127.0.0.1", "/private", 3)

    async def test_alert_is_rate_limited_after_threshold(self):
        alerts = SecurityAlertSystem(threshold=2, window_seconds=600)
        alerts._send_alert = AsyncMock(return_value=True)
        await alerts.record_auth_failure("127.0.0.1", "/private")
        self.assertTrue(await alerts.record_auth_failure("127.0.0.1", "/private"))
        self.assertFalse(await alerts.record_auth_failure("127.0.0.1", "/private"))
        alerts._send_alert.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
