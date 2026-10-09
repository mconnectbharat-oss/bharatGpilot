import crypto from "node:crypto";
import Razorpay from "razorpay";
import { getDb } from "./db.js";

export const CREDIT_PACKS = Object.freeze({
  99: Object.freeze({ amountPaisa: 9900, credits: 1000 }),
  199: Object.freeze({ amountPaisa: 19900, credits: 2500 }),
  499: Object.freeze({ amountPaisa: 49900, credits: 7000 })
});

export function verifyWebhookSignature(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || !signature || !secret || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const supplied = Buffer.from(signature, "hex");
  const calculated = Buffer.from(expected, "hex");
  return supplied.length === calculated.length && crypto.timingSafeEqual(supplied, calculated);
}

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay order creation is not configured.");
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export async function createBillingOrder(userId, packRupees) {
  const pack = CREDIT_PACKS[Number(packRupees)];
  if (!userId || !pack) {
    const error = new Error("Choose a valid credit package.");
    error.statusCode = 400;
    throw error;
  }
  const pool = getDb();
  const client = getRazorpayClient();
  const receipt = `bgp_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
  const order = await client.orders.create({
    amount: pack.amountPaisa,
    currency: "INR",
    receipt,
    notes: { user_id: String(userId) }
  });
  if (!order?.id || order.amount !== pack.amountPaisa || order.currency !== "INR") {
    throw new Error("Payment provider returned an invalid order.");
  }
  await pool.query(
    "INSERT INTO billing_orders (razorpay_order_id,user_id,amount_paisa,credits,status) VALUES ($1,$2,$3,$4,'created')",
    [order.id, userId, pack.amountPaisa, pack.credits]
  );
  return { id: order.id, amount: pack.amountPaisa, currency: "INR", keyId: process.env.RAZORPAY_KEY_ID };
}

export async function processRazorpayWebhook(rawBody, signature) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    const error = new Error("Invalid webhook signature.");
    error.statusCode = 400;
    throw error;
  }
  let event;
  try { event = JSON.parse(rawBody.toString("utf8")); }
  catch { const error = new Error("Invalid webhook payload."); error.statusCode = 400; throw error; }
  if (event?.event !== "payment.captured") return { status: "event_ignored" };

  const payment = event?.payload?.payment?.entity;
  const orderId = payment?.order_id;
  const paymentId = payment?.id;
  const amount = payment?.amount;
  if (typeof orderId !== "string" || typeof paymentId !== "string" || !Number.isSafeInteger(amount) || amount <= 0) {
    const error = new Error("Invalid captured-payment payload.");
    error.statusCode = 400;
    throw error;
  }

  const pool = getDb();
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const found = await db.query(
      "SELECT user_id,amount_paisa,credits,status FROM billing_orders WHERE razorpay_order_id=$1 FOR UPDATE",
      [orderId]
    );
    const order = found.rows[0];
    if (!order) {
      await db.query("ROLLBACK");
      return { status: "order_not_found" };
    }
    if (Number(order.amount_paisa) !== amount) {
      await db.query("ROLLBACK");
      const error = new Error("Captured amount does not match the order.");
      error.statusCode = 400;
      throw error;
    }
    if (order.status === "paid") {
      await db.query("COMMIT");
      return { status: "already_processed" };
    }
    await db.query(
      "INSERT INTO credit_wallets (user_id,balance) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET balance=credit_wallets.balance+EXCLUDED.balance,updated_at=now()",
      [order.user_id, order.credits]
    );
    await db.query(
      "INSERT INTO credit_ledger (user_id,razorpay_order_id,razorpay_payment_id,amount_paisa,credits) VALUES ($1,$2,$3,$4,$5)",
      [order.user_id, orderId, paymentId, amount, order.credits]
    );
    await db.query(
      "UPDATE billing_orders SET status='paid',razorpay_payment_id=$2,paid_at=now() WHERE razorpay_order_id=$1",
      [orderId, paymentId]
    );
    await db.query("COMMIT");
    return { status: "event_processed" };
  } catch (error) {
    try { await db.query("ROLLBACK"); } catch {}
    if (error.code === "23505") return { status: "already_processed" };
    throw error;
  } finally {
    db.release();
  }
}
