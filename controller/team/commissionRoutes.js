import express from "express";
import { requireSignin, isAdmin } from "../../middleware/authMiddleware.js";
import Commission from "../../models/commissionModel.js";
import Payout from "../../models/payoutModel.js";
import {
  getPendingCommissions,
  getTotalPendingAmount,
  getCommissionBreakdown,
  calculateEstimatedEarnings,
} from "../../helpers/commissionService.js";
import logger from "../../helpers/logger.js";

const router = express.Router();
const commissionLogger = logger.module("COMMISSION_API");

/**
 * GET /api/commission/pending
 * Get all pending commissions for the logged-in user
 */
router.get("/commission/pending", requireSignin, async (req, res) => {
  try {
    commissionLogger.start("Fetching pending commissions", { userId: req.user._id });

    const commissions = await getPendingCommissions(req.user._id);

    commissionLogger.success("Pending commissions fetched", {
      userId: req.user._id,
      count: commissions.length,
    });

    return res.status(200).json({
      success: true,
      message: "Pending commissions retrieved successfully",
      data: {
        commissions,
        count: commissions.length,
      },
    });
  } catch (error) {
    commissionLogger.error("Error fetching pending commissions", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching pending commissions",
      error: error.message,
    });
  }
});

/**
 * GET /api/commission/total-pending
 * Get total pending amount for the logged-in user
 */
router.get("/commission/total-pending", requireSignin, async (req, res) => {
  try {
    commissionLogger.start("Calculating total pending amount", { userId: req.user._id });

    const totalAmount = await getTotalPendingAmount(req.user._id);

    commissionLogger.success("Total pending amount calculated", {
      userId: req.user._id,
      amount: totalAmount,
    });

    return res.status(200).json({
      success: true,
      message: "Total pending amount retrieved successfully",
      data: {
        totalPendingAmount: totalAmount,
      },
    });
  } catch (error) {
    commissionLogger.error("Error calculating total pending amount", error);
    return res.status(500).json({
      success: false,
      message: "Error calculating total pending amount",
      error: error.message,
    });
  }
});

/**
 * GET /api/commission/breakdown
 * Get commission breakdown by type for current month/period
 * Query params: startDate, endDate (optional)
 */
router.get("/commission/breakdown", requireSignin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    let end = new Date();
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);

    if (startDate) start = new Date(startDate);
    if (endDate) end = new Date(endDate);

    commissionLogger.start("Fetching commission breakdown", {
      userId: req.user._id,
      startDate: start,
      endDate: end,
    });

    const breakdown = await getCommissionBreakdown(req.user._id, start, end);

    commissionLogger.success("Commission breakdown fetched", {
      userId: req.user._id,
      breakdown,
    });

    return res.status(200).json({
      success: true,
      message: "Commission breakdown retrieved successfully",
      data: {
        breakdown,
        period: {
          startDate: start,
          endDate: end,
        },
      },
    });
  } catch (error) {
    commissionLogger.error("Error fetching commission breakdown", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching commission breakdown",
      error: error.message,
    });
  }
});

/**
 * GET /api/commission/estimated-earnings
 * Get estimated potential earnings for the user
 */
router.get("/commission/estimated-earnings", requireSignin, async (req, res) => {
  try {
    commissionLogger.start("Calculating estimated earnings", { userId: req.user._id });

    const estimatedEarnings = await calculateEstimatedEarnings(req.user._id);

    commissionLogger.success("Estimated earnings calculated", {
      userId: req.user._id,
      earnings: estimatedEarnings,
    });

    return res.status(200).json({
      success: true,
      message: "Estimated earnings calculated successfully",
      data: estimatedEarnings,
    });
  } catch (error) {
    commissionLogger.error("Error calculating estimated earnings", error);
    return res.status(500).json({
      success: false,
      message: "Error calculating estimated earnings",
      error: error.message,
    });
  }
});

/**
 * GET /api/commission/history
 * Get commission history with pagination
 * Query params: page, limit
 */
router.get("/commission/history", requireSignin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    commissionLogger.start("Fetching commission history", {
      userId: req.user._id,
      page,
      limit,
    });

    const commissions = await Commission.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Commission.countDocuments({ userId: req.user._id });

    commissionLogger.success("Commission history fetched", {
      userId: req.user._id,
      count: commissions.length,
      total,
    });

    return res.status(200).json({
      success: true,
      message: "Commission history retrieved successfully",
      data: {
        commissions,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          limit,
        },
      },
    });
  } catch (error) {
    commissionLogger.error("Error fetching commission history", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching commission history",
      error: error.message,
    });
  }
});

/**
 * POST /api/commission/request-payout
 * Request payout for pending commissions
 */
