// Commission Calculation Service - Bonus Structure v1.0
import Commission from "../models/commissionModel.js";
import { TeamMember } from "../models/teamModel.js";
import User from "../models/authModel.js";
import {
  calculateDirectBonus,
  calculateLevelIncome,
  calculateRewardBonus,
  calculateBinaryBonus,
  checkLevelIncomQualification,
  BONUS_STRUCTURE,
} from "./bonusCalculator.js";

const PACKAGE_PRICE = 135;

/**
 * Generate commissions when a user makes a purchase
 * @param {ObjectId} buyerId - User who purchased the package
 * @param {Number} amount - Purchase amount
 * @param {ObjectId} transactionId - Payment transaction ID
 */
export const generatePurchaseCommissions = async (buyerId, amount, transactionId) => {
  try {
    const buyer = await User.findById(buyerId);
    if (!buyer) throw new Error("Buyer not found");

    const buyerTeam = await TeamMember.findOne({ userId: buyerId });
    if (!buyerTeam || !buyerTeam.sponsorId) {
      // User has no sponsor, no commissions to generate
      return [];
    }

    const commissions = [];

    // Get the buyer's sponsor (direct referrer)
    const directSponsor = await TeamMember.findOne({ userId: buyerTeam.sponsorId });
    if (!directSponsor) return [];

    // Generate Direct Bonus for sponsor
    const directBonus = await generateDirectBonus(directSponsor, buyerId, transactionId, amount);
    if (directBonus) commissions.push(directBonus);

    // Generate Level Income for all upline members
    const levelIncomes = await generateLevelIncomes(buyerTeam.sponsorId, buyerId, transactionId, amount);
    commissions.push(...levelIncomes);

    // Generate Binary Bonus (optional - based on binary structure)
    const binaryBonus = await generateBinaryBonus(directSponsor, buyerId, transactionId, amount);
    if (binaryBonus) commissions.push(binaryBonus);

    // Generate Reward Bonus (optional - based on performance)
    const rewardBonus = await generateRewardBonus(directSponsor, buyerId, transactionId, amount);
    if (rewardBonus) commissions.push(rewardBonus);

    return commissions;
  } catch (error) {
    console.error("Error generating purchase commissions:", error);
    throw error;
  }
};

/**
 * Generate Direct Bonus for the sponsor
 * Direct bonus is paid for referrals and resets every 30 days
 */
export const generateDirectBonus = async (sponsorTeam, buyerId, transactionId, amount) => {
  try {
    if (!sponsorTeam || !sponsorTeam.userId) return null;

    // Check if sponsor is in active 30-day bonus period
    if (!isIn30DayBonusPeriod(sponsorTeam.enrollmentDate)) {
      return null;
    }

    // Get current direct count for sponsor in this 30-day period
    const currentPeriod = getCurrentBonusPeriod(sponsorTeam.enrollmentDate);
    
    // Count directs added in current 30-day period
    const directs30Days = await TeamMember.countDocuments({
      sponsorId: sponsorTeam.userId,
      createdAt: {
        $gte: currentPeriod.startDate,
        $lt: currentPeriod.endDate,
      },
    });

    // Calculate direct bonus based on slab
    const bonusPercentage = getDirectBonusPercentage(directs30Days);
    const grossAmount = (amount * bonusPercentage) / 100;

    if (grossAmount <= 0) return null;

    const commission = await Commission.create({
      userId: sponsorTeam.userId,
      referrerId: buyerId,
      transactionId,
      commissionType: "direct_bonus",
      level: 1, // Direct is level 1
      grossAmount,
      taxPercentage: 0,
      taxAmount: 0,
      netAmount: grossAmount,
      status: "pending",
      earningDate: new Date(),
      period: {
        month: currentPeriod.month,
        year: currentPeriod.year,
      },
      description: `Direct bonus for referral of ${buyer?.fname} ${buyer?.lname}`,
    });

    return commission;
  } catch (error) {
    console.error("Error generating direct bonus:", error);
    return null;
  }
};

/**
 * Generate Level Income commissions for all upline members
 * Level income is paid after 10 directs and active until package expiration
 */
