"""Bounded PDF/DOCX extraction and overlapping chunking for Memo RAG.

This module accepts file bytes only. HTTP upload authorization, request-size
limits at the proxy, and ownership of user_id/document_id must be enforced by
the API layer before calling process_and_index_document().
"""
from __future__ import annotations

import asyncio
import io
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

import docx2txt
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader

if TYPE_CHECKING:
    from src.services.rag_engine import RAGEngine

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_PDF_PAGES = 500
MAX_EXTRACTED_CHARS = 2_000_000
CHUNK_SIZE = 1200
CHUNK_OVERLAP = 180
SUPPORTED_EXTENSIONS = {".pdf", ".docx"}


class DocumentProcessingError(ValueError):
    """Raised when an upload is unsupported, malformed, or exceeds limits."""


@dataclass(frozen=True)
class ProcessedDocument:
    text: str
    chunks: list[str]
    page_count: int | None


def _extract_pdf(content: bytes) -> tuple[str, int]:
    try:
        reader = PdfReader(io.BytesIO(content), strict=True)
        if reader.is_encrypted:
            raise DocumentProcessingError("Encrypted PDFs are not supported.")
        if len(reader.pages) > MAX_PDF_PAGES:
            raise DocumentProcessingError(f"PDFs may contain at most {MAX_PDF_PAGES} pages.")
        parts: list[str] = []
        total_chars = 0
        for page in reader.pages:
            text = page.extract_text() or ""
            total_chars += len(text)
            if total_chars > MAX_EXTRACTED_CHARS:
                raise DocumentProcessingError("Extracted document text exceeds the configured limit.")
            parts.append(text)
        return "\n\n".join(parts), len(reader.pages)
    except DocumentProcessingError:
        raise
    except Exception as exc:
        raise DocumentProcessingError("The PDF could not be parsed.") from exc


def _extract_docx(content: bytes) -> str:
    # docx2txt accepts a path; create a private temporary file and always remove it.
    path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(prefix="bgp-memo-", suffix=".docx", delete=False) as handle:
            handle.write(content)
            path = handle.name
        text = docx2txt.process(path) or ""
        if len(text) > MAX_EXTRACTED_CHARS:
            raise DocumentProcessingError("Extracted document text exceeds the configured limit.")
        return text
    except DocumentProcessingError:
        raise
    except Exception as exc:
        raise DocumentProcessingError("The DOCX document could not be parsed.") from exc
    finally:
        if path:
            try:
                os.unlink(path)
            except OSError:
                pass


def process_document_bytes(filename: str, content: bytes) -> ProcessedDocument:
    """Validate, extract, and split a PDF/DOCX using a bounded overlap window."""
    if not isinstance(filename, str) or not filename.strip():
        raise DocumentProcessingError("A filename is required.")
    suffix = Path(filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise DocumentProcessingError("Only PDF and DOCX documents are supported.")
    if not isinstance(content, bytes) or not content:
        raise DocumentProcessingError("The uploaded file is empty.")
    if len(content) > MAX_FILE_BYTES:
        raise DocumentProcessingError(f"Files must be no larger than {MAX_FILE_BYTES // (1024 * 1024)} MB.")

    if suffix == ".pdf":
        text, page_count = _extract_pdf(content)
    else:
        text, page_count = _extract_docx(content), None

    normalized = "\n".join(line.strip() for line in text.replace("\x00", "").splitlines()).strip()
    if not normalized:
        raise DocumentProcessingError(
            "No readable text was extracted. Scanned PDFs may require a separately configured OCR service."
        )
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
        add_start_index=True,
    )
    chunks = [chunk.strip() for chunk in splitter.split_text(normalized) if chunk.strip()]
    if not chunks:
        raise DocumentProcessingError("No usable text chunks were produced.")
    if len(chunks) > 500:
        raise DocumentProcessingError("The document creates too many chunks (maximum 500).")
    return ProcessedDocument(text=normalized, chunks=chunks, page_count=page_count)


async def process_and_index_document(
    rag_engine: "RAGEngine",
    *,
    user_id: str,
    document_id: str,
    filename: str,
    content: bytes,
) -> dict[str, int | str | None]:
    """Run CPU/file parsing off-loop, then index chunks with tenant metadata."""
    processed = await asyncio.to_thread(process_document_bytes, filename, content)
    chunk_count = await rag_engine.upsert_document_chunks(
        user_id=user_id,
        document_id=document_id,
        file_name=Path(filename).name[:255],
        text_chunks=processed.chunks,
    )
    return {
        "document_id": document_id,
        "chunks_indexed": chunk_count,
        "characters_extracted": len(processed.text),
        "page_count": processed.page_count,
    }
