"""Conservative Indic prompt text preprocessing.

Normalization and typo assistance are convenience features only; security
validation and authorization remain the responsibility of PromptGuardrails.
"""
from __future__ import annotations

import unicodedata

from src.services.fuzzy_checker import FuzzyScriptEngine


class IndicSpellPreProcessor:
    def __init__(self, fuzzy_engine: FuzzyScriptEngine | None = None):
        self.fuzzy_engine = fuzzy_engine or FuzzyScriptEngine()

    def normalize_halfform_conjuncts(self, text: str) -> str:
        # NFC composes canonically equivalent sequences without deleting valid viramas.
        return unicodedata.normalize("NFC", text)

    def clean_common_typos(self, text: str) -> str:
        # Avoid broad dictionary substitutions that can silently change meaning.
        return text

    def clean_text_pipeline(self, prompt: str) -> str:
        if not isinstance(prompt, str):
            raise TypeError("prompt must be a string")
        sanitized = prompt.strip()
        sanitized = self.normalize_halfform_conjuncts(sanitized)
        sanitized = self.clean_common_typos(sanitized)
        return self.fuzzy_engine.execute_fuzzy_pipeline(sanitized)
