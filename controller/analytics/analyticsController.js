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
import logger from "../../helpers/logger.js";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

const analyticsLogger = logger.module("ANALYTICS_CONTROLLER");
import fs from "fs";
import path from "path";

/**
 * Get Dashboard Summary
 * GET /api/admin/dashboard/summary
 */
export const getDashboardSummary = async (req, res) => {
  try {
    const { dateRange = "30" } = req.query; // 7, 30, 90, 365

    analyticsLogger.start("Fetching dashboard summary", { dateRange });

    const days = parseInt(dateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get current metrics
    analyticsLogger.debug("Calculating user metrics", { startDate });
    
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

    analyticsLogger.success("Dashboard summary calculated", { totalUsers, newSignups, totalMeetings });

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

    const uploadsDir = process.env.VERCEL ? "/tmp/uploads" : "uploads";
    const filename = `analytics_report_${new Date().getTime()}.xlsx`;
    const filepath = path.join(uploadsDir, filename);

    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
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
    doc.fontSize(24).text("ProNet Analytics Report", { align: "center" });
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

/**
 * Calculate total binary commission across all users from team structure
 */
const calculateTotalBinaryCommission = async () => {
  try {
    const TeamMember = (await import("../../models/teamModel.js")).default;
    
    // Get all team members once
    const allMembers = await TeamMember.find({});
    let totalBinaryCommission = 0;
    
    // Build memberMap once outside the loop
    const memberMap = {};
    for (const m of allMembers) {
      if (m && m.userId) {
        memberMap[m.userId.toString()] = m;
      }
    }
    
    // Recursive function to count ALL descendants (regardless of position)
    const countSubtree = (userIdString) => {
      if (!userIdString) return 0;
      const node = memberMap[userIdString];
      if (!node) return 0;
      
      let count = 1; // Count the node itself
      const children = node.teamMembers || [];
      
      for (const childId of children) {
        if (!childId) continue;
        count += countSubtree(childId.toString());
      }
      
      return count;
    };
    
    // Calculate binary commission for each user
    for (const member of allMembers) {
      if (!member.teamMembers || member.teamMembers.length === 0) {
        continue;
      }
      
      let totalLeftPro = 0;
      let totalRightPro = 0;
      
      // For each direct child, count them + all their descendants
      for (const childId of member.teamMembers) {
        if (!childId) continue;
        const childIdStr = childId.toString();
        const childNode = memberMap[childIdStr];
        
        if (!childNode) continue;
        
        // Count this child and all descendants under it
        const subtreeSize = countSubtree(childIdStr);
        
        // Add to appropriate leg based on child's position
        if (childNode.position === "left") {
          totalLeftPro += subtreeSize;
        } else if (childNode.position === "right") {
          totalRightPro += subtreeSize;
        }
      }
      
      // Calculate PV and commission
      const leftProPV = totalLeftPro * 94.5;
      const rightProPV = totalRightPro * 94.5;
      const weakerLegPV = Math.min(leftProPV, rightProPV);
      const matchedVolume = weakerLegPV;
      const bonusPercent = member.binaryBonusPercent || 0;
      const commissionAmount = matchedVolume * (bonusPercent / 100);
      
      totalBinaryCommission += commissionAmount;
    }
    
    return parseFloat(totalBinaryCommission.toFixed(2));
  } catch (error) {
    analyticsLogger.error("Error calculating binary commission", error);
    return 0;
  }
};

/**
 * Get Analytics Data for Admin Panel
 * GET /api/admin/analytics
 */
export const getAdminAnalytics = async (req, res) => {
  try {
    analyticsLogger.start("Fetching admin analytics data");

    // Import models dynamically
    const CommissionModel = (await import("../../models/commissionModel.js")).default;
    const PayoutModel = (await import("../../models/payoutModel.js")).default;
    const BinaryRewardModel = (await import("../../models/binaryRewardModel.js")).default;

    // Date ranges
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // User Metrics
    const totalUsers = await userModel.countDocuments({ isDeleted: { $ne: true } });
    const activeUsers = await userModel.countDocuments({
      isDeleted: { $ne: true },
      isSuspended: false,
      isBlocked: false
    });
    const subscribedUsers = await userModel.countDocuments({
      isDeleted: { $ne: true },
      subscriptionStatus: true
    });

    // Calculate growth rate
    const previousPeriodUsers = await userModel.countDocuments({
      createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
    });
    const currentPeriodUsers = await userModel.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });
    const monthlyGrowth = previousPeriodUsers > 0 
      ? ((currentPeriodUsers - previousPeriodUsers) / previousPeriodUsers * 100).toFixed(1)
      : (currentPeriodUsers > 0 ? 100 : 0);

    // Revenue Metrics
    const subscriptionRevenue = subscribedUsers * 100; // Assuming $100 per subscription
    
    // Commission breakdown
    const commissionStats = await CommissionModel.aggregate([
      {
        $group: {
          _id: "$commissionType",
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const totalCommissions = await CommissionModel.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: "$netAmount" }
        }
      }
    ]);
    const commissionsSum = totalCommissions.length > 0 ? totalCommissions[0].total : 0;

    // Payout Metrics
    const payoutStats = await PayoutModel.aggregate([
      {
        $group: {
          _id: "$status",
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const completedPayouts = await PayoutModel.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: null,
          total: { $sum: "$netAmount" }
        }
      }
    ]);
    const completedPayoutsSum = completedPayouts.length > 0 ? completedPayouts[0].total : 0;

    // Binary Rewards
    const binaryRewardsStats = await BinaryRewardModel.countDocuments();
    const claimedRewards = await BinaryRewardModel.countDocuments({ status: { $ne: "claimed" } });

    // Calculate real-time binary commission from team structure
    analyticsLogger.debug("Calculating real-time binary commission from team structure");
    const calculatedBinaryCommission = await calculateTotalBinaryCommission();
    
    // Total Revenue
    const totalRevenue = subscriptionRevenue;

    const analytics = {
      totalRevenue,
      totalUsers,
      activeUsers,
      subscribedUsers,
      monthlyGrowth: parseFloat(monthlyGrowth),
      // Detailed breakdowns
      commissions: {
        total: commissionsSum,
        breakdown: commissionStats,
        byType: {
          direct_bonus: commissionStats.find(c => c._id === "direct_bonus")?.totalAmount || 0,
          level_income: commissionStats.find(c => c._id === "level_income")?.totalAmount || 0,
          binary_bonus: calculatedBinaryCommission, // Use calculated binary commission instead of stored records
          reward_bonus: commissionStats.find(c => c._id === "reward_bonus")?.totalAmount || 0
        }
      },
      payouts: {
        total: completedPayoutsSum,
        breakdown: payoutStats,
        pending: payoutStats.find(p => p._id === "pending")?.totalAmount || 0,
        completed: completedPayoutsSum,
        processing: payoutStats.find(p => p._id === "processing")?.totalAmount || 0
      },
      rewards: {
        total: binaryRewardsStats,
        claimed: binaryRewardsStats - claimedRewards,
        processed: claimedRewards
      }
    };

    analyticsLogger.success("Admin analytics data fetched successfully", analytics);
    return successResponseWithData(res, "Analytics data fetched successfully", analytics);
  } catch (error) {
    analyticsLogger.error("Error fetching admin analytics data", error);
    return ErrorResponse(res, error.message, 500);
  }
};
