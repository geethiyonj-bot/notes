import crypto from "node:crypto";
import { json } from "../lib/supabase.js";
import { requireUser } from "../lib/require-user.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." });
  try {
    const auth = await requireUser(req, res);
    if (!auth) return;
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return json(res, 503, { error: "Payments are not configured yet. Please try again later." });

    const receipt = `vimal_${auth.user.id.replace(/-/g, "").slice(0, 12)}_${Date.now()}`;
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ amount: 1000, currency: "INR", receipt, notes: { user_id: auth.user.id, plan: "VIMAL monthly unlimited search" } })
    });
    const order = await response.json();
    if (!response.ok) {
      console.error("Razorpay order error:", order);
      return json(res, 502, { error: "Payment gateway could not create an order." });
    }
    return json(res, 200, { orderId: order.id, amount: order.amount, currency: order.currency, keyId });
  } catch (error) {
    console.error("Create order error:", error);
    return json(res, 500, { error: "Could not start payment." });
  }
}
