import express from "express";
import { requireSignin } from "../../middleware/authMiddleware.js";
import {
  debugAuth,
  initMembership,
  checkMemberStatus,
  getAllTeamMembers,
  getAllTeamStatistics,
  createTeamMember,
  setTeamSponsor,
  getTeamNetworkTree,
  deleteTeamMember,
  updateTeamMember,
  validateReferralCode,
  applyReferralCode,
  getMyReferralCode,
  getMyReferrals,
  getMyDownlineStructure,
  getDownlineStructure,
} from "./teamController.js";

const router = express.Router();

// ==================== MEMBERSHIP ROUTES ====================

// Initialize team membership
router.post("/team/init-membership", requireSignin, async (req, res) => {
  try {
    const result = await initMembership(req.user._id);
    return res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Check team member status
router.get("/team/check-status", requireSignin, async (req, res) => {
  try {
    const result = await checkMemberStatus(req.user._id);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== REFERRAL CODE ROUTES ====================

// Get my referral code
router.get("/team/my-referral-code", requireSignin, async (req, res) => {
  try {
    const result = await getMyReferralCode(req.user._id);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Debug endpoint to check authentication status
router.get("/team/my-referral-code/debug", requireSignin, async (req, res) => {
  try {
    const result = await debugAuth(req.user._id);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Validate referral code (public - no auth required)
router.post("/team/validate-referral-code", async (req, res) => {
  try {
    const { code } = req.body;
    const result = await validateReferralCode(code);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Apply referral code - User joins team using referral code
router.post("/team/apply-referral-code", requireSignin, async (req, res) => {
  try {
    const { code } = req.body;
    const result = await applyReferralCode(req.user._id, code);
    return res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== USER DOWNLINE & REFERRAL ROUTES ====================

// Get all referrals for current user
router.get("/team/my-referrals", requireSignin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await getMyReferrals(req.user._id, page, limit);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get downline structure for current user
router.get("/team/downline-structure/me", requireSignin, async (req, res) => {
  try {
    const depth = parseInt(req.query.depth) || 5;
    const result = await getMyDownlineStructure(req.user._id, depth);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get downline structure for specific user
router.get("/team/downline-structure/:userId", requireSignin, async (req, res) => {
  try {
    const depth = parseInt(req.query.depth) || 5;
    const result = await getDownlineStructure(req.params.userId, depth);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==================== ADMIN TEAM MEMBER ROUTES ====================

// GET all team members with statistics
router.get("/team/members", requireSignin, async (req, res) => {
  try {
    const result = await getAllTeamMembers();
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// GET team statistics
router.get("/team/statistics", requireSignin, async (req, res) => {
  try {
    const result = await getAllTeamStatistics();
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// POST create team member
router.post("/team/create-member", requireSignin, async (req, res) => {
  try {
    const { userId, sponsorId, packagePrice } = req.body;
    const result = await createTeamMember(userId, sponsorId, packagePrice);
    return res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// POST set sponsor
router.post("/team/set-sponsor", requireSignin, async (req, res) => {
  try {
    const { userId, sponsorId } = req.body;
    const result = await setTeamSponsor(userId, sponsorId);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// GET team network tree
router.get("/team/network/:userId", requireSignin, async (req, res) => {
  try {
    const result = await getTeamNetworkTree(req.params.userId);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// DELETE team member
router.delete("/team/member/:userId", requireSignin, async (req, res) => {
  try {
    const result = await deleteTeamMember(req.params.userId);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// PUT update team member
router.put("/team/member/:userId", requireSignin, async (req, res) => {
  try {
    const { packagePrice } = req.body;
    const result = await updateTeamMember(req.params.userId, packagePrice);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
