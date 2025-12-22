import SessionModel from "../../models/sessionModel.js";
import userModel from "../../models/authModel.js";
import {
  successResponse,
  successResponseWithData,
  ErrorResponse,
  notFoundResponse,
} from "../../helpers/apiResponse.js";
import logger from "../../helpers/logger.js";

const sessionLogger = logger.module("SESSION_CONTROLLER");

/* =========================
   CREATE SESSION (on login)
========================= */
export const createSession = async (userId, token, req) => {
  try {
    sessionLogger.start("Creating user session", { userId });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1); // 24 hours

    const session = await SessionModel.create({
      user: userId,
      token,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      expiresAt,
      lastActivityTime: new Date(),
    });

    sessionLogger.success("Session created successfully", { userId, sessionId: session._id, expiresAt });
    return session;
  } catch (error) {
    sessionLogger.error("Error creating session", error);
    return null;
  }
};

/* =========================
   ENFORCE SINGLE SESSION
   (Logout all previous sessions before creating new one)
========================= */
export const enforceSignleSession = async (userId) => {
  try {
    sessionLogger.start("Enforcing single session for user", { userId });

    // Deactivate all previous active sessions
    const result = await SessionModel.updateMany(
      { user: userId, isActive: true },
      { isActive: false }
    );

    sessionLogger.success("Previous sessions deactivated", { userId, deactivatedCount: result.modifiedCount });
  } catch (error) {
    sessionLogger.error("Error enforcing single session", error);
  }
};

/* =========================
   GET ACTIVE SESSION
========================= */
export const getActiveSession = async (req, res) => {
  try {
    const userId = req.user._id;

    sessionLogger.start("Fetching active session", { userId });

    const activeSession = await SessionModel.findOne({
      user: userId,
      isActive: true,
      expiresAt: { $gt: new Date() },
    })
      .select("-token")
      .lean();

    if (!activeSession) {
      sessionLogger.warn("No active session found", { userId });
      return notFoundResponse(res, "No active session found");
    }

    sessionLogger.success("Active session retrieved", { userId, sessionId: activeSession._id });

    return successResponseWithData(
      res,
      "Active session retrieved successfully",
      {
        sessionId: activeSession._id,
        loginTime: activeSession.loginTime,
        lastActivityTime: activeSession.lastActivityTime,
        expiresAt: activeSession.expiresAt,
        ipAddress: activeSession.ipAddress,
        deviceInfo: activeSession.deviceInfo,
        user: {
          id: activeSession.user,
          email: req.user.email,
          name: `${req.user.fname} ${req.user.lname}`,
        },
      }
    );
  } catch (error) {
    sessionLogger.error("Error getting active session", error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving session",
      error: error.message,
    });
  }
};

/* =========================
   LOGOUT USER
========================= */
export const logout = async (req, res) => {
  try {
    const token = req.headers.authorization;
    const userId = req.user._id;

    if (!token) {
      return ErrorResponse(res, "Token not found");
    }

    // Mark session as inactive
    const session = await SessionModel.findOneAndUpdate(
      { token, user: userId, isActive: true },
      { isActive: false },
      { new: true }
    );

    if (!session) {
      return notFoundResponse(res, "Session not found");
    }

    return successResponse(
      res,
      "Logged out successfully. Session terminated."
    );
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Error during logout",
      error: error.message,
    });
  }
};

/* =========================
   VALIDATE SESSION (Middleware)
========================= */
export const validateSession = async (req, res, next) => {
  try {
    const token = req.headers.authorization;
    const userId = req.user?._id;

    if (!token || !userId) {
      return ErrorResponse(res, "Unauthorized - Invalid session");
    }

    const session = await SessionModel.findOne({
      token,
      user: userId,
      isActive: true,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      return ErrorResponse(res, "Session expired or invalid");
    }

    // Update last activity time
    session.lastActivityTime = new Date();
    await session.save();

    next();
  } catch (error) {
    console.error("Session validation error:", error);
    return ErrorResponse(res, "Session validation failed");
  }
};

/* =========================
   GET ALL ACTIVE SESSIONS (Admin)
========================= */
export const getAllActiveSessions = async (req, res) => {
  try {
    const { userId } = req.query;

    const filter = {
      isActive: true,
      expiresAt: { $gt: new Date() },
    };

    if (userId) {
      filter.user = userId;
    }

    const sessions = await SessionModel.find(filter)
      .select("-token")
      .populate("user", "fname lname email")
      .sort({ loginTime: -1 });

    return successResponseWithData(
      res,
      "Active sessions retrieved successfully",
      sessions
    );
  } catch (error) {
    console.error("Error getting active sessions:", error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving sessions",
      error: error.message,
    });
  }
};

/* =========================
   TERMINATE SESSION (Admin/Force Logout)
========================= */
export const terminateSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await SessionModel.findByIdAndUpdate(
      sessionId,
      { isActive: false },
      { new: true }
    );

    if (!session) {
      return notFoundResponse(res, "Session not found");
    }

    return successResponse(res, "Session terminated successfully");
  } catch (error) {
    console.error("Error terminating session:", error);
    return ErrorResponse(res, "Error terminating session");
  }
};

/* =========================
   LOGOUT ALL SESSIONS (User)
========================= */
export const logoutAllSessions = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await SessionModel.updateMany(
      { user: userId, isActive: true },
      { isActive: false }
    );

    return successResponseWithData(
      res,
      `Logged out from all sessions. Total: ${result.modifiedCount}`,
      { sessionsTerminated: result.modifiedCount }
    );
  } catch (error) {
    console.error("Logout all sessions error:", error);
    return res.status(500).json({
      success: false,
      message: "Error logging out from all sessions",
      error: error.message,
    });
  }
};
