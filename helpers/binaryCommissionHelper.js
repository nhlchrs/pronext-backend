/**
 * Binary Commission Helper
 * 
 * Handles binary commission calculations including:
 * - Recursive PV calculation for legs
 * - Complete binary tree PV calculation
 * - Weekly binary commission calculation with carry forward
 * - Weekly payout processing
 * - Upline PV tree updates
 */

import { TeamMember } from "../models/teamModel.js";
import Commission from "../models/commissionModel.js";
import { calculateBinaryRank } from "./binaryRankHelper.js";
import logger from "./logger.js";

const binaryLogger = logger.module("BINARY_COMMISSION");

// Constants
const PV_PER_SUBSCRIPTION = 94.5;
const PACKAGE_PRICE = 135; // USD

/**
 * Calculate PV for a specific leg recursively
 * Traverses entire leg tree and sums all PV
 * 
 * @param {ObjectId} memberId - Team member ID
 * @param {string} legPosition - 'left' or 'right'
 * @returns {Promise<number>} Total PV in that leg
 */
export const calculateLegPV = async (memberId, legPosition) => {
  try {
    // Get direct children in this leg
    const children = await TeamMember.find({
      sponsorId: memberId,
      position: legPosition
    });

    if (children.length === 0) {
      return 0;
    }

    let totalPV = 0;

    // For each direct child, add their PV and recursively calculate their descendants
    for (const child of children) {
      // Add this child's PV
      totalPV += PV_PER_SUBSCRIPTION;

      // Recursively calculate left leg of this child
      totalPV += await calculateLegPV(child._id, 'left');

      // Recursively calculate right leg of this child
      totalPV += await calculateLegPV(child._id, 'right');
    }

    return totalPV;
  } catch (error) {
    binaryLogger.error("Error calculating leg PV", {
      memberId,
      legPosition,
      error: error.message
    });
    throw error;
  }
};

/**
 * Calculate complete binary tree PV for a user
 * Returns left leg PV, right leg PV, and total PV
 * 
 * @param {ObjectId} userId - User ID
 * @returns {Promise<Object>} { leftPV, rightPV, totalPV }
 */
export const calculateCompleteBinaryTreePV = async (userId) => {
  try {
    const member = await TeamMember.findOne({ userId });
    
    if (!member) {
      throw new Error("Team member not found");
    }

    // Calculate left leg PV recursively
    const leftPV = await calculateLegPV(member._id, 'left');

    // Calculate right leg PV recursively
    const rightPV = await calculateLegPV(member._id, 'right');

    const totalPV = leftPV + rightPV;

    binaryLogger.info("Complete binary tree PV calculated", {
      userId,
      leftPV,
      rightPV,
      totalPV
    });

    return {
      leftPV,
      rightPV,
      totalPV,
      success: true
    };
  } catch (error) {
    binaryLogger.error("Error calculating complete binary tree PV", {
      userId,
      error: error.message
    });
    throw error;
  }
};

/**
 * Calculate weekly binary commission with carry forward logic
 * 
 * Formula:
 * - Total Available PV = Carry Forward + New PV
 * - Pairs = min(leftPV, rightPV) / 94.5
 * - Matched PV = Pairs × 94.5
 * - Commission = Matched PV × Rank Percentage
 * - New Carry Forward = Total - Matched
 * 
 * @param {ObjectId} userId - User ID
 * @param {number} newLeftPV - New PV in left leg this week
 * @param {number} newRightPV - New PV in right leg this week
 * @returns {Promise<Object>} Commission calculation results
 */
