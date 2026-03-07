import express from "express";
import { requireSignin } from "../../middleware/authMiddleware.js";
import {
  getOrCreateTeamMember,
  setSponsor,
  setSponsorWithBinaryPosition,
  validateBinaryReferralCode,
  getTeamDashboard,
  getTeamMembers,
  getReferralHistory,
  processMonthlyBonuses,
  getBonusHistory,
  getCommissionDetails,
  requestPayout,
  updateUserLevel,
  getTeamNetwork,
  getLeaderboard,
  getTeamStatistics,
  initMembership,
  checkMemberStatus,
  getMyReferralCode,
  getMyReferrals,
  getMyDownlineStructure,
  getDownlineStructure,
  getUserDownlineOnly,
  getUserBinaryDownline,
  getSimpleTeamMembersList,
  validateReferralCode,
  applyReferralCode,
  getReferralStats,
  getUserAvailableBalance,
  createUserPayout,
  getUserPayoutHistory,
  getUserPayoutDetails,
  getUserPayoutStats,
  getAvailableRewards,
  claimReward,
  getRewardHistory,
  updateRewardStatus,
  getAllRewardClaims,
  getLegCountDetails,
  verifyLegCounts,
  recalculateLegCounts,
  getCompleteBinaryAnalytics,
} from "./teamController.js";

const router = express.Router();

// ==================== MEMBERSHIP ROUTES ====================

