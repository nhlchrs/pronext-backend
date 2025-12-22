import express from "express";
import {
  createAnnouncement,
  getAllAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
  getUserAnnouncements,
  trackAnnouncementClick,
  getAnnouncementsByType,
  getAnnouncementsByFlag,
  getAnnouncementStats,
  bulkUpdateStatus,
} from "./anouncementController.js";

import { requireSignin, isAdmin } from "../../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Admin Routes (Announcements Management)
 */

// Create announcement
router.post("/announcements", requireSignin, isAdmin, createAnnouncement);

// Get all announcements (with filters)
router.get("/announcements", requireSignin, getAllAnnouncements);

// Get announcements by type
router.get("/announcements/type/:type", requireSignin, getAnnouncementsByType);

// Get announcements by flag
router.get("/announcements/flag/:flag", requireSignin, getAnnouncementsByFlag);

// Get specific announcement
router.get("/announcements/:id", requireSignin, getAnnouncementById);

// Update announcement
router.put("/announcements/:id", requireSignin, isAdmin, updateAnnouncement);

// Delete announcement
router.delete("/announcements/:id", requireSignin, isAdmin, deleteAnnouncement);

// Track click
router.post("/announcements/:id/click", trackAnnouncementClick);

/**
 * User Routes
 */

// Get user-specific announcements (personalized feed)
router.get("/user/announcements/feed", requireSignin, getUserAnnouncements);

/**
 * Statistics & Admin Routes
 */

// Get announcement statistics
router.get("/admin/announcements/stats", requireSignin, isAdmin, getAnnouncementStats);

// Bulk update status
router.post("/admin/announcements/bulk-status", requireSignin, isAdmin, bulkUpdateStatus);

export default router;