export const calculateWeeklyBinaryCommission = async (userId, newLeftPV, newRightPV) => {
  try {
    const member = await TeamMember.findOne({ userId });
    
    if (!member) {
      throw new Error("Team member not found");
    }

    // Get carry forward from last week
    const carryForwardLeft = member.carryForwardLeftPV || 0;
    const carryForwardRight = member.carryForwardRightPV || 0;

    // Total available PV = carry forward + new PV
    const totalLeftPV = carryForwardLeft + (newLeftPV || 0);
    const totalRightPV = carryForwardRight + (newRightPV || 0);

    // Calculate pairs (minimum leg determines pairs)
    const pairs = Math.floor(Math.min(totalLeftPV, totalRightPV) / PV_PER_SUBSCRIPTION);
    const matchedPV = pairs * PV_PER_SUBSCRIPTION;

    // Calculate binary rank and commission percentage
    const totalTeamSize = (member.leftLegCount || 0) + (member.rightLegCount || 0);
    const rankInfo = calculateBinaryRank(totalTeamSize);
    const commissionPercent = rankInfo.binaryBonusPercent;

    // Calculate commission amount
    const commissionAmount = matchedPV * (commissionPercent / 100);

    // Calculate new carry forward
    const newCarryForwardLeft = totalLeftPV - matchedPV;
    const newCarryForwardRight = totalRightPV - matchedPV;

    binaryLogger.info("Weekly binary commission calculated", {
      userId,
      pairs,
      matchedPV,
      commissionPercent,
      commissionAmount,
      rank: rankInfo.rank
    });

    return {
      success: true,
      carryForward: {
        left: carryForwardLeft,
        right: carryForwardRight
      },
      newPV: {
        left: newLeftPV || 0,
        right: newRightPV || 0
      },
      totalAvailable: {
        left: totalLeftPV,
        right: totalRightPV
      },
      pairs,
      matchedPV,
      rank: rankInfo.rank,
      commissionPercent,
      commissionAmount,
      newCarryForward: {
        left: newCarryForwardLeft,
        right: newCarryForwardRight
      }
    };
  } catch (error) {
    binaryLogger.error("Error calculating weekly binary commission", {
      userId,
      error: error.message
    });
    return {
      success: false,
      message: error.message
    };
  }
};

/**
 * Process weekly binary payout
 * Creates commission record and updates carry forward values
 * 
 * @param {ObjectId} userId - User ID
 * @param {number} currentLeftPV - Current left leg PV
 * @param {number} currentRightPV - Current right leg PV
 * @returns {Promise<Object>} Payout processing results
 */
export const processWeeklyBinaryPayout = async (userId, currentLeftPV, currentRightPV) => {
  try {
    const member = await TeamMember.findOne({ userId });
    
    if (!member) {
      throw new Error("Team member not found");
    }

    // Calculate weekly commission
    const calculation = await calculateWeeklyBinaryCommission(
      userId,
      currentLeftPV,
      currentRightPV
    );

    if (!calculation.success) {
      throw new Error(calculation.message);
    }

    // Only create commission if amount > 0
    let commissionRecord = null;
    if (calculation.commissionAmount > 0) {
      // Create commission record
      commissionRecord = await Commission.create({
        userId: member.userId,
        type: "binary_bonus",
        amount: calculation.commissionAmount,
        details: {
          pairs: calculation.pairs,
          matchedPV: calculation.matchedPV,
          rank: calculation.rank,
          commissionPercent: calculation.commissionPercent,
          leftPV: calculation.totalAvailable.left,
          rightPV: calculation.totalAvailable.right,
          carryForwardLeft: calculation.carryForward.left,
          carryForwardRight: calculation.carryForward.right
        },
        status: "pending",
        createdAt: new Date()
      });

      binaryLogger.success("Binary commission record created", {
        userId,
        commissionId: commissionRecord._id,
        amount: calculation.commissionAmount
      });
    }

    // Update team member with new carry forward and income
    member.carryForwardLeftPV = calculation.newCarryForward.left;
    member.carryForwardRightPV = calculation.newCarryForward.right;
    member.lastBinaryMatchDate = new Date();
    member.totalMatchedPV = (member.totalMatchedPV || 0) + calculation.matchedPV;
    
    if (calculation.commissionAmount > 0) {
      member.weeklyBinaryIncome = calculation.commissionAmount;
      member.totalBinaryIncome = (member.totalBinaryIncome || 0) + calculation.commissionAmount;
    }

    await member.save();

    binaryLogger.success("Weekly binary payout processed", {
      userId,
      commissionAmount: calculation.commissionAmount,
      carryForwardLeft: calculation.newCarryForward.left,
      carryForwardRight: calculation.newCarryForward.right
    });

    return {
      success: true,
      commission: commissionRecord,
      calculation,
      updatedMember: {
        carryForwardLeftPV: member.carryForwardLeftPV,
        carryForwardRightPV: member.carryForwardRightPV,
        totalBinaryIncome: member.totalBinaryIncome,
        totalMatchedPV: member.totalMatchedPV
      }
    };
  } catch (error) {
    binaryLogger.error("Error processing weekly binary payout", {
      userId,
      error: error.message
    });
    return {
      success: false,
      message: error.message
    };
  }
};

