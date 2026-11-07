import crypto from "node:crypto";
import { supabaseAdmin, json } from "../lib/supabase.js";

export const config = { api: { bodyParser: false } };
async function readRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." });
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return json(res, 503, { error: "Webhook secret is not configured." });
    const raw = await readRaw(req);
    const received = String(req.headers["x-razorpay-signature"] || "");
    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    const a = Buffer.from(expected, "hex"), b = Buffer.from(received, "hex");
    if (!received || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return json(res, 400, { error: "Invalid webhook signature." });

    const event = JSON.parse(raw.toString("utf8"));
    if (event.event !== "payment.captured") return json(res, 200, { received: true, ignored: true });
    const payment = event.payload?.payment?.entity;
    if (!payment || payment.status !== "captured" || payment.amount !== 1000 || payment.currency !== "INR" || !payment.order_id) {
      return json(res, 200, { received: true, ignored: true });
    }

    const keyId = process.env.RAZORPAY_KEY_ID, keySecret = process.env.RAZORPAY_KEY_SECRET;
    const auth = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
    const orderResponse = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(payment.order_id)}`, { headers: { Authorization: auth } });
    const order = await orderResponse.json();
    const userId = order?.notes?.user_id;
    if (!orderResponse.ok || order.amount !== 1000 || order.currency !== "INR" || !userId) {
      return json(res, 400, { error: "Could not match captured payment to a VIMAL membership order." });
    }
    const db = supabaseAdmin();
    const { error } = await db.rpc("activate_monthly_membership", {
      p_user_id: userId, p_payment_id: payment.id, p_order_id: payment.order_id
    });
    if (error) throw error;
    return json(res, 200, { received: true, activated: true });
  } catch (error) {
    console.error("Razorpay webhook error:", error);
    return json(res, 500, { error: "Webhook processing failed." });
  }
}
