import pg from "pg";
const { Pool } = pg;
let pool;
export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for persistent accounts.");
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }, max: Number(process.env.DB_POOL_MAX || 5), idleTimeoutMillis: 10000, connectionTimeoutMillis: 5000 });
  return pool;
}
export async function query(text, params = []) { return getDb().query(text, params); }
