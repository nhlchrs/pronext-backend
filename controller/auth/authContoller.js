import { comparePassword, hashPassword } from "../../middleware/authMiddleware.js";
import userModel from "../../models/authModel.js";
import Jwt from "jsonwebtoken";
import twilio from "twilio";
import nodemailer from "nodemailer";
import {
  ErrorResponse,
  successResponse,
  notFoundResponse,
  successResponseWithData
} from "../../helpers/apiResponse.js";
import paymentModel from "../../models/paymentModel.js";
import { createSession, enforceSignleSession } from "../session/sessionController.js";
import logger from "../../helpers/logger.js";

const authLogger = logger.module("AUTH_CONTROLLER");
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const client = twilio(
  "ACb7266ba24e021877ca84a0a7d8f40985",
  "dc5f3cb615c47bd88a174f6c8dc08a15"   
);

const TWILIO_PHONE_NUMBER = "+14452757954"; 

export const sendOtpSms = async (phone, otp) => {
  if (!phone) {
    authLogger.warn("No phone number provided to sendOtpSms()");
    return;
  }

  try {
    await client.messages.create({
      body: `Your login OTP is ${otp}. It is valid for 1 minute.`,
      from: TWILIO_PHONE_NUMBER,
      to: phone.startsWith("+") ? phone : `+91${phone}`,
    });

    authLogger.notification(`OTP SMS sent successfully to: ${phone}`);
  } catch (error) {
    authLogger.error("Error sending OTP SMS", error.message);
  }
};

