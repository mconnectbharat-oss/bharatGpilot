import unittest
from unittest.mock import patch

from src.services.audit_store import _safe_metadata


class AuditMetadataTests(unittest.TestCase):
    def test_only_allowlisted_operational_metadata_is_kept(self):
        cleaned = _safe_metadata({
            "target_endpoint": "/api/v1/chat",
            "reason_code": "unicode_mixed_script",
            "prompt_snippet": "private user prompt",
            "token": "secret",
            "character_samples": ["а", "б", "в", "г"],
        })
        self.assertEqual(cleaned["target_endpoint"], "/api/v1/chat")
        self.assertEqual(cleaned["character_samples"], ["а", "б", "в"])
        self.assertNotIn("prompt_snippet", cleaned)
        self.assertNotIn("token", cleaned)


if __name__ == "__main__":
    unittest.main()
