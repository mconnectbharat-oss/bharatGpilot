import crypto from "node:crypto";

const SESSION_TTL_SECONDS = Number(process.env.AUTH_SESSION_TTL_SECONDS || 604800);
const users = new Map();
const sessions = new Map();

function requireSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SESSION_SECRET must be set to at least 32 characters.");
  return secret;
}

function normalizeEmail(email) { return String(email || "").trim().toLowerCase(); }

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

function issueSession(userId) {
  const tokenId = crypto.randomBytes(24).toString("base64url");
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = [tokenId, userId, expiresAt].join(".");
  const token = payload + "." + sign(payload);
  sessions.set(tokenId, { userId, expiresAt });
  return { token, expiresAt };
}

function readSession(token) {
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
    sessions.delete(tokenId);
    return null;
  }
  const session = sessions.get(tokenId);
  const user = users.get(userId);
  if (!session || session.userId !== userId || session.expiresAt !== expiresAt || !user) return null;
  return { id: user.id, email: user.email };
}

export function registerUser({ email, password }) {
  requireSecret();
  const normalizedEmail = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error("A valid email address is required.");
  if (typeof password !== "string" || password.length < 12) throw new Error("Password must be at least 12 characters.");
  if (users.has(normalizedEmail)) throw new Error("An account already exists.");
  const { salt, hash } = hashPassword(password);
  const user = { id: crypto.randomUUID(), email: normalizedEmail, salt, passwordHash: hash };
  users.set(user.id, user);
  users.set(normalizedEmail, user);
  return { id: user.id, email: user.email, ...issueSession(user.id) };
}

export function loginUser({ email, password }) {
  requireSecret();
  const user = users.get(normalizeEmail(email));
  if (!user || typeof password !== "string" || !verifyPassword(password, user.salt, user.passwordHash)) {
    throw new Error("Invalid email or password.");
  }
  return { id: user.id, email: user.email, ...issueSession(user.id) };
}

export function authenticateRequest(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  return token ? readSession(token) : null;
}

export function logoutRequest(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) sessions.delete(token.split(".")[0]);
}

export function requireAuth(req, res, next) {
  const user = authenticateRequest(req);
  if (!user) return res.status(401).json({ error: "Authentication required." });
  req.user = user;
  next();
}
