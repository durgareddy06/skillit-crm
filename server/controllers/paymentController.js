import mongoose from "mongoose";
import Student from "../models/Student.js";
import PaymentTransaction from "../models/PaymentTransaction.js";
import {
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchRazorpayPaymentDetails,
} from "../services/paymentService.js";
import * as emailService from "../services/emailService.js";

/**
 * Initiates payment order with Razorpay
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
export async function createOrder(req, res) {
  try {
    const { studentId, paymentLinkId } = req.body;
    if (!studentId || !paymentLinkId) {
      return res.status(400).json({ message: "studentId and paymentLinkId are required" });
    }

    // Find student in MongoDB
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Locate the specific payment link record
    const paymentLink = student.paymentLinks.find((link) => link.linkId === paymentLinkId);
    if (!paymentLink) {
      return res.status(404).json({ message: "Payment link not found for this student" });
    }

    // Avoid double payment on the same link
    if (paymentLink.status === "Paid") {
      return res.status(400).json({ message: "This payment link has already been paid" });
    }

    const receiptId = `rcpt_${student.id}_${paymentLinkId.slice(-6)}`;
    const amount = paymentLink.amount;

    // Create payment gateway order
    const order = await createRazorpayOrder(amount, receiptId);

    // Save initial transaction record as "created"
    await PaymentTransaction.create({
      studentId: student._id,
      studentUniqueId: student.id,
      paymentLinkId,
      orderId: order.id,
      amount,
      currency: "INR",
      status: "created",
    });

    res.status(201).json({
      orderId: order.id,
      amount: order.amount, // in paise
      currency: order.currency,
      paymentLinkId,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Error creating payment order:", error);
    res.status(500).json({ message: error.message || "Failed to create payment order" });
  }
}

/**
 * Cryptographically verifies client-submitted payment signatures
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
export async function verifyPayment(req, res) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      studentId,
      paymentLinkId,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !studentId || !paymentLinkId) {
      return res.status(400).json({ message: "Missing required verification fields" });
    }

    // Verify signature cryptographically
    const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      return res.status(400).json({ message: "Payment signature verification failed. Invalid payment." });
    }

    // Process verification and update DB
    const result = await processPaymentSuccess({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      studentId,
      paymentLinkId,
      req,
    });

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    res.json({
      success: true,
      message: "Payment verified and recorded successfully",
      student: result.student,
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ message: error.message || "Failed to verify payment" });
  }
}

/**
 * Handles incoming webhooks from Razorpay
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
export async function handleWebhook(req, res) {
  try {
    const signature = req.headers["x-razorpay-signature"];
    if (!signature) {
      return res.status(400).json({ message: "Missing x-razorpay-signature header" });
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      return res.status(400).json({ message: "Request raw body is missing" });
    }

    // Verify webhook signature cryptographically
    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    console.log(`Razorpay webhook event received: ${event}`);

    if (event === "payment.captured" || event === "order.paid") {
      const paymentEntity = payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;

      const transaction = await PaymentTransaction.findOne({ orderId });
      if (transaction) {
        transaction.webhookEvents.push({
          eventId: req.body.created_at?.toString() || Date.now().toString(),
          eventType: event,
          payload: req.body,
        });
        await transaction.save();

        if (transaction.status !== "captured") {
          await processPaymentSuccess({
            orderId,
            paymentId,
            signature: paymentEntity.signature || "webhook_captured",
            studentId: transaction.studentId,
            paymentLinkId: transaction.paymentLinkId,
            req,
          });
        }
      }
    } else if (event === "payment.failed") {
      const paymentEntity = payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const transaction = await PaymentTransaction.findOne({ orderId });
      if (transaction) {
        transaction.status = "failed";
        transaction.errorReason = paymentEntity.error_description || "Payment failed";
        transaction.webhookEvents.push({
          eventId: req.body.created_at?.toString() || Date.now().toString(),
          eventType: event,
          payload: req.body,
        });
        await transaction.save();

        // Send payment failure notification email natively
        const student = await Student.findById(transaction.studentId);
        if (student) {
          let invoiceLink = "";
          if (student.paymentLinks) {
            const link = student.paymentLinks.find((l) => l.linkId === transaction.paymentLinkId);
            if (link) {
              invoiceLink = link.url || "";
            }
          }
          emailService.sendPaymentFailureEmail(student, transaction.amount, transaction.errorReason, invoiceLink).catch((err) => {
            console.error("[Payment Controller] Failed to send payment failure email:", err.message);
          });
        }
      }
    }

    res.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ message: error.message || "Failed to process webhook event" });
  }
}

/**
 * Helper logic to mark payment as successful in DB (idempotent)
 */
