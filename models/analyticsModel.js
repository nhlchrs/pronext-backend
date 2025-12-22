import mongoose from "mongoose";

const AnalyticsSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true,
    },
    // User Metrics
    totalUsers: {
      type: Number,
      default: 0,
    },
    activeUsers: {
      type: Number,
      default: 0,
    },
    newSignups: {
      type: Number,
      default: 0,
    },
    suspendedUsers: {
      type: Number,
      default: 0,
    },
    blockedUsers: {
      type: Number,
      default: 0,
    },

    // Subscription Metrics
    basicSubscribers: {
      type: Number,
      default: 0,
    },
    premiumSubscribers: {
      type: Number,
      default: 0,
    },
    proSubscribers: {
      type: Number,
      default: 0,
    },

    // Meeting Metrics
    totalMeetings: {
      type: Number,
      default: 0,
    },
    completedMeetings: {
      type: Number,
      default: 0,
    },
    totalMeetingAttendees: {
      type: Number,
      default: 0,
    },

    // Revenue Metrics
    totalRevenue: {
      type: Number,
      default: 0,
    },
    payoutAmount: {
      type: Number,
      default: 0,
    },
    pendingPayouts: {
      type: Number,
      default: 0,
    },

    // Team Metrics
    totalTeams: {
      type: Number,
      default: 0,
    },
    activeTeams: {
      type: Number,
      default: 0,
    },

    // Referral Metrics
    totalReferrals: {
      type: Number,
      default: 0,
    },
    successfulReferrals: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Index for date-based queries
AnalyticsSchema.index({ date: -1 });

export default mongoose.model("Analytics", AnalyticsSchema);

// Payout Trends Schema
export const PayoutTrendSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true,
    },
    totalPayouts: {
      type: Number,
      default: 0,
    },
    successfulPayouts: {
      type: Number,
      default: 0,
    },
    failedPayouts: {
      type: Number,
      default: 0,
    },
    pendingPayouts: {
      type: Number,
      default: 0,
    },
    payoutAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const PayoutTrendModel = mongoose.model("PayoutTrend", PayoutTrendSchema);

// Subscription Trends Schema
export const SubscriptionTrendSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true,
    },
    basicCount: {
      type: Number,
      default: 0,
    },
    premiumCount: {
      type: Number,
      default: 0,
    },
    proCount: {
      type: Number,
      default: 0,
    },
    totalSubscriptions: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const SubscriptionTrendModel = mongoose.model(
  "SubscriptionTrend",
  SubscriptionTrendSchema
);

// Team Growth Schema
export const TeamGrowthSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true,
    },
    newTeams: {
      type: Number,
      default: 0,
    },
    totalTeams: {
      type: Number,
      default: 0,
    },
    activeTeams: {
      type: Number,
      default: 0,
    },
    teamMembersAdded: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const TeamGrowthModel = mongoose.model("TeamGrowth", TeamGrowthSchema);
