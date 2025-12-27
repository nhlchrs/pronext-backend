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

const router = express.Router();

// ==================== ADMIN TEAM MANAGEMENT ROUTES ====================
// All routes require authentication and admin role
router.use(requireSignin, isAdmin);

// Team List & Statistics
router.get("/admin/team/list", getAllTeams);
router.get("/admin/team/statistics", getTeamStatistics);

// Single Team Operations - More specific routes FIRST
router.get("/admin/team/:teamId", getTeamById);
router.put("/admin/team/:teamId", updateTeam);
router.delete("/admin/team/:teamId", deleteTeam);

// Team Verification
router.post("/admin/team/:teamId/verify", verifyTeam);
router.post("/admin/team/:teamId/suspend", suspendTeam);
router.post("/admin/team/:teamId/reactivate", reactivateTeam);

// Team Tier Management
router.put("/admin/team/:teamId/tier", updateTeamTier);

// Team Members Management
router.get("/admin/team/:teamId/members", getTeamMembers);
router.post("/admin/team/:teamId/members", addTeamMember);
router.delete("/admin/team/:teamId/members/:memberId", removeTeamMember);

// ==================== ADMIN TEAM MEMBER ROUTES ====================

// Get all team members (global)
router.get("/admin/team-members/list", async (req, res) => {
  try {
    const result = await getAllTeamMembers();
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Create team member
router.post("/admin/team-members/create", async (req, res) => {
  try {
    const { userId, sponsorId, packagePrice } = req.body;
    const result = await createTeamMember(userId, sponsorId, packagePrice);
    return res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Set sponsor for team member
router.post("/admin/team-members/set-sponsor", async (req, res) => {
  try {
    const { userId, sponsorId } = req.body;
    const result = await setTeamSponsor(userId, sponsorId);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Update team member
router.put("/admin/team-members/:userId", async (req, res) => {
  try {
    const { packagePrice } = req.body;
    const result = await updateTeamMember(req.params.userId, packagePrice);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Delete team member
router.delete("/admin/team-members/:userId", async (req, res) => {
  try {
    const result = await deleteTeamMember(req.params.userId);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
