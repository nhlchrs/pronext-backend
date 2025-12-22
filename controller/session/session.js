import express from "express";
import {
  logout,
  getActiveSession,
  logoutAllSessions,
  getAllActiveSessions,
  terminateSession,
} from "./sessionController.js";
import { requireSignin, isAdmin } from "../../middleware/authMiddleware.js";

const router = express.Router();

// User Routes
router.post("/logout", requireSignin, logout);
router.get("/session/active", requireSignin, getActiveSession);
router.post("/logout-all", requireSignin, logoutAllSessions);

// Admin Routes
router.get("/sessions", requireSignin, isAdmin, getAllActiveSessions);
router.delete("/session/:sessionId", requireSignin, isAdmin, terminateSession);

export default router;
