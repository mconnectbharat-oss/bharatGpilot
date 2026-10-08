# Agent memory and n8n automation

## Memory model
BharatGPilot stores user-scoped, persistent memories in PostgreSQL. Memory is deliberately explicit: create a memory only after the user or a trusted workflow chooses to save it. Memories can be listed and deleted through authenticated endpoints. Model-generated memory suggestions should be reviewed before being written; model output is not trusted as fact.

- `GET /api/pilot/memory` — list the authenticated user's memories.
- `POST /api/pilot/memory` — save a memory; body: `{ "content": "...", "category": "project", "source": "user", "confidence": 1 }`.
- `DELETE /api/pilot/memory/:id` — delete one of the authenticated user's memories.

## n8n
Configure `N8N_WEBHOOK_URL` (HTTPS only) and `N8N_WEBHOOK_SECRET` as server-side environment variables. The endpoint dispatch is explicit and allow-listed, has a 5-second timeout and 10 KB payload limit, and never executes arbitrary code.

- `GET /api/pilot/automation/status`
- `POST /api/pilot/automation/dispatch` body: `{ "event": "conversation.completed", "payload": {} }`

The secret is sent in the `X-BharatGPilot-Signature` header; configure n8n to validate it. Use n8n credentials for downstream APIs, never put API keys in workflow JSON. Restrict webhook access and do not connect untrusted input directly to shell, filesystem, deployment, or database-write nodes.

## Multi-model memory
Different models can propose candidate memories, but a deterministic policy should decide what is saved. Avoid automatic saving of passwords, API keys, sensitive personal data, or unverified model claims. Store provenance, confidence, timestamps, and allow the user to inspect and delete memories. Cross-model consensus is not proof of truth.