router.post("/commission/request-payout", requireSignin, async (req, res) => {
  try {
    const { amount, payoutMethod, bankDetails, upiId } = req.body;

    commissionLogger.start("Processing payout request", {
      userId: req.user._id,
      amount,
      method: payoutMethod,
    });

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payout amount",
      });
    }

    // Check if user has sufficient pending commissions
    const totalPending = await getTotalPendingAmount(req.user._id);
    if (amount > totalPending) {
      return res.status(400).json({
        success: false,
        message: `Insufficient pending commissions. Available: ${totalPending}`,
      });
    }

    // Validate payout method
    if (!["bank_transfer", "upi", "wallet", "cheque"].includes(payoutMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payout method",
      });
    }

    // Generate reference number
    const referenceNumber = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create payout request
    const payout = await Payout.create({
      userId: req.user._id,
      amount,
      payoutMethod,
      bankDetails: payoutMethod === "bank_transfer" ? bankDetails : undefined,
      upiId: payoutMethod === "upi" ? upiId : undefined,
      status: "pending",
      referenceNumber,
      source: "commission_request",
      requestedAt: new Date(),
    });

    commissionLogger.success("Payout request created", {
      userId: req.user._id,
      payoutId: payout._id,
      amount,
      referenceNumber,
    });

    return res.status(201).json({
      success: true,
      message: "Payout request submitted successfully",
      data: {
        payout,
        referenceNumber,
      },
    });
  } catch (error) {
    commissionLogger.error("Error processing payout request", error);
    return res.status(500).json({
      success: false,
      message: "Error processing payout request",
      error: error.message,
    });
  }
});

/**
 * GET /api/commission/payout-history
 * Get user's payout history
 */
router.get("/commission/payout-history", requireSignin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    commissionLogger.start("Fetching payout history", {
      userId: req.user._id,
      page,
      limit,
    });

    const payouts = await Payout.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Payout.countDocuments({ userId: req.user._id });

    commissionLogger.success("Payout history fetched", {
      userId: req.user._id,
      count: payouts.length,
      total,
    });

    return res.status(200).json({
      success: true,
      message: "Payout history retrieved successfully",
      data: {
        payouts,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          limit,
        },
      },
    });
  } catch (error) {
    commissionLogger.error("Error fetching payout history", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching payout history",
      error: error.message,
    });
  }
});

/**
 * ADMIN: GET /api/admin/commissions
 * Get all commissions (admin only)
 */
router.get("/admin/commissions", requireSignin, isAdmin, async (req, res) => {
  try {
    const { userId, status, type } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    commissionLogger.start("Fetching all commissions (admin)", {
      userId,
      status,
      type,
      page,
      limit,
    });

    const query = {};
    if (userId) query.userId = userId;
    if (status) query.status = status;
    if (type) query.commissionType = type;

    const commissions = await Commission.find(query)
      .populate("userId", "fname lname email")
      .populate("referrerId", "fname lname email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Commission.countDocuments(query);

    commissionLogger.success("All commissions fetched (admin)", {
      count: commissions.length,
      total,
    });

    return res.status(200).json({
      success: true,
      message: "Commissions retrieved successfully",
      data: {
        commissions,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          limit,
        },
      },
    });
  } catch (error) {
    commissionLogger.error("Error fetching commissions (admin)", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching commissions",
      error: error.message,
    });
  }
});

/**
 * ADMIN: POST /api/admin/commission/approve/:id
 * Approve a pending commission
 */
router.post("/admin/commission/approve/:id", requireSignin, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    commissionLogger.start("Approving commission (admin)", { commissionId: id });

    const commission = await Commission.findByIdAndUpdate(
      id,
      {
        status: "approved",
        approvedBy: req.user._id,
        approvedAt: new Date(),
      },
      { new: true }
    );

    if (!commission) {
      return res.status(404).json({
        success: false,
        message: "Commission not found",
      });
    }

    commissionLogger.success("Commission approved (admin)", {
      commissionId: id,
      userId: commission.userId,
      amount: commission.netAmount,
    });

    return res.status(200).json({
      success: true,
      message: "Commission approved successfully",
      data: commission,
    });
  } catch (error) {
    commissionLogger.error("Error approving commission (admin)", error);
    return res.status(500).json({
      success: false,
      message: "Error approving commission",
      error: error.message,
    });
  }
});

/**
 * ADMIN: POST /api/admin/commission/reject/:id
 * Reject a pending commission
 */
router.post("/admin/commission/reject/:id", requireSignin, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    commissionLogger.start("Rejecting commission (admin)", {
      commissionId: id,
      reason,
    });

    const commission = await Commission.findByIdAndUpdate(
      id,
      {
        status: "rejected",
        rejectionReason: reason || "Rejected by admin",
        rejectedAt: new Date(),
      },
      { new: true }
    );

    if (!commission) {
      return res.status(404).json({
        success: false,
        message: "Commission not found",
      });
    }

    commissionLogger.success("Commission rejected (admin)", {
      commissionId: id,
      userId: commission.userId,
      reason,
    });

    return res.status(200).json({
      success: true,
      message: "Commission rejected successfully",
      data: commission,
    });
  } catch (error) {
    commissionLogger.error("Error rejecting commission (admin)", error);
    return res.status(500).json({
      success: false,
      message: "Error rejecting commission",
      error: error.message,
    });
  }
});

export default router;
