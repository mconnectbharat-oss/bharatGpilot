import assert from "node:assert/strict";
import crypto from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL must point to a disposable test database.");
if (process.env.NODE_ENV === "production") throw new Error("Refusing to run migration verification in production.");

const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
});

let userA;
let userB;
try {
  const migrationRows = await pool.query(
    "SELECT filename FROM schema_migrations WHERE filename = ANY($1::text[]) ORDER BY filename",
    [["001_action_receipts.sql", "002_identity_auth.sql", "004_agent_memory.sql", "005_knowledge_rag.sql"]]
  );
  assert.deepEqual(
    migrationRows.rows.map((row) => row.filename),
    ["001_action_receipts.sql", "002_identity_auth.sql", "004_agent_memory.sql", "005_knowledge_rag.sql"],
    "all expected migrations should be recorded"
  );

  const schema = await pool.query(`
    SELECT
      to_regclass('public.knowledge_documents') AS documents_table,
      to_regclass('public.knowledge_chunks') AS chunks_table,
      to_regclass('public.knowledge_chunks_search_idx') AS search_index,
      (SELECT data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='knowledge_chunks' AND column_name='search_vector') AS vector_type
  `);
  assert.ok(schema.rows[0].documents_table, "knowledge_documents table should exist");
  assert.ok(schema.rows[0].chunks_table, "knowledge_chunks table should exist");
  assert.ok(schema.rows[0].search_index, "GIN search index should exist");
  assert.equal(schema.rows[0].vector_type, "USER-DEFINED", "generated tsvector column should exist");

  const userAResult = await pool.query(
    "INSERT INTO users(email,password_hash,password_salt) VALUES($1,$2,$3) RETURNING id",
    [`migration-check-a-${crypto.randomUUID()}@example.invalid`, "test-hash", "test-salt"]
  );
  userA = userAResult.rows[0].id;
  const userBResult = await pool.query(
    "INSERT INTO users(email,password_hash,password_salt) VALUES($1,$2,$3) RETURNING id",
    [`migration-check-b-${crypto.randomUUID()}@example.invalid`, "test-hash", "test-salt"]
  );
  userB = userBResult.rows[0].id;

  const docA = await pool.query(
    "INSERT INTO knowledge_documents(user_id,title,source_name,character_count,chunk_count) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [userA, "Disposable migration check A", "ci-test", 38, 1]
  );
  const docB = await pool.query(
    "INSERT INTO knowledge_documents(user_id,title,source_name,character_count,chunk_count) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [userB, "Disposable migration check B", "ci-test", 38, 1]
  );
  await pool.query(
    "INSERT INTO knowledge_chunks(document_id,user_id,chunk_index,content) VALUES($1,$2,0,$3),($4,$5,0,$3)",
    [docA.rows[0].id, userA, "zephyrknowledgeprobe private retrieval", docB.rows[0].id, userB]
  );

  const isolated = await pool.query(
    `SELECT d.title, c.search_vector @@ websearch_to_tsquery('simple', $2) AS matched
       FROM knowledge_chunks c
       JOIN knowledge_documents d ON d.id=c.document_id AND d.user_id=c.user_id
      WHERE c.user_id=$1 AND c.search_vector @@ websearch_to_tsquery('simple', $2)`,
    [userA, "zephyrknowledgeprobe"]
  );
  assert.equal(isolated.rows.length, 1, "search should return only the signed-in user's matching record");
  assert.equal(isolated.rows[0].title, "Disposable migration check A");
  assert.equal(isolated.rows[0].matched, true, "generated search vector should match full-text query");

  await pool.query("DELETE FROM knowledge_documents WHERE id=$1 AND user_id=$2", [docA.rows[0].id, userA]);
  const cascade = await pool.query("SELECT count(*)::int AS count FROM knowledge_chunks WHERE document_id=$1", [docA.rows[0].id]);
  assert.equal(cascade.rows[0].count, 0, "deleting a document should cascade to its chunks");

  console.log("Migration verification passed: schema, full-text index, owner isolation, and cascading delete.");
} finally {
  if (userA) await pool.query("DELETE FROM users WHERE id=$1", [userA]).catch(() => {});
  if (userB) await pool.query("DELETE FROM users WHERE id=$1", [userB]).catch(() => {});
  await pool.end();
}
