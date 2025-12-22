import userModel from "../../models/authModel.js";
import { compairPassword, hashPassword } from "../../middleware/authMiddleware.js";
import {
  ErrorResponse,
  successResponse,
  notFoundResponse,
  successResponseWithData,
} from "../../helpers/apiResponse.js";

/**
 * Update User Profile
 * User can update their own profile: name, DOB, email, phone
 * POST /api/user/update-profile
 */
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { fname, lname, email, phone, dob, address } = req.body;

    // Validate required fields
    if (!fname || !lname) {
      return ErrorResponse(res, "First name and last name are required", 400);
    }

    // Check if email is being changed and if it's already taken
    if (email) {
      const existingUser = await userModel.findOne({
        email: email,
        _id: { $ne: userId },
      });
      if (existingUser) {
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
        return ErrorResponse(res, "Phone number already in use", 400);
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
      return notFoundResponse(res, "User not found");
    }

    return successResponseWithData(
      res,
      updatedUser,
      "Profile updated successfully"
    );
  } catch (error) {
    console.error("Error updating profile:", error);
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

    return successResponseWithData(res, user, "Profile retrieved successfully");
  } catch (error) {
    console.error("Error fetching profile:", error);
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
    const isPasswordValid = await compairPassword(currentPassword, user.password);

    if (!isPasswordValid) {
      return ErrorResponse(res, "Current password is incorrect", 401);
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await userModel.findByIdAndUpdate(userId, { password: hashedPassword });

    return successResponse(res, "Password changed successfully");
  } catch (error) {
    console.error("Error changing password:", error);
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
    console.error("Error suspending user:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Admin: Reactivate User Account
 * Admin can reactivate a suspended user's account
 * POST /api/admin/user/:userId/reactivate
 */
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

    // Reactivate user
    user.isSuspended = false;
    user.suspensionReason = null;
    user.suspendedAt = null;
    user.suspendedBy = null;
    user.reactivatedAt = new Date();
    user.reactivatedBy = req.user._id;

    await user.save();

    return successResponseWithData(
      res,
      user,
      `User ${user.email} has been reactivated`
    );
  } catch (error) {
    console.error("Error reactivating user:", error);
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
    console.error("Error blocking user:", error);
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
      {
        users,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      },
      "Users retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching users:", error);
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
    console.error("Error fetching user:", error);
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
    console.error("Error updating user role:", error);
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
    console.error("Error fetching user statistics:", error);
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
    const isPasswordValid = await compairPassword(password, user.password);

    if (!isPasswordValid) {
      return ErrorResponse(res, "Password is incorrect", 401);
    }

    // Soft delete - mark as deleted
    user.isDeleted = true;
    user.deletedAt = new Date();

    await user.save();

    return successResponse(res, "Account deleted successfully");
  } catch (error) {
    console.error("Error deleting account:", error);
    return ErrorResponse(res, error.message, 500);
  }
};
