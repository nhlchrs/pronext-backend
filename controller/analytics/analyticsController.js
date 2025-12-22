import userModel from "../../models/authModel.js";
import meetingModel from "../../models/meetingModel.js";
import AnalyticsModel, {
  PayoutTrendModel,
  SubscriptionTrendModel,
  TeamGrowthModel,
} from "../../models/analyticsModel.js";
import {
  ErrorResponse,
  successResponse,
  notFoundResponse,
  successResponseWithData,
} from "../../helpers/apiResponse.js";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

/**
 * Get Dashboard Summary
 * GET /api/admin/dashboard/summary
 */
export const getDashboardSummary = async (req, res) => {
  try {
    const { dateRange = "30" } = req.query; // 7, 30, 90, 365

    const days = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get current metrics
    const totalUsers = await userModel.countDocuments();
    const activeUsers = await userModel.countDocuments({
      isSuspended: false,
      isBlocked: false,
    });
    const newSignups = await userModel.countDocuments({
      createdAt: { $gte: startDate },
    });

    // Subscription metrics
    const basicSubscribers = await userModel.countDocuments({
      subscriptionTier: "Basic",
    });
    const premiumSubscribers = await userModel.countDocuments({
      subscriptionTier: "Premium",
    });
    const proSubscribers = await userModel.countDocuments({
      subscriptionTier: "Pro",
    });

    // Meeting metrics
    const totalMeetings = await meetingModel.countDocuments();
    const completedMeetings = await meetingModel.countDocuments({
      status: "completed",
    });

    // Calculate total meeting attendees
    const meetingAttendees = await meetingModel.aggregate([
      {
        $group: {
          _id: null,
          totalAttendees: { $sum: "$totalAttendees" },
        },
      },
    ]);

    const totalMeetingAttendees =
      meetingAttendees.length > 0 ? meetingAttendees[0].totalAttendees : 0;

    const summary = {
      userMetrics: {
        totalUsers,
        activeUsers,
        newSignups,
        suspendedUsers: totalUsers - activeUsers,
      },
      subscriptionMetrics: {
        basic: basicSubscribers,
        premium: premiumSubscribers,
        pro: proSubscribers,
        total: basicSubscribers + premiumSubscribers + proSubscribers,
      },
      meetingMetrics: {
        totalMeetings,
        completedMeetings,
        totalAttendees: totalMeetingAttendees,
        attendeeRate:
          totalMeetings > 0
            ? ((totalMeetingAttendees / totalMeetings) * 100).toFixed(2)
            : 0,
      },
      dateRange: `Last ${days} days`,
    };

    return successResponseWithData(
      res,
      summary,
      "Dashboard summary retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Get Payout Trends
 * GET /api/admin/analytics/payout-trends
 */
export const getPayoutTrends = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const filter = {};
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filter.date = { $gte: thirtyDaysAgo };
    }

    const trends = await PayoutTrendModel.find(filter)
      .sort({ date: 1 })
      .limit(100);

    return successResponseWithData(
      res,
      trends,
      "Payout trends retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching payout trends:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Get Active Subscriptions Analytics
 * GET /api/admin/analytics/subscriptions
 */
export const getSubscriptionAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const filter = {};
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filter.date = { $gte: thirtyDaysAgo };
    }

    const trends = await SubscriptionTrendModel.find(filter)
      .sort({ date: 1 })
      .limit(100);

    // Current subscription breakdown
    const currentBreakdown = {
      basic: await userModel.countDocuments({ subscriptionTier: "Basic" }),
      premium: await userModel.countDocuments({
        subscriptionTier: "Premium",
      }),
      pro: await userModel.countDocuments({ subscriptionTier: "Pro" }),
    };

    return successResponseWithData(
      res,
      {
        trends,
        currentBreakdown,
        total:
          currentBreakdown.basic +
          currentBreakdown.premium +
          currentBreakdown.pro,
      },
      "Subscription analytics retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching subscription analytics:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Get Team Growth Analytics
 * GET /api/admin/analytics/team-growth
 */
export const getTeamGrowthAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const filter = {};
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filter.date = { $gte: thirtyDaysAgo };
    }

    const trends = await TeamGrowthModel.find(filter)
      .sort({ date: 1 })
      .limit(100);

    return successResponseWithData(
      res,
      trends,
      "Team growth analytics retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching team growth:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Get User Level Statistics
 * GET /api/admin/analytics/user-levels
 */
export const getUserLevelStats = async (req, res) => {
  try {
    const userLevels = await userModel.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
          activeCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$isSuspended", false] },
                    { $eq: ["$isBlocked", false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const breakdown = {};
    userLevels.forEach((level) => {
      breakdown[level._id] = {
        total: level.count,
        active: level.activeCount,
        inactive: level.count - level.activeCount,
      };
    });

    return successResponseWithData(
      res,
      breakdown,
      "User level statistics retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching user levels:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Get Referral Statistics
 * GET /api/admin/analytics/referrals
 */
export const getReferralStats = async (req, res) => {
  try {
    const { maxDepth = 5 } = req.query;

    // Users with referral codes
    const usersWithReferrals = await userModel.countDocuments({
      referralCode: { $ne: null, $ne: "" },
    });

    // Users who were referred
    const referredUsers = await userModel.countDocuments({
      referralCode: { $exists: true, $ne: null },
    });

    // Referral breakdown by level (if tracking referral depth)
    const stats = {
      usersWithReferralCodes: usersWithReferrals,
      usersReferred: referredUsers,
      conversionRate:
        usersWithReferrals > 0
          ? ((referredUsers / usersWithReferrals) * 100).toFixed(2)
          : 0,
      maxReferralDepth: maxDepth,
    };

    return successResponseWithData(
      res,
      stats,
      "Referral statistics retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching referral stats:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Generate Excel Report
 * POST /api/admin/analytics/report/excel
 */
export const generateExcelReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      includeUsers = true,
      includeMeetings = true,
      includeSubscriptions = true,
    } = req.body;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.$gte = new Date(startDate);
      dateFilter.$lte = new Date(endDate);
    }

    const workbook = new ExcelJS.Workbook();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet("Summary");
    summarySheet.columns = [
      { header: "Metric", key: "metric", width: 30 },
      { header: "Value", key: "value", width: 15 },
    ];

    const totalUsers = await userModel.countDocuments();
    const activeUsers = await userModel.countDocuments({
      isSuspended: false,
      isBlocked: false,
    });

    summarySheet.addRows([
      { metric: "Total Users", value: totalUsers },
      { metric: "Active Users", value: activeUsers },
      { metric: "Total Meetings", value: await meetingModel.countDocuments() },
    ]);

    // Users Sheet
    if (includeUsers) {
      const usersSheet = workbook.addWorksheet("Users");
      usersSheet.columns = [
        { header: "Name", key: "name", width: 20 },
        { header: "Email", key: "email", width: 25 },
        { header: "Subscription", key: "subscriptionTier", width: 15 },
        { header: "Role", key: "role", width: 15 },
        { header: "Status", key: "status", width: 15 },
      ];

      const users = await userModel
        .find()
        .select("fname lname email subscriptionTier role isSuspended isBlocked")
        .limit(1000);

      const usersData = users.map((user) => ({
        name: `${user.fname} ${user.lname}`,
        email: user.email,
        subscriptionTier: user.subscriptionTier || "Basic",
        role: user.role,
        status: user.isBlocked
          ? "Blocked"
          : user.isSuspended
            ? "Suspended"
            : "Active",
      }));

      usersSheet.addRows(usersData);
    }

    // Meetings Sheet
    if (includeMeetings) {
      const meetingsSheet = workbook.addWorksheet("Meetings");
      meetingsSheet.columns = [
        { header: "Title", key: "title", width: 30 },
        { header: "Status", key: "status", width: 12 },
        { header: "Attendees", key: "totalAttendees", width: 12 },
        { header: "Scheduled", key: "scheduledAt", width: 20 },
      ];

      const meetings = await meetingModel
        .find()
        .select("title status totalAttendees scheduledAt")
        .limit(1000);

      const meetingsData = meetings.map((meeting) => ({
        title: meeting.title,
        status: meeting.status,
        totalAttendees: meeting.totalAttendees,
        scheduledAt: new Date(meeting.scheduledAt).toLocaleString(),
      }));

      meetingsSheet.addRows(meetingsData);
    }

    // Subscriptions Sheet
    if (includeSubscriptions) {
      const subsSheet = workbook.addWorksheet("Subscriptions");
      subsSheet.columns = [
        { header: "Tier", key: "tier", width: 15 },
        { header: "Count", key: "count", width: 10 },
        { header: "Percentage", key: "percentage", width: 12 },
      ];

      const basic = await userModel.countDocuments({
        subscriptionTier: "Basic",
      });
      const premium = await userModel.countDocuments({
        subscriptionTier: "Premium",
      });
      const pro = await userModel.countDocuments({ subscriptionTier: "Pro" });
      const total = basic + premium + pro;

      subsSheet.addRows([
        {
          tier: "Basic",
          count: basic,
          percentage: ((basic / total) * 100).toFixed(2) + "%",
        },
        {
          tier: "Premium",
          count: premium,
          percentage: ((premium / total) * 100).toFixed(2) + "%",
        },
        {
          tier: "Pro",
          count: pro,
          percentage: ((pro / total) * 100).toFixed(2) + "%",
        },
      ]);
    }

    const filename = `analytics_report_${new Date().getTime()}.xlsx`;
    const filepath = path.join("uploads", filename);

    // Ensure uploads directory exists
    if (!fs.existsSync("uploads")) {
      fs.mkdirSync("uploads", { recursive: true });
    }

    await workbook.xlsx.writeFile(filepath);

    return successResponseWithData(
      res,
      {
        filename,
        url: `/api/download/${filename}`,
      },
      "Excel report generated successfully"
    );
  } catch (error) {
    console.error("Error generating Excel report:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Generate PDF Report
 * POST /api/admin/analytics/report/pdf
 */
export const generatePdfReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    const totalUsers = await userModel.countDocuments();
    const activeUsers = await userModel.countDocuments({
      isSuspended: false,
      isBlocked: false,
    });
    const newSignups = await userModel.countDocuments({
      createdAt: { $gte: new Date(startDate || "2025-01-01") },
    });

    const doc = new PDFDocument({ margin: 50 });
    const filename = `analytics_report_${new Date().getTime()}.pdf`;
    const filepath = path.join("uploads", filename);

    // Ensure uploads directory exists
    if (!fs.existsSync("uploads")) {
      fs.mkdirSync("uploads", { recursive: true });
    }

    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    // Header
    doc.fontSize(24).text("ProNext Analytics Report", { align: "center" });
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`, {
      align: "center",
    });
    doc.moveDown();

    // Summary Section
    doc.fontSize(16).text("Executive Summary", { underline: true });
    doc.fontSize(12);
    doc.text(`Total Users: ${totalUsers}`);
    doc.text(`Active Users: ${activeUsers}`);
    doc.text(`New Signups: ${newSignups}`);
    doc.moveDown();

    // Subscription Breakdown
    const basic = await userModel.countDocuments({ subscriptionTier: "Basic" });
    const premium = await userModel.countDocuments({
      subscriptionTier: "Premium",
    });
    const pro = await userModel.countDocuments({ subscriptionTier: "Pro" });

    doc.fontSize(16).text("Subscription Breakdown", { underline: true });
    doc.fontSize(12);
    doc.text(`Basic: ${basic} users`);
    doc.text(`Premium: ${premium} users`);
    doc.text(`Pro: ${pro} users`);
    doc.moveDown();

    // Meeting Stats
    const totalMeetings = await meetingModel.countDocuments();
    const completedMeetings = await meetingModel.countDocuments({
      status: "completed",
    });

    doc.fontSize(16).text("Meeting Statistics", { underline: true });
    doc.fontSize(12);
    doc.text(`Total Meetings: ${totalMeetings}`);
    doc.text(`Completed Meetings: ${completedMeetings}`);
    doc.text(
      `Completion Rate: ${((completedMeetings / totalMeetings) * 100).toFixed(2)}%`
    );

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on("finish", () => {
        resolve(
          res.json({
            success: true,
            message: "PDF report generated successfully",
            data: {
              filename,
              url: `/api/download/${filename}`,
            },
          })
        );
      });

      stream.on("error", (error) => {
        reject(error);
      });
    });
  } catch (error) {
    console.error("Error generating PDF report:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Download Report File
 * GET /api/download/:filename
 */
export const downloadReport = async (req, res) => {
  try {
    const { filename } = req.params;

    // Validate filename to prevent directory traversal
    if (filename.includes("..") || filename.includes("/")) {
      return ErrorResponse(res, "Invalid filename", 400);
    }

    const filepath = path.join("uploads", filename);

    // Check if file exists
    if (!fs.existsSync(filepath)) {
      return notFoundResponse(res, "File not found");
    }

    res.download(filepath, filename, (error) => {
      if (error) {
        console.error("Error downloading file:", error);
        return ErrorResponse(res, "Error downloading file", 500);
      }
    });
  } catch (error) {
    console.error("Error in download:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Get Performance Metrics
 * GET /api/admin/analytics/performance
 */
export const getPerformanceMetrics = async (req, res) => {
  try {
    const { dateRange = "30" } = req.query;

    const days = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // User growth
    const userGrowth = await userModel.aggregate([
      {
        $match: { createdAt: { $gte: startDate } },
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
    ]);

    // Meeting growth
    const meetingGrowth = await meetingModel.aggregate([
      {
        $match: { createdAt: { $gte: startDate } },
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
    ]);

    const metrics = {
      userGrowth,
      meetingGrowth,
      dateRange: `Last ${days} days`,
    };

    return successResponseWithData(
      res,
      metrics,
      "Performance metrics retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching performance metrics:", error);
    return ErrorResponse(res, error.message, 500);
  }
};

/**
 * Get Advanced Analytics with Filters
 * POST /api/admin/analytics/advanced
 */
export const getAdvancedAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, userLevel, referralDepth } = req.body;

    const filters = {};

    // Date range filter
    if (startDate && endDate) {
      filters.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // User level filter
    if (userLevel) {
      filters.role = userLevel;
    }

    // Get users matching filters
    const users = await userModel.find(filters);

    // Subscription breakdown for filtered users
    const subscriptionBreakdown = {
      basic: users.filter((u) => u.subscriptionTier === "Basic").length,
      premium: users.filter((u) => u.subscriptionTier === "Premium").length,
      pro: users.filter((u) => u.subscriptionTier === "Pro").length,
    };

    // Active vs inactive
    const activeCount = users.filter(
      (u) => !u.isSuspended && !u.isBlocked
    ).length;

    const analytics = {
      totalUsers: users.length,
      activeUsers: activeCount,
      inactiveUsers: users.length - activeCount,
      subscriptionBreakdown,
      filters: {
        dateRange: startDate && endDate ? `${startDate} to ${endDate}` : "All",
        userLevel: userLevel || "All",
      },
    };

    return successResponseWithData(
      res,
      analytics,
      "Advanced analytics retrieved successfully"
    );
  } catch (error) {
    console.error("Error fetching advanced analytics:", error);
    return ErrorResponse(res, error.message, 500);
  }
};
