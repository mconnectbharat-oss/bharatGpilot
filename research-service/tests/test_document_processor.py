"""Unit tests for bounded Memo document processing (run with unittest)."""
from __future__ import annotations

import unittest
from unittest.mock import patch

from src.services.document_processor import (
    MAX_FILE_BYTES,
    DocumentProcessingError,
    process_document_bytes,
)


class DocumentProcessorTests(unittest.TestCase):
    def test_rejects_unsupported_extension(self) -> None:
        with self.assertRaisesRegex(DocumentProcessingError, "Only PDF and DOCX"):
            process_document_bytes("notes.txt", b"not a supported file")

    def test_rejects_empty_upload(self) -> None:
        with self.assertRaisesRegex(DocumentProcessingError, "empty"):
            process_document_bytes("notes.docx", b"")

    def test_rejects_oversized_upload(self) -> None:
        with self.assertRaisesRegex(DocumentProcessingError, "no larger"):
            process_document_bytes("notes.docx", b"x" * (MAX_FILE_BYTES + 1))

    @patch("src.services.document_processor._extract_docx")
    def test_chunks_text_with_overlap(self, extract_docx) -> None:
        extract_docx.return_value = " ".join(f"word{i}" for i in range(1200))
        result = process_document_bytes("notes.docx", b"fake-docx-bytes")
        self.assertGreater(len(result.chunks), 1)
        self.assertTrue(all(0 < len(chunk) <= 1200 for chunk in result.chunks))
        # Sliding-window overlap should preserve some text between neighboring chunks.
        self.assertTrue(set(result.chunks[0].split()) & set(result.chunks[1].split()))
        self.assertIsNone(result.page_count)

    @patch("src.services.document_processor._extract_docx")
    def test_rejects_documents_without_readable_text(self, extract_docx) -> None:
        extract_docx.return_value = "  \n\x00  "
        with self.assertRaisesRegex(DocumentProcessingError, "No readable text"):
            process_document_bytes("notes.docx", b"fake-docx-bytes")


if __name__ == "__main__":
    unittest.main()
