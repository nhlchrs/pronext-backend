import { TeamMember, Referral, Bonus, Commission } from "../models/teamModel.js";
import User from "../models/authModel.js";
import { v4 as uuidv4 } from "uuid";
import {
  calculateDirectBonus,
  calculateLevelIncome,
  getDirectBonusSlab,
  generateBonusBreakdown,
  getNextMilestone,
  checkLevelIncomQualification,
} from "../helpers/bonusCalculator.js";

// Generate unique referral code
export const generateReferralCode = (userId) => {
  return `PRO-${userId.toString().slice(-6).toUpperCase()}-${uuidv4().slice(0, 8).toUpperCase()}`;
};

// Get or Create Team Member
export const getOrCreateTeamMember = async (userId) => {
  try {
    let teamMember = await TeamMember.findOne({ userId }).populate("sponsorId");

    if (!teamMember) {
      const referralCode = generateReferralCode(userId);
      teamMember = new TeamMember({
        userId,
        referralCode,
      });
      await teamMember.save();
    }

    return {
      success: true,
      teamMember,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
};

// Set Sponsor/Upline
export const setSponsor = async (userId, sponsorId) => {
  try {
    const teamMember = await TeamMember.findOne({ userId });

    if (!teamMember) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    if (teamMember.sponsorId) {
      return {
        success: false,
        message: "Sponsor already assigned",
      };
    }

    const sponsor = await TeamMember.findOne({ userId: sponsorId });
    if (!sponsor) {
      return {
        success: false,
        message: "Sponsor not found",
      };
    }

    teamMember.sponsorId = sponsorId;
    await teamMember.save();

    // Add to sponsor's team
    sponsor.teamMembers.push(userId);
    sponsor.directCount = sponsor.teamMembers.length;
    await sponsor.save();

    return {
      success: true,
      message: "Sponsor assigned successfully",
      teamMember,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
};

// Get Team Dashboard
export const getTeamDashboard = async (userId) => {
  try {
    const teamMember = await TeamMember.findOne({ userId })
      .populate("sponsorId", "fname lname email")
      .populate("teamMembers", "fname lname email");

    if (!teamMember) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    const commission = await Commission.findOne({ userId });
    const directCount = teamMember.directCount;
    const bonusBreakdown = generateBonusBreakdown(teamMember, directCount);
    const nextMilestone = getNextMilestone(directCount);
    const levelQualified = checkLevelIncomQualification(directCount);

    return {
      success: true,
      dashboard: {
        referralCode: teamMember.referralCode,
        sponsor: teamMember.sponsorId,
        directCount,
        teamMembers: teamMember.teamMembers,
        level: teamMember.level,
        levelQualified,
        levelQualifiedDate: teamMember.levelQualifiedDate,
        totalDownline: teamMember.totalDownline,
        bonusBreakdown,
        nextMilestone,
        earnings: {
          total: commission?.totalCommission || 0,
          paid: commission?.totalPaid || 0,
          pending: commission?.totalPending || 0,
        },
        lastPayoutDate: teamMember.lastPayoutDate,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
};

// Get Team Members (Downline)
export const getTeamMembers = async (userId, page = 1, limit = 10) => {
  try {
    const skip = (page - 1) * limit;

    const teamMember = await TeamMember.findOne({ userId });
    if (!teamMember) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    const total = teamMember.teamMembers.length;
    const members = await User.find({ _id: { $in: teamMember.teamMembers } })
      .select("fname lname email phone")
      .skip(skip)
      .limit(limit);

    return {
      success: true,
      page,
      limit,
      total,
      members,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
};

// Get Referral History
export const getReferralHistory = async (userId, page = 1, limit = 10) => {
  try {
    const skip = (page - 1) * limit;

    const total = await Referral.countDocuments({ referrerId: userId });
    const referrals = await Referral.find({ referrerId: userId })
      .populate("referredUserId", "fname lname email phone")
      .sort({ referralDate: -1 })
      .skip(skip)
      .limit(limit);

    return {
      success: true,
      page,
      limit,
      total,
      referrals,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
};

// Calculate and Process Bonuses
export const processMonthlyBonuses = async (userId) => {
  try {
    const teamMember = await TeamMember.findOne({ userId });
    if (!teamMember) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    const directCount = teamMember.directCount;
    const packagePrice = teamMember.packagePrice;
    let totalBonus = 0;

    // Direct Bonus
    const directBonus = calculateDirectBonus(directCount, packagePrice);
    if (directBonus > 0) {
      const bonus = new Bonus({
        userId,
        bonusType: "direct",
        amount: directBonus,
        percentage: getDirectBonusSlab(directCount)?.percentage || 0,
        status: "pending",
      });
      await bonus.save();
      totalBonus += directBonus;
    }

    // Level Income
    if (checkLevelIncomQualification(directCount)) {
      const levelIncome = calculateLevelIncome(
        teamMember.level,
        teamMember.teamMembers.length,
        packagePrice
      );
      if (levelIncome > 0) {
        const bonus = new Bonus({
          userId,
          bonusType: "level",
          amount: levelIncome,
          percentage: teamMember.level,
          level: teamMember.level,
          status: "pending",
        });
        await bonus.save();
        totalBonus += levelIncome;
      }
    }

    // Update Commission
    let commission = await Commission.findOne({ userId });
    if (!commission) {
      commission = new Commission({ userId });
    }

    commission.totalPending += totalBonus;
    commission.totalCommission += totalBonus;
    await commission.save();

    return {
      success: true,
      message: "Bonuses processed successfully",
      totalBonusGenerated: totalBonus,
      commission,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
};

// Get Bonus History
export const getBonusHistory = async (userId, page = 1, limit = 10) => {
  try {
    const skip = (page - 1) * limit;

    const total = await Bonus.countDocuments({ userId });
    const bonuses = await Bonus.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const summary = await Bonus.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: "$bonusType",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      success: true,
      page,
      limit,
      total,
      bonuses,
      summary,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
};

// Get Commission Details
export const getCommissionDetails = async (userId) => {
  try {
    let commission = await Commission.findOne({ userId });

    if (!commission) {
      commission = new Commission({ userId });
      await commission.save();
    }

    return {
      success: true,
      commission,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
};

// Request Payout
export const requestPayout = async (userId, amount) => {
  try {
    const commission = await Commission.findOne({ userId });

    if (!commission) {
      return {
        success: false,
        message: "Commission record not found",
      };
    }

    if (commission.totalPending < amount) {
      return {
        success: false,
        message: "Insufficient pending balance",
      };
    }

    const payout = {
      amount,
      date: new Date(),
      method: "pending",
    };

    commission.payoutHistory.push(payout);
    commission.totalPaid += amount;
    commission.totalPending -= amount;
    commission.lastPayoutDate = new Date();
    commission.nextPayoutDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    await commission.save();

    return {
      success: true,
      message: "Payout requested successfully",
      payout,
      commission,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
};

// Get User Rank/Level Based on Directs
export const updateUserLevel = async (userId) => {
  try {
    const teamMember = await TeamMember.findOne({ userId });

    if (!teamMember) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    let newLevel = 0;
    const directCount = teamMember.directCount;

    if (directCount >= 10 && !teamMember.levelQualified) {
      newLevel = 1;
      teamMember.levelQualified = true;
      teamMember.levelQualifiedDate = new Date();
    } else if (directCount >= 20) newLevel = 2;
    else if (directCount >= 50) newLevel = 3;
    else if (directCount >= 100) newLevel = 4;

    teamMember.level = newLevel;
    await teamMember.save();

    return {
      success: true,
      message: "User level updated",
      level: newLevel,
      levelQualified: teamMember.levelQualified,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
};

// Get Team Network (Tree Structure)
export const getTeamNetwork = async (userId, depth = 2, currentDepth = 0) => {
  try {
    if (currentDepth >= depth) return null;

    const teamMember = await TeamMember.findOne({ userId }).populate(
      "teamMembers",
      "fname lname email"
    );

    if (!teamMember) {
      return null;
    }

    const children = await Promise.all(
      teamMember.teamMembers.map((memberId) =>
        getTeamNetwork(memberId, depth, currentDepth + 1)
      )
    );

    return {
      userId: teamMember.userId,
      directCount: teamMember.directCount,
      level: teamMember.level,
      totalDownline: teamMember.totalDownline,
      children: children.filter((child) => child !== null),
    };
  } catch (error) {
    console.error("Error building team network:", error.message);
    return null;
  }
};

// Get Leaderboard
export const getLeaderboard = async (limit = 10) => {
  try {
    const leaderboard = await TeamMember.find({ isActive: true })
      .populate("userId", "fname lname email")
      .sort({ directCount: -1, totalEarnings: -1 })
      .limit(limit)
      .select("userId directCount level totalEarnings totalDownline");

    return {
      success: true,
      leaderboard,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
};

// Get Statistics
export const getTeamStatistics = async () => {
  try {
    const stats = await TeamMember.aggregate([
      {
        $group: {
          _id: null,
          totalMembers: { $sum: 1 },
          totalEarnings: { $sum: "$totalEarnings" },
          averageDirects: { $avg: "$directCount" },
          maxDirects: { $max: "$directCount" },
          totalDownline: { $sum: "$totalDownline" },
        },
      },
    ]);

    const levelBreakdown = await TeamMember.aggregate([
      {
        $group: {
          _id: "$level",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      success: true,
      statistics: stats[0] || {},
      levelBreakdown,
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
};
