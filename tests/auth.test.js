import test from "node:test";
import assert from "node:assert/strict";
import { registerUser, loginUser } from "../src/security/auth.js";

test("register validates credentials before requiring a database", async () => {
  await assert.rejects(() => registerUser({ email: "user@example.com", password: "short" }), /12/);
});

test("login validates credentials before requiring a database", async () => {
  await assert.rejects(() => loginUser({ email: "missing@example.com", password: "short" }), /12/);
});

test("login rejects malformed email before database access", async () => {
  await assert.rejects(() => loginUser({ email: "not-an-email", password: "a-secure-password" }), /valid email/);
});