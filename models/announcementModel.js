import mongoose from "mongoose";

const AnnouncementSchema = new mongoose.Schema(
  {
    // Core Fields
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },
    description: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 5000,
    },

    // Classification
    type: {
      type: String,
      enum: ["announcement", "promotion", "news"],
      required: true,
      index: true,
    },
    flag: {
      type: String,
      enum: ["important", "promotional"],
      default: "important",
      index: true,
    },

    // Media
    image: {
      type: String,
      default: null,
    },

    // Schedule
    startDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    endDate: {
      type: Date,
      default: null,
    },

    // Targeting
    targetUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
      },
    ],

    // Status
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Analytics
    views: {
      type: Number,
      default: 0,
    },
    clicks: {
      type: Number,
      default: 0,
    },
    engagementRate: {
      type: Number,
      default: 0,
    },

    // Audit
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },

    // Additional Info
    tags: [String],
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    actionUrl: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for performance
AnnouncementSchema.index({ type: 1, flag: 1, isActive: 1 });
AnnouncementSchema.index({ startDate: 1, endDate: 1 });
AnnouncementSchema.index({ createdAt: -1 });
AnnouncementSchema.index({ views: -1, clicks: -1 });

// Calculate engagement rate before save
AnnouncementSchema.pre("save", function (next) {
  if (this.views > 0) {
    this.engagementRate = (this.clicks / this.views) * 100;
  }
  next();
});

export default mongoose.model("Announcements", AnnouncementSchema);
