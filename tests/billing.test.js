import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { CREDIT_PACKS, verifyWebhookSignature } from "../src/services/billing.js";

test("only the three published credit packs are accepted", () => {
  assert.deepEqual(CREDIT_PACKS[99], { amountPaisa: 9900, credits: 1000 });
  assert.deepEqual(CREDIT_PACKS[199], { amountPaisa: 19900, credits: 2500 });
  assert.deepEqual(CREDIT_PACKS[499], { amountPaisa: 49900, credits: 7000 });
  assert.equal(CREDIT_PACKS[1], undefined);
  assert.equal(CREDIT_PACKS[999], undefined);
});

test("webhook verification accepts only a matching SHA-256 HMAC over raw bytes", () => {
  const raw = Buffer.from('{"event":"payment.captured"}');
  const secret = "test-secret";
  const signature = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  assert.equal(verifyWebhookSignature(raw, signature, secret), true);
  assert.equal(verifyWebhookSignature(Buffer.from(raw.toString() + " "), signature, secret), false);
  assert.equal(verifyWebhookSignature(raw, "bad", secret), false);
  assert.equal(verifyWebhookSignature(raw, signature, ""), false);
  assert.equal(verifyWebhookSignature("not bytes", signature, secret), false);
});
