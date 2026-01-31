import express from "express";
import { requireSignin, isAdmin } from "../../middleware/authMiddleware.js";
import { uploadImage } from "../../middleware/multerConfig.js";
import {
  updateUserProfile,
  getUserProfile,
  changePassword,
  suspendUserAccount,
  reactivateUserAccount,
  blockUserPermanently,
  getAllUsers,
  getUserById,
  updateUserRole,
  getUserStatistics,
  deleteUserAccount,
  resetDailyLoginCounts,
  uploadProfilePicture,
  deleteProfilePicture,
  agreeToTerms,
  checkTermsAgreement,
} from "./userController.js";

const router = express.Router();

// ==================== USER ROUTES ====================

// User profile endpoints
router.put("/user/update-profile", requireSignin, updateUserProfile);
router.get("/user/profile", requireSignin, getUserProfile);
router.post("/user/change-password", requireSignin, changePassword);
router.post("/user/delete-account", requireSignin, deleteUserAccount);

// Profile picture endpoints
router.post(
  "/user/upload-profile-picture",
  requireSignin,
  uploadImage.single("profilePicture"),
  uploadProfilePicture
);
router.delete("/user/delete-profile-picture", requireSignin, deleteProfilePicture);

// Terms & Conditions endpoints
router.post("/user/agree-to-terms", requireSignin, agreeToTerms);
router.get("/user/check-terms-agreement", requireSignin, checkTermsAgreement);

// ==================== ADMIN ROUTES ====================

// Admin user management endpoints
router.post("/admin/user/:userId/suspend", requireSignin, isAdmin, suspendUserAccount);
router.post("/admin/user/:userId/reactivate", requireSignin, isAdmin, reactivateUserAccount);
router.delete("/admin/user/:userId/block", requireSignin, isAdmin, blockUserPermanently);

// Admin user viewing endpoints
router.get("/admin/users", requireSignin, isAdmin, getAllUsers);
router.get("/admin/user/:userId", requireSignin, isAdmin, getUserById);
router.put("/admin/user/:userId/role", requireSignin, isAdmin, updateUserRole);
router.get("/admin/user-stats", requireSignin, isAdmin, getUserStatistics);
router.post("/admin/reset-login-counts", requireSignin, isAdmin, resetDailyLoginCounts);

export default router;
