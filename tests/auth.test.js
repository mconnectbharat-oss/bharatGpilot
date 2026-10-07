import test from "node:test";
import assert from "node:assert/strict";
import { registerUser, loginUser } from "../src/security/auth.js";

process.env.AUTH_SESSION_SECRET = "test-secret-that-is-at-least-32-characters-long";

test("registers a user and returns a session", () => {
  const result = registerUser({ email: "user-" + Date.now() + "@example.com", password: "a-secure-password" });
  assert.ok(result.id);
  assert.ok(result.token);
  assert.ok(result.expiresAt > Date.now());
});

test("rejects short passwords", () => {
  assert.throws(() => registerUser({ email: "short@example.com", password: "short" }), /at least 12/);
});

test("login rejects invalid credentials", () => {
  assert.throws(() => loginUser({ email: "missing@example.com", password: "wrong-password" }), /Invalid email or password/);
});
