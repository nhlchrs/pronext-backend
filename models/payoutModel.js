import mongoose from "mongoose";

const PayoutSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    payoutMethod: {
      type: String,
      enum: ["bank_transfer", "upi", "wallet", "cheque"],
      required: true,
    },

    bankDetails: {
      accountHolderName: String,
      accountNumber: String,
      ifscCode: String,
      bankName: String,
    },

    upiId: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "cancelled"],
      default: "pending",
      index: true,
    },

    transactionId: {
      type: String,
      default: null,
      sparse: true,
      unique: true,
    },

    referenceNumber: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },

    source: {
      type: String,
      enum: ["direct_bonus", "level_income", "binary_bonus", "reward_bonus", "manual_credit"],
      required: true,
    },

    description: {
      type: String,
      default: null,
    },

    requestedAt: {
      type: Date,
      default: Date.now,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    failureReason: {
      type: String,
      default: null,
    },

    notes: {
      type: String,
      default: null,
    },

    taxDeducted: {
      type: Number,
      default: 0,
      min: 0,
    },

    netAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    period: {
      month: Number,
      year: Number,
    },
  },
  { timestamps: true }
);

// Indexes for queries
PayoutSchema.index({ userId: 1, status: 1 });
PayoutSchema.index({ createdAt: -1 });
PayoutSchema.index({ status: 1, createdAt: -1 });
PayoutSchema.index({ "period.month": 1, "period.year": 1 });

export default mongoose.model("Payout", PayoutSchema);
