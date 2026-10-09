"""Tenant-scoped retrieval primitives for the optional BharatGPilot RAG service.

This module deliberately exposes no HTTP routes by itself. Callers must derive
user_id from trusted server-side authentication, never from an untrusted client
field. Document parsing and upload authorization belong at the API boundary.
"""
from __future__ import annotations

import os
import uuid
from typing import Any, Sequence

from litellm import aembedding
from qdrant_client import AsyncQdrantClient, models


COLLECTION_NAME = os.getenv("BGP_RAG_COLLECTION", "bharatgpilot_user_knowledge")
EMBEDDING_MODEL = os.getenv("BGP_RAG_EMBEDDING_MODEL", "").strip()
VECTOR_SIZE = int(os.getenv("BGP_RAG_VECTOR_SIZE", "1536"))
MAX_CHUNK_CHARS = 6000
MAX_QUERY_CHARS = 2000
MAX_RETRIEVAL_LIMIT = 10


class RAGConfigurationError(RuntimeError):
    """Raised when required RAG configuration is missing or inconsistent."""


class RAGEngine:
    """Async embedding + Qdrant retrieval with mandatory per-user filtering."""

    def __init__(self) -> None:
        qdrant_url = os.getenv("QDRANT_URL", "http://127.0.0.1:6333").strip()
        qdrant_api_key = os.getenv("QDRANT_API_KEY", "").strip()
        if not qdrant_api_key:
            raise RAGConfigurationError("QDRANT_API_KEY must be configured.")
        if not EMBEDDING_MODEL:
            raise RAGConfigurationError(
                "BGP_RAG_EMBEDDING_MODEL must be explicitly configured; no model is selected implicitly."
            )
        if VECTOR_SIZE < 1:
            raise RAGConfigurationError("BGP_RAG_VECTOR_SIZE must be a positive integer.")
        self.client = AsyncQdrantClient(url=qdrant_url, api_key=qdrant_api_key, timeout=10)
        self.collection_name = COLLECTION_NAME
        self.vector_size = VECTOR_SIZE

    async def ensure_collection_exists(self) -> None:
        if await self.client.collection_exists(self.collection_name):
            info = await self.client.get_collection(self.collection_name)
            vectors = info.config.params.vectors
            if not isinstance(vectors, models.VectorParams) or vectors.size != self.vector_size:
                raise RAGConfigurationError(
                    "Existing Qdrant collection vector dimensions do not match BGP_RAG_VECTOR_SIZE."
                )
            return
        await self.client.create_collection(
            collection_name=self.collection_name,
            vectors_config=models.VectorParams(size=self.vector_size, distance=models.Distance.COSINE),
        )
        # Index tenant and document identifiers to keep filtered retrieval efficient.
        for field in ("user_id", "document_id"):
            await self.client.create_payload_index(
                collection_name=self.collection_name,
                field_name=field,
                field_schema=models.PayloadSchemaType.KEYWORD,
            )

    async def _embed(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []
        response = await aembedding(model=EMBEDDING_MODEL, input=list(texts))
        data = response.get("data") if isinstance(response, dict) else getattr(response, "data", None)
        if not isinstance(data, list) or len(data) != len(texts):
            raise RuntimeError("Embedding provider returned an invalid response.")
        vectors: list[list[float]] = []
        for item in data:
            vector = item.get("embedding") if isinstance(item, dict) else getattr(item, "embedding", None)
            if not isinstance(vector, list) or len(vector) != self.vector_size:
                raise RAGConfigurationError(
                    "Embedding vector dimensions do not match BGP_RAG_VECTOR_SIZE."
                )
            vectors.append(vector)
        return vectors

    async def upsert_document_chunks(
        self,
        *,
        user_id: str,
        document_id: str,
        file_name: str,
        text_chunks: Sequence[str],
    ) -> int:
        """Embed and store bounded chunks; tenant and document IDs are mandatory."""
        tenant = user_id.strip()
        doc_id = document_id.strip()
        name = file_name.strip()
        chunks = [chunk.strip() for chunk in text_chunks if isinstance(chunk, str) and chunk.strip()]
        if not tenant or not doc_id or not name:
            raise ValueError("user_id, document_id, and file_name are required.")
        if not chunks:
            raise ValueError("At least one non-empty text chunk is required.")
        if len(chunks) > 500:
            raise ValueError("A document may contain at most 500 chunks per request.")
        if any(len(chunk) > MAX_CHUNK_CHARS for chunk in chunks):
            raise ValueError(f"Each text chunk must be at most {MAX_CHUNK_CHARS} characters.")

        vectors = await self._embed(chunks)
        points = []
        for index, (chunk, vector) in enumerate(zip(chunks, vectors, strict=True)):
            stable_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"bharatgpilot:{tenant}:{doc_id}:{index}"))
            points.append(
                models.PointStruct(
                    id=stable_id,
                    vector=vector,
                    payload={
                        "user_id": tenant,
                        "document_id": doc_id,
                        "file_name": name[:255],
                        "chunk_index": index,
                        "text_content": chunk,
                    },
                )
            )
        await self.client.upsert(
            collection_name=self.collection_name,
            points=points,
            wait=True,
        )
        return len(points)

    async def retrieve_context(self, *, user_id: str, query: str, limit: int = 3) -> list[dict[str, Any]]:
        """Return only the authenticated tenant's passages, with source metadata."""
        tenant = user_id.strip()
        question = query.strip()
        if not tenant:
            raise ValueError("An authenticated user_id is required.")
        if not question or len(question) > MAX_QUERY_CHARS:
            raise ValueError(f"query must contain 1 to {MAX_QUERY_CHARS} characters.")
        bounded_limit = min(MAX_RETRIEVAL_LIMIT, max(1, int(limit)))
        vectors = await self._embed([question])
        result = await self.client.query_points(
            collection_name=self.collection_name,
            query=vectors[0],
            query_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="user_id",
                        match=models.MatchValue(value=tenant),
                    )
                ]
            ),
            limit=bounded_limit,
            with_payload=True,
        )
        passages: list[dict[str, Any]] = []
        for point in result.points:
            payload = point.payload or {}
            # Defend in depth if a future query change weakens the Qdrant filter.
            if payload.get("user_id") != tenant:
                continue
            text = payload.get("text_content")
            if not isinstance(text, str) or not text:
                continue
            passages.append({
                "text": text,
                "file_name": str(payload.get("file_name", "")),
                "document_id": str(payload.get("document_id", "")),
                "chunk_index": payload.get("chunk_index"),
                "score": point.score,
            })
        return passages

    async def close(self) -> None:
        await self.client.close()