export const generateLevelIncomes = async (sponsorId, buyerId, transactionId, amount) => {
  try {
    const commissions = [];
    let currentSponsor = await TeamMember.findOne({ userId: sponsorId });
    let level = 1;

    while (currentSponsor && level <= 4) {
      // Check if sponsor qualifies for level income (needs 10+ directs)
      const directCount = await TeamMember.countDocuments({
        sponsorId: currentSponsor.userId,
      });

      if (directCount >= 10) {
        // Calculate level income
        const levelData = BONUS_STRUCTURE.levelIncome[level];
        const grossAmount = (amount * levelData.percentage) / 100;

        if (grossAmount > 0) {
          const commission = await Commission.create({
            userId: currentSponsor.userId,
            referrerId: buyerId,
            transactionId,
            commissionType: "level_income",
            level,
            grossAmount,
            taxPercentage: 0,
            taxAmount: 0,
            netAmount: grossAmount,
            status: "pending",
            earningDate: new Date(),
            period: {
              month: new Date().getMonth() + 1,
              year: new Date().getFullYear(),
            },
            description: `Level ${level} income from network sale`,
          });

          commissions.push(commission);
        }
      }

      // Move to next level upline
      if (currentSponsor.sponsorId) {
        currentSponsor = await TeamMember.findOne({ userId: currentSponsor.sponsorId });
        level++;
      } else {
        break;
      }
    }

    return commissions;
  } catch (error) {
    console.error("Error generating level incomes:", error);
    return [];
  }
};

/**
 * Generate Binary Bonus (14% of package price)
 * Binary bonus is paid based on binary structure (left/right balance)
 */
export const generateBinaryBonus = async (sponsorTeam, buyerId, transactionId, amount) => {
  try {
    if (!sponsorTeam) return null;

    // Check if this is a position-based referral (left or right)
    const buyer = await TeamMember.findOne({ userId: buyerId });
    if (!buyer || buyer.position === "main") return null;

    // Calculate binary bonus (14% structure)
    const binaryPercentage = BONUS_STRUCTURE.binary.percentage;
    const grossAmount = (amount * binaryPercentage) / 100;

    if (grossAmount <= 0) return null;

    const commission = await Commission.create({
      userId: sponsorTeam.userId,
      referrerId: buyerId,
      transactionId,
      commissionType: "binary_bonus",
      level: 1,
      grossAmount,
      taxPercentage: 0,
      taxAmount: 0,
      netAmount: grossAmount,
      status: "pending",
      earningDate: new Date(),
      period: {
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
      },
      description: `Binary bonus - ${buyer.position} position referral`,
    });

    return commission;
  } catch (error) {
    console.error("Error generating binary bonus:", error);
    return null;
  }
};

/**
 * Generate Reward Bonus (1.5% of package price)
 * Reward bonus is paid for high performers and milestones
 */
export const generateRewardBonus = async (sponsorTeam, buyerId, transactionId, amount) => {
  try {
    if (!sponsorTeam) return null;

    // Check if sponsor qualifies for reward (10+ directs)
    const directCount = await TeamMember.countDocuments({
      sponsorId: sponsorTeam.userId,
    });

    if (directCount < 10) return null;

    // Calculate reward bonus (1.5% structure)
    const rewardPercentage = BONUS_STRUCTURE.reward.percentage;
    const grossAmount = (amount * rewardPercentage) / 100;

    if (grossAmount <= 0) return null;

    const commission = await Commission.create({
      userId: sponsorTeam.userId,
      referrerId: buyerId,
      transactionId,
      commissionType: "reward_bonus",
      level: 1,
      grossAmount,
      taxPercentage: 0,
      taxAmount: 0,
      netAmount: grossAmount,
      status: "pending",
      earningDate: new Date(),
      period: {
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
      },
      description: `Performance reward bonus`,
    });

    return commission;
  } catch (error) {
    console.error("Error generating reward bonus:", error);
    return null;
  }
};

/**
 * Check if user is in active 30-day bonus period
 * Bonus resets every 30 days from enrollment date
 */
export const isIn30DayBonusPeriod = (enrollmentDate) => {
  if (!enrollmentDate) return false;

  const now = new Date();
  const daysSinceEnrollment = Math.floor((now - enrollmentDate) / (1000 * 60 * 60 * 24));

  // Direct bonus is active for first 30 days
  return daysSinceEnrollment <= 30;
};

/**
 * Get current 30-day bonus period
 */
export const getCurrentBonusPeriod = (enrollmentDate) => {
  const now = new Date();
  const daysSinceEnrollment = Math.floor((now - enrollmentDate) / (1000 * 60 * 60 * 24));
  const cycleNumber = Math.floor(daysSinceEnrollment / 30);

  const startDate = new Date(enrollmentDate);
  startDate.setDate(startDate.getDate() + cycleNumber * 30);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 30);

  return {
    startDate,
    endDate,
    cycleNumber,
    month: startDate.getMonth() + 1,
    year: startDate.getFullYear(),
  };
};

