import express from "express";
import { requireSignin, isAdmin } from "../../middleware/authMiddleware.js";
import {
  getAllTeams,
  getTeamById,
  getTeamMembers,
  getTeamStatistics,
  verifyTeam,
  suspendTeam,
  reactivateTeam,
  updateTeamTier,
  removeTeamMember,
  addTeamMember,
  updateTeam,
  deleteTeam,
  getAllTeamMembers,
  createTeamMember,
  setTeamSponsor,
  deleteTeamMember,
  updateTeamMember,
} from "./adminTeamController.js";
import { getDownlineStructure } from "./teamController.js";
import Payout from "../../models/payoutModel.js";
import User from "../../models/authModel.js";
import logger from "../../helpers/logger.js";

const adminPayoutLogger = logger.module("ADMIN_PAYOUT");

const router = express.Router();

// ==================== ADMIN TEAM MANAGEMENT ROUTES ====================
// All routes require authentication and admin role - apply middleware to each route individually

// Team List & Statistics
router.get("/admin/team/list", requireSignin, isAdmin, getAllTeams);
router.get("/admin/team/statistics", requireSignin, isAdmin, getTeamStatistics);

// Single Team Operations - More specific routes FIRST
router.get("/admin/team/:teamId", requireSignin, isAdmin, getTeamById);
router.put("/admin/team/:teamId", requireSignin, isAdmin, updateTeam);
router.delete("/admin/team/:teamId", requireSignin, isAdmin, deleteTeam);

// Team Verification
router.post("/admin/team/:teamId/verify", requireSignin, isAdmin, verifyTeam);
router.post("/admin/team/:teamId/suspend", requireSignin, isAdmin, suspendTeam);
router.post("/admin/team/:teamId/reactivate", requireSignin, isAdmin, reactivateTeam);

// Team Tier Management
router.put("/admin/team/:teamId/tier", requireSignin, isAdmin, updateTeamTier);

// Team Members Management
router.get("/admin/team/:teamId/members", requireSignin, isAdmin, getTeamMembers);
router.post("/admin/team/:teamId/members", requireSignin, isAdmin, addTeamMember);
router.delete("/admin/team/:teamId/members/:memberId", requireSignin, isAdmin, removeTeamMember);

// ==================== ADMIN TEAM MEMBER ROUTES ====================

