import mongoose from "mongoose";

const TeamSchema = new mongoose.Schema(
  {
    teamName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },

    teamLead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
      index: true,
    },

    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
        index: true,
      },
    ],

    description: {
      type: String,
      default: null,
    },

    totalMembers: {
      type: Number,
      default: 0,
    },

    totalEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalCommissionsPaid: {
      type: Number,
      default: 0,
      min: 0,
    },

    tier: {
      type: String,
      enum: ["bronze", "silver", "gold", "platinum"],
      default: "bronze",
    },

    performanceScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    targetAchieved: {
      type: Boolean,
      default: false,
    },

    monthlyTarget: {
      type: Number,
      default: 0,
      min: 0,
    },

    currentMonthEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },

    suspendedAt: {
      type: Date,
      default: null,
    },

    suspensionReason: {
      type: String,
      default: null,
    },

    suspendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes
TeamSchema.index({ teamLead: 1, isActive: 1 });
TeamSchema.index({ createdAt: -1 });
TeamSchema.index({ tier: 1, performanceScore: -1 });

export default mongoose.model("Team", TeamSchema);