export const sendOtpEmail = async (email, otp) => {
  if (!email) {
    authLogger.warn("No email provided to sendOtpEmail()");
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "harshit.inventcolab@gmail.com",
        pass: "xggpvgdhddkzyecb",
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    await transporter.sendMail({
      from: `"Opt" <test@gmail.com}>`,
      to: email, 
      subject: "Your OTP Code",
      html: `
        <h2>🔐 Login OTP</h2>
        <p>Your one-time password (OTP) is:</p>
        <h3 style="color:#2E86C1;">${otp}</h3>
        <p>This code is valid for <b>1 minute</b>.</p>
      `,
    });

    authLogger.notification(`OTP sent via Email to: ${email}`);
  } catch (error) {
    authLogger.error("Error sending OTP Email", error.message);
  }
};
export const register = async (req, res) => {
  try {
    authLogger.start("User registration process", { module: "REGISTER" });
    const { fname, lname, email, password, phone, address, referralCode, role } = req.body;
    
    authLogger.debug(`Checking if user with email ${email} already exists`);
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      authLogger.warn(`User with email ${email} already exists`);
      return ErrorResponse(res, "User already exists");
    }

    authLogger.security(`Hashing password for user ${email}`);
    const hashedPassword = await hashPassword(password);

    const otp = generateOTP();
    authLogger.otp(`Generated OTP for email: ${email}`, { otp });
    
    const newUser = await new userModel({
      fname,
      lname,
      email,
      password: hashedPassword,
      phone,
      address,
      referralCode,
      role: role || "User",
      otp,
    }).save();

    authLogger.success(`User ${email} registered successfully`, { userId: newUser._id });
    // await sendOtpSms(phone, otp);
    // await sendOtpEmail(email, otp);

    return successResponseWithData(
      res,
      `User created successfully. OTP: ${otp} (temporary for testing)`,
      {
        userId: newUser._id,
        email: newUser.email,
        role: newUser.role,
        message: "Please verify OTP to complete registration. Then proceed to payment for subscription.",
        otp: otp, // TEMPORARY - for testing only
        otpExpiresIn: "1 minute",
        nextStep: "Verify OTP and proceed to /api/payments for subscription"
      }
    );
  } catch (err) {
    authLogger.error("Error in register", err);
    res.status(500).send({
      success: false,
      message: "Error while registering",
      error: err.message,
    });
  }
};
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    authLogger.start("OTP verification process", { email });

    if (!email || !otp) {
      authLogger.warn("Missing email or OTP in request");
      return ErrorResponse(res, "Email and OTP are required");
    }
    
    const user = await userModel.findOne({ email });
    if (!user) {
      authLogger.error(`User not found for email: ${email}`);
      return notFoundResponse(res, "User not found");
    }
    
    authLogger.debug("Checking OTP expiration", { email });
    const currentTime = new Date();
    const updatedTime = new Date(user.updatedAt);
    const diffInMs = currentTime - updatedTime; 
    const diffInMinutes = diffInMs / (1000 * 60);

    if (diffInMinutes > 1) {
      authLogger.warn(`OTP expired for user: ${email}`, { expiredMinutesAgo: diffInMinutes.toFixed(2) });
      return ErrorResponse(res, "OTP expired, please request a new one");
    }

    if (user.otp !== otp) {
      authLogger.error(`Invalid OTP provided for user: ${email}`, { expected: user.otp, received: otp });
      return ErrorResponse(res, "Invalid OTP");
    }

    authLogger.success(`OTP verified for user: ${email}`);
    user.otp = null;
    await user.save();

    const jwtPayload = {
      _id: user._id,
      fname: user.fname,
      lname: user.lname,
      email: user.email,
      role: user.role
    };

    authLogger.security(`Generating JWT token for user: ${email}`);
    const token = Jwt.sign(jwtPayload, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    authLogger.success(`User ${email} successfully verified and logged in`);
    return successResponseWithData(res, "OTP verified successfully", {
      user: {
        id: user._id,
        fname: user.fname,
        lname: user.lname,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    authLogger.error("Error verifying OTP", error);
    return res.status(500).send({
      success: false,
      message: "Error while verifying OTP",
      error: error.message,
    });
  }
};
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    authLogger.start("OTP resend process", { email });

    if (!email) {
      authLogger.warn("Missing email in request");
      return ErrorResponse(res, "Email is required");
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      authLogger.error(`User not found for email: ${email}`);
      return notFoundResponse(res, "User not found");
    }

    const newOtp = generateOTP();
    authLogger.otp(`Generated new OTP for email: ${email}`, { otp: newOtp });
    
    user.otp = newOtp;
    await user.save();
    authLogger.database(`New OTP saved for user: ${email}`);

    if (user.Phone) {
      authLogger.info(`Attempting to send SMS to: ${user.Phone}`);
      // await sendOtpSms(user.Phone, newOtp);
    }
    if (user.email) {
      authLogger.info(`Attempting to send Email to: ${user.email}`);
      // await sendOtpEmail(user.email, newOtp);
    }

    authLogger.success(`New OTP resent successfully for user: ${email}`);
    return successResponseWithData(res, "OTP resent successfully", {
      email: user.email,
      phone: user.Phone,
      otp: newOtp, // TEMPORARY - for testing only
      message: "New OTP has been generated. Use it within 1 minute.",
    });
  } catch (error) {
    authLogger.error("Error while resending OTP", error);
    return res.status(500).send({
      success: false,
      message: "Error while resending OTP",
      error: error.message,
    });
  }
};


