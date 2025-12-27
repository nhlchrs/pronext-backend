import kycModel from "../../models/kycModel.js";
import userModel from "../../models/authModel.js";
import eventBus from "../../services/eventBus.js";
import {
  ErrorResponse,
  successResponse,
  notFoundResponse,
  successResponseWithData,
} from "../../helpers/apiResponse.js";
import logger from "../../helpers/logger.js";

const kycLogger = logger.module("KYC_CONTROLLER");

/**
 * Get all KYC records (Admin only)
 * GET /api/admin/kyc/list
 */
export const getAllKYCRecords = async (req, res) => {
  try {
    kycLogger.start("Fetching all KYC records");

    const kycRecords = await kycModel
      .find()
      .populate("userId", "email fname lname phone")
      .populate("verifiedBy", "fname lname email")
      .populate("rejectedBy", "fname lname email")
      .sort({ createdAt: -1 });

    if (!kycRecords || kycRecords.length === 0) {
      kycLogger.info("No KYC records found");
      return successResponseWithData(res, [], "No KYC records found");
    }

    kycLogger.success(`Retrieved ${kycRecords.length} KYC records`);
    return successResponseWithData(
      res,
      kycRecords,
      "KYC records retrieved successfully"
    );
  } catch (error) {
    kycLogger.error("Error fetching KYC records", error);
    return ErrorResponse(
      res,
      "Error fetching KYC records: " + error.message,
      500
    );
  }
};

/**
 * Get KYC record by ID (Admin & User)
 * GET /api/admin/kyc/:kycId
 * GET /api/kyc/:kycId
 */
export const getKYCById = async (req, res) => {
  try {
    const { kycId } = req.params;
    kycLogger.start("Fetching KYC record", { kycId });

    const kycRecord = await kycModel
      .findById(kycId)
      .populate("userId", "email fname lname phone")
      .populate("verifiedBy", "fname lname email")
      .populate("rejectedBy", "fname lname email");

    if (!kycRecord) {
      kycLogger.warn("KYC record not found", { kycId });
      return notFoundResponse(res, "KYC record not found");
    }

    kycLogger.success("KYC record retrieved", { kycId });
    return successResponseWithData(
      res,
      kycRecord,
      "KYC record retrieved successfully"
    );
  } catch (error) {
    kycLogger.error("Error fetching KYC record", error);
    return ErrorResponse(res, "Error fetching KYC record: " + error.message, 500);
  }
};

/**
 * Submit KYC documents (User)
 * POST /api/kyc/submit
 */
export const submitKYC = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      documentType,
      documentNumber,
      documentImageUrl,
      backImageUrl,
      fullName,
      dateOfBirth,
      gender,
      address,
    } = req.body;

    kycLogger.start("User submitting KYC", { userId });

    // Validate required fields
    if (
      !documentType ||
      !documentNumber ||
      !documentImageUrl ||
      !fullName ||
      !dateOfBirth ||
      !gender
    ) {
      kycLogger.warn("Missing required KYC fields", { userId });
      return ErrorResponse(res, "All required fields must be provided", 400);
    }

    // Check if user already has a KYC record
    const existingKYC = await kycModel.findOne({ userId });
    if (existingKYC) {
      kycLogger.info("User already has KYC record", { userId });
      
      // Update existing record
      existingKYC.documentType = documentType;
      existingKYC.documentNumber = documentNumber;
      existingKYC.documentImageUrl = documentImageUrl;
      existingKYC.backImageUrl = backImageUrl || null;
      existingKYC.fullName = fullName;
      existingKYC.dateOfBirth = new Date(dateOfBirth);
      existingKYC.gender = gender;
      existingKYC.address = address || {};
      existingKYC.status = "pending";
      existingKYC.resubmissionCount = (existingKYC.resubmissionCount || 0) + 1;
      existingKYC.lastResubmittedAt = new Date();

      await existingKYC.save();
      
      // Emit event
      eventBus.emitKYCSubmitted(userId, existingKYC);

      kycLogger.success("KYC resubmitted successfully", { userId });
      return successResponseWithData(
        res,
        existingKYC,
        "KYC resubmitted for verification"
      );
    }

    // Create new KYC record
    const newKYC = new kycModel({
      userId,
      documentType,
      documentNumber,
      documentImageUrl,
      backImageUrl: backImageUrl || null,
      fullName,
      dateOfBirth: new Date(dateOfBirth),
      gender,
      address: address || {},
      status: "pending",
      resubmissionCount: 0,
    });

    await newKYC.save();

    // Emit event
    eventBus.emitKYCSubmitted(userId, newKYC);

    kycLogger.success("KYC submitted successfully", { userId });
    return successResponseWithData(res, newKYC, "KYC submitted for verification", 201);
  } catch (error) {
    kycLogger.error("Error submitting KYC", error);
    return ErrorResponse(res, "Error submitting KYC: " + error.message, 500);
  }
};

/**
 * Get user's KYC status (User)
 * GET /api/kyc/status
 */