/**
 * Get direct bonus percentage based on direct count in current 30-day period
 */
export const getDirectBonusPercentage = (directCount) => {
  if (directCount >= 10) return BONUS_STRUCTURE.directBonus[4].percentage;
  if (directCount >= 7) return BONUS_STRUCTURE.directBonus[3].percentage;
  if (directCount >= 4) return BONUS_STRUCTURE.directBonus[2].percentage;
  if (directCount >= 1) return BONUS_STRUCTURE.directBonus[1].percentage;
  return 0;
};

/**
 * Get pending commissions for a user
 */
export const getPendingCommissions = async (userId) => {
  try {
    const commissions = await Commission.find({
      userId,
      status: "pending",
    }).sort({ createdAt: -1 });

    return commissions;
  } catch (error) {
    console.error("Error fetching pending commissions:", error);
    throw error;
  }
};

/**
 * Get total pending amount for a user
 */
export const getTotalPendingAmount = async (userId) => {
  try {
    const result = await Commission.aggregate([
      {
        $match: {
          userId,
          status: "pending",
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$netAmount" },
        },
      },
    ]);

    return result[0]?.totalAmount || 0;
  } catch (error) {
    console.error("Error calculating total pending amount:", error);
    throw error;
  }
};

/**
 * Get commission breakdown by type
 */
export const getCommissionBreakdown = async (userId, startDate, endDate) => {
  try {
    const commissions = await Commission.aggregate([
      {
        $match: {
          userId,
          createdAt: {
            $gte: startDate,
            $lt: endDate,
          },
        },
      },
      {
        $group: {
          _id: "$commissionType",
          total: { $sum: "$netAmount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const breakdown = {
      directBonus: 0,
      levelIncome: 0,
      binaryBonus: 0,
      rewardBonus: 0,
    };

    commissions.forEach((item) => {
      if (item._id === "direct_bonus") breakdown.directBonus = item.total;
      if (item._id === "level_income") breakdown.levelIncome = item.total;
      if (item._id === "binary_bonus") breakdown.binaryBonus = item.total;
      if (item._id === "reward_bonus") breakdown.rewardBonus = item.total;
    });

    return breakdown;
  } catch (error) {
    console.error("Error getting commission breakdown:", error);
    throw error;
  }
};

/**
 * Calculate estimated earnings for user
 */
export const calculateEstimatedEarnings = async (userId) => {
  try {
    const userTeam = await TeamMember.findOne({ userId });
    if (!userTeam) return null;

    const directCount = await TeamMember.countDocuments({
      sponsorId: userId,
    });

    const totalDownline = await TeamMember.countDocuments({
      $or: [{ sponsorId: userId }, { "path.includes": userId }],
    });

    // Calculate potential direct bonus
    const directBonus = calculateDirectBonus(directCount, PACKAGE_PRICE);

    // Calculate potential level income
    let levelIncome = 0;
    if (directCount >= 10) {
      // Simplified: assume average of 3 sales per downline member at level 1
      levelIncome = calculateLevelIncome(1, totalDownline * 0.3, PACKAGE_PRICE);
    }

    // Calculate potential reward bonus
    const rewardBonus = directCount >= 10 ? calculateRewardBonus(PACKAGE_PRICE) : 0;

    // Calculate potential binary bonus
    const binaryBonus = calculateBinaryBonus(PACKAGE_PRICE);

    const totalPotential = directBonus + levelIncome + rewardBonus + binaryBonus;

    return {
      directBonus,
      levelIncome,
      rewardBonus,
      binaryBonus,
      total: totalPotential,
      qualifiesForLevelIncome: directCount >= 10,
      directCount,
      totalDownline,
    };
  } catch (error) {
    console.error("Error calculating estimated earnings:", error);
    throw error;
  }
};

export default {
  generatePurchaseCommissions,
  generateDirectBonus,
  generateLevelIncomes,
  generateBinaryBonus,
  generateRewardBonus,
  isIn30DayBonusPeriod,
  getCurrentBonusPeriod,
  getDirectBonusPercentage,
  getPendingCommissions,
  getTotalPendingAmount,
  getCommissionBreakdown,
  calculateEstimatedEarnings,
};
