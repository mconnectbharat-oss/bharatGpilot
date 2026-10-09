import unittest

from src.services.fuzzy_checker import FuzzyScriptEngine
from src.services.spell_checker import IndicSpellPreProcessor


class FuzzyScriptEngineTests(unittest.TestCase):
    def setUp(self):
        self.engine = FuzzyScriptEngine()

    def test_levenshtein_distance(self):
        self.assertEqual(self.engine.calculate_levenshtein_distance("kitten", "sitting"), 3)
        self.assertEqual(self.engine.calculate_levenshtein_distance("भारत", "भारत"), 0)

    def test_corrects_unique_indic_candidate(self):
        self.assertEqual(self.engine.resolve_dynamic_typo("भाारत"), "भारत")
        self.assertEqual(self.engine.resolve_dynamic_typo("বাংলা"), "বাংলা")

    def test_does_not_rewrite_english_or_numbers(self):
        self.assertEqual(self.engine.resolve_dynamic_typo("developer"), "developer")
        self.assertEqual(self.engine.resolve_dynamic_typo("12345"), "12345")

    def test_preserves_whitespace_and_punctuation(self):
        self.assertEqual(
            self.engine.execute_fuzzy_pipeline("  भाारत,\tবাংলা!  "),
            "  भारत,\tবাংলা!  ",
        )

    def test_ambiguous_candidate_is_left_unchanged(self):
        engine = FuzzyScriptEngine(priority_corpus=["करना", "करनी"])
        self.assertEqual(engine.resolve_dynamic_typo("करन"), "करन")


class IndicSpellPreProcessorTests(unittest.TestCase):
    def test_pipeline_normalizes_nfc_and_uses_fuzzy_engine(self):
        processor = IndicSpellPreProcessor()
        self.assertEqual(processor.clean_text_pipeline("  भाारत  "), "भारत")

    def test_non_string_input_is_rejected(self):
        with self.assertRaises(TypeError):
            IndicSpellPreProcessor().clean_text_pipeline(None)


if __name__ == "__main__":
    unittest.main()
