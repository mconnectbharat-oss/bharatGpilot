CREATE TABLE IF NOT EXISTS bharatgpilot_action_receipts (
  receipt_hash TEXT PRIMARY KEY,
  action_id TEXT NOT NULL UNIQUE,
  actor_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CLAIMED','AUTHORIZED','COMPLETED')),
  receipt JSONB NOT NULL,
  audit_record JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