/**
 * Add PV to upline tree when a new member joins
 * Traverses up the binary tree and adds PV to all upline members
 * 
 * @param {ObjectId} newMemberId - New member's TeamMember ID
 * @param {number} pvAmount - PV amount to add (default: 94.5)
 * @returns {Promise<Object>} Result of PV addition
 */
export const addPVToUplineTree = async (newMemberId, pvAmount = PV_PER_SUBSCRIPTION) => {
  try {
    const newMember = await TeamMember.findById(newMemberId);
    
    if (!newMember) {
      throw new Error("New member not found");
    }

    // If no sponsor or main position, nothing to update
    if (!newMember.sponsorId || newMember.position === 'main') {
      binaryLogger.info("No upline PV update needed", {
        newMemberId,
        reason: "No sponsor or main position"
      });
      return {
        success: true,
        message: "No upline PV update needed (no sponsor or main position)"
      };
    }

    let currentMemberId = newMember.sponsorId;
    let currentPosition = newMember.position; // 'left' or 'right'
    let updatedCount = 0;

    binaryLogger.info("Starting upline PV update", {
      newMemberId,
      position: currentPosition,
      pvAmount
    });

    // Traverse up the tree
    while (currentMemberId) {
      const currentMember = await TeamMember.findById(currentMemberId);
      
      if (!currentMember) {
        break;
      }

      // Add PV to the appropriate leg
      if (currentPosition === 'left') {
        currentMember.leftLegPV = (currentMember.leftLegPV || 0) + pvAmount;
      } else if (currentPosition === 'right') {
        currentMember.rightLegPV = (currentMember.rightLegPV || 0) + pvAmount;
      }

      // Recalculate rank based on total team size
      const totalTeamSize = (currentMember.leftLegCount || 0) + (currentMember.rightLegCount || 0);
      const rankInfo = calculateBinaryRank(totalTeamSize);
      currentMember.binaryRank = rankInfo.rank;
      currentMember.binaryBonusPercent = rankInfo.binaryBonusPercent;
      currentMember.totalActiveAffiliates = totalTeamSize;

      await currentMember.save();
      updatedCount++;

      binaryLogger.debug("Updated upline member PV", {
        memberId: currentMember._id,
        position: currentPosition,
        newLeftPV: currentMember.leftLegPV,
        newRightPV: currentMember.rightLegPV,
        rank: currentMember.binaryRank
      });

      // Move to next upline member
      currentPosition = currentMember.position;
      currentMemberId = currentMember.sponsorId;
    }

    binaryLogger.success("Upline PV tree updated", {
      newMemberId,
      pvAmount,
      updatedCount
    });

    return {
      success: true,
      message: `PV added to ${updatedCount} upline members`,
      updatedCount
    };
  } catch (error) {
    binaryLogger.error("Error adding PV to upline tree", {
      newMemberId,
      pvAmount,
      error: error.message
    });
    return {
      success: false,
      message: error.message
    };
  }
};

export default {
  calculateLegPV,
  calculateCompleteBinaryTreePV,
  calculateWeeklyBinaryCommission,
  processWeeklyBinaryPayout,
  addPVToUplineTree
};
