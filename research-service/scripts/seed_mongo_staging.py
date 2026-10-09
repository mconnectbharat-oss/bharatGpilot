#!/usr/bin/env python3
"""Insert synthetic audit fixtures into a separately provisioned staging MongoDB database.

This utility intentionally refuses to use MONGODB_ATLAS_URI. Configure a dedicated
MONGODB_STAGING_URI and explicitly set BGP_SEED_STAGING=true. Never point the staging
URI at a production cluster/database.
"""
from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta, timezone

from pymongo import ASCENDING, DESCENDING, AsyncMongoClient
from pymongo.errors import DuplicateKeyError


DATABASE_NAME = "bharatgpilot_staging"
COLLECTION_NAME = "audit_trails"


async def seed() -> None:
    if os.getenv("BGP_SEED_STAGING") != "true":
        raise SystemExit("Refusing to seed: set BGP_SEED_STAGING=true explicitly.")
    uri = os.getenv("MONGODB_STAGING_URI", "").strip()
    if not uri:
        raise SystemExit("Refusing to seed: MONGODB_STAGING_URI is required; production URI is not accepted.")
    if os.getenv("MONGODB_ATLAS_URI", "").strip() and uri == os.getenv("MONGODB_ATLAS_URI", "").strip():
        raise SystemExit("Refusing to seed: staging URI matches MONGODB_ATLAS_URI.")

    client = AsyncMongoClient(
        uri,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
        appname="BharatGPilot-StagingSeeder",
    )
    try:
        await client.admin.command("ping")
        db = client[DATABASE_NAME]
        names = await db.list_collection_names()
        if COLLECTION_NAME not in names:
            await db.create_collection(COLLECTION_NAME, capped=True, size=16 * 1024 * 1024, max=10000)
        collection = db[COLLECTION_NAME]
        stats = await db.command("collStats", COLLECTION_NAME)
        if not stats.get("capped", False):
            raise RuntimeError("Refusing to seed: audit_trails exists but is not capped.")

        await collection.create_indexes([
            [("timestamp", DESCENDING)],
            [("client_ip", ASCENDING), ("timestamp", DESCENDING)],
            [("infraction_type", ASCENDING), ("timestamp", DESCENDING)],
        ])

        now = datetime.now(timezone.utc)
        fixtures = [
            {
                "_id": "bgp-staging-demo-prompt-injection",
                "timestamp": now - timedelta(hours=2),
                "client_ip": "192.0.2.10",
                "infraction_type": "Prompt Injection",
                "metadata": {"target_endpoint": "/api/v1/chat/secure-gateway", "reason_code": "staging_fixture"},
            },
            {
                "_id": "bgp-staging-demo-unicode-anomaly",
                "timestamp": now - timedelta(minutes=45),
                "client_ip": "198.51.100.20",
                "infraction_type": "Unicode Script Anomaly",
                "metadata": {"target_endpoint": "/api/v1/agent/research", "reason_code": "staging_fixture", "status_code": 422},
            },
        ]
        inserted = 0
        for fixture in fixtures:
            try:
                await collection.insert_one(fixture)
                inserted += 1
            except DuplicateKeyError:
                # Stable IDs make reruns idempotent; capped audit entries are never updated.
                pass
        print(f"Staging seed complete: inserted {inserted} synthetic audit event(s) into {DATABASE_NAME}.{COLLECTION_NAME}.")
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(seed())
