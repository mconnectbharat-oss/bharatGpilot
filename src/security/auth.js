import crypto from "node:crypto";
import { ensureAuthSchema, getPool } from "../db.js";

const SESSION_TTL_SECONDS = Number(process.env.AUTH_SESSION_TTL_SECONDS || 604800);

function requireSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SESSION_SECRET must be set to at least 32 characters.");
  }
  return secret;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.scryptSync(password, salt, 64);
  return { salt, hash: derived.toString("hex") };
}

function verifyPassword(password, salt, expectedHash) {
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function sign(value) {
  return crypto.createHmac("sha256", requireSecret()).update(value).digest("base64url");
}

async function issueSession(userId) {
  const tokenId = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const payload = [tokenId, userId, expiresAt.getTime()].join(".");
  const token = payload + "." + sign(payload);

  await getPool().query(
    "INSERT INTO bharatgpilot_sessions (token_id, user_id, expires_at) VALUES ($1, $2, $3)",
    [tokenId, userId, expiresAt]
  );

  return { token, expiresAt: expiresAt.getTime() };
}

async function readSession(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 4) return null;

  const [tokenId, userId, expiresAtText, signature] = parts;
  const payload = [tokenId, userId, expiresAtText].join(".");
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const expiresAt = Number(expiresAtText);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
    await getPool().query("DELETE FROM bharatgpilot_sessions WHERE token_id = $1", [tokenId]);
    return null;
  }

  const result = await getPool().query(
    `SELECT u.id, u.email
       FROM bharatgpilot_sessions s
       JOIN bharatgpilot_users u ON u.id = s.user_id
      WHERE s.token_id = $1
        AND s.user_id = $2
        AND s.expires_at = TO_TIMESTAMP($3 / 1000.0)
        AND s.expires_at > NOW()`,
    [tokenId, userId, expiresAt]
  );

  return result.rows[0] || null;
}

export async function registerUser({ email, password }) {
  requireSecret();
  await ensureAuthSchema();

  const normalizedEmail = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("A valid email address is required.");
  }
  if (typeof password !== "string" || password.length < 12) {
    throw new Error("Password must be at least 12 characters.");
  }

  const { salt, hash } = hashPassword(password);
  const id = crypto.randomUUID();

  try {
    await getPool().query(
      "INSERT INTO bharatgpilot_users (id, email, password_salt, password_hash) VALUES ($1, $2, $3, $4)",
      [id, normalizedEmail, salt, hash]
    );
  } catch (error) {
    if (error.code === "23505") throw new Error("An account already exists.");
    throw error;
  }

  return { id, email: normalizedEmail, ...(await issueSession(id)) };
}

export async function loginUser({ email, password }) {
  requireSecret();
  await ensureAuthSchema();

  const normalizedEmail = normalizeEmail(email);
  const result = await getPool().query(
    "SELECT id, email, password_salt, password_hash FROM bharatgpilot_users WHERE email = $1",
    [normalizedEmail]
  );
  const user = result.rows[0];

  if (
    !user ||
    typeof password !== "string" ||
    !verifyPassword(password, user.password_salt, user.password_hash)
  ) {
    throw new Error("Invalid email or password.");
  }

  return { id: user.id, email: user.email, ...(await issueSession(user.id)) };
}

export async function authenticateRequest(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  return token ? readSession(token) : null;
}

export async function logoutRequest(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    await getPool().query(
      "DELETE FROM bharatgpilot_sessions WHERE token_id = $1",
      [token.split(".")[0]]
    );
  }
}

export async function requireAuth(req, res, next) {
  try {
    const user = await authenticateRequest(req);
    if (!user) return res.status(401).json({ error: "Authentication required." });
    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication error:", error.message);
    res.status(503).json({ error: "Authentication service unavailable." });
  }
}
