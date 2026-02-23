/**
 * Binary Commission Service
 * Generates binary bonuses based on rank and weaker leg PV
 */

import Commission from "../models/commissionModel.js";
import { TeamMember } from "../models/teamModel.js";
import { calculateBinaryCommission } from "./binaryRankHelper.js";
import logger from "./logger.js";

const binaryLogger = logger.module("BINARY_COMMISSION");

/**
 * Generate binary commissions for a specific user
 * Only generates if binary system is activated (10+ direct referrals)
 */
export const generateBinaryCommissionForUser = async (userId) => {
  try {
    const teamMember = await TeamMember.findOne({ userId }).populate('userId');
    
    if (!teamMember) {
      return { success: false, message: "Team member not found" };
    }

    // Check if binary is activated (2:1 or 1:2 ratio)
    const has2x1 = teamMember.leftLegCount >= 2 && teamMember.rightLegCount >= 1;
    const has1x2 = teamMember.leftLegCount >= 1 && teamMember.rightLegCount >= 2;
    if (!has2x1 && !has1x2) {
      binaryLogger.info("Binary not activated - needs 2:1 or 1:2 ratio", {
        userId,
        leftLegCount: teamMember.leftLegCount,
        rightLegCount: teamMember.rightLegCount
      });
      return {
        success: false,
        message: `Binary system not activated. Current: ${teamMember.leftLegCount} left, ${teamMember.rightLegCount} right (needs 2:1 or 1:2)`,
        binaryActivated: false,
        leftLegCount: teamMember.leftLegCount,
        rightLegCount: teamMember.rightLegCount
      };
    }

    // Calculate binary commission based on rank and PV
    const binaryData = calculateBinaryCommission(
      teamMember.leftLegPV || 0,
      teamMember.rightLegPV || 0,
      teamMember.directCount || 0
    );

    if (!binaryData.activated || binaryData.commission <= 0) {
      return {
        success: false,
        message: "No binary commission to generate",
        binaryActivated: binaryData.activated,
        commission: 0
      };
    }

    // Check if commission for this period already exists
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    const existingCommission = await Commission.findOne({
      userId,
      commissionType: "binary_bonus",
      'period.month': currentMonth,
      'period.year': currentYear
    });

    if (existingCommission) {
      return {
        success: false,
        message: "Binary commission already generated for this month",
        existingCommission
      };
    }

    // Create binary commission record
    const commission = await Commission.create({
      userId,
      commissionType: "binary_bonus",
      level: 1,
      grossAmount: binaryData.commission,
      taxPercentage: 0,
      taxAmount: 0,
      netAmount: binaryData.commission,
      status: "pending",
      earningDate: new Date(),
      period: {
        month: currentMonth,
        year: currentYear
      },
      description: `Binary bonus - ${binaryData.rank} rank (${binaryData.bonusPercent}% of weaker leg PV: $${binaryData.weakerLegPV})`,
      metadata: {
        rank: binaryData.rank,
        bonusPercent: binaryData.bonusPercent,
        leftLegPV: teamMember.leftLegPV || 0,
        rightLegPV: teamMember.rightLegPV || 0,
        weakerLegPV: binaryData.weakerLegPV,
        leftLegCount: teamMember.leftLegCount || 0,
        rightLegCount: teamMember.rightLegCount || 0,
        directCount: teamMember.directCount || 0
      }
    });

    binaryLogger.success("Binary commission generated", {
      userId,
      amount: binaryData.commission,
      rank: binaryData.rank,
      commissionId: commission._id
    });

    return {
      success: true,
      message: "Binary commission generated successfully",
      commission,
      binaryData
    };

  } catch (error) {
    binaryLogger.error("Error generating binary commission", error);
    return {
      success: false,
      message: error.message
    };
  }
};

/**
 * Generate binary commissions for all qualified users
 * Run this monthly or on-demand
 */
export const generateBinaryCommissionsForAll = async () => {
  try {
    binaryLogger.start("Generating binary commissions for all qualified users");

    // Find all team members with 2:1 or 1:2 ratio (binary activated)
    const qualifiedMembers = await TeamMember.find({
      $or: [
        { leftLegCount: { $gte: 2 }, rightLegCount: { $gte: 1 } },
        { leftLegCount: { $gte: 1 }, rightLegCount: { $gte: 2 } }
      ],
      binaryActivated: true
    }).populate('userId');

    const results = {
      total: qualifiedMembers.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      commissions: [],
      errors: []
    };

    for (const member of qualifiedMembers) {
      const result = await generateBinaryCommissionForUser(member.userId._id);
      
      if (result.success) {
        results.successful++;
        results.commissions.push(result.commission);
      } else if (result.message.includes("already generated")) {
        results.skipped++;
      } else {
        results.failed++;
        results.errors.push({
          userId: member.userId._id,
          email: member.userId.email,
          error: result.message
        });
      }
    }

    binaryLogger.success("Binary commission generation completed", {
      total: results.total,
      successful: results.successful,
      failed: results.failed,
      skipped: results.skipped
    });

    return results;

  } catch (error) {
    binaryLogger.error("Error generating binary commissions for all", error);
    throw error;
  }
};

export default {
  generateBinaryCommissionForUser,
  generateBinaryCommissionsForAll
};
