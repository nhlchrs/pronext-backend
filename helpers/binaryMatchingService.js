/**
 * Binary Matching Service
 * 
 * Implements weekly 1:1 binary matching system with:
 * - Phase 1: 1:2 activation rule
 * - Phase 2: Weekly 1:1 matching
 * - PV generation (94.5 PV per $135 subscription)
 * - Carry forward logic
 * - 90-day inactivity reset
 * - Friday 23:59 execution
 */

import TeamMember from "../models/teamModel.js";
import Commission from "../models/commissionModel.js";
import { calculateBinaryRank } from "./binaryRankHelper.js";

// Constants
export const PV_PER_SUBSCRIPTION = 94.5; // Each $135 subscription = 94.5 PV
export const INACTIVITY_DAYS = 90; // Days before PV reset
export const SUBSCRIPTION_PRICE = 135;

/**
 * Phase 1: Check if binary is activated (1:2 minimum criteria)
 * Formula: (Left >= 1 AND Right >= 2) OR (Right >= 1 AND Left >= 2)
 */
export const checkBinaryActivation = (leftLegCount, rightLegCount) => {
  const activated = 
    (leftLegCount >= 1 && rightLegCount >= 2) ||
    (rightLegCount >= 1 && leftLegCount >= 2);
  
  return {
    activated,
    message: activated 
      ? `Binary activated! Left: ${leftLegCount}, Right: ${rightLegCount}`
      : `Need 1:2 ratio. Current - Left: ${leftLegCount}, Right: ${rightLegCount}`
  };
};

/**
 * Add PV to leg when subscription is placed
 * @param {ObjectId} userId - Team member ID
 * @param {string} position - 'left' or 'right'
 * @param {number} pvAmount - Point value to add (default 94.5)
 */
export const addPVToLeg = async (userId, position, pvAmount = PV_PER_SUBSCRIPTION) => {
  try {
    const member = await TeamMember.findOne({ userId });
    if (!member) {
      throw new Error("Team member not found");
    }

    // Update PV based on position
    if (position === 'left') {
      member.leftLegPV += pvAmount;
      member.leftLegCount += 1;
    } else if (position === 'right') {
      member.rightLegPV += pvAmount;
      member.rightLegCount += 1;
    }

    // Update last activity date
    member.lastActivityDate = new Date();

    // Check if binary should be activated
    if (!member.binaryActivated) {
      const activation = checkBinaryActivation(member.leftLegCount, member.rightLegCount);
      if (activation.activated) {
        member.binaryActivated = true;
        member.binaryActivationDate = new Date();
      }
    }

    await member.save();

    // Propagate PV to upline
    if (member.sponsorId) {
      await propagatePVToUpline(member.sponsorId, position, pvAmount);
    }

    return {
      success: true,
      message: `${pvAmount} PV added to ${position} leg`,
      leftLegPV: member.leftLegPV,
      rightLegPV: member.rightLegPV,
      binaryActivated: member.binaryActivated
    };
  } catch (error) {
    console.error("Error adding PV to leg:", error);
    throw error;
  }
};

/**
 * Propagate PV up the binary tree
 */
const propagatePVToUpline = async (sponsorId, position, pvAmount) => {
  try {
    const sponsor = await TeamMember.findOne({ userId: sponsorId });
    if (!sponsor) return;

    // Add to sponsor's corresponding leg
    if (position === 'left') {
      sponsor.leftLegPV += pvAmount;
    } else if (position === 'right') {
      sponsor.rightLegPV += pvAmount;
    }

    sponsor.lastActivityDate = new Date();

    // Check activation
    if (!sponsor.binaryActivated) {
      const activation = checkBinaryActivation(sponsor.leftLegCount, sponsor.rightLegCount);
      if (activation.activated) {
        sponsor.binaryActivated = true;
        sponsor.binaryActivationDate = new Date();
      }
    }

    await sponsor.save();

    // Continue propagating
    if (sponsor.sponsorId) {
      await propagatePVToUpline(sponsor.sponsorId, position, pvAmount);
    }
  } catch (error) {
    console.error("Error propagating PV:", error);
  }
};

/**
 * Phase 2: Execute weekly 1:1 matching (Friday 23:59)
 * matched_volume = MIN(LPro, RPro)
 * Binary Income = matched_volume × rank_percentage
 * Remaining PV carries forward
 */
