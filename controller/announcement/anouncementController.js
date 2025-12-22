import Announcement from "../../models/announcementModel.js";
import userModel from "../../models/authModel.js";
import {
  successResponse,
  successResponseWithData,
  ErrorResponse,
  notFoundResponse,
} from "../../helpers/apiResponse.js";

/**
 * Create Announcement/Promotion/News
 * POST /api/announcements/create
 * Admin only
 */
export const createAnnouncement = async (req, res) => {
  try {
    const { title, description, type, flag, image, startDate, endDate, targetUsers } = req.body;

    // Validate required fields
    if (!title || !description || !type) {
      return ErrorResponse(
        res,
        "Title, description, and type are required",
        400
      );
    }

    // Validate type
    if (!["announcement", "promotion", "news"].includes(type)) {
      return ErrorResponse(
        res,
        "Type must be: announcement, promotion, or news",
        400
      );
    }

    // Validate flag
    if (flag && !["important", "promotional"].includes(flag)) {
      return ErrorResponse(
        res,
        "Flag must be: important or promotional",
        400
      );
    }

    // Validate dates if provided
    if (startDate && endDate) {
      if (new Date(startDate) > new Date(endDate)) {
        return ErrorResponse(res, "Start date must be before end date", 400);
      }
    }

    const announcement = await Announcement.create({
      title,
      description,
      type,
      flag: flag || "important",
      image,
      startDate: startDate || new Date(),
      endDate,
      targetUsers: targetUsers || [],
      createdBy: req.user._id,
      views: 0,
      clicks: 0,
    });

    return successResponseWithData(
      res,
      announcement,
      "Announcement created successfully"
    );
  } catch (error) {
    console.error("Create announcement error:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Get All Announcements
 * GET /api/announcements/list
 */
export const getAllAnnouncements = async (req, res) => {
  try {
    const {
      type,
      flag,
      userId,
      isActive,
      page = 1,
      limit = 10,
      sort = "createdAt",
    } = req.query;

    const skip = (page - 1) * limit;
    const filter = {};

    // Filter by active status (default: active announcements)
    if (isActive === "true" || isActive === undefined) {
      filter.isActive = true;
      filter.startDate = { $lte: new Date() };
      filter.$or = [{ endDate: null }, { endDate: { $gte: new Date() } }];
    } else if (isActive === "false") {
      filter.isActive = false;
    }

    // Filter by type
    if (type && ["announcement", "promotion", "news"].includes(type)) {
      filter.type = type;
    }

    // Filter by flag
    if (flag && ["important", "promotional"].includes(flag)) {
      filter.flag = flag;
    }

    // Filter by target users if userId provided
    if (userId) {
      filter.$or = [
        { targetUsers: { $size: 0 } }, // General announcements
        { targetUsers: null },
        { targetUsers: userId }, // Targeted to this user
      ];
    }

    // Get total count
    const total = await Announcement.countDocuments(filter);

    // Get announcements
    const announcements = await Announcement.find(filter)
      .sort({ [sort]: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("createdBy", "fname lname email role");

    return successResponseWithData(
      res,
      {
        announcements,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      },
      "Announcements retrieved successfully"
    );
  } catch (error) {
    console.error("Get announcements error:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Get Announcement By ID
 * GET /api/announcements/:id
 */
export const getAnnouncementById = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } }, // Increment views
      { new: true }
    ).populate("createdBy", "fname lname email role");

    if (!announcement) {
      return notFoundResponse(res, "Announcement not found");
    }

    return successResponseWithData(
      res,
      announcement,
      "Announcement retrieved successfully"
    );
  } catch (error) {
    console.error("Get announcement by id error:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Update Announcement
 * PUT /api/announcements/:id
 * Admin only
 */
export const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, type, flag, image, startDate, endDate, targetUsers, isActive } = req.body;

    const announcement = await Announcement.findById(id);

    if (!announcement) {
      return notFoundResponse(res, "Announcement not found");
    }

    // Update fields
    if (title) announcement.title = title;
    if (description) announcement.description = description;
    if (type && ["announcement", "promotion", "news"].includes(type)) {
      announcement.type = type;
    }
    if (flag && ["important", "promotional"].includes(flag)) {
      announcement.flag = flag;
    }
    if (image) announcement.image = image;
    if (startDate) announcement.startDate = new Date(startDate);
    if (endDate) announcement.endDate = new Date(endDate);
    if (targetUsers !== undefined) announcement.targetUsers = targetUsers;
    if (isActive !== undefined) announcement.isActive = isActive;

    await announcement.save();

    return successResponseWithData(
      res,
      announcement,
      "Announcement updated successfully"
    );
  } catch (error) {
    console.error("Update announcement error:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Delete Announcement
 * DELETE /api/announcements/:id
 * Admin only
 */
export const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findByIdAndDelete(id);

    if (!announcement) {
      return notFoundResponse(res, "Announcement not found");
    }

    return successResponse(res, "Announcement deleted successfully");
  } catch (error) {
    console.error("Delete announcement error:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Get User-Specific Announcements
 * GET /api/announcements/user/feed
 * User can see general announcements + targeted ones
 */
export const getUserAnnouncements = async (req, res) => {
  try {
    const userId = req.user._id;
    const { type, flag, page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;
    const filter = {
      isActive: true,
      startDate: { $lte: new Date() },
      $or: [{ endDate: null }, { endDate: { $gte: new Date() } }],
      $or: [
        { targetUsers: { $size: 0 } },
        { targetUsers: null },
        { targetUsers: userId },
      ],
    };

    if (type && ["announcement", "promotion", "news"].includes(type)) {
      filter.type = type;
    }

    if (flag && ["important", "promotional"].includes(flag)) {
      filter.flag = flag;
    }

    const total = await Announcement.countDocuments(filter);

    const announcements = await Announcement.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("createdBy", "fname lname email role");

    return successResponseWithData(
      res,
      {
        announcements,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      },
      "User announcements retrieved successfully"
    );
  } catch (error) {
    console.error("Get user announcements error:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Track Announcement Click
 * POST /api/announcements/:id/click
 */
export const trackAnnouncementClick = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findByIdAndUpdate(
      id,
      { $inc: { clicks: 1 } },
      { new: true }
    );

    if (!announcement) {
      return notFoundResponse(res, "Announcement not found");
    }

    return successResponseWithData(
      res,
      announcement,
      "Click tracked successfully"
    );
  } catch (error) {
    console.error("Track click error:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Get Announcements by Type
 * GET /api/announcements/type/:type
 */
export const getAnnouncementsByType = async (req, res) => {
  try {
    const { type } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!["announcement", "promotion", "news"].includes(type)) {
      return ErrorResponse(res, "Invalid announcement type", 400);
    }

    const skip = (page - 1) * limit;
    const filter = {
      type,
      isActive: true,
      startDate: { $lte: new Date() },
      $or: [{ endDate: null }, { endDate: { $gte: new Date() } }],
    };

    const total = await Announcement.countDocuments(filter);

    const announcements = await Announcement.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("createdBy", "fname lname email role");

    return successResponseWithData(
      res,
      {
        announcements,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      },
      `${type} announcements retrieved successfully`
    );
  } catch (error) {
    console.error("Get announcements by type error:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Get Announcements by Flag
 * GET /api/announcements/flag/:flag
 */
export const getAnnouncementsByFlag = async (req, res) => {
  try {
    const { flag } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!["important", "promotional"].includes(flag)) {
      return ErrorResponse(res, "Invalid flag type", 400);
    }

    const skip = (page - 1) * limit;
    const filter = {
      flag,
      isActive: true,
      startDate: { $lte: new Date() },
      $or: [{ endDate: null }, { endDate: { $gte: new Date() } }],
    };

    const total = await Announcement.countDocuments(filter);

    const announcements = await Announcement.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("createdBy", "fname lname email role");

    return successResponseWithData(
      res,
      {
        announcements,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      },
      `${flag} announcements retrieved successfully`
    );
  } catch (error) {
    console.error("Get announcements by flag error:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Get Announcement Statistics
 * GET /api/admin/announcements/stats
 */
export const getAnnouncementStats = async (req, res) => {
  try {
    const stats = await Announcement.aggregate([
      {
        $match: {
          isActive: true,
          startDate: { $lte: new Date() },
          $or: [{ endDate: null }, { endDate: { $gte: new Date() } }],
        },
      },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          totalViews: { $sum: "$views" },
          totalClicks: { $sum: "$clicks" },
          averageViews: { $avg: "$views" },
          averageClicks: { $avg: "$clicks" },
        },
      },
    ]);

    const flagStats = await Announcement.aggregate([
      {
        $match: {
          isActive: true,
          startDate: { $lte: new Date() },
          $or: [{ endDate: null }, { endDate: { $gte: new Date() } }],
        },
      },
      {
        $group: {
          _id: "$flag",
          count: { $sum: 1 },
          totalViews: { $sum: "$views" },
          totalClicks: { $sum: "$clicks" },
        },
      },
    ]);

    const totalAnnouncements = await Announcement.countDocuments({
      isActive: true,
    });

    return successResponseWithData(
      res,
      {
        byType: stats,
        byFlag: flagStats,
        totalActive: totalAnnouncements,
      },
      "Announcement statistics retrieved successfully"
    );
  } catch (error) {
    console.error("Get stats error:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Bulk Update Status
 * POST /api/admin/announcements/bulk-status
 */
export const bulkUpdateStatus = async (req, res) => {
  try {
    const { ids, isActive } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return ErrorResponse(res, "Please provide announcement IDs", 400);
    }

    if (typeof isActive !== "boolean") {
      return ErrorResponse(res, "isActive must be a boolean", 400);
    }

    const result = await Announcement.updateMany(
      { _id: { $in: ids } },
      { isActive }
    );

    return successResponseWithData(
      res,
      result,
      `${result.modifiedCount} announcements updated`
    );
  } catch (error) {
    console.error("Bulk update error:", error);
    return ErrorResponse(res, error.message, 500);
  }
};
