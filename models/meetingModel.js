import mongoose from "mongoose";

const MeetingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number, // in minutes
      required: true,
      default: 60,
    },
    zoomMeetingId: {
      type: String,
      required: true,
      unique: true,
    },
    zoomLink: {
      type: String,
      required: true,
    },
    zoomPasscode: {
      type: String,
      default: "",
    },
    hostId: {
      type: String,
      default: "", // Zoom host ID
    },
    status: {
      type: String,
      enum: ["scheduled", "ongoing", "completed", "cancelled"],
      default: "scheduled",
    },
    allowedSubscriptionTiers: {
      type: [String],
      enum: ["Basic", "Premium", "Pro", "Free"],
      default: ["Premium", "Pro"], // Only Premium and Pro by default
    },
    allowedLevels: {
      type: [String],
      enum: ["Beginner", "Intermediate", "Advanced", "Expert"],
      default: ["Beginner", "Intermediate", "Advanced", "Expert"],
    },
    maxAttendees: {
      type: Number,
      default: null, // null means unlimited
    },
    topic: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    attendees: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Users",
        },
        joinedAt: Date,
        leftAt: Date,
        isPresent: Boolean,
      },
    ],
    meetingStartedAt: {
      type: Date,
      default: null,
    },
    meetingEndedAt: {
      type: Date,
      default: null,
    },
    recordingUrl: {
      type: String,
      default: null,
    },
    totalAttendees: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: "",
    },
    tags: [String],
    isRecorded: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index for scheduled date
MeetingSchema.index({ scheduledAt: 1 });
MeetingSchema.index({ status: 1 });
MeetingSchema.index({ createdBy: 1 });
MeetingSchema.index({ allowedSubscriptionTiers: 1 });

export default mongoose.model("Meeting", MeetingSchema);
