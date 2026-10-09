"""Unicode normalization and conservative mixed-script input guardrails."""
from __future__ import annotations

import unicodedata

from fastapi import HTTPException

# Joiners are used in legitimate Indic orthography; newline and tab are also
# valid whitespace. Other control/surrogate/private-use/unassigned characters
# are not needed in ordinary chat prompts.
_ALLOWED_FORMAT_CONTROLS = {"\u200c", "\u200d"}
_SUPPORTED_LETTER_SCRIPTS = ("LATIN", "DEVANAGARI", "BENGALI", "TAMIL")
_INDIC_SCRIPT_NAMES = ("DEVANAGARI", "BENGALI", "TAMIL")


class IndicTextNormalizer:
    """Normalize text without rejecting ordinary punctuation or Hinglish."""

    def __init__(self, max_chars: int = 12_000) -> None:
        self.max_chars = max(2, min(int(max_chars), 100_000))

    def clean_and_normalize_unicode(self, text: str) -> str:
        if not isinstance(text, str):
            raise HTTPException(status_code=400, detail="Prompt must be text.")
        return unicodedata.normalize("NFKC", text)

    def enforce_script_guardrails(self, prompt: str) -> str:
        normalized = self.clean_and_normalize_unicode(prompt).strip()
        if len(normalized) < 2:
            raise HTTPException(status_code=400, detail="Prompt payload is empty.")
        if len(normalized) > self.max_chars:
            raise HTTPException(status_code=413, detail="Prompt exceeds the allowed size.")

        for char in normalized:
            category = unicodedata.category(char)
            if category in {"Cc", "Cs", "Co", "Cn"}:
                if char in "\n\t" or char in _ALLOWED_FORMAT_CONTROLS:
                    continue
                raise HTTPException(status_code=400, detail="Malformed Unicode text configuration block.")
            if category == "Cf" and char not in _ALLOWED_FORMAT_CONTROLS:
                raise HTTPException(status_code=400, detail="Unsupported invisible Unicode formatting character.")

        has_indic = any(
            category.startswith("L")
            and any(script in unicodedata.name(char, "") for script in _INDIC_SCRIPT_NAMES)
            for char in normalized
            for category in [unicodedata.category(char)]
        )
        if has_indic:
            unsupported_letters = []
            for char in normalized:
                if not unicodedata.category(char).startswith("L"):
                    continue
                name = unicodedata.name(char, "")
                if not any(script in name for script in _SUPPORTED_LETTER_SCRIPTS):
                    unsupported_letters.append(char)
            if unsupported_letters:
                samples = "".join(dict.fromkeys(unsupported_letters))[:3]
                raise HTTPException(
                    status_code=422,
                    detail="Unsupported mixed-script input detected. Remove unrelated script characters or submit them separately.",
                )

        return normalized
