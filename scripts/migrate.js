import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "../src/services/db.js";
const here=path.dirname(fileURLToPath(import.meta.url));
const dir=path.join(here,"..","migrations");
const db=getDb();
await db.query("CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
const files=(await fs.readdir(dir)).filter(f=>f.endsWith(".sql")).sort();
for(const filename of files){
  const exists=await db.query("SELECT 1 FROM schema_migrations WHERE filename=$1",[filename]);
  if(exists.rowCount) continue;
  const sql=await fs.readFile(path.join(dir,filename),"utf8");
  const client=await db.connect();
  try { await client.query("BEGIN"); await client.query(sql); await client.query("INSERT INTO schema_migrations(filename) VALUES($1)",[filename]); await client.query("COMMIT"); console.log("Applied",filename); }
  catch(error){ await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
await db.end();
