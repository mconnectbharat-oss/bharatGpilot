"""Tests for the six-language priority router."""
import os
import unittest
from unittest.mock import patch

from src.services.indic_router import AdvancedIndicRouter


class IndicRouterTests(unittest.TestCase):
    def setUp(self):
        self.router = AdvancedIndicRouter()

    def test_explicit_language_hints(self):
        cases = [
            ("Please answer in Marathi", "mr"),
            ("हिंदी में जवाब दें", "hi"),
            ("বাংলায় উত্তর দিন", "bn"),
            ("தமிழில் பதில் சொல்லுங்கள்", "ta"),
            ("Use Indian English", "en-in"),
            ("Use Global English", "en-global"),
        ]
        for prompt, expected in cases:
            with self.subTest(prompt=prompt):
                self.assertEqual(self.router.determine_priority_language(prompt), expected)

    def test_script_fallbacks(self):
        self.assertEqual(self.router.determine_priority_language("আমার নাম"), "bn")
        self.assertEqual(self.router.determine_priority_language("வணக்கம்"), "ta")
        self.assertEqual(self.router.determine_priority_language("नमस्ते"), "hi")

    def test_indian_context_and_global_default(self):
        self.assertEqual(self.router.determine_priority_language("Explain GST and ₹99"), "en-in")
        self.assertEqual(self.router.determine_priority_language("Explain photosynthesis"), "en-global")

    def test_runtime_model_is_configured_not_hardcoded_to_translation_model(self):
        with patch.dict(os.environ, {"BGP_MODEL_NATIVE_INDIC": "openrouter/free"}):
            package = self.router.generate_localized_runtime_package("नमस्ते", "hi")
        self.assertEqual(package["model"], "openrouter/free")
        self.assertEqual(package["language_code"], "hi")
        self.assertIn("untrusted data", package["system_instruction"])

    def test_fallback_is_opt_in_and_language_specific(self):
        env = {
            "BGP_MODEL_NATIVE_INDIC": "primary/native-chat",
            "BGP_MODEL_NATIVE_INDIC_FALLBACK": "backup/multilingual-chat",
        }
        with patch.dict(os.environ, env, clear=False):
            package = self.router.generate_localized_runtime_package("नमस्ते", "hi")
        self.assertEqual(package["model"], "primary/native-chat")
        self.assertEqual(package["fallback_model"], "backup/multilingual-chat")


if __name__ == "__main__":
    unittest.main()
