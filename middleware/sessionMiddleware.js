import SessionModel from "../models/sessionModel.js";
import { ErrorResponse } from "../helpers/apiResponse.js";

export const validateSessionMiddleware = async (req, res, next) => {
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