// Get all team members (global)
router.get("/admin/team-members/list", requireSignin, isAdmin, async (req, res) => {
  try {
    const result = await getAllTeamMembers();
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Create team member
router.post("/admin/team-members/create", requireSignin, isAdmin, async (req, res) => {
  try {
    const { userId, sponsorId, packagePrice } = req.body;
    const result = await createTeamMember(userId, sponsorId, packagePrice);
    return res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Set sponsor for team member
router.post("/admin/team-members/set-sponsor", requireSignin, isAdmin, async (req, res) => {
  try {
    const { userId, sponsorId } = req.body;
    const result = await setTeamSponsor(userId, sponsorId);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Update team member
router.put("/admin/team-members/:userId", requireSignin, isAdmin, async (req, res) => {
  try {
    const { packagePrice } = req.body;
    const result = await updateTeamMember(req.params.userId, packagePrice);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Delete team member
router.delete("/admin/team-members/:userId", requireSignin, isAdmin, async (req, res) => {
  try {
    const result = await deleteTeamMember(req.params.userId);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== ADMIN HIERARCHY ROUTES ====================

// Get downline structure for any user (admin only)
router.get("/admin/team/downline-structure/:userId", requireSignin, isAdmin, async (req, res) => {
  try {
    const depth = parseInt(req.query.depth) || 10;
    console.log(`[ADMIN] Fetching downline structure for userId: ${req.params.userId}, depth: ${depth}`);
    const result = await getDownlineStructure(req.params.userId, depth);
    console.log(`[ADMIN] Downline structure result:`, result.success ? 'SUCCESS' : 'FAILED');
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    console.error('[ADMIN] Error fetching downline structure:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== ADMIN PAYOUT MANAGEMENT ROUTES ====================

/**
 * Get all payouts with filters and pagination
 * GET /api/admin/payouts
 */
router.get("/admin/payouts", requireSignin, isAdmin, async (req, res) => {
  try {
    const { status, payoutMethod, page = 1, limit = 20, search, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    adminPayoutLogger.start("Fetching all payouts", { status, payoutMethod, page, limit, search });

    // Build query
    const query = {};
    if (status) query.status = status;
    if (payoutMethod) query.payoutMethod = payoutMethod;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Search by reference number or user email
    if (search) {
      const users = await User.find({
        $or: [
          { email: new RegExp(search, 'i') },
          { fname: new RegExp(search, 'i') },
          { lname: new RegExp(search, 'i') }
        ]
      }).select('_id');
      
      query.$or = [
        { referenceNumber: new RegExp(search, 'i') },
        { userId: { $in: users.map(u => u._id) } }
      ];
    }

    const payouts = await Payout.find(query)
      .populate('userId', 'fname lname email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Payout.countDocuments(query);

    // Get statistics
    const stats = await Payout.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" }
        }
      }
    ]);

    adminPayoutLogger.success("Payouts fetched", { count: payouts.length, total });

    return res.status(200).json({
      success: true,
      message: "Payouts retrieved successfully",
      data: {
        payouts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalRecords: total,
          limit: parseInt(limit)
        },
        stats
      }
    });
  } catch (error) {
    adminPayoutLogger.error("Error fetching payouts", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching payouts",
      error: error.message
    });
  }
});

/**
 * Get payout by ID
 * GET /api/admin/payouts/:payoutId
 */
router.get("/admin/payouts/:payoutId", requireSignin, isAdmin, async (req, res) => {
  try {
    const { payoutId } = req.params;

    adminPayoutLogger.start("Fetching payout by ID", { payoutId });

    const payout = await Payout.findById(payoutId).populate('userId', 'fname lname email phone cryptoWalletAddress cryptoCurrency');

    if (!payout) {
      return res.status(404).json({
        success: false,
        message: "Payout not found"
      });
    }

    adminPayoutLogger.success("Payout fetched", { payoutId, status: payout.status });

    return res.status(200).json({
      success: true,
      message: "Payout retrieved successfully",
      data: payout
    });
  } catch (error) {
    adminPayoutLogger.error("Error fetching payout", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching payout",
      error: error.message
    });
  }
});

/**
 * Update payout status
 * PUT /api/admin/payouts/:payoutId/status
 */
router.put("/admin/payouts/:payoutId/status", requireSignin, isAdmin, async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { status, transactionId, cryptoTransactionHash, adminNotes } = req.body;

    adminPayoutLogger.start("Updating payout status", { payoutId, status });

    if (!["pending", "processing", "completed", "failed", "cancelled"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status"
      });
    }

    const updateData = {
      status,
      adminNotes,
      processedBy: req.user._id
    };

    if (status === "processing") {
      updateData.processingDate = new Date();
    }

    if (status === "completed") {
      updateData.completedDate = new Date();
      if (transactionId) updateData.transactionId = transactionId;
      if (cryptoTransactionHash) updateData.cryptoTransactionHash = cryptoTransactionHash;
    }

    if (status === "failed" || status === "cancelled") {
      updateData.failedDate = new Date();
    }

    const payout = await Payout.findByIdAndUpdate(
      payoutId,
      updateData,
      { new: true, runValidators: true }
    ).populate('userId', 'fname lname email');

    if (!payout) {
      return res.status(404).json({
        success: false,
        message: "Payout not found"
      });
    }

    adminPayoutLogger.success("Payout status updated", { payoutId, status, newStatus: payout.status });

    return res.status(200).json({
      success: true,
      message: `Payout ${status} successfully`,
      data: payout
    });
  } catch (error) {
    adminPayoutLogger.error("Error updating payout status", error);
    return res.status(500).json({
      success: false,
      message: "Error updating payout status",
      error: error.message
    });
  }
});

/**
 * Delete payout (admin only - use with caution)
 * DELETE /api/admin/payouts/:payoutId
 */
router.delete("/admin/payouts/:payoutId", requireSignin, isAdmin, async (req, res) => {
  try {
    const { payoutId } = req.params;

    adminPayoutLogger.start("Deleting payout", { payoutId });

    const payout = await Payout.findByIdAndDelete(payoutId);

    if (!payout) {
      return res.status(404).json({
        success: false,
        message: "Payout not found"
      });
    }

    adminPayoutLogger.success("Payout deleted", { payoutId });

    return res.status(200).json({
      success: true,
      message: "Payout deleted successfully"
    });
  } catch (error) {
    adminPayoutLogger.error("Error deleting payout", error);
    return res.status(500).json({
      success: false,
      message: "Error deleting payout",
      error: error.message
    });
  }
});

/**
 * Get payout statistics
 * GET /api/admin/payouts/stats/summary
 */
router.get("/admin/payouts/stats/summary", requireSignin, isAdmin, async (req, res) => {
  try {
    adminPayoutLogger.start("Fetching payout statistics");

    const stats = await Payout.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          totalNet: { $sum: "$netAmount" }
        }
      }
    ]);

    const totalPayouts = await Payout.countDocuments();
    const totalPaid = stats.find(s => s._id === "completed")?.totalNet || 0;
    const totalPending = stats.filter(s => ["pending", "processing"].includes(s._id))
      .reduce((sum, s) => sum + (s.totalNet || 0), 0);

    adminPayoutLogger.success("Payout statistics fetched");

    return res.status(200).json({
      success: true,
      message: "Payout statistics retrieved successfully",
      data: {
        totalPayouts,
        totalPaid,
        totalPending,
        statusBreakdown: stats
      }
    });
  } catch (error) {
    adminPayoutLogger.error("Error fetching payout statistics", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching payout statistics",
      error: error.message
    });
  }
});

export default router;