export const getKYCStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    kycLogger.start("Fetching KYC status", { userId });

    const kycRecord = await kycModel
      .findOne({ userId })
      .populate("verifiedBy", "fname lname email")
      .populate("rejectedBy", "fname lname email");

    if (!kycRecord) {
      kycLogger.info("No KYC record found for user", { userId });
      return successResponseWithData(
        res,
        { status: "not_submitted", message: "KYC not yet submitted" },
        "KYC status retrieved"
      );
    }

    kycLogger.success("KYC status retrieved", { userId, status: kycRecord.status });
    return successResponseWithData(
      res,
      {
        status: kycRecord.status,
        submittedAt: kycRecord.createdAt,
        verifiedAt: kycRecord.verifiedAt,
        rejectedAt: kycRecord.rejectedAt,
        rejectionReason: kycRecord.rejectionReason,
        resubmissionCount: kycRecord.resubmissionCount,
        expiryDate: kycRecord.expiryDate,
        verificationNotes: kycRecord.verificationNotes,
      },
      "KYC status retrieved successfully"
    );
  } catch (error) {
    kycLogger.error("Error fetching KYC status", error);
    return ErrorResponse(res, "Error fetching KYC status: " + error.message, 500);
  }
};

/**
 * Verify KYC documents (Admin only)
 * POST /api/admin/kyc/verify
 */
export const verifyKYC = async (req, res) => {
  try {
    const adminId = req.user._id;
    const { kycId, verificationNotes } = req.body;

    kycLogger.start("Admin verifying KYC", { kycId, adminId });

    // Validate input
    if (!kycId) {
      kycLogger.warn("Missing KYC ID", { adminId });
      return ErrorResponse(res, "KYC ID is required", 400);
    }

    // Find KYC record
    const kycRecord = await kycModel.findById(kycId);
    if (!kycRecord) {
      kycLogger.warn("KYC record not found", { kycId });
      return notFoundResponse(res, "KYC record not found");
    }

    // Update KYC record
    kycRecord.status = "verified";
    kycRecord.verifiedAt = new Date();
    kycRecord.verifiedBy = adminId;
    kycRecord.verificationNotes = verificationNotes || "Verified by admin";

    await kycRecord.save();

    // Emit event
    eventBus.emitKYCVerified(kycRecord.userId, kycRecord);

    kycLogger.success("KYC verified successfully", { kycId });
    return successResponseWithData(
      res,
      kycRecord,
      "KYC verified successfully"
    );
  } catch (error) {
    kycLogger.error("Error verifying KYC", error);
    return ErrorResponse(res, "Error verifying KYC: " + error.message, 500);
  }
};

/**
 * Reject KYC documents (Admin only)
 * POST /api/admin/kyc/reject
 */
export const rejectKYC = async (req, res) => {
  try {
    const adminId = req.user._id;
    const { kycId, rejectionReason } = req.body;

    kycLogger.start("Admin rejecting KYC", { kycId, adminId });

    // Validate input
    if (!kycId || !rejectionReason) {
      kycLogger.warn("Missing required fields for rejection", { adminId });
      return ErrorResponse(
        res,
        "KYC ID and rejection reason are required",
        400
      );
    }

    // Find KYC record
    const kycRecord = await kycModel.findById(kycId);
    if (!kycRecord) {
      kycLogger.warn("KYC record not found", { kycId });
      return notFoundResponse(res, "KYC record not found");
    }

    // Update KYC record
    kycRecord.status = "rejected";
    kycRecord.rejectedAt = new Date();
    kycRecord.rejectedBy = adminId;
    kycRecord.rejectionReason = rejectionReason;

    await kycRecord.save();

    // Emit event
    eventBus.emitKYCRejected(kycRecord.userId, rejectionReason);

    kycLogger.success("KYC rejected successfully", { kycId });
    return successResponseWithData(
      res,
      kycRecord,
      "KYC rejected successfully"
    );
  } catch (error) {
    kycLogger.error("Error rejecting KYC", error);
    return ErrorResponse(res, "Error rejecting KYC: " + error.message, 500);
  }
};

/**
 * Get KYC statistics (Admin only)
 * GET /api/admin/kyc/stats
 */
export const getKYCStatistics = async (req, res) => {
  try {
    kycLogger.start("Fetching KYC statistics");

    const totalKYC = await kycModel.countDocuments();
    const pendingKYC = await kycModel.countDocuments({ status: "pending" });
    const verifiedKYC = await kycModel.countDocuments({ status: "verified" });
    const rejectedKYC = await kycModel.countDocuments({ status: "rejected" });
    const expiredKYC = await kycModel.countDocuments({ status: "expired" });

    const stats = {
      totalKYC,
      pendingKYC,
      verifiedKYC,
      rejectedKYC,
      expiredKYC,
      verificationRate:
        totalKYC > 0 ? ((verifiedKYC / totalKYC) * 100).toFixed(2) : 0,
      rejectionRate: totalKYC > 0 ? ((rejectedKYC / totalKYC) * 100).toFixed(2) : 0,
    };

    kycLogger.success("KYC statistics retrieved", stats);
    return successResponseWithData(
      res,
      stats,
      "KYC statistics retrieved successfully"
    );
  } catch (error) {
    kycLogger.error("Error fetching KYC statistics", error);
    return ErrorResponse(res, "Error fetching KYC statistics: " + error.message, 500);
  }
};
