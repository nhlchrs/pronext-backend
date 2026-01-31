import express from "express";
import { requireSignin, isStaff } from "../../middleware/authMiddleware.js";
import { getAdminReports } from "./reportsController.js";

const router = express.Router();

// Get reports data (Staff can view)
router.get("/", requireSignin, isStaff, getAdminReports);

export default router;
