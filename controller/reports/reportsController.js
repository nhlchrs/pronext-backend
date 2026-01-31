import userModel from "../../models/authModel.js";
import AnalyticsModel from "../../models/analyticsModel.js";
import { successResponseWithData, ErrorResponse } from "../../helpers/apiResponse.js";
import logger from "../../helpers/logger.js";

const reportsLogger = logger.module("REPORTS_CONTROLLER");

/**
 * Get Reports Data for Admin Panel
 * GET /api/admin/reports
 */
export const getAdminReports = async (req, res) => {
  try {
    reportsLogger.start("Fetching admin reports data");

    // Get total users count
    const totalUsers = await userModel.countDocuments({ isDeleted: { $ne: true } });

    // Get active users (not suspended/blocked)
    const activeUsers = await userModel.countDocuments({
      isDeleted: { $ne: true },
      isSuspended: false,
      isBlocked: false
    });

    // Get revenue from AnalyticsModel
    let totalRevenue = 0;
    let totalCommissions = 0;
    try {
      const analytics = await AnalyticsModel.findOne({}).sort({ updatedAt: -1 });
      if (analytics) {
        totalRevenue = analytics.revenue?.total || 0;
        totalCommissions = analytics.revenue?.commissions || 0;
      }
    } catch (err) {
      reportsLogger.warn("Could not fetch revenue from analytics", err);
    }

    // Calculate active rate
    const activeRate = totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : 0;

    // Calculate growth rates (comparing last 30 days vs previous 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const previousPeriodUsers = await userModel.countDocuments({
      createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
    });
    
    const currentPeriodUsers = await userModel.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    const userGrowth = previousPeriodUsers > 0 
      ? parseFloat(((currentPeriodUsers - previousPeriodUsers) / previousPeriodUsers * 100).toFixed(1))
      : (currentPeriodUsers > 0 ? 100 : 0);

    // Revenue growth (you can enhance this with payment data if available)
    const revenueGrowth = 12.5; // Placeholder - implement based on your payment tracking

    const reports = {
      totalRevenue,
      totalUsers,
      totalCommissions,
      activeRate: parseFloat(activeRate) || 0,
      revenueGrowth: parseFloat(revenueGrowth) || 0,
      userGrowth: userGrowth || 0
    };

    reportsLogger.success("Admin reports data fetched successfully", reports);
    return successResponseWithData(res, "Reports data fetched successfully", reports);
  } catch (error) {
    reportsLogger.error("Error fetching admin reports data", error);
    return ErrorResponse(res, error.message, 500);
  }
};
