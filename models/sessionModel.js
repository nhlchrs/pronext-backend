import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
      index: true,
    },

    token: {
      type: String,
      required: true,
      unique: true,
    },

    ipAddress: {
      type: String,
    },

    userAgent: {
      type: String,
    },

    deviceInfo: {
      type: String,
      default: "Unknown",
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    loginTime: {
      type: Date,
      default: Date.now,
    },

    lastActivityTime: {
      type: Date,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Auto-delete expired sessions
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Session", SessionSchema);
