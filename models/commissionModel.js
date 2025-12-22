import mongoose from "mongoose";

const CommissionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
      index: true,
    },

    referrerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
      index: true,
    },

    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payments",
      default: null,
    },

    commissionType: {
      type: String,
      enum: ["direct_bonus", "level_income", "binary_bonus", "reward_bonus"],
      required: true,
      index: true,
    },

    level: {
      type: Number,
      required: true,
      min: 1,
      max: 4,
    },

    grossAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    taxPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    netAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "processing", "paid", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },

    payoutId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payout",
      default: null,
    },

    earningDate: {
      type: Date,
      required: true,
      index: true,
    },

    period: {
      month: Number,
      year: Number,
    },

    description: {
      type: String,
      default: null,
    },

    notes: {
      type: String,
      default: null,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for queries
CommissionSchema.index({ userId: 1, status: 1 });
CommissionSchema.index({ referrerId: 1, commissionType: 1 });
CommissionSchema.index({ earningDate: -1 });
CommissionSchema.index({ "period.month": 1, "period.year": 1 });
CommissionSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("Commission", CommissionSchema);
