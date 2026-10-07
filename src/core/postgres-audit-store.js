import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL
});

function assertConfigured() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    throw new Error("A durable PostgreSQL connection is required for the production audit store.");
  }
}

export async function ensureAuditSchema() {
  assertConfigured();
  await pool.query(`
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
    )
  `);
}

export function createPostgresAuditStore() {
  assertConfigured();

  return Object.freeze({
    async claim(receiptHash, actionId, receipt = null) {
      if (!receiptHash || !actionId || !receipt) throw new Error("Receipt hash, action id, and receipt are required.");
      const result = await pool.query(
        `INSERT INTO bharatgpilot_action_receipts
          (receipt_hash, action_id, actor_id, status, receipt)
         VALUES ($1, $2, $3, 'CLAIMED', $4::jsonb)
         ON CONFLICT (receipt_hash) DO NOTHING
         RETURNING receipt_hash`,
        [receiptHash, actionId, receipt.actorId || "system", JSON.stringify(receipt)]
      );
      if (result.rowCount !== 1) throw new Error("Action receipt has already been claimed or consumed.");
      return true;
    },

    async append(record) {
      const result = await pool.query(
        `UPDATE bharatgpilot_action_receipts
         SET status = CASE WHEN status = 'CLAIMED' THEN 'AUTHORIZED' ELSE status END,
             audit_record = $3::jsonb
         WHERE receipt_hash = $1 AND action_id = $2
         RETURNING receipt_hash`,
        [record.receiptHash, record.actionId, JSON.stringify(record)]
      );
      if (result.rowCount !== 1) throw new Error("Action receipt claim was not found for audit append.");
      return record;
    },

    async complete(receiptHash, actionId, pullRequest) {
      const result = await pool.query(
        `UPDATE bharatgpilot_action_receipts
         SET status = 'COMPLETED',
             audit_record = jsonb_set(COALESCE(audit_record, '{}'::jsonb), '{pullRequest}', $3::jsonb, true),
             completed_at = NOW()
         WHERE receipt_hash = $1 AND action_id = $2
           AND status IN ('CLAIMED', 'AUTHORIZED')
         RETURNING receipt_hash`,
        [receiptHash, actionId, JSON.stringify(pullRequest || null)]
      );
      if (result.rowCount !== 1) throw new Error("Action receipt could not be completed.");
      return true;
    },

    async release(receiptHash, actionId) {
      // Release is only safe before authorization is persisted.
      const result = await pool.query(
        `DELETE FROM bharatgpilot_action_receipts
         WHERE receipt_hash = $1 AND action_id = $2 AND status = 'CLAIMED'`,
        [receiptHash, actionId]
      );
      return result.rowCount === 1;
    },

    async hasReceipt(receiptHash) {
      const result = await pool.query(
        "SELECT 1 FROM bharatgpilot_action_receipts WHERE receipt_hash = $1 LIMIT 1",
        [receiptHash]
      );
      return result.rowCount === 1;
    }
  });
}
