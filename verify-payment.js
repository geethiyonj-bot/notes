import crypto from "node:crypto";
import { json } from "../lib/supabase.js";
import { requireUser } from "../lib/require-user.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." });
  try {
    const auth = await requireUser(req, res);
    if (!auth) return;
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if (![orderId, paymentId, signature].every(v => typeof v === "string" && v.length > 5)) {
      return json(res, 400, { error: "Payment verification details are incomplete." });
    }
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return json(res, 503, { error: "Payment verification is not configured." });

    const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
    const expectedBuf = Buffer.from(expected, "hex");
    const suppliedBuf = Buffer.from(signature, "hex");
    if (expectedBuf.length !== suppliedBuf.length || !crypto.timingSafeEqual(expectedBuf, suppliedBuf)) {
      return json(res, 400, { error: "Payment signature could not be verified." });
    }

    const authHeader = `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${secret}`).toString("base64")}`;
    const [paymentResponse, orderResponse] = await Promise.all([
      fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: authHeader } }),
      fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, { headers: { Authorization: authHeader } })
    ]);
    const [payment, order] = await Promise.all([paymentResponse.json(), orderResponse.json()]);
    if (!paymentResponse.ok || !orderResponse.ok || payment.order_id !== orderId ||
        payment.amount !== 1000 || payment.currency !== "INR" || payment.status !== "captured" ||
        order.amount !== 1000 || order.currency !== "INR" || order.notes?.user_id !== auth.user.id) {
      return json(res, 402, { error: "Payment is not captured, belongs to another account, or does not match the ₹10 monthly plan. Please contact support if money was deducted." });
    }

    const { data, error } = await auth.db.rpc("activate_monthly_membership", {
      p_user_id: auth.user.id,
      p_payment_id: paymentId,
      p_order_id: orderId
    });
    if (error) throw error;
    return json(res, 200, { success: true, expiresAt: data?.[0]?.expires_at || null, message: "Your unlimited-search pass is active." });
  } catch (error) {
    console.error("Payment verification error:", error);
    return json(res, 500, { error: "Payment was received but activation could not be completed. Contact support with your payment ID." });
  }
}
