import unittest
from unittest.mock import Mock

from fastapi import HTTPException

from src.services.guardrails import PromptGuardrails


class PromptGuardrailsTests(unittest.TestCase):
    def test_rejects_empty_and_non_text_prompts(self):
        guard = PromptGuardrails()
        for prompt in (" ", "\x00\n", None):
            with self.subTest(prompt=prompt), self.assertRaises(HTTPException):
                guard.validate_and_sanitize_prompt("user-1", prompt)

    def test_strips_control_characters_and_enforces_length(self):
        guard = PromptGuardrails(max_chars=5)
        self.assertEqual(guard.validate_and_sanitize_prompt("user-1", " hi\x00 "), "hi")
        with self.assertRaises(HTTPException) as caught:
            guard.validate_and_sanitize_prompt("user-1", "too long")
        self.assertEqual(caught.exception.status_code, 413)

    def test_redis_duplicate_guard_is_atomic(self):
        redis = Mock()
        redis.set.side_effect = [True, False]
        guard = PromptGuardrails(redis_client=redis)
        self.assertEqual(guard.validate_and_sanitize_prompt("user-1", "hello"), "hello")
        with self.assertRaises(HTTPException) as caught:
            guard.validate_and_sanitize_prompt("user-1", "hello")
        self.assertEqual(caught.exception.status_code, 429)
        self.assertEqual(redis.set.call_args.kwargs, {"ex": 4, "nx": True})

    def test_redis_failure_fails_closed(self):
        redis = Mock()
        redis.set.side_effect = RuntimeError("down")
        with self.assertRaises(HTTPException) as caught:
            PromptGuardrails(redis_client=redis).validate_and_sanitize_prompt("user-1", "hello")
        self.assertEqual(caught.exception.status_code, 503)

    def test_missing_user_rejected(self):
        with self.assertRaises(HTTPException) as caught:
            PromptGuardrails().validate_and_sanitize_prompt("", "hello")
        self.assertEqual(caught.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
