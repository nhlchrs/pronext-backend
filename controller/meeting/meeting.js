import express from "express";
import { requireSignin, isAdmin, isStaff } from "../../middleware/authMiddleware.js";
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

// Admin meeting management - MORE SPECIFIC ROUTES FIRST (Staff can manage meetings)
router.post("/admin/meeting/create", requireSignin, isStaff, createMeeting);
router.get("/admin/meeting-stats", requireSignin, isStaff, getMeetingStatistics);
router.get("/admin/meetings", requireSignin, isStaff, getAllMeetings);
router.post(
  "/admin/meeting/:meetingId/share",
  requireSignin,
  isStaff,
  shareMeetingLink
);
router.get(
  "/admin/meeting/:meetingId/attendees",
  requireSignin,
  isStaff,
  getMeetingAttendees
);
router.post(
  "/admin/meeting/:meetingId/start",
  requireSignin,
  isStaff,
  startMeeting
);
router.post("/admin/meeting/:meetingId/end", requireSignin, isStaff, endMeeting);
router.put("/admin/meeting/:meetingId", requireSignin, isStaff, updateMeeting);
router.delete("/admin/meeting/:meetingId", requireSignin, isAdmin, deleteMeeting);

// ==================== USER ROUTES ====================

// User meeting endpoints
router.get("/user/available-meetings", requireSignin, getUserAvailableMeetings);
router.get("/meeting/upcoming", requireSignin, getUpcomingMeetings);
router.get("/meeting/:meetingId", requireSignin, getMeetingById);
router.get("/meeting/:meetingId/join", requireSignin, joinMeeting);

export default router;
