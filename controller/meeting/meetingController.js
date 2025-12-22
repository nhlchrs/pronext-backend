import meetingModel from "../../models/meetingModel.js";
import userModel from "../../models/authModel.js";
import {
  ErrorResponse,
  successResponse,
  notFoundResponse,
  successResponseWithData,
} from "../../helpers/apiResponse.js";
import logger from "../../helpers/logger.js";

const meetingLogger = logger.module("MEETING_CONTROLLER");

// Simulated Zoom API integration (replace with actual Zoom SDK)
const zoomClient = {
  createMeeting: async (userId, meetingData) => {
    // In production, use zoom-nodejs SDK or fetch API
    // For now, we generate a mock meeting ID and link
    const meetingId = Math.floor(Math.random() * 90000000) + 10000000;
    const link = `https://zoom.us/wc/join/${meetingId}`;
    return {
      id: meetingId,
      link: link,
      passcode: Math.floor(Math.random() * 1000000).toString(),
    };
  },
};

/**
 * Admin: Create Meeting
 * POST /api/admin/meeting/create
 */
export const createMeeting = async (req, res) => {
  try {
    const {
      title,
      description,
      scheduledAt,
      duration,
      allowedSubscriptionTiers,
      allowedLevels,
      maxAttendees,
      topic,
      tags,
      isRecorded,
    } = req.body;

    meetingLogger.start("Creating new meeting", { title, duration, scheduledAt });

    // Validate required fields
    if (!title || !scheduledAt || !duration) {
      meetingLogger.warn("Missing required fields for meeting creation", { title, scheduledAt, duration });
      return ErrorResponse(
        res,
        "Title, scheduled time, and duration are required",
        400
      );
    }

    // Validate scheduledAt is in the future
    if (new Date(scheduledAt) <= new Date()) {
      meetingLogger.warn("Meeting scheduled in the past", { scheduledAt });
      return ErrorResponse(res, "Meeting must be scheduled in the future", 400);
    }

    // Validate duration
    if (duration < 15 || duration > 480) {
      meetingLogger.warn("Invalid meeting duration", { duration });
      return ErrorResponse(res, "Duration must be between 15 and 480 minutes", 400);
    }

    // Validate subscription tiers
    if (allowedSubscriptionTiers) {
      const validTiers = ["Basic", "Premium", "Pro", "Free"];
      for (let tier of allowedSubscriptionTiers) {
        if (!validTiers.includes(tier)) {
          meetingLogger.warn("Invalid subscription tier for meeting", { tier });
          return ErrorResponse(res, `Invalid subscription tier: ${tier}`, 400);
        }
      }
    }

    // Create Zoom meeting (mocked for now)
    let zoomMeeting;
    try {
      meetingLogger.debug("Creating Zoom meeting", { title });
      zoomMeeting = await zoomClient.createMeeting(req.user._id, {
        title,
        startTime: scheduledAt,
        duration,
      });
    } catch (error) {
      console.error("Error creating Zoom meeting:", error);
      return ErrorResponse(res, "Failed to create Zoom meeting", 500);
    }

    // Create meeting document
    const meeting = new meetingModel({
      title,
      description: description || "",
      scheduledAt: new Date(scheduledAt),
      duration,
      zoomMeetingId: zoomMeeting.id.toString(),
      zoomLink: zoomMeeting.link,
      zoomPasscode: zoomMeeting.passcode,
      allowedSubscriptionTiers: allowedSubscriptionTiers || ["Premium", "Pro"],
      allowedLevels: allowedLevels || [
        "Beginner",
        "Intermediate",
        "Advanced",
        "Expert",
      ],
      maxAttendees: maxAttendees || null,
      topic: topic || "",
      createdBy: req.user._id,
      tags: tags || [],
      isRecorded: isRecorded || false,
    });

    await meeting.save();

    return successResponseWithData(
      res,
      meeting,
      "Meeting created successfully"
    );
  } catch (error) {
    console.error("Error creating meeting:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Admin: Get All Meetings
 * GET /api/admin/meetings
 */
export const getAllMeetings = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;

    const skip = (page - 1) * limit;
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { topic: { $regex: search, $options: "i" } },
      ];
    }

    const total = await meetingModel.countDocuments(filter);

    const meetings = await meetingModel
      .find(filter)
      .populate("createdBy", "fname lname email")
      .limit(limit * 1)
      .skip(skip)
      .sort({ scheduledAt: -1 });

    return successResponseWithData(
      res,
      {
        meetings,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      },
      "Meetings retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching meetings:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Get Meeting by ID
 * GET /api/meeting/:meetingId
 */
export const getMeetingById = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const meeting = await meetingModel
      .findById(meetingId)
      .populate("createdBy", "fname lname email")
      .populate("attendees.userId", "fname lname email");

    if (!meeting) {
      return notFoundResponse(res, "Meeting not found");
    }

    return successResponseWithData(
      res,
      meeting,
      "Meeting retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching meeting:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Admin: Update Meeting
 * PUT /api/admin/meeting/:meetingId
 */
export const updateMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const {
      title,
      description,
      scheduledAt,
      duration,
      allowedSubscriptionTiers,
      allowedLevels,
      maxAttendees,
      topic,
      tags,
      isRecorded,
    } = req.body;

    const meeting = await meetingModel.findById(meetingId);

    if (!meeting) {
      return notFoundResponse(res, "Meeting not found");
    }

    // Cannot update if meeting is ongoing or completed
    if (meeting.status === "ongoing" || meeting.status === "completed") {
      return ErrorResponse(res, "Cannot update ongoing or completed meeting", 400);
    }

    // Validate new scheduled time if provided
    if (scheduledAt) {
      if (new Date(scheduledAt) <= new Date()) {
        return ErrorResponse(
          res,
          "Meeting must be scheduled in the future",
          400
        );
      }
      meeting.scheduledAt = new Date(scheduledAt);
    }

    // Update fields
    if (title) meeting.title = title;
    if (description !== undefined) meeting.description = description;
    if (duration) {
      if (duration < 15 || duration > 480) {
        return ErrorResponse(
          res,
          "Duration must be between 15 and 480 minutes",
          400
        );
      }
      meeting.duration = duration;
    }
    if (allowedSubscriptionTiers) meeting.allowedSubscriptionTiers = allowedSubscriptionTiers;
    if (allowedLevels) meeting.allowedLevels = allowedLevels;
    if (maxAttendees !== undefined) meeting.maxAttendees = maxAttendees;
    if (topic) meeting.topic = topic;
    if (tags) meeting.tags = tags;
    if (isRecorded !== undefined) meeting.isRecorded = isRecorded;

    await meeting.save();

    return successResponseWithData(res, meeting, "Meeting updated successfully");
  } catch (error) {
    console.error("Error updating meeting:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Admin: Cancel Meeting
 * DELETE /api/admin/meeting/:meetingId
 */
export const deleteMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const meeting = await meetingModel.findById(meetingId);

    if (!meeting) {
      return notFoundResponse(res, "Meeting not found");
    }

    if (meeting.status === "completed") {
      return ErrorResponse(res, "Cannot delete completed meeting", 400);
    }

    meeting.status = "cancelled";
    await meeting.save();

    return successResponse(res, "Meeting cancelled successfully");
  } catch (error) {
    console.error("Error cancelling meeting:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Get User Available Meetings (based on subscription tier)
 * GET /api/user/available-meetings
 */
export const getUserAvailableMeetings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    const user = await userModel.findById(userId);

    if (!user) {
      return notFoundResponse(res, "User not found");
    }

    // Default subscription tier if not set
    const userSubscriptionTier = user.subscriptionTier || "Basic";

    const skip = (page - 1) * limit;

    // Find meetings that user can access
    const meetings = await meetingModel
      .find({
        allowedSubscriptionTiers: userSubscriptionTier,
        status: { $in: ["scheduled", "ongoing"] },
      })
      .populate("createdBy", "fname lname email")
      .limit(limit * 1)
      .skip(skip)
      .sort({ scheduledAt: -1 });

    const total = await meetingModel.countDocuments({
      allowedSubscriptionTiers: userSubscriptionTier,
      status: { $in: ["scheduled", "ongoing"] },
    });

    return successResponseWithData(
      res,
      {
        meetings,
        userTier: userSubscriptionTier,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      },
      "Available meetings retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching available meetings:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Get Upcoming Meetings
 * GET /api/meeting/upcoming
 */
export const getUpcomingMeetings = async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const meetings = await meetingModel
      .find({
        scheduledAt: { $gte: new Date() },
        status: "scheduled",
      })
      .populate("createdBy", "fname lname email")
      .limit(parseInt(limit))
      .sort({ scheduledAt: 1 });

    return successResponseWithData(
      res,
      meetings,
      "Upcoming meetings retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching upcoming meetings:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * User: Join Meeting (Get Zoom Link)
 * GET /api/meeting/:meetingId/join
 */
export const joinMeeting = async (req, res) => {
  try {
    const userId = req.user._id;
    const { meetingId } = req.params;

    const meeting = await meetingModel.findById(meetingId);

    if (!meeting) {
      return notFoundResponse(res, "Meeting not found");
    }

    // Check if meeting is active
    if (meeting.status !== "scheduled" && meeting.status !== "ongoing") {
      return ErrorResponse(res, "Meeting is not available", 400);
    }

    const user = await userModel.findById(userId);

    // Check if user has access to this meeting (based on subscription tier)
    const userTier = user.subscriptionTier || "Basic";
    if (!meeting.allowedSubscriptionTiers.includes(userTier)) {
      return ErrorResponse(
        res,
        "You do not have access to this meeting. Please upgrade your subscription.",
        403
      );
    }

    // Check max attendees
    if (meeting.maxAttendees && meeting.totalAttendees >= meeting.maxAttendees) {
      return ErrorResponse(res, "Meeting is at maximum capacity", 400);
    }

    // Add user to attendees if not already present
    const alreadyJoined = meeting.attendees.some(
      (attendee) => attendee.userId.toString() === userId.toString()
    );

    if (!alreadyJoined) {
      meeting.attendees.push({
        userId,
        joinedAt: new Date(),
        isPresent: true,
      });
      meeting.totalAttendees += 1;
      await meeting.save();
    }

    return successResponseWithData(
      res,
      {
        zoomLink: meeting.zoomLink,
        zoomPasscode: meeting.zoomPasscode,
        meetingTitle: meeting.title,
        startTime: meeting.scheduledAt,
        duration: meeting.duration,
      },
      "Meeting link retrieved successfully"
    );
  } catch (error) {
    console.error("Error joining meeting:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Admin: Share Meeting Link with Specific Tiers
 * POST /api/admin/meeting/:meetingId/share
 */
export const shareMeetingLink = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { subscriptionTiers, message } = req.body;

    if (!subscriptionTiers || subscriptionTiers.length === 0) {
      return ErrorResponse(res, "At least one subscription tier is required", 400);
    }

    const meeting = await meetingModel.findById(meetingId);

    if (!meeting) {
      return notFoundResponse(res, "Meeting not found");
    }

    // Update allowed tiers
    meeting.allowedSubscriptionTiers = subscriptionTiers;
    await meeting.save();

    // In production, send notifications to users of these tiers
    // For now, just return the meeting details
    const eligibleUsers = await userModel.countDocuments({
      subscriptionTier: { $in: subscriptionTiers },
      isBlocked: false,
      isSuspended: false,
    });

    return successResponseWithData(
      res,
      {
        meeting,
        sharedWith: subscriptionTiers,
        eligibleUsersCount: eligibleUsers,
        message:
          message ||
          `Meeting shared with ${subscriptionTiers.join(", ")} subscribers`,
      },
      "Meeting link shared successfully"
    );
  } catch (error) {
    console.error("Error sharing meeting:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Admin: Get Meeting Attendees
 * GET /api/admin/meeting/:meetingId/attendees
 */
export const getMeetingAttendees = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const meeting = await meetingModel
      .findById(meetingId)
      .populate("attendees.userId", "fname lname email phone");

    if (!meeting) {
      return notFoundResponse(res, "Meeting not found");
    }

    const skip = (page - 1) * limit;
    const attendees = meeting.attendees.slice(skip, skip + parseInt(limit));

    return successResponseWithData(
      res,
      {
        meetingTitle: meeting.title,
        totalAttendees: meeting.totalAttendees,
        attendees,
        pagination: {
          total: meeting.totalAttendees,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(meeting.totalAttendees / limit),
        },
      },
      "Attendees retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching attendees:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Admin: Start Meeting
 * POST /api/admin/meeting/:meetingId/start
 */
export const startMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const meeting = await meetingModel.findById(meetingId);

    if (!meeting) {
      return notFoundResponse(res, "Meeting not found");
    }

    if (meeting.status !== "scheduled") {
      return ErrorResponse(res, "Meeting has already been started or is cancelled", 400);
    }

    meeting.status = "ongoing";
    meeting.meetingStartedAt = new Date();
    await meeting.save();

    return successResponseWithData(
      res,
      meeting,
      "Meeting started successfully"
    );
  } catch (error) {
    console.error("Error starting meeting:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Admin: End Meeting
 * POST /api/admin/meeting/:meetingId/end
 */
export const endMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { recordingUrl } = req.body;

    const meeting = await meetingModel.findById(meetingId);

    if (!meeting) {
      return notFoundResponse(res, "Meeting not found");
    }

    if (meeting.status !== "ongoing") {
      return ErrorResponse(res, "Meeting is not currently ongoing", 400);
    }

    meeting.status = "completed";
    meeting.meetingEndedAt = new Date();

    if (recordingUrl) {
      meeting.recordingUrl = recordingUrl;
    }

    await meeting.save();

    return successResponseWithData(
      res,
      meeting,
      "Meeting ended successfully"
    );
  } catch (error) {
    console.error("Error ending meeting:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Get Meeting Statistics
 * GET /api/admin/meeting-stats
 */
export const getMeetingStatistics = async (req, res) => {
  try {
    const totalMeetings = await meetingModel.countDocuments();
    const scheduledMeetings = await meetingModel.countDocuments({
      status: "scheduled",
    });
    const ongoingMeetings = await meetingModel.countDocuments({
      status: "ongoing",
    });
    const completedMeetings = await meetingModel.countDocuments({
      status: "completed",
    });
    const cancelledMeetings = await meetingModel.countDocuments({
      status: "cancelled",
    });

    const meetingsByTier = await meetingModel.aggregate([
      {
        $group: {
          _id: { $arrayElemAt: ["$allowedSubscriptionTiers", 0] },
          count: { $sum: 1 },
        },
      },
    ]);

    const stats = {
      totalMeetings,
      scheduledMeetings,
      ongoingMeetings,
      completedMeetings,
      cancelledMeetings,
      meetingsByTier: meetingsByTier.reduce((acc, item) => {
        if (item._id) acc[item._id] = item.count;
        return acc;
      }, {}),
    };

    return successResponseWithData(
      res,
      stats,
      "Meeting statistics retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching statistics:", error);
    return ErrorResponse(res, error.message, 500);
  }
};
