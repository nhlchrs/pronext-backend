import express from "express";
import {
  getAllKYCRecords,
  getKYCById,
  submitKYC,
  getKYCStatus,
  verifyKYC,
  rejectKYC,
  getKYCStatistics,
} from "./kycController.js";
import { requireSignin, isAdmin } from "../../middleware/authMiddleware.js";

const router = express.Router();

// ==================== USER ROUTES ====================

/**
 * User submits KYC documents
 * POST /api/kyc/submit
 */
router.post("/kyc/submit", requireSignin, submitKYC);

/**
 * User gets their KYC status
 * GET /api/kyc/status
 */
router.get("/kyc/status", requireSignin, getKYCStatus);

/**
 * Get KYC record by ID (user can view their own)
 * GET /api/kyc/:kycId
 */
router.get("/kyc/:kycId", requireSignin, getKYCById);

// ==================== ADMIN ROUTES ====================

/**
 * Admin gets all KYC records
 * GET /api/admin/kyc/list
 */
router.get("/admin/kyc/list", requireSignin, isAdmin, getAllKYCRecords);

/**
 * Admin gets KYC record by ID
 * GET /api/admin/kyc/:kycId
 */
router.get("/admin/kyc/:kycId", requireSignin, isAdmin, getKYCById);

/**
 * Admin verifies KYC documents
 * POST /api/admin/kyc/verify
 */
router.post("/admin/kyc/verify", requireSignin, isAdmin, verifyKYC);

/**
 * Admin rejects KYC documents
 * POST /api/admin/kyc/reject
 */
router.post("/admin/kyc/reject", requireSignin, isAdmin, rejectKYC);

/**
 * Admin gets KYC statistics
 * GET /api/admin/kyc/stats
 */
router.get("/admin/kyc/stats", requireSignin, isAdmin, getKYCStatistics);

export default router;
