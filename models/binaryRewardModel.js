import mongoose from "mongoose";

/**
 * Binary Reward Schema
 * Tracks physical rewards users can claim when reaching new binary ranks
 */
const BinaryRewardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
      index: true,
    },
    rank: {
      type: String,
      enum: [
        "IGNITOR",
        "SPARK",
        "RISER",
        "PIONEER",
        "INNOVATOR",
        "TRAILBLAZER",
        "CATALYST",
        "MOGUL",
        "VANGUARD",
        "LUMINARY",
        "SOVEREIGN",
        "ZENITH",
      ],
      required: true,
      index: true,
    },
    rewardType: {
      type: String,
      enum: [
        "T-SHIRT",
        "GIFT_HAMPER",
        "OFFICE_BAG",
        "DINNER_SET",
        "HEADPHONES",
        "TITAN_WATCH",
        "PURCHASE_VOUCHER",
        "THAILAND_TOUR_1",
        "THAILAND_TOUR_2",
        "BAJAJ_CHETAK_EV",
        "ROYAL_ENFIELD",
        "CASH_REWARD",
      ],
      required: true,
    },
    rewardValue: {
      type: Number,
      default: 0,
      comment: "For vouchers/cash rewards",
    },
    status: {
      type: String,
      enum: ["AVAILABLE", "CLAIMED", "PROCESSING", "SHIPPED", "DELIVERED"],
      default: "AVAILABLE",
      index: true,
    },
    claimedDate: {
      type: Date,
      default: null,
    },
    shippingAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
      phone: String,
    },
    size: {
      type: String,
      enum: ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "N/A"],
      default: "N/A",
    },
    color: {
      type: String,
      default: null,
    },
    trackingNumber: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
    achievedDate: {
      type: Date,
      default: Date.now,
    },
    processingDate: {
      type: Date,
      default: null,
    },
    shippedDate: {
      type: Date,
      default: null,
    },
    deliveredDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound index for user and rank (one reward per rank per user)
BinaryRewardSchema.index({ userId: 1, rank: 1 }, { unique: true });

// Index for admin filtering
BinaryRewardSchema.index({ status: 1, createdAt: -1 });

// Static method to check if user already claimed reward for a rank
BinaryRewardSchema.statics.hasClaimedReward = async function (userId, rank) {
  const reward = await this.findOne({ userId, rank });
  return reward !== null;
};

// Static method to get available rewards for user
BinaryRewardSchema.statics.getAvailableRewards = async function (userId, currentRank) {
  const ranks = [
    "IGNITOR",
    "SPARK",
    "RISER",
    "PIONEER",
    "INNOVATOR",
    "TRAILBLAZER",
    "CATALYST",
    "MOGUL",
    "VANGUARD",
    "LUMINARY",
    "SOVEREIGN",
    "ZENITH",
  ];

  const currentRankIndex = ranks.indexOf(currentRank);
  if (currentRankIndex === -1) return [];

  // Get all ranks up to and including current rank
  const achievedRanks = ranks.slice(0, currentRankIndex + 1);

  // Find which rewards have been claimed
  const claimedRewards = await this.find({ userId });
  const claimedRanks = claimedRewards.map((r) => r.rank);

  // Return ranks that haven't been claimed
  return achievedRanks.filter((rank) => !claimedRanks.includes(rank));
};

// Instance method to mark as claimed
BinaryRewardSchema.methods.markAsClaimed = async function (shippingAddress, size, color, notes) {
  this.status = "CLAIMED";
  this.claimedDate = new Date();
  this.shippingAddress = shippingAddress;
  this.size = size || "N/A";
  this.color = color || null;
  this.notes = notes || null;
  return await this.save();
};

// Instance method to update status
BinaryRewardSchema.methods.updateStatus = async function (status, additionalData = {}) {
  this.status = status;

  if (status === "PROCESSING") {
    this.processingDate = new Date();
  } else if (status === "SHIPPED") {
    this.shippedDate = new Date();
    if (additionalData.trackingNumber) {
      this.trackingNumber = additionalData.trackingNumber;
    }
  } else if (status === "DELIVERED") {
    this.deliveredDate = new Date();
  }

  return await this.save();
};

const BinaryReward = mongoose.model("BinaryReward", BinaryRewardSchema);

export default BinaryReward;
