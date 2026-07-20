import crypto from "crypto";

// Read Razorpay environment variables
const getRazorpayConfig = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  return { keyId, keySecret, webhookSecret };
};

/**
 * Creates an order in Razorpay using REST API
 * @param {number} amount - Amount in INR (will be converted to paise)
 * @param {string} receiptId - Unique identifier for receipt mapping
 * @returns {Promise<object>} Razorpay order details
 */
export async function createRazorpayOrder(amount, receiptId) {
  const { keyId, keySecret } = getRazorpayConfig();
  if (!keyId || !keySecret) {
    throw new Error("Razorpay API credentials (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET) are not set.");
  }

  // Convert amount to paise (subunit)
  const amountInPaise = Math.round(amount * 100);

  const authHeader = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authHeader,
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency: "INR",
      receipt: receiptId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Razorpay order creation failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Verifies standard Razorpay checkout signature
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Signature received from checkout
 * @returns {boolean} True if verification matches
 */
export function verifyPaymentSignature(orderId, paymentId, signature) {
  const { keySecret } = getRazorpayConfig();
  if (!keySecret) {
    throw new Error("Razorpay secret (RAZORPAY_KEY_SECRET) is not configured.");
  }

  const payload = `${orderId}|${paymentId}`;
  const generatedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(payload)
    .digest("hex");

  return generatedSignature === signature;
}

/**
 * Cryptographically validates the webhook signature
 * Uses timingSafeEqual to protect against timing attacks.
 * @param {Buffer|string} rawBody - Raw body buffer of the request
 * @param {string} expectedSignature - Signature header value
 * @returns {boolean} True if signature is valid
 */
export function verifyWebhookSignature(rawBody, expectedSignature) {
  const { webhookSecret } = getRazorpayConfig();
  if (!webhookSecret) {
    throw new Error("Razorpay Webhook secret (RAZORPAY_WEBHOOK_SECRET) is not configured.");
  }

  if (!rawBody || !expectedSignature) {
    return false;
  }

  const generatedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(generatedSignature, "utf8"),
      Buffer.from(expectedSignature, "utf8")
    );
  } catch (error) {
    return false;
  }
}



/**
 * Fetches transaction/payment details directly from Razorpay
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Promise<object>} Razorpay payment details object
 */
export async function fetchRazorpayPaymentDetails(paymentId) {
  const { keyId, keySecret } = getRazorpayConfig();
  if (!keyId || !keySecret) {
    throw new Error("Razorpay API credentials (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET) are not set.");
  }

  const authHeader = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    method: "GET",
    headers: {
      "Authorization": authHeader,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch Razorpay payment details: ${response.status} - ${errorText}`);
  }

  return response.json();
}
