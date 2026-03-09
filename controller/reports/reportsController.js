import userModel from "../../models/authModel.js";
import AnalyticsModel from "../../models/analyticsModel.js";
import { successResponseWithData, ErrorResponse } from "../../helpers/apiResponse.js";
import logger from "../../helpers/logger.js";

const reportsLogger = logger.module("REPORTS_CONTROLLER");

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
    reportsLogger.error("Error calculating binary commission", error);
    return 0;
  }
};

/**
 * Get Reports Data for Admin Panel
 * GET /api/admin/reports
 */
export const getAdminReports = async (req, res) => {
  try {
    reportsLogger.start("Fetching admin reports data");

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

    // Calculate active rate
    const activeRate = totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : 0;

    // Calculate growth rates
    const previousPeriodUsers = await userModel.countDocuments({
      createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
    });
    const currentPeriodUsers = await userModel.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });
    const userGrowth = previousPeriodUsers > 0 
      ? parseFloat(((currentPeriodUsers - previousPeriodUsers) / previousPeriodUsers * 100).toFixed(1))
      : (currentPeriodUsers > 0 ? 100 : 0);

    // Revenue Metrics
    const subscriptionRevenue = subscribedUsers * 100; // $100 per subscription
    
    // Commission Metrics
    const totalCommissionsResult = await CommissionModel.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: "$netAmount" },
          count: { $sum: 1 }
        }
      }
    ]);
    const totalCommissions = totalCommissionsResult.length > 0 ? totalCommissionsResult[0].total : 0;
    const totalCommissionCount = totalCommissionsResult.length > 0 ? totalCommissionsResult[0].count : 0;

    // Commission by type
    const commissionByType = await CommissionModel.aggregate([
      {
        $group: {
          _id: "$commissionType",
          total: { $sum: "$netAmount" },
          count: { $sum: 1 }
        }
      }
    ]);

    // Payout Metrics
    const totalPayoutsResult = await PayoutModel.aggregate([
      {
        $group: {
          _id: "$status",
          total: { $sum: "$netAmount" },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const completedPayouts = totalPayoutsResult.find(p => p._id === "completed");
    const pendingPayouts = totalPayoutsResult.find(p => p._id === "pending");
    
    const totalPayoutsPaid = completedPayouts ? completedPayouts.total : 0;
    const totalPayoutsPending = pendingPayouts ? pendingPayouts.total : 0;

    // Binary Rewards
    const totalRewards = await BinaryRewardModel.countDocuments();
    const claimedRewards = await BinaryRewardModel.countDocuments({ status: "claimed" });
    const deliveredRewards = await BinaryRewardModel.countDocuments({ status: "delivered" });

    // Calculate real-time binary commission from team structure
    reportsLogger.debug("Calculating real-time binary commission from team structure");
    const calculatedBinaryCommission = await calculateTotalBinaryCommission();

    // Calculate revenue growth
    const previousRevenue = subscriptionRevenue * 0.88; // Simplified calculation
    const revenueGrowth = previousRevenue > 0 
      ? parseFloat(((subscriptionRevenue - previousRevenue) / previousRevenue * 100).toFixed(1))
      : (subscriptionRevenue > 0 ? 100 : 0);

    const reports = {
      // Summary
      totalRevenue: subscriptionRevenue,
      totalUsers,
      totalCommissions,
      activeRate: parseFloat(activeRate),
      revenueGrowth,
      userGrowth,
      
      // Detailed Metrics
      users: {
        total: totalUsers,
        active: activeUsers,
        subscribed: subscribedUsers,
        suspended: totalUsers - activeUsers,
        newThisMonth: currentPeriodUsers
      },
      
      commissions: {
        total: totalCommissions,
        count: totalCommissionCount,
        byType: {
          direct_bonus: commissionByType.find(c => c._id === "direct_bonus")?.total || 0,
          level_income: commissionByType.find(c => c._id === "level_income")?.total || 0,
          binary_bonus: calculatedBinaryCommission, // Use calculated binary commission instead of stored records
          reward_bonus: commissionByType.find(c => c._id === "reward_bonus")?.total || 0
        }
      },
      
      payouts: {
        completed: totalPayoutsPaid,
        pending: totalPayoutsPending,
        total: totalPayoutsPaid + totalPayoutsPending,
        breakdown: totalPayoutsResult
      },
      
      rewards: {
        total: totalRewards,
        claimed: claimedRewards,
        delivered: deliveredRewards,
        pending: claimedRewards - deliveredRewards
      },
      
      financial: {
        grossRevenue: subscriptionRevenue,
        commissionsOut: totalCommissions,
        payoutsCompleted: totalPayoutsPaid,
        netProfit: subscriptionRevenue - totalCommissions
      }
    };

    reportsLogger.success("Admin reports data fetched successfully", reports);
    return successResponseWithData(res, "Reports data fetched successfully", reports);
  } catch (error) {
    reportsLogger.error("Error fetching admin reports data", error);
    return ErrorResponse(res, error.message, 500);
  }
};
