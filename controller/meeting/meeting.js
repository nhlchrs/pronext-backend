import express from "express";
import { requireSignin, isAdmin } from "../../middleware/authMiddleware.js";
import {
  createMeeting,
  getAllMeetings,
  getMeetingById,
  updateMeeting,
  deleteMeeting,
  getUserAvailableMeetings,
  getUpcomingMeetings,
  joinMeeting,
  shareMeetingLink,
  getMeetingAttendees,
  startMeeting,
  endMeeting,
  getMeetingStatistics,
} from "./meetingController.js";

const router = express.Router();

// ==================== ADMIN ROUTES ====================

// Admin meeting management
router.post("/admin/meeting/create", requireSignin, isAdmin, createMeeting);
router.get("/admin/meetings", requireSignin, isAdmin, getAllMeetings);
router.put("/admin/meeting/:meetingId", requireSignin, isAdmin, updateMeeting);
router.delete("/admin/meeting/:meetingId", requireSignin, isAdmin, deleteMeeting);
router.post(
  "/admin/meeting/:meetingId/share",
  requireSignin,
  isAdmin,
  shareMeetingLink
);
router.get(
  "/admin/meeting/:meetingId/attendees",
  requireSignin,
  isAdmin,
  getMeetingAttendees
);
router.post(
  "/admin/meeting/:meetingId/start",
  requireSignin,
  isAdmin,
  startMeeting
);
router.post("/admin/meeting/:meetingId/end", requireSignin, isAdmin, endMeeting);
router.get("/admin/meeting-stats", requireSignin, isAdmin, getMeetingStatistics);

// ==================== USER ROUTES ====================

// User meeting endpoints
router.get("/user/available-meetings", requireSignin, getUserAvailableMeetings);
router.get("/meeting/upcoming", requireSignin, getUpcomingMeetings);
router.get("/meeting/:meetingId", requireSignin, getMeetingById);
router.get("/meeting/:meetingId/join", requireSignin, joinMeeting);

export default router;
