import mongoose from "mongoose";

const IncentiveSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
      index: true,
    },

    incentiveType: {
      type: String,
      enum: [
        "milestone_achievement",
        "team_growth",
        "direct_bonus",
        "monthly_target",
        "seasonal_bonus",
        "loyalty_reward",
        "performance_bonus",
        "referral_bonus",
        "achievement_badge",
        "special_promotion",
      ],
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: null,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    rewardPoints: {
      type: Number,
      default: 0,
      min: 0,
    },

    criteria: {
      minDirectReferrals: {
        type: Number,
        default: 0,
      },
      minTotalDownline: {
        type: Number,
        default: 0,
      },
      minMonthlyVolume: {
        type: Number,
        default: 0,
      },
      requiredLevel: {
        type: Number,
        default: 0,
      },
    },

    status: {
      type: String,
      enum: ["eligible", "ineligible", "qualified", "awarded", "expired", "claimed"],
      default: "eligible",
      index: true,
    },

    qualifiedAt: {
      type: Date,
      default: null,
    },

    awardedAt: {
      type: Date,
      default: null,
    },

    awardedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },

    claimedAt: {
      type: Date,
      default: null,
    },

    expiryDate: {
      type: Date,
      default: null,
    },

    validFrom: {
      type: Date,
      required: true,
    },

    validTo: {
      type: Date,
      default: null,
    },

    campaign: {
      campaignId: mongoose.Schema.Types.ObjectId,
      campaignName: String,
    },

    tier: {
      type: String,
      enum: ["bronze", "silver", "gold", "platinum"],
      default: "bronze",
    },

    notes: {
      type: String,
      default: null,
    },

    termsAccepted: {
      type: Boolean,
      default: false,
    },

    termsAcceptedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for queries
IncentiveSchema.index({ userId: 1, status: 1 });
IncentiveSchema.index({ incentiveType: 1, status: 1 });
IncentiveSchema.index({ expiryDate: 1 });
IncentiveSchema.index({ validFrom: 1, validTo: 1 });
IncentiveSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("Incentive", IncentiveSchema);