export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    authLogger.start("Login attempt", { email });

    if (!email || !password) {
      authLogger.warn("Missing email or password in request");
      return ErrorResponse(res, "Email and Password are required");
    }

    authLogger.debug(`Looking up user with email: ${email}`);
    const user = await userModel.findOne({ email });
    if (!user) {
      authLogger.error(`User not found for email: ${email}`);
      return notFoundResponse(res, "User not found");
    }
    
    if (user.isSuspended) {
      authLogger.warn(`Account suspended for user: ${email}`);
      return ErrorResponse(res, "Your account is temporarily suspended. Please contact support.");
    }

    authLogger.security(`Verifying password for user: ${email}`);
    // 🔑 Verify password
    const match = await comparePassword(password, user.password);
    if (!match) {
      authLogger.error(`Invalid password for user: ${email}`);
      return ErrorResponse(res, "Invalid password");
    }

    authLogger.success(`Password verified for user: ${email}`);
    const today = new Date().toDateString();
    const lastLoginDate = user.lastLoginDate
      ? new Date(user.lastLoginDate).toDateString()
      : null;
    if (today !== lastLoginDate) {
      user.dailyLoginCount = 0;
    }

    // Skip daily login limit check for Admin users
    if (user.role !== "Admin" && user.dailyLoginCount >= 5) {
      authLogger.warn(`Daily login limit exceeded for user: ${email}. Suspending account.`, { loginCount: user.dailyLoginCount });
      user.isSuspended = true;
      await user.save();
      return ErrorResponse(
        res,
        "Daily login limit exceeded. Your account has been temporarily suspended. Please contact support."
      );
    }
    
    // Increment login count only for non-admin users
    if (user.role !== "Admin") {
      user.dailyLoginCount += 1;
    }
    user.lastLoginDate = new Date();

    const otp = generateOTP();
    authLogger.otp(`Generated OTP for login: ${email}`, { otp });
    user.otp = otp;
    await user.save();

    // 🔐 Enforce single session (logout all previous sessions)
    authLogger.info(`Enforcing single session for user: ${email}`);
    await enforceSignleSession(user._id);

    authLogger.info(`Returning OTP to user: ${email} for verification`);
    // 🎫 Generate JWT token
    const jwtPayload = {
      _id: user._id,
      name: `${user.fname} ${user.lname}`,
      email: user.email,
      role: user.role,
    };

    const token = Jwt.sign(jwtPayload, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    // 📝 Create session record
    await createSession(user._id, token, req);

    if (user.phone) {
      // await sendOtpSms(user.phone, otp);
    }

    authLogger.success(`Login successful for user: ${email}`, { loginsToday: user.dailyLoginCount });
    return successResponseWithData(
      res,
      `Login successful. (${user.dailyLoginCount}/5 logins used today). OTP: ${otp} (temporary for testing)`,
      {
        user: {
          id: user._id,
          name: `${user.fname} ${user.lname}`,
          email: user.email,
          role: user.role,
          phone: user.phone,
          loginsToday: user.dailyLoginCount,
        },
        otp: otp, // TEMPORARY - for testing only
        otpExpiresIn: "1 minute",
        message: "Please verify OTP to complete login",
        token,
      }
    );

  } catch (error) {
    authLogger.error("Error during login", error);
    return res.status(500).send({
      success: false,
      message: "Error while logging in",
      error: error.message,
    });
  }
};


export const getAllUsersExceptLoggedIn = async (req, res) => {
  try {
    authLogger.start("Fetching all users except logged in", { userId: req.user._id });
    const loggedInUserId = req.user._id;

    const users = await userModel.find({ _id: { $ne: loggedInUserId } });
    authLogger.success(`Fetched ${users.length} users`);

    return successResponseWithData(res, "Users fetched successfully", users);
  } catch (error) {
    authLogger.error("Error occurred while fetching users", error);
    res.status(500).send({
      success: false,
      message: "Error while fetching users",
    });
  }
};
export const getUserbyId = async (req, res) => {
  try {
    authLogger.debug("Fetching user by ID", { id: req.body.id });
    const {id} = req.body;
    const users = await userModel.find({ _id:  id });
    authLogger.success(`Fetched user with ID: ${id}`);

    return successResponseWithData(res, "Users fetched successfully", users);
  } catch (error) {
    authLogger.error("Error occurred while fetching users", error);
    res.status(500).send({
      success: false,
      message: "Error while fetching users",
    });
  }
};

