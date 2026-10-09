import unittest
from unittest.mock import AsyncMock

from src.services.health_monitor import MongoSelfHealingWorker


class MongoHealthWorkerTests(unittest.IsolatedAsyncioTestCase):
    async def test_unconfigured_worker_stays_disabled(self):
        worker = MongoSelfHealingWorker(telemetry_bridge=object(), audit_store=object())
        worker.uri = ""
        self.assertFalse(worker.enabled)
        self.assertFalse(await worker.check_once())
        self.assertEqual(worker.status()["status"], "disabled")

    async def test_status_does_not_expose_uri(self):
        worker = MongoSelfHealingWorker(telemetry_bridge=object(), audit_store=object())
        worker.uri = "mongodb+srv://user:password@example.invalid/db"
        worker._last_error = "ServerSelectionTimeoutError"
        status = worker.status()
        self.assertEqual(status["status"], "degraded")
        self.assertNotIn("uri", status)
        self.assertNotIn("password", str(status))


if __name__ == "__main__":
    unittest.main()
