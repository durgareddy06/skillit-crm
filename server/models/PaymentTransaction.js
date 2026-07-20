import mongoose from "mongoose";

const paymentTransactionSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    studentUniqueId: {
      type: String,
      required: true,
    },
    paymentLinkId: {
      type: String,
      required: true,
    },
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    paymentId: {
      type: String,
      default: null,
      index: true,
    },
    signature: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
    status: {
      type: String,
      enum: ["created", "captured", "failed", "refunded"],
      default: "created",
    },
    method: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      default: null,
    },
    contact: {
      type: String,
      default: null,
    },
    errorReason: {
      type: String,
      default: null,
    },
    webhookEvents: [
      {
        eventId: String,
        eventType: String,
        receivedAt: {
          type: Date,
          default: Date.now,
        },
        payload: mongoose.Schema.Types.Mixed,
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("PaymentTransaction", paymentTransactionSchema);
