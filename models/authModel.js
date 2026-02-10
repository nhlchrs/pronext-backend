import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    fname: {
        type: String,
        required: true,
        trim: true
    },
    lname: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    subscriptionStatus: {
        type:Boolean,
        default: false
    },
    phone:{
        type: String,
        required: true,
    },
    
    address: {
        type: String,
    },
    
    profilePicture: {
        type: String,
        default: null,
    },
    
    referralCode : {
        type: String,
        
    },
    password: {
        type: String,
        required: true,
    },
    otp: {
        type: String,
        default : "",
    },
  dailyLoginCount: {
    type: Number,
    default: 0,
  },
  lastLoginDate: {
    type: Date,
    default: null,
  },
  isSuspended: {
    type: Boolean,
    default: false,
  },
  suspensionReason: {
    type: String,
    default: null,
  },
  suspendedAt: {
    type: Date,
    default: null,
  },
  suspendedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    default: null,
  },
  reactivatedAt: {
    type: Date,
    default: null,
  },
  reactivatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    default: null,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  blockReason: {
    type: String,
    default: null,
  },
  blockedAt: {
    type: Date,
    default: null,
  },
  blockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    default: null,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  dob: {
    type: Date,
    default: null,
  },
  subscriptionTier: {
    type: String,
    enum: ["Basic", "Premium", "Pro"],
    default: "Basic",
    index: true,
  },
  subscriptionExpiryDate: {
    type: Date,
    default: null,
  },
  level: {
    type: Number,
    default: 0,
    min: 0,
    max: 4,
    index: true,
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Team",
    default: null,
  },
  sponsorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    default: null,
    index: true,
  },
  kycStatus: {
    type: String,
    enum: ["pending", "verified", "rejected", "expired"],
    default: "pending",
    index: true,
  },
  kycVerifiedAt: {
    type: Date,
    default: null,
  },
  kycVerifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    default: null,
  },
  kycDocumentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "KYCDocument",
    default: null,
  },
  totalCommissionEarned: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalPayoutRequested: {
    type: Number,
    default: 0,
    min: 0,
  },
  walletBalance: {
    type: Number,
    default: 0,
    min: 0,
  },
  directReferralCount: {
    type: Number,
    default: 0,
    index: true,
  },
  totalDownlineCount: {
    type: Number,
    default: 0,
  },
  role: {
    type: String,
    enum: ["User", "Admin", "Finance", "Support", "Educator"],
    default: "User"
  },
  termsAgreed: {
    type: Boolean,
    default: false,
  },
  termsAgreedAt: {
    type: Date,
    default: null,
  },
  // Crypto wallet preferences
  cryptoWalletAddress: {
    type: String,
    default: null,
    trim: true,
  },
  cryptoCurrency: {
    type: String,
    enum: ["USDT", "BTC", null],
    default: null,
  },
  cryptoWalletUpdatedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

export default mongoose.model("Users", UserSchema);
