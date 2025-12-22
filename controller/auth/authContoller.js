import { compairPassword, hashPassword } from "../../middleware/authMiddleware.js";
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
    const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const client = twilio(
  "ACb7266ba24e021877ca84a0a7d8f40985",
  "dc5f3cb615c47bd88a174f6c8dc08a15"   
);

const TWILIO_PHONE_NUMBER = "+14452757954"; 

export const sendOtpSms = async (phone, otp) => {
  if (!phone) {
    console.error(" No phone number provided to sendOtpSms()");
    return;
  }

  try {
    await client.messages.create({
      body: `Your login OTP is ${otp}. It is valid for 1 minute.`,
      from: TWILIO_PHONE_NUMBER,
      to: phone.startsWith("+") ? phone : `+91${phone}`,
    });

    console.log(` OTP SMS sent successfully to: ${phone}`);
  } catch (error) {
    console.error("Error sending OTP SMS:", error.message);
  }
};

export const sendOtpEmail = async (email, otp) => {
  if (!email) {
    console.error(" No email provided to sendOtpEmail()");
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

    console.log(`✅ OTP sent via Email to: ${email}`);
  } catch (error) {
    console.error("❌ Error sending OTP Email:", error.message);
  }
};
export const register = async (req, res) => {
  try {
    const { fname, lname, email, password, phone, address, referralCode, role } = req.body;
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return ErrorResponse(res, "User already exists");
    }

    const hashedPassword = await hashPassword(password);

    const otp = generateOTP();
     await new userModel({
      fname,
      lname,
      email,
      password: hashedPassword,
      phone,
      address,
      referralCode,
      role: role,
      otp,
    }).save();

    // await sendOtpSms(phone, otp);
    // await sendOtpEmail(email, otp);
// 
    return successResponse(
      res,
      `User created successfully. OTP sent to your phone and email.`
    );
  } catch (err) {
    console.error(" Error in register:", err);
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

    if (!email || !otp) {
      return ErrorResponse(res, "Email and OTP are required");
    }
    const user = await userModel.findOne({ email });
    if (!user) {
      return notFoundResponse(res, "User not found");
    }
      const currentTime = new Date();
    const updatedTime = new Date(user.updatedAt);
    const diffInMs = currentTime - updatedTime; 
    const diffInMinutes = diffInMs / (1000 * 60);

    if (diffInMinutes > 1) {
      return ErrorResponse(res, "OTP expired, please request a new one");
    }

    if (user.otp !== otp) {
      return ErrorResponse(res, "Invalid OTP");
    }

    user.otp = null;
    await user.save();

    const jwtPayload = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    const token = Jwt.sign(jwtPayload, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    return successResponseWithData(res, "OTP verified successfully", {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
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

    if (!email) {
      return ErrorResponse(res, "Email is required");
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    const newOtp = generateOTP();
    user.otp = newOtp;
    await user.save();

    if (user.Phone) {
      // await sendOtpSms(user.Phone, newOtp);
    }
    // if (user.email) {
    //   await sendOtpEmail(user.email, newOtp);
    // }

    return successResponseWithData(res, "OTP resent successfully", {
      email: user.email,
      phone: user.Phone,
      message: "OTP has been sent to your registered phone and email.",
    });
  } catch (error) {
    console.error("Error while resending OTP:", error);
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

    if (!email || !password) {
      return ErrorResponse(res, "Email and Password are required");
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      return notFoundResponse(res, "User not found");
    }
    if (user.isSuspended) {
      return ErrorResponse(res, "Your account is temporarily suspended. Please contact support.");
    }

    // 🔑 Verify password
    const match = await compairPassword(password, user.password);
    if (!match) {
      return ErrorResponse(res, "Invalid password");
    }

    const today = new Date().toDateString();
    const lastLoginDate = user.lastLoginDate
      ? new Date(user.lastLoginDate).toDateString()
      : null;
    if (today !== lastLoginDate) {
      user.dailyLoginCount = 0;
    }

    if (user.dailyLoginCount >= 5) {
      user.isSuspended = true;
      await user.save();
      return ErrorResponse(
        res,
        "Daily login limit exceeded. Your account has been temporarily suspended. Please contact support."
      );
    }
    user.dailyLoginCount += 1;
    user.lastLoginDate = new Date();

    const otp = generateOTP();
    user.otp = otp;
    await user.save();

    // 🔐 Enforce single session (logout all previous sessions)
    await enforceSignleSession(user._id);

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

    return successResponseWithData(
      res,
      `Login successful. (${user.dailyLoginCount}/5 logins used today). OTP sent to your registered phone/email.`,
      {
        user: {
          id: user._id,
          name: `${user.fname} ${user.lname}`,
          email: user.email,
          role: user.role,
          phone: user.phone,
          loginsToday: user.dailyLoginCount,
        },
        token,
      }
    );

  } catch (error) {
    console.error("Error during login:", error);
    return res.status(500).send({
      success: false,
      message: "Error while logging in",
      error: error.message,
    });
  }
};


export const getAllUsersExceptLoggedIn = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const users = await userModel.find({ _id: { $ne: loggedInUserId } });

    return successResponseWithData(res, "Users fetched successfully", users);
  } catch (error) {
    console.error("Error occurred while fetching users:", error);
    res.status(500).send({
      success: false,
      message: "Error while fetching users",
    });
  }
};
export const getUserbyId = async (req, res) => {
  try {
    const {id} = req.body;
    const users = await userModel.find({ _id:  id });

    return successResponseWithData(res, "Users fetched successfully", users);
  } catch (error) {
    console.error("Error occurred while fetching users:", error);
    res.status(500).send({
      success: false,
      message: "Error while fetching users",
    });
  }
};

export const getUserPlatformMetrics = async (req, res) => {
  try {
    // 🔹 Time calculations
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(
      startOfDay.getFullYear(),
      startOfDay.getMonth(),
      1
    );

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
    console.error("Dashboard metrics error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching platform metrics",
    });
  }
};

export const getDashboardVisualizations = async (req, res) => {
  try {
    // 🔹 Time ranges
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 6);

    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 29);

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
    console.error("Dashboard visualization error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching dashboard visualizations",
    });
  }
};