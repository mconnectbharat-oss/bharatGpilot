import unittest

from fastapi import HTTPException

from src.services.normalization import IndicTextNormalizer


class IndicTextNormalizerTests(unittest.TestCase):
    def setUp(self):
        self.normalizer = IndicTextNormalizer()

    def test_normalizes_compatibility_characters_and_preserves_prompt(self):
        self.assertEqual(self.normalizer.enforce_script_guardrails("ＡＢＣ hello"), "ABC hello")

    def test_allows_hinglish_punctuation_digits_and_indic_joiners(self):
        prompt = "नमस्ते! Please explain 2+2.\u200d"
        self.assertEqual(self.normalizer.enforce_script_guardrails(prompt), prompt)

    def test_rejects_hidden_control_characters(self):
        with self.assertRaises(HTTPException) as caught:
            self.normalizer.enforce_script_guardrails("नमस्ते\x00")
        self.assertEqual(caught.exception.status_code, 400)

    def test_rejects_unrelated_script_letters_in_indic_input(self):
        with self.assertRaises(HTTPException) as caught:
            self.normalizer.enforce_script_guardrails("नमस्ते абв")
        self.assertEqual(caught.exception.status_code, 422)

    def test_allows_english_only_and_supported_indic_scripts(self):
        self.assertEqual(self.normalizer.enforce_script_guardrails("Explain GitHub"), "Explain GitHub")
        self.assertEqual(self.normalizer.enforce_script_guardrails("বাংলা ভাষা"), "বাংলা ভাষা")
        self.assertEqual(self.normalizer.enforce_script_guardrails("தமிழ் மொழி"), "தமிழ் மொழி")

    def test_enforces_input_length(self):
        with self.assertRaises(HTTPException) as caught:
            IndicTextNormalizer(max_chars=3).enforce_script_guardrails("long")
        self.assertEqual(caught.exception.status_code, 413)


if __name__ == "__main__":
    unittest.main()
