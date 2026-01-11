import express from "express";
import { secureUpload } from "../../middleware/secureFileUpload.js";
import { requireSignin, isAdmin, hasActiveSubscription } from "../../middleware/authMiddleware.js";
import {
  uploadSecureMedia,
  getAllSecureMedia,
  getSecureMediaById,
  streamSecureMedia,
  updateSecureMedia,
  deleteSecureMedia,
} from "./secureMediaController.js";

const router = express.Router();

// Admin routes - Upload and manage
router.post(
  "/secure-media/upload",
  requireSignin,
  isAdmin,
  secureUpload.single("file"),
  uploadSecureMedia
);

router.put(
  "/secure-media/:id",
  requireSignin,
  isAdmin,
  updateSecureMedia
);

router.delete(
  "/secure-media/:id",
  requireSignin,
  isAdmin,
  deleteSecureMedia
);

// User routes - View and stream (subscription required)
router.get(
  "/secure-media",
  (req, res, next) => {
    console.log(`[SECURE MEDIA ROUTE] GET /secure-media route hit! Middleware chain: [requireSignin ONLY]`);
    next();
  },
  requireSignin,
  getAllSecureMedia
);

router.get(
  "/secure-media/:id",
  requireSignin,
  getSecureMediaById
);

router.get(
  "/secure-media/:id/stream",
  requireSignin,
  streamSecureMedia
);

export default router;
