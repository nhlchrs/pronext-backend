import mongoose from "mongoose";

const KYCDocumentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
      unique: true,
      index: true,
    },

    documentType: {
      type: String,
      enum: ["aadhar", "pancard", "passport", "driving_license"],
      required: true,
    },

    documentNumber: {
      type: String,
      required: true,
      trim: true,
    },

    documentImageUrl: {
      type: String,
      required: true,
    },

    backImageUrl: {
      type: String,
      default: null,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    dateOfBirth: {
      type: Date,
      required: true,
    },

    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      required: true,
    },

    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },

    status: {
      type: String,
      enum: ["pending", "verified", "rejected", "expired"],
      default: "pending",
      index: true,
    },

    verificationNotes: {
      type: String,
      default: null,
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

    expiryDate: {
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

    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },

    resubmissionCount: {
      type: Number,
      default: 0,
    },

    lastResubmittedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Index for queries
KYCDocumentSchema.index({ status: 1, createdAt: -1 });
KYCDocumentSchema.index({ verifiedAt: -1 });

export default mongoose.model("KYCDocument", KYCDocumentSchema);
