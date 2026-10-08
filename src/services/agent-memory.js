import crypto from "node:crypto";
import { query } from "./db.js";

const CATEGORIES = new Set(["general", "preference", "project", "workflow", "technical"]);
const SOURCES = new Set(["user", "assistant", "model", "workflow"]);

export async function listMemories(userId, limit = 50) {
  const result = await query(
    "SELECT id, content, category, source, confidence, created_at, updated_at FROM agent_memories WHERE user_id=$1 ORDER BY updated_at DESC LIMIT $2",
    [userId, limit]
  );
  return result.rows;
}

export async function createMemory(userId, { content, category = "general", source = "user", confidence = 1 } = {}) {
  if (typeof content !== "string" || !content.trim() || content.trim().length > 2000) {
    throw new Error("Memory content must contain 1–2000 characters.");
  }
  if (!CATEGORIES.has(category)) throw new Error("Unsupported memory category.");
  if (!SOURCES.has(source)) throw new Error("Unsupported memory source.");
  const score = Number(confidence);
  if (!Number.isFinite(score) || score < 0 || score > 1) throw new Error("Confidence must be between 0 and 1.");
  const id = crypto.randomUUID();
  const result = await query(
    "INSERT INTO agent_memories (id,user_id,content,category,source,confidence) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,content,category,source,confidence,created_at,updated_at",
    [id, userId, content.trim(), category, source, score]
  );
  return result.rows[0];
}

export async function deleteMemory(userId, id) {
  const result = await query("DELETE FROM agent_memories WHERE id=$1 AND user_id=$2 RETURNING id", [id, userId]);
  return result.rowCount > 0;
}
