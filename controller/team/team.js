import express from "express";
import { requireSignin } from "../../middleware/authMiddleware.js";
import {
  getOrCreateTeamMember,
  setSponsor,
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
  validateReferralCode,
  applyReferralCode,
  getReferralStats,
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
router.post("/team/validate-referral-code", async (req, res) => {
  try {
    const { code } = req.body;
    const result = await validateReferralCode(code);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Apply referral code - User joins team using referral code
router.post("/team/apply-referral-code", requireSignin, async (req, res) => {
  try {
    const { code } = req.body;
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

export default router;
