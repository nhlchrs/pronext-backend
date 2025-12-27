import mongoose from "mongoose";

// Team Member Schema
const TeamMemberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
      unique: true,
      index: true,
    },
    sponsorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TeamMember",
      default: null,
      index: true,
    },
    referralCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    teamMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
      },
    ],
    directCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalDownline: {
      type: Number,
      default: 0,
      min: 0,
    },
    level: {
      type: Number,
      default: 0,
      min: 0,
    },
    levelQualified: {
      type: Boolean,
      default: false,
    },
    levelQualifiedDate: {
      type: Date,
      default: null,
    },
    packagePrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastPayoutDate: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Referral Schema
const ReferralSchema = new mongoose.Schema(
  {
    referrerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
      index: true,
    },
    referredUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    referralCode: {
      type: String,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    referralDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    approvalDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Bonus Schema
const BonusSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
      index: true,
    },
    bonusType: {
      type: String,
      enum: ["direct", "level", "achievement", "referral"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    percentage: {
      type: Number,
      default: 0,
      min: 0,
    },
    level: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "paid", "cancelled"],
      default: "pending",
      index: true,
    },
    description: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Commission Schema
const CommissionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
      unique: true,
      index: true,
    },
    totalCommission: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPending: {
      type: Number,
      default: 0,
      min: 0,
    },
    payoutHistory: [
      {
        amount: {
          type: Number,
          required: true,
        },
        date: {
          type: Date,
          default: Date.now,
        },
        method: {
          type: String,
          enum: ["bank_transfer", "paypal", "crypto", "pending"],
          default: "pending",
        },
        status: {
          type: String,
          enum: ["pending", "completed", "failed"],
          default: "pending",
        },
        transactionId: {
          type: String,
          default: null,
        },
      },
    ],
    lastPayoutDate: {
      type: Date,
      default: null,
    },
    nextPayoutDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Team Schema (keep existing for backward compatibility)
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
TeamMemberSchema.index({ userId: 1, isActive: 1 });
TeamMemberSchema.index({ sponsorId: 1 });
ReferralSchema.index({ referrerId: 1, referralDate: -1 });
BonusSchema.index({ userId: 1, status: 1 });
CommissionSchema.index({ userId: 1 });

// Export Models
export const Team = mongoose.model("Team", TeamSchema);
export const TeamMember = mongoose.model("TeamMember", TeamMemberSchema);
export const Referral = mongoose.model("Referral", ReferralSchema);
export const Bonus = mongoose.model("Bonus", BonusSchema);
export const Commission = mongoose.model("Commission", CommissionSchema);

export default Team;
