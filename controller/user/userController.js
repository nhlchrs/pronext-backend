import userModel from "../../models/authModel.js";
import { comparePassword, hashPassword } from "../../middleware/authMiddleware.js";
import fs from "fs";
import path from "path";
import {
  ErrorResponse,
  successResponse,
  notFoundResponse,
  successResponseWithData,
} from "../../helpers/apiResponse.js";
import logger from "../../helpers/logger.js";

const userLogger = logger.module("USER_CONTROLLER");

/**
 * Update User Profile
 * User can update their own profile: name, DOB, email, phone
 * POST /api/user/update-profile
 */
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { fname, lname, email, phone, dob, address } = req.body;

    userLogger.start("Updating user profile", { userId });

    // Validate required fields
    if (!fname || !lname) {
      userLogger.warn("Missing required fields for profile update", { userId });
      return ErrorResponse(res, "First name and last name are required", 400);
    }

    // Check if email is being changed and if it's already taken
    if (email) {
      const existingUser = await userModel.findOne({
        email: email,
        _id: { $ne: userId },
      });
      if (existingUser) {
        userLogger.warn("Email already in use", { email, userId });
        return ErrorResponse(res, "Email already in use", 400);
      }
    }

    // Check if phone is being changed and if it's already taken
    if (phone) {
      const existingPhone = await userModel.findOne({
        phone: phone,
        _id: { $ne: userId },
      });
      if (existingPhone) {
        userLogger.warn("Phone number already in use", { phone, userId });
        return ErrorResponse(res, "Phone number already in use", 400);
      }
    }

    // Validate date of birth if provided
    if (dob) {
      const dobDate = new Date(dob);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to compare only dates
      
      if (dobDate > today) {
        userLogger.warn("Invalid date of birth - future date", { dob, userId });
        return ErrorResponse(res, "Date of birth cannot be in the future", 400);
      }
      
      // Optional: Check if DOB is reasonable (e.g., not older than 120 years)
      const minDate = new Date();
      minDate.setFullYear(minDate.getFullYear() - 120);
      if (dobDate < minDate) {
        userLogger.warn("Invalid date of birth - too old", { dob, userId });
        return ErrorResponse(res, "Date of birth is invalid", 400);
      }
    }

    // Update user
    const updateData = {
      fname: fname.trim(),
      lname: lname.trim(),
    };

    if (email) updateData.email = email.trim().toLowerCase();
    if (phone) updateData.phone = phone.trim();
    if (dob) updateData.dob = new Date(dob);
    if (address) updateData.address = address.trim();

    const updatedUser = await userModel.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      userLogger.error("User not found for profile update", { userId });
      return notFoundResponse(res, "User not found");
    }

    userLogger.success("User profile updated successfully", { userId });
    return successResponseWithData(
      res,
      "Profile updated successfully",
      updatedUser
    );
  } catch (error) {
    userLogger.error("Error updating profile", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Get User Profile
 * User can view their own profile
 * GET /api/user/profile
 */
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await userModel.findById(userId).select("-password -otp");

    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    return successResponseWithData(res, "Profile retrieved successfully", user);
  } catch (error) {
    userLogger.error("Error fetching profile", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Change Password
 * User can change their password
 * POST /api/user/change-password
 */
export const changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate inputs
    if (!currentPassword || !newPassword || !confirmPassword) {
      return ErrorResponse(res, "All password fields are required", 400);
    }

    if (newPassword !== confirmPassword) {
      return ErrorResponse(res, "New passwords do not match", 400);
    }

    if (newPassword.length < 6) {
      return ErrorResponse(res, "New password must be at least 6 characters", 400);
    }

    const user = await userModel.findById(userId);

    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    // Verify current password
    const isPasswordValid = await comparePassword(currentPassword, user.password);

    if (!isPasswordValid) {
      return ErrorResponse(res, "Current password is incorrect", 401);
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await userModel.findByIdAndUpdate(userId, { password: hashedPassword });

    return successResponse(res, "Password changed successfully");
  } catch (error) {
    userLogger.error("Error changing password", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Admin: Suspend User Account
 * Admin can suspend a user's account
 * POST /api/admin/user/:userId/suspend
 */
export const suspendUserAccount = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return ErrorResponse(res, "Suspension reason is required", 400);
    }

    const user = await userModel.findById(userId);

    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    if (user.isSuspended) {
      return ErrorResponse(res, "User is already suspended", 400);
    }

    // Update user suspension status
    user.isSuspended = true;
    user.suspensionReason = reason;
    user.suspendedAt = new Date();
    user.suspendedBy = req.user._id;

    await user.save();

    return successResponseWithData(
      res,
      user,
      `User ${user.email} has been suspended`
    );
  } catch (error) {
    userLogger.error("Error suspending user", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Admin: Reactivate User Account
 * Admin can reactivate a suspended user's account
 * POST /api/admin/user/:userId/reactivate
 */
// Reset all users' daily login counts (scheduled job)
export const resetDailyLoginCounts = async (req, res) => {
  try {
    const today = new Date().toDateString();
    
    // Find all users whose last login date is not today
    const result = await userModel.updateMany(
      {
        $or: [
          { lastLoginDate: { $lt: new Date(today) } },
          { lastLoginDate: null }
        ],
        dailyLoginCount: { $gt: 0 }
      },
      {
        $set: { dailyLoginCount: 0 }
      }
    );

    userLogger.info(`Daily login counts reset for ${result.modifiedCount} users`);

    if (res) {
      return successResponseWithData(
        res,
        "Daily login counts reset successfully",
        { usersReset: result.modifiedCount }
      );
    }
    
    return { success: true, usersReset: result.modifiedCount };
  } catch (error) {
    userLogger.error("Error resetting daily login counts", error);
    if (res) {
      return ErrorResponse(res, error.message, 500);
    }
    return { success: false, error: error.message };
  }
};

export const reactivateUserAccount = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await userModel.findById(userId);

    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    if (!user.isSuspended) {
      return ErrorResponse(res, "User is not suspended", 400);
    }

    // Reactivate user and reset login count
    user.isSuspended = false;
    user.suspensionReason = null;
    user.suspendedAt = null;
    user.suspendedBy = null;
    user.reactivatedAt = new Date();
    user.reactivatedBy = req.user._id;
    user.dailyLoginCount = 0;  // Reset to 0 to allow fresh login attempts
    user.lastLoginDate = null;  // Reset last login date

    await user.save();

    // Verify the save
    const updatedUser = await userModel.findById(userId);
    userLogger.info(`User ${user.email} reactivated - Login count: ${updatedUser.dailyLoginCount}`);

    return successResponseWithData(
      res,
      user,
      `User ${user.email} has been reactivated`
    );
  } catch (error) {
    userLogger.error("Error reactivating user", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Admin: Permanently Block User
 * Admin can permanently block a user (cannot be reactivated)
 * DELETE /api/admin/user/:userId/block
 */
export const blockUserPermanently = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return ErrorResponse(res, "Block reason is required", 400);
    }

    const user = await userModel.findById(userId);

    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    if (user.isBlocked) {
      return ErrorResponse(res, "User is already blocked", 400);
    }

    // Block user
    user.isBlocked = true;
    user.blockReason = reason;
    user.blockedAt = new Date();
    user.blockedBy = req.user._id;

    await user.save();

    return successResponseWithData(
      res,
      user,
      `User ${user.email} has been permanently blocked`
    );
  } catch (error) {
    userLogger.error("Error blocking user", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Admin: Get All Users
 * Admin can view all users with filters
 * GET /api/admin/users
 */
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, status, search } = req.query;

    const skip = (page - 1) * limit;
    const filter = {};

    // Apply role filter
    if (role) {
      filter.role = role;
    }

    // Apply status filter
    if (status === "suspended") {
      filter.isSuspended = true;
      filter.isBlocked = false;
    } else if (status === "blocked") {
      filter.isBlocked = true;
    } else if (status === "active") {
      filter.isSuspended = false;
      filter.isBlocked = false;
    }

    // Apply search filter (by email, name, or phone)
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: "i" } },
        { fname: { $regex: search, $options: "i" } },
        { lname: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    // Get total count
    const total = await userModel.countDocuments(filter);

    // Get users
    const users = await userModel
      .find(filter)
      .select("-password -otp")
      .limit(limit * 1)
      .skip(skip)
      .sort({ createdAt: -1 });

    return successResponseWithData(
      res,
      "Users retrieved successfully",
      {
        users,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      }
    );
  } catch (error) {
    userLogger.error("Error fetching users", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Admin: Get User by ID
 * Admin can view specific user details
 * GET /api/admin/user/:userId
 */
export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await userModel.findById(userId).select("-password -otp");

    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    return successResponseWithData(
      res,
      user,
      "User details retrieved successfully"
    );
  } catch (error) {
    userLogger.error("Error fetching user", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Admin: Update User Role
 * Admin can change a user's role
 * PUT /api/admin/user/:userId/role
 */
export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role) {
      return ErrorResponse(res, "Role is required", 400);
    }

    const validRoles = ["Admin", "Finance", "Support", "Educator"];
    if (!validRoles.includes(role)) {
      return ErrorResponse(
        res,
        `Role must be one of: ${validRoles.join(", ")}`,
        400
      );
    }

    const user = await userModel.findByIdAndUpdate(
      userId,
      { role },
      { new: true, runValidators: true }
    ).select("-password -otp");

    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    return successResponseWithData(
      res,
      user,
      `User role updated to ${role}`
    );
  } catch (error) {
    userLogger.error("Error updating user role", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Admin: Get User Statistics
 * Admin can view user account statistics
 * GET /api/admin/user-stats
 */
export const getUserStatistics = async (req, res) => {
  try {
    const totalUsers = await userModel.countDocuments();
    const activeUsers = await userModel.countDocuments({
      isSuspended: false,
      isBlocked: false,
    });
    const suspendedUsers = await userModel.countDocuments({
      isSuspended: true,
      isBlocked: false,
    });
    const blockedUsers = await userModel.countDocuments({
      isBlocked: true,
    });

    const usersByRole = await userModel.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    const stats = {
      totalUsers,
      activeUsers,
      suspendedUsers,
      blockedUsers,
      usersByRole: usersByRole.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
    };

    return successResponseWithData(
      res,
      stats,
      "User statistics retrieved successfully"
    );
  } catch (error) {
    userLogger.error("Error fetching user statistics", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Delete User Account (Soft Delete)
 * User can request account deletion
 * POST /api/user/delete-account
 */
export const deleteUserAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { password } = req.body;

    if (!password) {
      return ErrorResponse(res, "Password is required to delete account", 400);
    }

    const user = await userModel.findById(userId);

    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      return ErrorResponse(res, "Password is incorrect", 401);
    }

    // Soft delete - mark as deleted
    user.isDeleted = true;
    user.deletedAt = new Date();

    await user.save();

    return successResponse(res, "Account deleted successfully");
  } catch (error) {
    userLogger.error("Error deleting account", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Upload Profile Picture
 * User can upload/update their profile picture
 * POST /api/user/upload-profile-picture
 */
export const uploadProfilePicture = async (req, res) => {
  try {
    console.log("[UPLOAD PROFILE] User from token:", req.user);
    console.log("[UPLOAD PROFILE] User role:", req.user?.role);
    console.log("[UPLOAD PROFILE] User ID:", req.user?._id);
    
    const userId = req.user._id;

    if (!req.file) {
      return ErrorResponse(res, "No file uploaded", 400);
    }

    userLogger.start("Uploading profile picture", { userId, filename: req.file.filename });

    const user = await userModel.findById(userId);

    if (!user) {
      // Delete uploaded file if user not found
      fs.unlinkSync(req.file.path);
      return notFoundResponse(res, "User not found");
    }

    // Delete old profile picture if exists
    if (user.profilePicture) {
      const oldPicturePath = path.join(process.cwd(), user.profilePicture);
      if (fs.existsSync(oldPicturePath)) {
        fs.unlinkSync(oldPicturePath);
        userLogger.info("Old profile picture deleted", { oldPath: user.profilePicture });
      }
    }

    // Save new profile picture path
    const profilePicturePath = `/uploads/${req.file.filename}`;
    user.profilePicture = profilePicturePath;
    await user.save();

    userLogger.success("Profile picture uploaded successfully", { userId, path: profilePicturePath });

    return successResponseWithData(
      res,
      "Profile picture uploaded successfully",
      {
        profilePicture: profilePicturePath,
        fullUrl: `${req.protocol}://${req.get('host')}${profilePicturePath}`,
      }
    );
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    userLogger.error("Error uploading profile picture", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Delete Profile Picture
 * User can delete their profile picture
 * DELETE /api/user/delete-profile-picture
 */
export const deleteProfilePicture = async (req, res) => {
  try {
    const userId = req.user._id;

    userLogger.start("Deleting profile picture", { userId });

    const user = await userModel.findById(userId);

    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    if (!user.profilePicture) {
      return ErrorResponse(res, "No profile picture to delete", 400);
    }

    // Delete file from filesystem
    const picturePath = path.join(process.cwd(), user.profilePicture);
    if (fs.existsSync(picturePath)) {
      fs.unlinkSync(picturePath);
      userLogger.info("Profile picture file deleted", { path: user.profilePicture });
    }

    // Remove from database
    user.profilePicture = null;
    await user.save();

    userLogger.success("Profile picture deleted successfully", { userId });

    return successResponse(res, "Profile picture deleted successfully");
  } catch (error) {
    userLogger.error("Error deleting profile picture", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Agree to Terms & Conditions
 * User agrees to terms and conditions
 * POST /api/user/agree-to-terms
 */
export const agreeToTerms = async (req, res) => {
  try {
    const userId = req.user._id;

    userLogger.start("User agreeing to terms", { userId });

    const user = await userModel.findById(userId);

    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    if (user.termsAgreed) {
      return ErrorResponse(res, "User has already agreed to terms", 400);
    }

    // Update terms agreement
    user.termsAgreed = true;
    user.termsAgreedAt = new Date();
    await user.save();

    userLogger.success("User agreed to terms", { userId });

    return successResponseWithData(
      res,
      "Terms accepted successfully",
      {
        termsAgreed: user.termsAgreed,
        termsAgreedAt: user.termsAgreedAt,
      }
    );
  } catch (error) {
    userLogger.error("Error agreeing to terms", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Check Terms Agreement Status
 * Check if user has agreed to terms
 * GET /api/user/check-terms-agreement
 */
export const checkTermsAgreement = async (req, res) => {
  try {
    const userId = req.user._id;

    userLogger.start("Checking terms agreement status", { userId });

    const user = await userModel.findById(userId).select("termsAgreed termsAgreedAt");

    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    userLogger.success("Terms agreement status retrieved", { userId, termsAgreed: user.termsAgreed });

    return successResponseWithData(
      res,
      "Terms agreement status retrieved",
      {
        termsAgreed: user.termsAgreed || false,
        termsAgreedAt: user.termsAgreedAt || null,
      }
    );
  } catch (error) {
    userLogger.error("Error checking terms agreement", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Update user's crypto wallet preferences
 * PUT /api/user/crypto-wallet
 */
export const updateCryptoWallet = async (req, res) => {
  try {
    const userId = req.user._id;
    const { cryptoWalletAddress, cryptoCurrency } = req.body;

    userLogger.start("Updating crypto wallet preferences", { userId });

    // Validate crypto wallet address
    if (!cryptoWalletAddress || cryptoWalletAddress.trim().length === 0) {
      return ErrorResponse(res, "Crypto wallet address is required", 400);
    }

    if (cryptoWalletAddress.trim().length < 26) {
      return ErrorResponse(res, "Invalid crypto wallet address. Please check and try again", 400);
    }

    // Validate cryptocurrency type
    if (!cryptoCurrency || !["USDT", "BTC"].includes(cryptoCurrency)) {
      return ErrorResponse(res, "Invalid cryptocurrency. Please select USDT or BTC", 400);
    }

    // Update user's crypto wallet preferences
    const user = await userModel.findByIdAndUpdate(
      userId,
      {
        cryptoWalletAddress: cryptoWalletAddress.trim(),
        cryptoCurrency: cryptoCurrency,
        cryptoWalletUpdatedAt: new Date(),
      },
      { new: true, runValidators: true }
    ).select("cryptoWalletAddress cryptoCurrency cryptoWalletUpdatedAt");

    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    userLogger.success("Crypto wallet preferences updated", { 
      userId, 
      cryptoCurrency,
      walletAddressLength: cryptoWalletAddress.length
    });

    return successResponseWithData(
      res,
      "Crypto wallet preferences saved successfully",
      {
        cryptoWalletAddress: user.cryptoWalletAddress,
        cryptoCurrency: user.cryptoCurrency,
        cryptoWalletUpdatedAt: user.cryptoWalletUpdatedAt,
      }
    );
  } catch (error) {
    userLogger.error("Error updating crypto wallet", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Get user's crypto wallet preferences
 * GET /api/user/crypto-wallet
 */
export const getCryptoWallet = async (req, res) => {
  try {
    const userId = req.user._id;

    userLogger.start("Getting crypto wallet preferences", { userId });

    const user = await userModel.findById(userId).select("cryptoWalletAddress cryptoCurrency cryptoWalletUpdatedAt");

    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    userLogger.success("Crypto wallet preferences retrieved", { userId });

    return successResponseWithData(
      res,
      "Crypto wallet preferences retrieved",
      {
        cryptoWalletAddress: user.cryptoWalletAddress || null,
        cryptoCurrency: user.cryptoCurrency || "USDT",
        cryptoWalletUpdatedAt: user.cryptoWalletUpdatedAt || null,
      }
    );
  } catch (error) {
    userLogger.error("Error getting crypto wallet", error);
    return ErrorResponse(res, error.message, 500);
  }
};