export const executeWeeklyMatching = async () => {
  try {
    console.log("🔄 Starting weekly binary matching...");
    
    const activatedMembers = await TeamMember.find({ 
      binaryActivated: true 
    });

    let totalMatched = 0;
    let totalIncome = 0;
    const results = [];

    for (const member of activatedMembers) {
      try {
        // Reset check - if inactive for 90 days, reset PV
        const daysSinceActivity = Math.floor(
          (new Date() - member.lastActivityDate) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceActivity >= INACTIVITY_DAYS) {
          // Reset PV due to inactivity
          member.leftLegPV = 0;
          member.rightLegPV = 0;
          member.carryForwardLeftPV = 0;
          member.carryForwardRightPV = 0;
          member.inactivityResetDate = new Date();
          await member.save();
          
          results.push({
            userId: member.userId,
            status: 'reset',
            reason: '90-day inactivity',
            daysSinceActivity
          });
          continue;
        }

        // Get current PV (including carry forward)
        const leftPV = member.leftLegPV + member.carryForwardLeftPV;
        const rightPV = member.rightLegPV + member.carryForwardRightPV;

        // Calculate matched volume (1:1 matching)
        const matchedVolume = Math.min(leftPV, rightPV);

        if (matchedVolume <= 0) {
          results.push({
            userId: member.userId,
            status: 'no_match',
            leftPV,
            rightPV
          });
          continue;
        }

        // Calculate rank and percentage
        const rank = calculateBinaryRank(member.totalActiveAffiliates);
        const rankPercentage = rank.bonusPercent / 100;

        // Calculate binary income
        const binaryIncome = matchedVolume * rankPercentage;

        // Update carry forward (remaining PV)
        const remainingLeftPV = leftPV - matchedVolume;
        const remainingRightPV = rightPV - matchedVolume;

        // Create commission record
        const commission = await Commission.create({
          userId: member.userId,
          referrerId: member.userId,
          transactionId: null,
          commissionType: "binary_bonus",
          level: 0,
          grossAmount: binaryIncome,
          taxPercentage: 0,
          taxAmount: 0,
          netAmount: binaryIncome,
          status: "pending",
          earningDate: new Date(),
          period: {
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear()
          },
          description: `Weekly binary match - ${matchedVolume} PV matched at ${rank.name} (${rank.bonusPercent}%)`
        });

        // Update member stats
        member.carryForwardLeftPV = remainingLeftPV;
        member.carryForwardRightPV = remainingRightPV;
        member.totalMatchedPV += matchedVolume;
        member.weeklyBinaryIncome = binaryIncome;
        member.totalBinaryIncome += binaryIncome;
        member.binaryCommissionEarned += binaryIncome;
        member.totalEarnings += binaryIncome;
        member.lastBinaryMatchDate = new Date();
        member.lastBinaryCalculation = new Date();
        member.weakerLegPV = Math.min(leftPV, rightPV);
        
        // Reset weekly PV (keep only carry forward)
        member.leftLegPV = 0;
        member.rightLegPV = 0;

        await member.save();

        totalMatched += matchedVolume;
        totalIncome += binaryIncome;

        results.push({
          userId: member.userId,
          status: 'matched',
          matchedVolume,
          binaryIncome,
          rank: rank.name,
          rankPercentage: rank.bonusPercent,
          remainingLeftPV,
          remainingRightPV
        });

      } catch (error) {
        console.error(`Error processing member ${member.userId}:`, error);
        results.push({
          userId: member.userId,
          status: 'error',
          error: error.message
        });
      }
    }

    console.log(`✅ Weekly matching complete!`);
    console.log(`   - Members processed: ${activatedMembers.length}`);
    console.log(`   - Total PV matched: ${totalMatched}`);
    console.log(`   - Total income: $${totalIncome.toFixed(2)}`);

    return {
      success: true,
      summary: {
        totalMembers: activatedMembers.length,
        totalMatched,
        totalIncome,
        executionTime: new Date()
      },
      results
    };

  } catch (error) {
    console.error("❌ Error in weekly matching:", error);
    throw error;
  }
};

/**
 * Get binary status for a user
 */
export const getBinaryStatus = async (userId) => {
  try {
    const member = await TeamMember.findOne({ userId });
    if (!member) {
      return { success: false, message: "Member not found" };
    }

    const activation = checkBinaryActivation(member.leftLegCount, member.rightLegCount);
    const rank = calculateBinaryRank(member.totalActiveAffiliates);
    
    const leftPV = member.leftLegPV + member.carryForwardLeftPV;
    const rightPV = member.rightLegPV + member.carryForwardRightPV;
    const matchedVolume = Math.min(leftPV, rightPV);
    const potentialIncome = matchedVolume * (rank.bonusPercent / 100);

    // Check inactivity
    const daysSinceActivity = Math.floor(
      (new Date() - member.lastActivityDate) / (1000 * 60 * 60 * 24)
    );
    const daysUntilReset = Math.max(0, INACTIVITY_DAYS - daysSinceActivity);

    return {
      success: true,
      data: {
        // Activation Status
        activated: member.binaryActivated,
        activationDate: member.binaryActivationDate,
        activationMessage: activation.message,
        
        // Current PV
        leftLegCount: member.leftLegCount,
        rightLegCount: member.rightLegCount,
        leftLegPV: member.leftLegPV,
        rightLegPV: member.rightLegPV,
        carryForwardLeftPV: member.carryForwardLeftPV,
        carryForwardRightPV: member.carryForwardRightPV,
        totalLeftPV: leftPV,
        totalRightPV: rightPV,
        
        // Matching Info
        matchedVolume,
        potentialIncome: potentialIncome.toFixed(2),
        rank: rank.name,
        rankPercentage: rank.bonusPercent,
        
        // Activity
        lastActivityDate: member.lastActivityDate,
        daysSinceActivity,
        daysUntilReset,
        inactivityWarning: daysSinceActivity >= 60 ? 'Warning: Close to 90-day inactivity reset' : null,
        
        // Stats
        totalMatchedPV: member.totalMatchedPV,
        totalBinaryIncome: member.totalBinaryIncome,
        lastMatchDate: member.lastBinaryMatchDate,
        weeklyBinaryIncome: member.weeklyBinaryIncome
      }
    };
  } catch (error) {
    console.error("Error getting binary status:", error);
    return { success: false, message: error.message };
  }
};

/**
 * Manual trigger for testing
 */
export const triggerWeeklyMatchingNow = async () => {
  console.log("🧪 Manual trigger: Weekly matching");
  return await executeWeeklyMatching();
};

export default {
  checkBinaryActivation,
  addPVToLeg,
  executeWeeklyMatching,
  getBinaryStatus,
  triggerWeeklyMatchingNow,
  PV_PER_SUBSCRIPTION,
  INACTIVITY_DAYS
};