async function processPaymentSuccess({ orderId, paymentId, signature, studentId, paymentLinkId, req = null }) {
  const transaction = await PaymentTransaction.findOne({ orderId });
  if (!transaction) {
    return { success: false, message: "Transaction not found for this order" };
  }

  // Idempotency check: if transaction is already processed as captured
  if (transaction.status === "captured") {
    const student = await Student.findById(transaction.studentId);
    return { success: true, student };
  }

  // Fetch payment detail metrics (method, card/upi, contact info) from Razorpay
  let paymentDetails = {};
  try {
    paymentDetails = await fetchRazorpayPaymentDetails(paymentId);
  } catch (error) {
    console.warn("Failed to fetch detailed payment info from Razorpay, falling back:", error);
  }

  // Update transactional log
  transaction.status = "captured";
  transaction.paymentId = paymentId;
  transaction.signature = signature;
  transaction.method = paymentDetails.method || "online";
  transaction.email = paymentDetails.email || null;
  transaction.contact = paymentDetails.contact || null;
  await transaction.save();

  // Find Student
  const student = await Student.findById(transaction.studentId);
  if (!student) {
    return { success: false, message: "Student record not found for transaction" };
  }

  // Update link status
  let linkAmount = transaction.amount;
  if (student.paymentLinks) {
    const linkIndex = student.paymentLinks.findIndex((link) => link.linkId === paymentLinkId);
    if (linkIndex !== -1) {
      student.paymentLinks[linkIndex].status = "Paid";
      linkAmount = student.paymentLinks[linkIndex].amount || transaction.amount;
    }
  }

  // Append new payment details to Payments array
  const paymentRecord = {
    paidDate: new Date().toLocaleDateString("en-GB").replaceAll("/", "-"),
    amount: linkAmount,
    product: "Razorpay Checkout",
    mode: transaction.method || "Online",
    refId: paymentId,
    statementId: paymentDetails.acquirer_data?.rrn || "",
    settlementDate: "",
  };

  student.payments.push(paymentRecord);
  student.paidAmount += linkAmount;

  const netPayable = Math.max(0, Number(student.saleValue || 0) - Number(student.discount || 0));
  student.outstanding = Math.max(0, netPayable - student.paidAmount);
  student.paymentLinkStatus = student.outstanding === 0 ? "Paid" : "Partial";

  await student.save();

  // Trigger native payment success email (attaches invoice PDF and receipt)
  emailService.sendPaymentSuccessEmail(
    student,
    paymentId,
    linkAmount,
    paymentRecord.paidDate,
    student.course || student.program || "Course Fee"
  ).catch((err) => {
    console.error("[Payment Controller] Failed to send payment success email:", err.message);
  });

  // Broadcast payment update via Socket.IO
  const io = req ? req.app.get("io") : null;
  if (io) {
    io.emit("payment-success", { studentId: student._id, amount: linkAmount, student });
    io.emit("student-updated", student);
  }
  
  return { success: true, student };
}

/**
 * Confirm Payment (REST API wrapper over verifyPayment)
 */
export async function confirmPayment(req, res) {
  return verifyPayment(req, res);
}

/**
 * Process a Payment Refund natively
 */
export async function refundPayment(req, res) {
  try {
    const { transactionId } = req.body;
    if (!transactionId) {
      return res.status(400).json({ message: "transactionId is required" });
    }

    const transaction = await PaymentTransaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.status === "refunded") {
      return res.status(400).json({ message: "This transaction is already refunded" });
    }

    // Update transaction status
    transaction.status = "refunded";
    await transaction.save();

    // Find student and update records
    const student = await Student.findById(transaction.studentId);
    if (student) {
      const refundAmount = transaction.amount;
      student.paidAmount = Math.max(0, student.paidAmount - refundAmount);

      const netPayable = Math.max(0, Number(student.saleValue || 0) - Number(student.discount || 0));
      student.outstanding = Math.max(0, netPayable - student.paidAmount);
      student.paymentLinkStatus = student.outstanding === 0 ? "Paid" : "Refunded / Partial";

      if (student.payments) {
        const paymentIndex = student.payments.findIndex(p => p.refId === transaction.paymentId);
        if (paymentIndex !== -1) {
          student.payments[paymentIndex].mode = `${student.payments[paymentIndex].mode} (Refunded)`;
        }
      }

      await student.save();

      // Send refund email natively
      emailService.sendRefundEmail(student, transaction.paymentId || transactionId, refundAmount, new Date().toLocaleDateString("en-GB")).catch((err) => {
        console.error("[Payment Controller] Failed to send refund email:", err.message);
      });

      // Broadcast via Socket.IO
      const io = req.app.get("io");
      if (io) {
        io.emit("payment-refunded", { studentId: student._id, transactionId, refundAmount, student });
        io.emit("student-updated", student);
      }
    }

    res.json({ success: true, message: "Payment refunded and registered", transaction });
  } catch (error) {
    console.error("Error in refundPayment:", error);
    res.status(500).json({ message: error.message || "Failed to process refund" });
  }
}