export const getUserPlatformMetrics = async (req, res) => {
  try {
    authLogger.start("Fetching platform metrics");
    // 🔹 Time calculations
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(
      startOfDay.getFullYear(),
      startOfDay.getMonth(),
      1
    );

    authLogger.debug("Fetching metrics from database");
    // 🔹 Parallel execution (performance optimized)
    const [
      activeUsers,
      todaySignups,
      monthlySignups,
      totalUsers,
      totalRevenueAgg,
      monthlyRevenueAgg,
    ] = await Promise.all([
      // 👤 USERS
      userModel.countDocuments({ isSuspended: false }),

      userModel.countDocuments({
        createdAt: { $gte: startOfDay },
      }),

      userModel.countDocuments({
        createdAt: { $gte: startOfMonth },
      }),

      userModel.countDocuments(),

      // 💰 TOTAL REVENUE
      paymentModel.aggregate([
        { $match: { status: "paid" } },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
          },
        },
      ]),

      // 💰 MONTHLY REVENUE
      paymentModel.aggregate([
        {
          $match: {
            status: "paid",
            createdAt: { $gte: startOfMonth },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
          },
        },
      ]),
    ]);

    const totalRevenue = totalRevenueAgg[0]?.total || 0;
    const monthlyRevenue = monthlyRevenueAgg[0]?.total || 0;

    authLogger.success("Platform metrics fetched successfully", {
      totalUsers,
      activeUsers,
      todaySignups,
      totalRevenue
    });

    return successResponseWithData(
      res,
      "Platform metrics fetched successfully",
      {
        users: {
          total: totalUsers,
          active: activeUsers,
          newToday: todaySignups,
          newThisMonth: monthlySignups,
        },
        revenue: {
          total: totalRevenue,
          thisMonth: monthlyRevenue,
        },
      }
    );
  } catch (error) {
    authLogger.error("Dashboard metrics error", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching platform metrics",
    });
  }
};

