import express from "express";
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
} from "./teamController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Initialize Team Member (call after registration)
router.post("/team/init", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await getOrCreateTeamMember(userId);

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Set Sponsor/Upline
router.post("/team/set-sponsor", authenticateToken, async (req, res) => {
  try {
    const { sponsorId } = req.body;
    const userId = req.user.id;

    if (!sponsorId) {
      return res
        .status(400)
        .json({ success: false, message: "Sponsor ID is required" });
    }

    const result = await setSponsor(userId, sponsorId);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Team Dashboard
router.get("/team/dashboard", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await getTeamDashboard(userId);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Team Members (Direct Downline)
router.get("/team/members", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await getTeamMembers(userId, page, limit);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Referral History
router.get("/team/referrals", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await getReferralHistory(userId, page, limit);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Process Monthly Bonuses (Admin/Scheduled)
router.post("/team/process-bonuses", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await processMonthlyBonuses(userId);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Bonus History
router.get("/team/bonus-history", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await getBonusHistory(userId, page, limit);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Commission Details
router.get("/team/commission", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await getCommissionDetails(userId);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Request Payout
router.post("/team/request-payout", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required",
      });
    }

    const result = await requestPayout(userId, amount);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update User Level
router.post("/team/update-level", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await updateUserLevel(userId);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Team Network (Tree View)
router.get("/team/network", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const depth = parseInt(req.query.depth) || 3;

    const network = await getTeamNetwork(userId, depth);

    res.status(200).json({
      success: true,
      network,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Leaderboard
router.get("/team/leaderboard", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const result = await getLeaderboard(limit);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Team Statistics (Public)
router.get("/team/statistics", async (req, res) => {
  try {
    const result = await getTeamStatistics();

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
