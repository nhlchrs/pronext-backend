import express from "express";
import authMiddleware from "../../middleware/authMiddleware.js";
import { requireSignin, isStaff } from "../../middleware/authMiddleware.js";
import {
  getDashboardSummary,
  getPayoutTrends,
  getSubscriptionAnalytics,
  getTeamGrowthAnalytics,
  getUserLevelStats,
  getReferralStats,
  generateExcelReport,
  generatePdfReport,
  downloadReport,
  getPerformanceMetrics,
  getAdvancedAnalytics,
  getAdminAnalytics,
} from "./analyticsController.js";

const router = express.Router();

/**
 * All analytics routes require admin authentication
 */

// Dashboard routes
router.get(
  "/dashboard/summary",
  authMiddleware,
  getDashboardSummary
);

// Analytics routes
router.get(
  "/payout-trends",
  authMiddleware,
  getPayoutTrends
);

router.get(
  "/subscriptions",
  authMiddleware,
  getSubscriptionAnalytics
);

router.get(
  "/team-growth",
  authMiddleware,
  getTeamGrowthAnalytics
);

router.get(
  "/user-levels",
  authMiddleware,
  getUserLevelStats
);

router.get(
  "/referrals",
  authMiddleware,
  getReferralStats
);

router.get(
  "/performance",
  authMiddleware,
  getPerformanceMetrics
);

// Report generation routes
router.post(
  "/report/excel",
  authMiddleware,
  generateExcelReport
);

router.post(
  "/report/pdf",
  authMiddleware,
  generatePdfReport
);

// Advanced analytics with filters
router.post(
  "/advanced",
  authMiddleware,
  getAdvancedAnalytics
);

// Admin Panel Analytics Route
router.get(
  "/",
  requireSignin,
  isStaff,
  getAdminAnalytics
);

// File download route
router.get(
  "/download/:filename",
  downloadReport
);

export default router;