export const getDashboardVisualizations = async (req, res) => {
  try {
    authLogger.start("Fetching dashboard visualizations");
    // 🔹 Time ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 6);

    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 29);

    authLogger.debug("Aggregating visualization data");
    // 🔹 Parallel execution for performance
    const [
      payoutTrends,
      activeSubscriptions,
      teamGrowth,
    ] = await Promise.all([
      // 💰 Payout Trends (Last 7 Days)
      paymentModel.aggregate([
        {
          $match: {
            status: "paid",
            createdAt: { $gte: last7Days },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            totalAmount: { $sum: "$amount" },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // 🔁 Active Subscriptions
      userModel.countDocuments({
        subscriptionStatus: true,
        isSuspended: false,
      }),

      // 👥 Team Growth (Last 30 Days)
      userModel.aggregate([
        {
          $match: {
            createdAt: { $gte: last30Days },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    authLogger.success("Dashboard visualizations fetched successfully", {
      payoutTrendsCount: payoutTrends.length,
      activeSubscriptions,
      teamGrowthDays: teamGrowth.length
    });

    return successResponseWithData(
      res,
      "Dashboard visualizations fetched successfully",
      {
        payoutTrends,            // line / bar chart
        activeSubscriptions,     // stat / donut
        teamGrowthAnalytics: teamGrowth, // line chart
      }
    );
  } catch (error) {
    authLogger.error("Dashboard visualization error", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching dashboard visualizations",
    });
  }
};

/**
 * Suspend/Unsuspend User Account
 * PUT /api/users/:userId/suspend-status
 * Admin only endpoint
 */
export const updateUserSuspensionStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isSuspended, suspensionReason } = req.body;

    authLogger.start("Updating user suspension status", { userId, isSuspended });

    if (!userId) {
      authLogger.warn("Missing userId in request");
      return ErrorResponse(res, "User ID is required", 400);
    }

    const user = await userModel.findById(userId);
    if (!user) {
      authLogger.error(`User not found: ${userId}`);
      return notFoundResponse(res, "User not found");
    }

    if (isSuspended === true) {
      // Suspending user
      if (!suspensionReason || !suspensionReason.trim()) {
        authLogger.warn("Missing suspension reason");
        return ErrorResponse(res, "Suspension reason is required", 400);
      }
      user.isSuspended = true;
      user.suspensionReason = suspensionReason;
      user.suspendedAt = new Date();
      user.suspendedBy = req.user._id;
      authLogger.security(`User ${user.email} suspended by admin. Reason: ${suspensionReason}`);
    } else if (isSuspended === false) {
      // Unsuspending user - reset login count to allow fresh attempts
      user.isSuspended = false;
      user.suspensionReason = null;
      user.suspendedAt = null;
      user.suspendedBy = null;
      user.reactivatedAt = new Date();
      user.reactivatedBy = req.user._id;
      user.dailyLoginCount = 0;  // Reset login count to 0
      user.lastLoginDate = null;  // Reset last login date
      authLogger.security(`User ${user.email} reactivated by admin with login count reset`);
    } else {
      authLogger.warn("Invalid isSuspended value");
      return ErrorResponse(res, "isSuspended must be true or false", 400);
    }

    await user.save();

    authLogger.success(`User suspension status updated: ${user.email}`, {
      userId: user._id,
      isSuspended: user.isSuspended,
    });

    return successResponseWithData(
      res,
      isSuspended ? "User suspended successfully" : "User reactivated successfully",
      {
        user: {
          id: user._id,
          email: user.email,
          fname: user.fname,
          lname: user.lname,
          isSuspended: user.isSuspended,
          suspensionReason: user.suspensionReason,
        },
      }
    );
  } catch (error) {
    authLogger.error("Error updating user suspension status", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Forgot Password - Send OTP to Admin Email
 * POST /api/forgot-password
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return ErrorResponse(res, "Email is required", 400);
    }

    authLogger.start("Processing forgot password request", { email });

    // Find user by email
    const user = await userModel.findOne({ email: email.toLowerCase() });

    if (!user) {
      authLogger.warn("User not found for forgot password", { email });
      return ErrorResponse(res, "No user found with this email address", 404);
    }

    // Check if user is Admin
    if (user.role !== "Admin") {
      authLogger.warn("Non-admin user attempted password reset", { email, role: user.role });
      return ErrorResponse(res, "Password reset is only available for administrators", 403);
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Update user with OTP
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    user.resetPasswordToken = otp; // Using OTP as reset token
    await user.save();

    // Send OTP via email
    await sendOtpEmail(user.email, otp);

    authLogger.success("Password reset OTP sent successfully", { email });

    return successResponseWithData(
      res,
      "Password reset OTP sent to your email. Valid for 5 minutes.",
      {
        email: user.email,
        message: "Please check your email for the OTP code",
        otp: otp, // Include OTP in response for testing
      }
    );
  } catch (error) {
    authLogger.error("Error in forgot password", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Reset Password with OTP
 * POST /api/reset-password
 */
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;

    if (!email || !otp || !newPassword || !confirmPassword) {
      return ErrorResponse(res, "All fields are required", 400);
    }

    if (newPassword !== confirmPassword) {
      return ErrorResponse(res, "Passwords do not match", 400);
    }

    if (newPassword.length < 6) {
      return ErrorResponse(res, "Password must be at least 6 characters", 400);
    }

    authLogger.start("Processing password reset", { email });

    // Find user by email
    const user = await userModel.findOne({ email: email.toLowerCase() });

    if (!user) {
      authLogger.warn("User not found for password reset", { email });
      return ErrorResponse(res, "Invalid email or OTP", 401);
    }

    // Check if user is Admin
    if (user.role !== "Admin") {
      authLogger.warn("Non-admin user attempted password reset", { email, role: user.role });
      return ErrorResponse(res, "Password reset is only available for administrators", 403);
    }

    // Verify OTP
    if (user.otp !== otp) {
      authLogger.warn("Invalid OTP for password reset", { email });
      return ErrorResponse(res, "Invalid OTP", 401);
    }

    // Check OTP expiry
    if (user.otpExpiry < new Date()) {
      authLogger.warn("Expired OTP for password reset", { email });
      return ErrorResponse(res, "OTP has expired. Please request a new one.", 401);
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password and clear OTP
    user.password = hashedPassword;
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.resetPasswordToken = undefined;
    await user.save();

    authLogger.success("Password reset successfully", { email });

    return successResponse(res, "Password reset successfully. Please login with your new password.");
  } catch (error) {
    authLogger.error("Error in reset password", error);
    return ErrorResponse(res, error.message, 500);
  }
};