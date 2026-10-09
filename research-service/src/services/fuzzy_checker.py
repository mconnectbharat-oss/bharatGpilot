"""Conservative fuzzy correction for a small, explicitly scoped Indic vocabulary.

Only tokens written in a supported Indic script are considered. A correction is
applied only when one corpus entry is the unique closest match within the
configured edit-distance limit. This is a best-effort typo helper, not a
language model or a security control.
"""
from __future__ import annotations

import unicodedata
from typing import Optional


class FuzzyScriptEngine:
    def __init__(self, priority_corpus: Optional[list[str]] = None, max_edit_distance: int = 2):
        self.priority_corpus = priority_corpus or [
            "क्या", "क्यों", "करना", "महत्त्व", "नमस्ते", "भारत",
            "করুন", "বাংলা", "ধন্যবাদ", "தமிழ்", "வந்த", "நன்றி",
        ]
        self.max_edit_distance = max(0, min(int(max_edit_distance), 2))

    @staticmethod
    def calculate_levenshtein_distance(token_a: str, token_b: str) -> int:
        """Return character-level Levenshtein distance using O(min(n, m)) memory."""
        if len(token_a) < len(token_b):
            token_a, token_b = token_b, token_a
        if not token_b:
            return len(token_a)
        previous_row = list(range(len(token_b) + 1))
        for i, char_a in enumerate(token_a):
            current_row = [i + 1]
            for j, char_b in enumerate(token_b):
                current_row.append(min(
                    previous_row[j + 1] + 1,
                    current_row[j] + 1,
                    previous_row[j] + (char_a != char_b),
                ))
            previous_row = current_row
        return previous_row[-1]

    @staticmethod
    def _script_family(token: str) -> str | None:
        families = set()
        for char in token:
            category = unicodedata.category(char)
            if not (category.startswith("L") or category.startswith("M")):
                continue
            name = unicodedata.name(char, "")
            if "DEVANAGARI" in name:
                families.add("devanagari")
            elif "BENGALI" in name:
                families.add("bengali")
            elif "TAMIL" in name:
                families.add("tamil")
            else:
                return None
        return next(iter(families)) if len(families) == 1 else None

    def resolve_dynamic_typo(self, input_token: str) -> str:
        token = input_token.strip()
        if not token or len(token) < 3 or token.isdigit():
            return input_token
        family = self._script_family(token)
        if family is None:
            return input_token

        candidates = [
            word for word in self.priority_corpus
            if self._script_family(word) == family
            and abs(len(word) - len(token)) <= self.max_edit_distance
        ]
        scored = sorted(
            ((self.calculate_levenshtein_distance(token, word), word) for word in candidates),
            key=lambda item: item[0],
        )
        if not scored or scored[0][0] == 0 or scored[0][0] > self.max_edit_distance:
            return input_token
        best_distance = scored[0][0]
        best_words = [word for distance, word in scored if distance == best_distance]
        # Ambiguous guesses are left untouched rather than silently changing meaning.
        return best_words[0] if len(best_words) == 1 else input_token

    def execute_fuzzy_pipeline(self, prompt_text: str) -> str:
        """Correct isolated whitespace-delimited Indic tokens and preserve spacing."""
        if not prompt_text:
            return ""
        import re
        parts = re.split(r"(\s+)", prompt_text)
        output = []
        for part in parts:
            if not part or part.isspace():
                output.append(part)
                continue
            # Keep punctuation outside the candidate word.
            start, end = 0, len(part)
            while start < end and unicodedata.category(part[start])[0] not in {"L", "M"}:
                start += 1
            while end > start and unicodedata.category(part[end - 1])[0] not in {"L", "M"}:
                end -= 1
            if start == end:
                output.append(part)
                continue
            token = part[start:end]
            output.append(part[:start] + self.resolve_dynamic_typo(token) + part[end:])
        return "".join(output)