// Initialize team membership
router.post("/team/init-membership", requireSignin, async (req, res) => {
  try {
    const result = await initMembership(req.user._id);
    return res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Check team member status
router.get("/team/check-status", requireSignin, async (req, res) => {
  try {
    const result = await checkMemberStatus(req.user._id);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Initialize Team Member (legacy - same as init-membership)
router.post("/team/init", requireSignin, async (req, res) => {
  try {
    const result = await getOrCreateTeamMember(req.user._id);
    return res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== REFERRAL CODE ROUTES ====================

// Get my referral code
router.get("/team/my-referral-code", requireSignin, async (req, res) => {
  try {
    const result = await getMyReferralCode(req.user._id);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Validate referral code (public - no auth required)
// Now supports binary LPRO/RPRO validation
router.post("/team/validate-referral-code", async (req, res) => {
  try {
    const { code } = req.body;
    
    // Use binary validation if code is LPRO/RPRO
    if (code.startsWith("LPRO-") || code.startsWith("RPRO-")) {
      const result = await validateBinaryReferralCode(code);
      return res.status(result.success ? 200 : 400).json(result);
    }
    
    // Regular PRO code validation
    const result = await validateReferralCode(code);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Apply referral code - User joins team using referral code
// Now supports binary positioning with LPRO/RPRO
router.post("/team/apply-referral-code", requireSignin, async (req, res) => {
  try {
    const { code } = req.body;
    
    // Use binary positioning if code is LPRO/RPRO
    if (code.startsWith("LPRO-") || code.startsWith("RPRO-")) {
      const result = await setSponsorWithBinaryPosition(req.user._id, code);
      return res.status(result.success ? 201 : 400).json(result);
    }
    
    // Regular referral code application
    const result = await applyReferralCode(req.user._id, code);
    return res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== USER TEAM DASHBOARD & ANALYTICS ROUTES ====================

// Get Team Dashboard
router.get("/team/dashboard", requireSignin, async (req, res) => {
  try {
    const result = await getTeamDashboard(req.user._id);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Get Direct Team Members
router.get("/team/members", requireSignin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await getTeamMembers(req.user._id, page, limit);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Get my referrals
router.get("/team/my-referrals", requireSignin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await getMyReferrals(req.user._id, page, limit);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Get my downline structure
router.get("/team/downline-structure/me", requireSignin, async (req, res) => {
  try {
    const depth = parseInt(req.query.depth) || 5;
    const result = await getMyDownlineStructure(req.user._id, depth);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Get downline structure for specific user
router.get("/team/downline-structure/:userId", requireSignin, async (req, res) => {
  try {
    const depth = parseInt(req.query.depth) || 5;
    const result = await getDownlineStructure(req.params.userId, depth);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Get user's own downline only (user as root, no ancestors) - FOR USER PANEL
router.get("/team/my-downline", requireSignin, async (req, res) => {
  try {
    const result = await getUserDownlineOnly(req.user._id);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Get user's BINARY TREE downline (includes ALL LPRO/RPRO/Main children) - FOR USER PANEL  
router.get("/team/my-binary-downline", requireSignin, async (req, res) => {
  try {
    const result = await getUserBinaryDownline(req.user._id);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Get simple team members list with directCount and position
router.get("/team/my-team-list", requireSignin, async (req, res) => {
  try {
    const result = await getSimpleTeamMembersList(req.user._id);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Get Referral History
router.get("/team/referrals", requireSignin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await getReferralHistory(req.user._id, page, limit);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== COMMISSION & BONUS ROUTES ====================

// Get Commission Details
router.get("/team/commission", requireSignin, async (req, res) => {
  try {
    const result = await getCommissionDetails(req.user._id);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Get Bonus History
router.get("/team/bonus-history", requireSignin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await getBonusHistory(req.user._id, page, limit);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Request Payout
router.post("/team/request-payout", requireSignin, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Valid amount required" });
    }
    const result = await requestPayout(req.user._id, amount);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== USER PAYOUT ROUTES ====================

// Get available balance for payout
router.get("/team/payout/balance", requireSignin, async (req, res) => {
  try {
    const result = await getUserAvailableBalance(req.user._id);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Create payout request with payment details
router.post("/team/payout/request", requireSignin, async (req, res) => {
  try {
    const { amount, payoutMethod, bankDetails, upiId, cryptoWalletAddress, cryptoCurrency, source } = req.body;

    // Validate required fields
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid payout amount is required",
      });
    }

    if (!payoutMethod) {
      return res.status(400).json({
        success: false,
        message: "Payout method is required (bank_transfer, upi, wallet, cheque, or crypto)",
      });
    }

    // Validate payment method specific details
    if (payoutMethod === "bank_transfer" && !bankDetails) {
      return res.status(400).json({
        success: false,
        message: "Bank details are required for bank transfer",
      });
    }

    if (payoutMethod === "upi" && !upiId) {
      return res.status(400).json({
        success: false,
        message: "UPI ID is required for UPI payout",
      });
    }

    const payoutData = {
      amount,
      payoutMethod,
      bankDetails,
      upiId,
      cryptoWalletAddress,
      cryptoCurrency,
      source,
    };

    const result = await createUserPayout(req.user._id, payoutData);
    return res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Get payout history with pagination
router.get("/team/payout/history", requireSignin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await getUserPayoutHistory(req.user._id, page, limit);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Get specific payout details
router.get("/team/payout/:payoutId", requireSignin, async (req, res) => {
  try {
    const { payoutId } = req.params;
    const result = await getUserPayoutDetails(req.user._id, payoutId);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Get payout statistics
router.get("/team/payout/stats/summary", requireSignin, async (req, res) => {
  try {
    const result = await getUserPayoutStats(req.user._id);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== SPONSOR & LEVEL ROUTES ====================

// Set Sponsor/Upline
router.post("/team/set-sponsor", requireSignin, async (req, res) => {
  try {
    const { sponsorId } = req.body;
    if (!sponsorId) {
      return res.status(400).json({ success: false, message: "Sponsor ID required" });
    }
    const result = await setSponsor(req.user._id, sponsorId);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Update User Level
router.post("/team/update-level", requireSignin, async (req, res) => {
  try {
    const result = await updateUserLevel(req.user._id);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Process Monthly Bonuses (for current user)
router.post("/team/process-bonuses", requireSignin, async (req, res) => {
  try {
    const result = await processMonthlyBonuses(req.user._id);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== PUBLIC ROUTES (No Auth Required) ====================

// Get Team Network (Tree View)
router.get("/team/network", requireSignin, async (req, res) => {
  try {
    const depth = parseInt(req.query.depth) || 3;
    const network = await getTeamNetwork(req.user._id, depth);
    return res.status(200).json({ success: true, network });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Get Leaderboard (Public)
router.get("/team/leaderboard", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const result = await getLeaderboard(limit);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Get Team Statistics (Public)
router.get("/team/statistics", async (req, res) => {
  try {
    const result = await getTeamStatistics();
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Get Referral Stats for a specific user (requires auth)
router.get("/team/referral/stats/:userId", requireSignin, async (req, res) => {
  try {
    const result = await getReferralStats(req.params.userId);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== BINARY REWARD ROUTES ====================

// Get available rewards for user
router.get("/team/rewards/available", requireSignin, async (req, res) => {
  try {
    const result = await getAvailableRewards(req.user._id);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Claim a reward
router.post("/team/rewards/claim", requireSignin, async (req, res) => {
  try {
    const result = await claimReward(req.user._id, req.body);
    return res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Get reward history
router.get("/team/rewards/history", requireSignin, async (req, res) => {
  try {
    const result = await getRewardHistory(req.user._id);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Update reward status (Admin only - add admin middleware later)
router.patch("/team/rewards/:rewardId/status", requireSignin, async (req, res) => {
  try {
    const { status, trackingNumber } = req.body;
    const result = await updateRewardStatus(req.params.rewardId, status, { trackingNumber });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Get all reward claims (Admin only - add admin middleware later)
router.get("/team/rewards/all", requireSignin, async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      rank: req.query.rank,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    const result = await getAllRewardClaims(filters);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== BINARY MATCHING ROUTES ====================

// Get binary status and PV information
router.get("/team/binary/status", requireSignin, async (req, res) => {
  try {
    const { getBinaryStatus } = await import('../../helpers/binaryMatchingService.js');
    const result = await getBinaryStatus(req.user._id);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Manual trigger for weekly matching (Admin only - for testing)
router.post("/team/binary/trigger-matching", requireSignin, async (req, res) => {
  try {
    // TODO: Add admin check middleware
    const { triggerWeeklyMatchingNow } = await import('../../helpers/binaryMatchingService.js');
    const result = await triggerWeeklyMatchingNow();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Get binary scheduler status
router.get("/team/binary/scheduler-status", requireSignin, async (req, res) => {
  try {
    const { getSchedulerStatus } = await import('../../helpers/binaryScheduler.js');
    const status = getSchedulerStatus();
    return res.status(200).json({ success: true, data: status });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== LEG COUNT MANAGEMENT ROUTES ====================

/**
 * GET /api/team/leg-counts/details
 * Get detailed leg count information for the authenticated user
 * Shows stored vs calculated counts with complete tree breakdown
 */
router.get("/team/leg-counts/details", requireSignin, async (req, res) => {
  try {
    const result = await getLegCountDetails(req.user._id);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * GET /api/team/leg-counts/verify
 * Verify leg counts for the authenticated user or all users
 * Query param: all=true to verify all users (requires admin permissions in future)
 */
router.get("/team/leg-counts/verify", requireSignin, async (req, res) => {
  try {
    const verifyAll = req.query.all === 'true';
    const userId = verifyAll ? null : req.user._id;
    
    // TODO: Add admin check if verifyAll is true
    // if (verifyAll && !req.user.isAdmin) {
    //   return res.status(403).json({ success: false, message: "Admin access required" });
    // }
    
    const result = await verifyLegCounts(userId);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

/**
 * POST /api/team/leg-counts/recalculate
 * Recalculate and update leg counts for the authenticated user or all users
 * Body: { all: true } to recalculate for all users (requires admin permissions in future)
 */
router.post("/team/leg-counts/recalculate", requireSignin, async (req, res) => {
  try {
    const recalculateAll = req.body.all === true;
    const userId = recalculateAll ? null : req.user._id;
    
    // TODO: Add admin check if recalculateAll is true
    // if (recalculateAll && !req.user.isAdmin) {
    //   return res.status(403).json({ success: false, message: "Admin access required" });
    // }
    
    const result = await recalculateLegCounts(userId);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// ==================== COMPLETE BINARY ANALYTICS ====================

/**
 * GET /api/team/binary/complete-analytics
 * Get complete binary tree analytics in one call
 * 
 * Returns EVERYTHING:
 * - Leg counts (stored & calculated)
 * - PV values (stored & calculated)
 * - Binary rank & commission %
 * - Carry forward values
 * - Matching & pairing calculations
 * - Commission earnings breakdown
 * - Tree validation status
 * - Direct children breakdown
 * - Statistics summary
 */
router.get("/team/binary/complete-analytics", requireSignin, async (req, res) => {
  try {
    const result = await getCompleteBinaryAnalytics(req.user._id);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

export default router;
