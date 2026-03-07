import { TeamMember, Referral, Bonus } from "../../models/teamModel.js";
import Commission from "../../models/commissionModel.js";
import Payout from "../../models/payoutModel.js";
import User from "../../models/authModel.js";
import BinaryReward from "../../models/binaryRewardModel.js";
import { v4 as uuidv4 } from "uuid";
import { getRewardForRank } from "../../config/binaryRewardConfig.js";
import {
  calculateDirectBonus,
  calculateLevelIncome,
  getDirectBonusSlab,
  generateBonusBreakdown,
  getNextMilestone,
  checkLevelIncomQualification,
} from "../../helpers/bonusCalculator.js";
import {
  isBinaryActivated,
  calculateBinaryRank,
  calculateBinaryCommission,
  getNextRankInfo,
  getRankBadge,
  getRankColor,
} from "../../helpers/binaryRankHelper.js";
import logger from "../../helpers/logger.js";

const teamLogger = logger.module("TEAM_CONTROLLER");

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate unique referral code for a user
 */
export const generateReferralCode = (userId) => {
  return `PRO-${userId.toString().slice(-6).toUpperCase()}-${uuidv4().slice(0, 8).toUpperCase()}`;
};

/**
 * Generate left team referral code (Lpro)
 */
export const generateLeftReferralCode = (userId) => {
  return `LPRO-${userId.toString().slice(-6).toUpperCase()}-${uuidv4().slice(0, 8).toUpperCase()}`;
};

/**
 * Generate right team referral code (Rpro)
 */
export const generateRightReferralCode = (userId) => {
  return `RPRO-${userId.toString().slice(-6).toUpperCase()}-${uuidv4().slice(0, 8).toUpperCase()}`;
};

// Get or Create Team Member
export const getOrCreateTeamMember = async (userId) => {
  try {
    teamLogger.start("Getting or creating team member", { userId });

    let teamMember = await TeamMember.findOne({ userId }).populate("sponsorId");

    if (!teamMember) {
      const referralCode = generateReferralCode(userId);
      const leftReferralCode = generateLeftReferralCode(userId);
      const rightReferralCode = generateRightReferralCode(userId);
      teamLogger.debug("Creating new team member", { userId, referralCode, leftReferralCode, rightReferralCode });

      teamMember = new TeamMember({
        userId,
        referralCode,
        leftReferralCode,
        rightReferralCode,
      });
      
      try {
        await teamMember.save();
        teamLogger.success("New team member created", { userId, referralCode, leftReferralCode, rightReferralCode });
      } catch (saveError) {
        // Handle duplicate key error (race condition)
        if (saveError.code === 11000) {
          teamLogger.debug("Team member already exists (race condition), fetching existing", { userId });
          teamMember = await TeamMember.findOne({ userId }).populate("sponsorId");
          if (!teamMember) {
            throw new Error("Failed to create or find team member");
          }
        } else {
          throw saveError;
        }
      }
    } else {
      teamLogger.debug("Team member found", { userId });
    }

    return {
      success: true,
      teamMember,
    };
  } catch (error) {
    teamLogger.error("Error getting or creating team member", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Set Sponsor/Upline
export const setSponsor = async (userId, sponsorId) => {
  try {
    teamLogger.start("Setting sponsor for team member", { userId, sponsorId });

    const teamMember = await TeamMember.findOne({ userId });

    if (!teamMember) {
      teamLogger.warn("Team member not found for sponsor assignment", { userId });
      return {
        success: false,
        message: "Team member not found",
      };
    }

    if (teamMember.sponsorId) {
      teamLogger.warn("Sponsor already assigned to team member", { userId });
      return {
        success: false,
        message: "Sponsor already assigned",
      };
    }

    const sponsor = await TeamMember.findOne({ userId: sponsorId });
    if (!sponsor) {
      teamLogger.warn("Sponsor not found", { sponsorId });
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

    // Update totalActiveAffiliates (entire team count)
    // Note: leftLegCount and rightLegCount already include all members in those legs
    sponsor.totalActiveAffiliates = sponsor.leftLegCount + sponsor.rightLegCount;

    // Recalculate binary rank based on totalActiveAffiliates
    const rankData = calculateBinaryRank(sponsor.totalActiveAffiliates);
    sponsor.binaryRank = rankData.name;
    sponsor.binaryBonusPercent = rankData.bonusPercent;

    // Track highest rank achieved (never decreases)
    const rankHierarchy = ["NONE", "IGNITOR", "SPARK", "RISER", "PIONEER", "INNOVATOR", "TRAILBLAZER", "CATALYST", "MOGUL", "VANGUARD", "LUMINARY", "SOVEREIGN", "ZENITH"];
    const currentRankIndex = rankHierarchy.indexOf(sponsor.binaryRank);
    const highestRankIndex = rankHierarchy.indexOf(sponsor.highestRankAchieved || "NONE");
    
    if (currentRankIndex > highestRankIndex) {
      sponsor.highestRankAchieved = sponsor.binaryRank;
      sponsor.highestRankAchievedDate = new Date();
      teamLogger.info("New highest rank achieved", {
        userId: sponsor.userId,
        newRank: sponsor.binaryRank,
        previousRank: sponsor.highestRankAchieved,
      });
    }

    // Calculate weaker leg PV
    sponsor.weakerLegPV = Math.min(sponsor.leftLegPV || 0, sponsor.rightLegPV || 0);

    // Check if binary system is activated (2:1 or 1:2 ratio achieved)
    sponsor.binaryActivated = (sponsor.leftLegCount >= 2 && sponsor.rightLegCount >= 1) || (sponsor.leftLegCount >= 1 && sponsor.rightLegCount >= 2);

    await sponsor.save();

    teamLogger.success("Sponsor assigned successfully", {
      userId,
      sponsorId,
      directCount: sponsor.directCount,
      totalActiveAffiliates: sponsor.totalActiveAffiliates,
      binaryRank: sponsor.binaryRank,
    });

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

/**
 * Update upline leg totals (leftLegTotal/rightLegTotal) up the chain
 */
const updateUplineLegTotals = async (userId, legPosition) => {
  try {
    let currentMember = await TeamMember.findOne({ userId });
    
    while (currentMember && currentMember.sponsorId) {
      const sponsor = await TeamMember.findOne({ userId: currentMember.sponsorId });
      if (!sponsor) break;

      // Update the appropriate leg total based on the position
      if (currentMember.position === "left") {
        sponsor.leftLegTotal = (sponsor.leftLegTotal || 0) + 1;
      } else if (currentMember.position === "right") {
        sponsor.rightLegTotal = (sponsor.rightLegTotal || 0) + 1;
      }

      await sponsor.save();
      currentMember = sponsor;
    }
  } catch (error) {
    teamLogger.error("Error updating upline leg totals", error);
  }
};

/**
 * Update upline totalDownline count up the chain
 */
const updateUplineTotalDownline = async (userId) => {
  try {
    let currentMember = await TeamMember.findOne({ userId });
    
    while (currentMember && currentMember.sponsorId) {
      const sponsor = await TeamMember.findOne({ userId: currentMember.sponsorId });
      if (!sponsor) break;

      sponsor.totalDownline = (sponsor.totalDownline || 0) + 1;
      await sponsor.save();
      
      currentMember = sponsor;
    }
  } catch (error) {
    teamLogger.error("Error updating upline total downline", error);
  }
};

/**
 * Find Next Available Position for Spillover
 * Uses BFS (Breadth-First Search) to find the first available spot in the binary tree
 */
const findNextAvailablePosition = async (startSponsor) => {
  try {
    const queue = [];
    const visited = new Set();
    
    // Start BFS from the sponsor
    queue.push(startSponsor);
    visited.add(startSponsor.userId.toString());

    while (queue.length > 0) {
      const currentSponsor = queue.shift();

      // Check if left leg has space
      if (currentSponsor.leftLegCount < 2) {
        teamLogger.info("Found available left position", {
          sponsorId: currentSponsor.userId,
          leftLegCount: currentSponsor.leftLegCount,
        });
        return {
          actualSponsor: currentSponsor,
          position: "left",
        };
      }

      // Check if right leg has space
      if (currentSponsor.rightLegCount < 2) {
        teamLogger.info("Found available right position", {
          sponsorId: currentSponsor.userId,
          rightLegCount: currentSponsor.rightLegCount,
        });
        return {
          actualSponsor: currentSponsor,
          position: "right",
        };
      }

      // Both legs are full, add children to queue for BFS
      // Find left and right leg members
      const leftLegMembers = await TeamMember.find({
        sponsorId: currentSponsor.userId,
        position: "left",
      });

      const rightLegMembers = await TeamMember.find({
        sponsorId: currentSponsor.userId,
        position: "right",
      });

      // Add left leg members to queue
      for (const member of leftLegMembers) {
        const memberId = member.userId.toString();
        if (!visited.has(memberId)) {
          queue.push(member);
          visited.add(memberId);
        }
      }

      // Add right leg members to queue
      for (const member of rightLegMembers) {
        const memberId = member.userId.toString();
        if (!visited.has(memberId)) {
          queue.push(member);
          visited.add(memberId);
        }
      }
    }

    // No available position found
    teamLogger.warn("No available position found in the network");
    return null;
  } catch (error) {
    teamLogger.error("Error finding next available position", error);
    return null;
  }
};

/**
 * Validate Binary Referral Code
 * 
 * Binary System 2:1 or 1:2 Activation:
 * - LPRO/RPRO codes limited to 2 members each (until 2:1 or 1:2 achieved)
 * - After 2:1 or 1:2 achieved: unlimited growth in both legs
 * - Binary commission: Calculated after 2:1 or 1:2 ratio achieved (rank-based percentage)
 */
export const validateBinaryReferralCode = async (referralCode) => {
  try {
    teamLogger.start("Validating binary referral code", { referralCode });

    // Check if it's LPRO or RPRO
    if (!referralCode.startsWith("LPRO-") && !referralCode.startsWith("RPRO-")) {
      // Regular PRO code - no binary restriction
      const sponsor = await TeamMember.findOne({ referralCode });
      if (!sponsor) {
        return {
          success: false,
          message: "Invalid referral code",
        };
      }
      return {
        success: true,
        sponsor,
        position: "main",
        isAvailable: true,
      };
    }

    // Binary code validation (LPRO or RPRO)
    const isLeftCode = referralCode.startsWith("LPRO-");
    const isRightCode = referralCode.startsWith("RPRO-");

    const sponsor = await TeamMember.findOne({
      $or: [{ leftReferralCode: referralCode }, { rightReferralCode: referralCode }],
    });

    if (!sponsor) {
      teamLogger.warn("Sponsor not found for binary referral code", { referralCode });
      return {
        success: false,
        message: "Invalid referral code",
      };
    }

    // Check if 2:2 is already achieved (binary activation criteria)
    const has2x2 = sponsor.leftLegCount >= 2 && sponsor.rightLegCount >= 2;
    const binaryActivated = has2x2;
    
    
    teamLogger.info("Binary referral validation", {
      sponsorId: sponsor.userId,
      directCount: sponsor.directCount,
      binaryActivated: binaryActivated,
      has2x2: has2x2,
      leftLegCount: sponsor.leftLegCount,
      rightLegCount: sponsor.rightLegCount,
      requestedPosition: isLeftCode ? "left" : "right",
    });

    if (has2x2) {
      // After 2:2 is achieved, accept ANY code and place directly - NO SPILLOVER
      const position = isLeftCode ? "left" : "right";
      const currentCount = isLeftCode ? sponsor.leftLegCount : sponsor.rightLegCount;
      
      let message = `✅ Joining ${position} leg! Parent has achieved 2:2, all new members are direct referrals.`;
      if (binaryActivated) {
        message += ` Binary bonus active! Rank-based commission applies.`;
      }
      
      return {
        success: true,
        sponsor,
        position: position,
        isAvailable: true,
        currentCount: currentCount,
        binaryActivated: binaryActivated,
        message: message,
      };
    }

    // Still building initial 2:2 - enforce the 2-member limit per leg
    if (isLeftCode) {
      if (sponsor.leftLegCount >= 2) {
        // Left is full, check if right is available
        if (sponsor.rightLegCount < 2) {
          teamLogger.warn("Left leg full, right leg available - suggest RPRO", {
            sponsorId: sponsor.userId,
            leftLegCount: sponsor.leftLegCount,
            rightLegCount: sponsor.rightLegCount,
          });
          return {
            success: false,
            message: "This left position (LPRO) is full (2/2). Please use the right position code (RPRO) instead.",
            legFull: true,
            position: "left",
            currentCount: sponsor.leftLegCount,
          };
        }
      }

      return {
        success: true,
        sponsor,
        position: "left",
        isAvailable: true,
        currentCount: sponsor.leftLegCount,
        binaryActivated: binaryActivated,
      };
    }

    if (isRightCode) {
      if (sponsor.rightLegCount >= 2) {
        // Right is full, check if left is available
        if (sponsor.leftLegCount < 2) {
          teamLogger.warn("Right leg full, left leg available - suggest LPRO", {
            sponsorId: sponsor.userId,
            leftLegCount: sponsor.leftLegCount,
            rightLegCount: sponsor.rightLegCount,
          });
          return {
            success: false,
            message: "This right position (RPRO) is full (2/2). Please use the left position code (LPRO) instead.",
            legFull: true,
            position: "right",
            currentCount: sponsor.rightLegCount,
          };
        }
      }

      return {
        success: true,
        sponsor,
        position: "right",
        isAvailable: true,
        currentCount: sponsor.rightLegCount,
        binaryActivated: binaryActivated,
      };
    }

    return {
      success: false,
      message: "Invalid referral code format",
    };
  } catch (error) {
    teamLogger.error("Error validating binary referral code", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Set Sponsor with Binary Position
 * Enhanced version that handles LPRO/RPRO placement
 */
export const setSponsorWithBinaryPosition = async (userId, referralCode) => {
  try {
    teamLogger.start("Setting sponsor with binary position", { userId, referralCode });

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

    // Validate referral code
    const validation = await validateBinaryReferralCode(referralCode);
    if (!validation.success) {
      return validation;
    }

    const { sponsor, position } = validation;

    // Direct placement under sponsor (NO SPILLOVER - everyone placed directly)
    // Set sponsor and position
    teamMember.sponsorId = sponsor.userId;
    teamMember.position = position;
    await teamMember.save();

    // Update sponsor's team (prevent duplicates)
    if (!sponsor.teamMembers.some(id => id.toString() === userId.toString())) {
      sponsor.teamMembers.push(userId);
      // Increment directCount because user used sponsor's referral code directly
      sponsor.directCount += 1;
    }

    // Update binary leg counts (NO LIMIT - track count but don't mark as full)
    if (position === "left") {
      sponsor.leftLegCount += 1;
    } else if (position === "right") {
      sponsor.rightLegCount += 1;
    }

    // Update totalActiveAffiliates (entire team count)
    // Note: leftLegCount and rightLegCount already include all members in those legs
    sponsor.totalActiveAffiliates = sponsor.leftLegCount + sponsor.rightLegCount;

    // Recalculate binary rank based on totalActiveAffiliates
    const rankData = calculateBinaryRank(sponsor.totalActiveAffiliates);
    sponsor.binaryRank = rankData.name;
    sponsor.binaryBonusPercent = rankData.bonusPercent;

    // Track highest rank achieved (never decreases)
    const rankHierarchy = ["NONE", "IGNITOR", "SPARK", "RISER", "PIONEER", "INNOVATOR", "TRAILBLAZER", "CATALYST", "MOGUL", "VANGUARD", "LUMINARY", "SOVEREIGN", "ZENITH"];
    const currentRankIndex = rankHierarchy.indexOf(sponsor.binaryRank);
    const highestRankIndex = rankHierarchy.indexOf(sponsor.highestRankAchieved || "NONE");
    
    if (currentRankIndex > highestRankIndex) {
      sponsor.highestRankAchieved = sponsor.binaryRank;
      sponsor.highestRankAchievedDate = new Date();
      teamLogger.info("New highest rank achieved", {
        userId: sponsor.userId,
        newRank: sponsor.binaryRank,
      });
    }

    // Calculate weaker leg PV
    sponsor.weakerLegPV = Math.min(sponsor.leftLegPV || 0, sponsor.rightLegPV || 0);

    // Check if binary system is activated (2:1 or 1:2 ratio achieved)
    sponsor.binaryActivated = (sponsor.leftLegCount >= 2 && sponsor.rightLegCount >= 1) || (sponsor.leftLegCount >= 1 && sponsor.rightLegCount >= 2);

    await sponsor.save();

    // Update sponsor's level based on new directCount
    await updateUserLevel(sponsor.userId);

    // 💰 GENERATE COMMISSIONS (Direct Bonus, Level Income)
    console.log('\n' + '='.repeat(80));
    console.log('🎯 [BINARY JOIN] COMMISSION GENERATION STARTING');
    console.log('='.repeat(80));
    console.log('   New Member ID:', userId);
    console.log('   Sponsor ID:', sponsor.userId);
    console.log('   Sponsor DirectCount:', sponsor.directCount);
    console.log('   Position:', position);
    console.log('   Referral Code:', referralCode);
    console.log('='.repeat(80) + '\n');

    try {
      const { generateDirectBonusOnJoin, generateLevelIncomesOnJoin } = await import('../../helpers/commissionService.js');
      const PACKAGE_PRICE = 135;

      console.log('✅ Commission service imported successfully');

      // Generate Direct Bonus for sponsor
      console.log('\n💰 [STEP 1/2] Generating direct bonus for sponsor...');
      console.log('   Sponsor directCount:', sponsor.directCount);
      console.log('   Expected percentage:', sponsor.directCount >= 10 ? '33.4%' : sponsor.directCount >= 7 ? '25%' : sponsor.directCount >= 4 ? '16.68%' : '8.34%');

      const directBonus = await generateDirectBonusOnJoin(sponsor, userId, PACKAGE_PRICE);

      if (directBonus) {
        console.log('\n✅ ✅ ✅ DIRECT BONUS SUCCESSFULLY CREATED! ✅ ✅ ✅');
        console.log('   Commission ID:', directBonus._id);
        console.log('   Sponsor:', sponsor.userId);
        console.log('   Amount: $' + directBonus.netAmount.toFixed(2));
        console.log('   Percentage:', directBonus.metadata?.bonusPercentage + '%');
        console.log('   Status:', directBonus.status);
        console.log('   Description:', directBonus.description);

        teamLogger.success("💰 Direct bonus generated", {
          sponsorId: sponsor.userId,
          newMemberId: userId,
          amount: directBonus.netAmount,
          commissionId: directBonus._id
        });
      } else {
        console.log('\n⚠️  ⚠️  ⚠️  WARNING: No direct bonus created');
        console.log('   Reason: Check logs above for details');
        console.log('   Sponsor directCount:', sponsor.directCount);
      }

      // Generate Level Income for upline
      console.log('\n💰 [STEP 2/2] Generating level income for upline...');
      const levelIncomes = await generateLevelIncomesOnJoin(sponsor.userId, userId, PACKAGE_PRICE);

      if (levelIncomes && levelIncomes.length > 0) {
        console.log('\n✅ LEVEL INCOMES CREATED:', levelIncomes.length, 'commission(s)');
        levelIncomes.forEach((income, idx) => {
          console.log(`   Level ${income.level}: $${income.netAmount.toFixed(2)} (Commission ID: ${income._id})`);
        });

        teamLogger.success("💰 Level incomes generated", {
          count: levelIncomes.length,
          totalAmount: levelIncomes.reduce((sum, c) => sum + c.netAmount, 0)
        });
      } else {
        console.log('\nℹ️  No level incomes created (upline might not qualify or no upline exists)');
      }

      console.log('\n' + '='.repeat(80));
      console.log('✅ COMMISSION GENERATION COMPLETE!');
      console.log('   Direct Bonus:', directBonus ? `$${directBonus.netAmount.toFixed(2)}` : 'None');
      console.log('   Level Incomes:', levelIncomes?.length || 0, 'commission(s)');
      console.log('='.repeat(80) + '\n');

    } catch (commissionError) {
      console.log('\n' + '='.repeat(80));
      console.error('❌ ❌ ❌ ERROR GENERATING COMMISSIONS ❌ ❌ ❌');
      console.error('Error Name:', commissionError.name);
      console.error('Error Message:', commissionError.message);
      console.error('Error Stack:', commissionError.stack);
      console.log('='.repeat(80) + '\n');

      teamLogger.error("⚠️ Error generating commissions", {
        error: commissionError.message,
        stack: commissionError.stack
      });
      // Don't fail the join process if commission generation fails
    }

    teamLogger.success("Sponsor assigned with binary position", {
      userId,
      sponsorId: sponsor.userId,
      position,
      leftLegCount: sponsor.leftLegCount,
      rightLegCount: sponsor.rightLegCount,
      totalActiveAffiliates: sponsor.totalActiveAffiliates,
      binaryRank: sponsor.binaryRank,
    });

    return {
      success: true,
      message: "Sponsor assigned successfully",
      teamMember,
      position,
      sponsorLeftLegCount: sponsor.leftLegCount,
      sponsorRightLegCount: sponsor.rightLegCount,
    };
  } catch (error) {
    teamLogger.error("Error setting sponsor with binary position", error);
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
        leftReferralCode: teamMember.leftReferralCode,
        rightReferralCode: teamMember.rightReferralCode,
        sponsor: teamMember.sponsorId,
        directCount,
        teamMembers: teamMember.teamMembers,
        level: teamMember.level,
        levelQualified,
        levelQualifiedDate: teamMember.levelQualifiedDate,
        totalDownline: teamMember.totalDownline,
        // Binary Tree Information
        binaryTree: {
          leftLegCount: teamMember.leftLegCount,
          rightLegCount: teamMember.rightLegCount,
          leftLegPV: teamMember.leftLegPV,
          rightLegPV: teamMember.rightLegPV,
          leftLegFull: teamMember.leftLegFull,
          rightLegFull: teamMember.rightLegFull,
          leftReferralActive: teamMember.leftReferralActive,
          rightReferralActive: teamMember.rightReferralActive,
          lproAvailable: !teamMember.leftLegFull && teamMember.leftReferralActive,
          rproAvailable: !teamMember.rightLegFull && teamMember.rightReferralActive,
        },
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

    // Return summary without trying to update non-existent Commission fields
    const pendingCommissions = await Commission.find({ 
      userId,
      status: 'pending'
    });
    
    const totalPending = pendingCommissions.reduce((sum, c) => sum + c.netAmount, 0);

    return {
      success: true,
      message: "Bonuses processed successfully",
      totalBonusGenerated: totalBonus,
      totalPending,
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
    // Aggregate commission data from existing records
    const commissions = await Commission.find({ userId });
    
    const stats = {
      totalPending: 0,
      totalApproved: 0,
      totalPaid: 0,
      totalRejected: 0,
      totalCommission: 0,
      byType: {
        direct_bonus: 0,
        level_income: 0,
        binary_bonus: 0,
        reward_bonus: 0,
      },
    };

    commissions.forEach((comm) => {
      stats.totalCommission += comm.netAmount;
      
      switch (comm.status) {
        case 'pending':
          stats.totalPending += comm.netAmount;
          break;
        case 'approved':
        case 'processing':
          stats.totalApproved += comm.netAmount;
          break;
        case 'paid':
          stats.totalPaid += comm.netAmount;
          break;
        case 'rejected':
        case 'cancelled':
          stats.totalRejected += comm.netAmount;
          break;
      }
      
      if (stats.byType[comm.commissionType] !== undefined) {
        stats.byType[comm.commissionType] += comm.netAmount;
      }
    });

    return {
      success: true,
      commission: stats,
      records: commissions.slice(0, 10), // Return latest 10 records
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

    // Determine level based on directCount thresholds
    if (directCount >= 40) {
      newLevel = 4;
    } else if (directCount >= 30) {
      newLevel = 3;
    } else if (directCount >= 20) {
      newLevel = 2;
    } else if (directCount >= 10) {
      newLevel = 1;
    }

    // Set levelQualified flag and date when first reaching level 1
    if (newLevel >= 1 && !teamMember.levelQualified) {
      teamMember.levelQualified = true;
      teamMember.levelQualifiedDate = new Date();
    }

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

// ==================== REFERRAL API FUNCTIONS ====================

// Debug endpoint - check authentication status
export const debugAuth = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return {
        success: false,
        message: "User not found",
      };
    }
    return {
      success: true,
      message: "Authentication successful",
      userInfo: {
        userId: user._id,
        userRole: user.role,
        email: user.email,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
    };
  }
};

// Initialize team membership
export const initMembership = async (userId) => {
  try {
    teamLogger.start("Initializing team membership", { userId });

    let teamMember = await TeamMember.findOne({ userId });

    if (teamMember) {
      return {
        success: true,
        message: "User is already a team member",
        data: teamMember,
      };
    }

    const referralCode = generateReferralCode(userId);
    const leftReferralCode = generateLeftReferralCode(userId);
    const rightReferralCode = generateRightReferralCode(userId);
    teamMember = new TeamMember({
      userId,
      referralCode,
      leftReferralCode,
      rightReferralCode,
      isActive: true,
    });

    try {
      await teamMember.save();
      teamLogger.success("Team membership created", { userId, referralCode, leftReferralCode, rightReferralCode });
    } catch (saveError) {
      // Handle duplicate key error (race condition)
      if (saveError.code === 11000) {
        teamLogger.debug("Team member already exists (race condition), fetching existing", { userId });
        teamMember = await TeamMember.findOne({ userId });
        if (!teamMember) {
          throw new Error("Failed to create or find team member");
        }
        return {
          success: true,
          message: "User is already a team member",
          data: teamMember,
        };
      } else {
        throw saveError;
      }
    }

    return {
      success: true,
      message: "Team membership created successfully",
      data: teamMember,
    };
  } catch (error) {
    teamLogger.error("Error initializing team membership", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Check team member status
export const checkMemberStatus = async (userId) => {
  try {
    const teamMember = await TeamMember.findOne({ userId });

    if (!teamMember) {
      return {
        success: true,
        isTeamMember: false,
        message: "User is not yet a team member",
      };
    }

    // Calculate current rank based on total active affiliates
    const totalActiveAffiliates = teamMember.totalActiveAffiliates || 0;
    const rankData = calculateBinaryRank(totalActiveAffiliates);
    const calculatedRank = rankData.name; // rank object has 'name' property
    
    // Calculate PV dynamically based on leg counts
    const leftLegCount = teamMember.leftLegCount || 0;
    const rightLegCount = teamMember.rightLegCount || 0;
    const leftLegPV = leftLegCount * 94.5;
    const rightLegPV = rightLegCount * 94.5;
    const weakerLegPV = Math.min(leftLegPV, rightLegPV);
    
    // Calculate 1:2 matching commission
    const binaryCommission = calculateBinaryCommission(
      leftLegCount,
      rightLegCount,
      leftLegPV,
      rightLegPV,
      totalActiveAffiliates
    );
    
    // Check if current rank is higher than highest achieved
    const rankHierarchy = ["NONE", "IGNITOR", "SPARK", "RISER", "PIONEER", "INNOVATOR", "TRAILBLAZER", "CATALYST", "MOGUL", "VANGUARD", "LUMINARY", "SOVEREIGN", "ZENITH"];
    const currentRankIndex = rankHierarchy.indexOf(calculatedRank);
    const highestRankIndex = rankHierarchy.indexOf(teamMember.highestRankAchieved || "NONE");
    
    let rankUpdated = false;
    if (currentRankIndex > highestRankIndex) {
      teamMember.binaryRank = calculatedRank;
      teamMember.binaryBonusPercent = rankData.bonusPercent;
      teamMember.highestRankAchieved = calculatedRank;
      teamMember.highestRankAchievedDate = new Date();
      await teamMember.save();
      rankUpdated = true;
      teamLogger.info(`Rank updated for userId ${userId}: ${calculatedRank} (${totalActiveAffiliates} affiliates)`);
    } else {
      // Update current rank even if not highest (user might have lost affiliates)
      teamMember.binaryRank = calculatedRank;
      teamMember.binaryBonusPercent = rankData.bonusPercent;
      await teamMember.save();
    }

    return {
      success: true,
      isTeamMember: true,
      rankUpdated,
      data: {
        referralCode: teamMember.referralCode,
        level: teamMember.level,
        directCount: teamMember.directCount,
        totalDownline: teamMember.totalDownline,
        sponsorId: teamMember.sponsorId,
        hasJoinedTeam: !!teamMember.sponsorId,
        // Binary rank data - now calculated dynamically
        binaryActivated: teamMember.binaryActivated || false,
        binaryRank: calculatedRank,
        binaryBonusPercent: rankData.bonusPercent,
        totalActiveAffiliates: totalActiveAffiliates,
        leftLegPV: leftLegPV,
        rightLegPV: rightLegPV,
        leftLegCount: leftLegCount,
        rightLegCount: rightLegCount,
        weakerLegPV: weakerLegPV,
        binaryCommissionEarned: binaryCommission.commission || 0,
        // 1:2 Matching data
        matchedVolume: binaryCommission.matchedVolume || 0,
        matchedLeft: binaryCommission.matchedLeft || 0,
        matchedRight: binaryCommission.matchedRight || 0,
        carryForwardLeft: binaryCommission.carryForwardLeft || 0,
        carryForwardRight: binaryCommission.carryForwardRight || 0,
        lastBinaryCalculation: teamMember.lastBinaryCalculation,
        highestRankAchieved: teamMember.highestRankAchieved || "NONE",
      },
    };
  } catch (error) {
    teamLogger.error("Error checking team status", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Get all team members with statistics
export const getAllTeamMembers = async () => {
  try {
    teamLogger.start("Fetching all team members");

    const members = await TeamMember.find()
      .populate("userId", "fname lname email phone createdAt")
      .populate("sponsorId", "fname lname")
      .sort({ directCount: -1 });

    const stats = await TeamMember.aggregate([
      {
        $group: {
          _id: null,
          totalMembers: { $sum: 1 },
          totalEarnings: { $sum: "$totalEarnings" },
          averageDirects: { $avg: "$directCount" },
          maxDirects: { $max: "$directCount" },
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
      data: {
        members,
        totalMembers: stats[0]?.totalMembers || 0,
        totalEarnings: stats[0]?.totalEarnings || 0,
        averageDirects: stats[0]?.averageDirects || 0,
        levelBreakdown,
      },
    };
  } catch (error) {
    teamLogger.error("Error fetching team members", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Get team statistics
export const getAllTeamStatistics = async () => {
  try {
    teamLogger.start("Fetching team statistics");

    const stats = await TeamMember.aggregate([
      {
        $group: {
          _id: null,
          totalMembers: { $sum: 1 },
          totalEarnings: { $sum: "$totalEarnings" },
          averageDirects: { $avg: "$directCount" },
          maxDirects: { $max: "$directCount" },
          averageEarnings: { $avg: "$totalEarnings" },
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

    const qualifiedMembers = await TeamMember.countDocuments({
      levelQualified: true,
    });

    return {
      success: true,
      data: {
        totalMembers: stats[0]?.totalMembers || 0,
        totalEarnings: stats[0]?.totalEarnings || 0,
        averageDirects: stats[0]?.averageDirects || 0,
        maxDirects: stats[0]?.maxDirects || 0,
        averageEarnings: stats[0]?.averageEarnings || 0,
        levelBreakdown,
        qualifiedMembers,
      },
    };
  } catch (error) {
    teamLogger.error("Error fetching statistics", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Create team member (admin function)
export const createTeamMember = async (userId, sponsorId, packagePrice) => {
  try {
    teamLogger.start("Creating new team member", { userId });

    if (!userId) {
      return {
        success: false,
        message: "User ID is required",
      };
    }

    const user = await User.findById(userId);
    if (!user) {
      return {
        success: false,
        message: "User not found",
      };
    }

    const existingMember = await TeamMember.findOne({ userId });
    if (existingMember) {
      return {
        success: false,
        message: "Team member already exists",
      };
    }

    const referralCode = generateReferralCode(userId);
    const leftReferralCode = generateLeftReferralCode(userId);
    const rightReferralCode = generateRightReferralCode(userId);
    const newMember = new TeamMember({
      userId,
      referralCode,
      leftReferralCode,
      rightReferralCode,
      packagePrice: packagePrice || 0,
    });

    if (sponsorId) {
      const sponsor = await TeamMember.findOne({ userId: sponsorId });
      if (!sponsor) {
        return {
          success: false,
          message: "Sponsor not found",
        };
      }

      newMember.sponsorId = sponsor._id;
      // Prevent duplicates in teamMembers array
      if (!sponsor.teamMembers.some(id => id.toString() === userId.toString())) {
        sponsor.teamMembers.push(userId);
        sponsor.directCount = sponsor.teamMembers.length;
      }
      await sponsor.save();

      teamLogger.success("Sponsor assigned", { userId, sponsorId });
    }

    try {
      await newMember.save();
      teamLogger.success("Team member created", { userId, referralCode, leftReferralCode, rightReferralCode });
    } catch (saveError) {
      // Handle duplicate key error
      if (saveError.code === 11000) {
        teamLogger.debug("Team member already exists (duplicate)", { userId });
        return {
          success: false,
          message: "Team member already exists",
        };
      }
      throw saveError;
    }

    return {
      success: true,
      message: "Team member created successfully",
      data: newMember,
    };
  } catch (error) {
    teamLogger.error("Error creating team member", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Set sponsor for team member
export const setTeamSponsor = async (userId, sponsorId) => {
  try {
    teamLogger.start("Setting sponsor", { userId, sponsorId });

    if (!userId) {
      return {
        success: false,
        message: "User ID is required",
      };
    }

    const member = await TeamMember.findOne({ userId });
    if (!member) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    // If unsetting sponsor
    if (!sponsorId) {
      if (member.sponsorId) {
        const oldSponsor = await TeamMember.findById(member.sponsorId);
        if (oldSponsor) {
          oldSponsor.teamMembers = oldSponsor.teamMembers.filter(
            (id) => id.toString() !== userId
          );
          oldSponsor.directCount = oldSponsor.teamMembers.length;
          await oldSponsor.save();
        }
      }
      member.sponsorId = null;
      await member.save();
      return {
        success: true,
        message: "Sponsor removed successfully",
        data: member,
      };
    }

    // Set new sponsor
    const newSponsor = await TeamMember.findOne({ userId: sponsorId });
    if (!newSponsor) {
      return {
        success: false,
        message: "Sponsor not found",
      };
    }

    // Remove from old sponsor if exists
    if (member.sponsorId) {
      const oldSponsor = await TeamMember.findById(member.sponsorId);
      if (oldSponsor) {
        oldSponsor.teamMembers = oldSponsor.teamMembers.filter(
          (id) => id.toString() !== userId
        );
        oldSponsor.directCount = oldSponsor.teamMembers.length;
        await oldSponsor.save();
      }
    }

    // Add to new sponsor
    member.sponsorId = newSponsor._id;
    newSponsor.teamMembers.push(userId);
    newSponsor.directCount = newSponsor.teamMembers.length;

    await member.save();
    await newSponsor.save();

    teamLogger.success("Sponsor updated", { userId, sponsorId });

    return {
      success: true,
      message: "Sponsor updated successfully",
      data: member,
    };
  } catch (error) {
    teamLogger.error("Error setting sponsor", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Get team network tree
export const getTeamNetworkTree = async (userId, depth = 3) => {
  try {
    teamLogger.start("Fetching team network", { userId });

    const getNetworkTree = async (userId, depth = 3, currentDepth = 0) => {
      if (currentDepth >= depth) return null;

      const teamMember = await TeamMember.findOne({ userId }).populate(
        "teamMembers"
      );

      if (!teamMember) return null;

      const children = await Promise.all(
        teamMember.teamMembers.map((memberId) =>
          getNetworkTree(memberId, depth, currentDepth + 1)
        )
      );

      return {
        userId: teamMember.userId,
        directCount: teamMember.directCount,
        level: teamMember.level,
        totalDownline: teamMember.totalDownline,
        children: children.filter((child) => child !== null),
      };
    };

    const network = await getNetworkTree(userId);

    if (!network) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    teamLogger.success("Network fetched", { userId });

    return {
      success: true,
      data: network,
    };
  } catch (error) {
    teamLogger.error("Error fetching network", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Delete team member
export const deleteTeamMember = async (userId) => {
  try {
    teamLogger.start("Deleting team member", { userId });

    const member = await TeamMember.findOne({ userId });

    if (!member) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    // Remove from sponsor's team
    if (member.sponsorId) {
      const sponsor = await TeamMember.findById(member.sponsorId);
      if (sponsor) {
        sponsor.teamMembers = sponsor.teamMembers.filter(
          (id) => id.toString() !== userId
        );
        sponsor.directCount = sponsor.teamMembers.length;
        await sponsor.save();
      }
    }

    // Reassign downline to sponsor
    if (member.teamMembers.length > 0 && member.sponsorId) {
      const sponsor = await TeamMember.findById(member.sponsorId);
      if (sponsor) {
        for (const downlineId of member.teamMembers) {
          const downlineMember = await TeamMember.findOne({ userId: downlineId });
          if (downlineMember) {
            downlineMember.sponsorId = sponsor._id;
            await downlineMember.save();
            sponsor.teamMembers.push(downlineId);
          }
        }
        sponsor.directCount = sponsor.teamMembers.length;
        await sponsor.save();
      }
    }

    // Delete team member
    await TeamMember.deleteOne({ userId });

    // Delete related records
    await Bonus.deleteMany({ userId });
    await Commission.deleteOne({ userId });
    await Referral.deleteMany({ referrerId: userId });

    teamLogger.success("Team member deleted", { userId });

    return {
      success: true,
      message: "Team member deleted successfully",
    };
  } catch (error) {
    teamLogger.error("Error deleting team member", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Update team member
export const updateTeamMember = async (userId, packagePrice) => {
  try {
    teamLogger.start("Updating team member", { userId });

    const member = await TeamMember.findOne({ userId });

    if (!member) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    if (packagePrice !== undefined) {
      member.packagePrice = packagePrice;
    }

    await member.save();

    teamLogger.success("Team member updated", { userId });

    return {
      success: true,
      message: "Team member updated successfully",
      data: member,
    };
  } catch (error) {
    teamLogger.error("Error updating team member", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Validate referral code
export const validateReferralCode = async (code) => {
  try {
    teamLogger.start("Validating referral code", { code });

    if (!code) {
      return {
        success: false,
        message: "Referral code is required",
      };
    }

    // Check all three types of referral codes
    const teamMember = await TeamMember.findOne({ 
      $or: [
        { referralCode: code },
        { leftReferralCode: code },
        { rightReferralCode: code }
      ]
    }).populate(
      "userId",
      "fname lname email"
    );

    if (!teamMember) {
      return {
        success: false,
        message: "Invalid referral code",
      };
    }

    if (!teamMember.isActive) {
      return {
        success: false,
        message: "Referrer is not active",
      };
    }

    // Determine which type of code was used
    let codeType = "main";
    if (code === teamMember.leftReferralCode) {
      codeType = "left";
    } else if (code === teamMember.rightReferralCode) {
      codeType = "right";
    }

    teamLogger.success("Referral code validated", { code, referrerId: teamMember.userId, codeType });

    return {
      success: true,
      message: "Referral code is valid",
      data: {
        referralCode: code,
        codeType: codeType,
        referrerId: teamMember.userId._id,
        referrerName: `${teamMember.userId.fname} ${teamMember.userId.lname}`,
        referrerLevel: teamMember.level,
        directCount: teamMember.directCount,
      },
    };
  } catch (error) {
    teamLogger.error("Error validating referral code", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Apply referral code
export const applyReferralCode = async (userId, code) => {
  try {
    teamLogger.start("Applying referral code", { code, userId });

    if (!code) {
      return {
        success: false,
        message: "Referral code is required",
      };
    }

    const existingMember = await TeamMember.findOne({ userId });
    
    // Check if user already has a sponsor (already part of a team)
    if (existingMember && existingMember.sponsorId) {
      return {
        success: false,
        message: "You are already part of a team. Cannot join another team.",
      };
    }

    // Validate the referral code
    const referrerMember = await TeamMember.findOne({ 
      $or: [
        { referralCode: code },
        { leftReferralCode: code },
        { rightReferralCode: code }
      ]
    });

    if (!referrerMember) {
      return {
        success: false,
        message: "Invalid referral code",
      };
    }

    // Determine which code type was used
    let codeType = "main";
    if (code === referrerMember.leftReferralCode) {
      codeType = "left";
    } else if (code === referrerMember.rightReferralCode) {
      codeType = "right";
    }

    if (!referrerMember.isActive) {
      return {
        success: false,
        message: "Referrer is not active",
      };
    }

    // Check if user is trying to use their own referral code
    if (existingMember && (existingMember.referralCode === code || existingMember.leftReferralCode === code || existingMember.rightReferralCode === code)) {
      return {
        success: false,
        message: "You cannot use your own referral code",
      };
    }

    let teamMember;
    let isNewMember = false;

    // If user already has a TeamMember record (from init-membership) but no sponsor
    if (existingMember) {
      teamLogger.info("Updating existing member with sponsor", { userId, code, codeType });
      existingMember.sponsorId = referrerMember._id;
      existingMember.position = codeType;
      teamMember = existingMember;
    } else {
      // Create new team member
      teamLogger.info("Creating new team member with sponsor", { userId, code, codeType });
      const newReferralCode = generateReferralCode(userId);
      const leftCode = generateLeftReferralCode(userId);
      const rightCode = generateRightReferralCode(userId);
      teamMember = new TeamMember({
        userId,
        sponsorId: referrerMember._id,
        referralCode: newReferralCode,
        leftReferralCode: leftCode,
        rightReferralCode: rightCode,
        position: codeType,
        isActive: true,
      });
      isNewMember = true;
    }

    // Add user to referrer's team (prevent duplicates)
    let shouldGenerateCommission = false;
    if (!referrerMember.teamMembers.some(id => id.toString() === userId.toString())) {
      referrerMember.teamMembers.push(userId);
      referrerMember.directCount = referrerMember.teamMembers.length;
      shouldGenerateCommission = true; // Only generate commission for new joins
      
      console.log('\n📝 [JOIN] Adding new team member:');
      console.log('   Sponsor:', referrerMember.userId);
      console.log('   New DirectCount:', referrerMember.directCount);
      console.log('   New Member:', userId);
    } else {
      console.log('\n⚠️  [JOIN] User already in team, skipping commission generation');
    }

    // Create referral record
    const referral = new Referral({
      referrerId: referrerMember.userId,
      referredUserId: userId,
      referralCode: code,
      status: "approved",
      approvalDate: new Date(),
    });

    // Save all changes
    await Promise.all([
      teamMember.save(),
      referrerMember.save(),
      referral.save(),
    ]);
    
    console.log('✅ [JOIN] Team member, referrer, and referral records saved to database');

    // Update referrer's level if needed
    if (referrerMember.directCount >= 10 && !referrerMember.levelQualified) {
      referrerMember.levelQualified = true;
      referrerMember.levelQualifiedDate = new Date();
      referrerMember.level = 1;
      await referrerMember.save();
    }

    // ⚡ UPDATE LEG COUNTS FOR ENTIRE UPLINE (lpro/rpro) if left or right position
    if (codeType === 'left' || codeType === 'right') {
      try {
        console.log('\n🔄 [LEG COUNT UPDATE] Starting upline leg count update...');
        console.log('   New Member ID:', teamMember._id);
        console.log('   Position:', codeType);
        
        const legCountResult = await updateUplineLegCounts(teamMember._id);
        
        if (legCountResult.success) {
          console.log(`✅ [LEG COUNT UPDATE] Updated ${legCountResult.updatedCount} upline members`);
        } else {
          console.log('⚠️ [LEG COUNT UPDATE] Failed:', legCountResult.message);
        }
      } catch (legCountError) {
        console.error('❌ [LEG COUNT UPDATE] Error:', legCountError.message);
        teamLogger.error("⚠️ Error updating upline leg counts", legCountError);
        // Don't fail the join process if leg count update fails
      }
    }

    // ⚡ ADD PV TO BINARY TREE (lpro/rpro) if left or right position
    if (codeType === 'left' || codeType === 'right') {
      try {
        const { addPVToLeg } = await import('../../helpers/binaryMatchingService.js');
        const pvAmount = 94.5; // Standard PV per member
        // sponsorId in database stores User _id, so referrerMember.userId is the User _id
        await addPVToLeg(referrerMember.userId, codeType, pvAmount);
        
        teamLogger.success("✅ PV added to binary tree", {
          sponsorUserId: referrerMember.userId,
          position: codeType,
          pvAmount,
          newMemberId: userId
        });
      } catch (pvError) {
        teamLogger.error("⚠️ Error adding PV to binary tree", pvError);
        // Don't fail the join process if PV addition fails
      }
    }

    // 💰 GENERATE COMMISSIONS (Direct Bonus, Level Income, etc.)
    if (!shouldGenerateCommission) {
      console.log('\n' + '='.repeat(80));
      console.log('⏭️  [JOIN] SKIPPING COMMISSION GENERATION (duplicate join)');
      console.log('='.repeat(80) + '\n');
    } else {
      console.log('\n' + '='.repeat(80));
      console.log('🎯 [JOIN] COMMISSION GENERATION STARTING');
      console.log('='.repeat(80));
    console.log('   New Member ID:', userId);
    console.log('   New Member Name:', user.fname, user.lname);
    console.log('   Sponsor ID:', referrerMember.userId);
    console.log('   Sponsor DirectCount:', referrerMember.directCount);
    console.log('   Position:', codeType);
    console.log('='.repeat(80) + '\n');
    
    try {
      const { generateDirectBonusOnJoin, generateLevelIncomesOnJoin } = await import('../../helpers/commissionService.js');
      const PACKAGE_PRICE = 135;
      
      console.log('✅ Commission service imported successfully');
      
      // Generate Direct Bonus for sponsor
      console.log('\n💰 [STEP 1/2] Generating direct bonus for sponsor...');
      console.log('   Sponsor directCount:', referrerMember.directCount);
      console.log('   Expected percentage:', referrerMember.directCount >= 10 ? '33.4%' : referrerMember.directCount >= 7 ? '25%' : referrerMember.directCount >= 4 ? '16.68%' : '8.34%');
      
      const directBonus = await generateDirectBonusOnJoin(referrerMember, userId, PACKAGE_PRICE);
      
      if (directBonus) {
        console.log('\n✅ ✅ ✅ DIRECT BONUS SUCCESSFULLY CREATED! ✅ ✅ ✅');
        console.log('   Commission ID:', directBonus._id);
        console.log('   Sponsor:', referrerMember.userId);
        console.log('   Amount: $' + directBonus.netAmount.toFixed(2));
        console.log('   Percentage:', directBonus.metadata?.bonusPercentage + '%');
        console.log('   Status:', directBonus.status);
        console.log('   Description:', directBonus.description);
        
        teamLogger.success("💰 Direct bonus generated", {
          sponsorId: referrerMember.userId,
          newMemberId: userId,
          amount: directBonus.netAmount,
          commissionId: directBonus._id
        });
      } else {
        console.log('\n⚠️  ⚠️  ⚠️  WARNING: No direct bonus created');
        console.log('   Reason: Check logs above for details');
        console.log('   Sponsor directCount:', referrerMember.directCount);
      }
      
      // Generate Level Income for upline
      console.log('\n💰 [STEP 2/2] Generating level income for upline...');
      const levelIncomes = await generateLevelIncomesOnJoin(referrerMember.userId, userId, PACKAGE_PRICE);
      
      if (levelIncomes && levelIncomes.length > 0) {
        console.log('\n✅ LEVEL INCOMES CREATED:', levelIncomes.length, 'commission(s)');
        levelIncomes.forEach((income, idx) => {
          console.log(`   Level ${income.level}: $${income.netAmount.toFixed(2)} (Commission ID: ${income._id})`);
        });
        
        teamLogger.success("💰 Level incomes generated", {
          count: levelIncomes.length,
          totalAmount: levelIncomes.reduce((sum, c) => sum + c.netAmount, 0)
        });
      } else {
        console.log('\nℹ️  No level incomes created (upline might not qualify or no upline exists)');
      }
      
      console.log('\n' + '='.repeat(80));
      console.log('✅ COMMISSION GENERATION COMPLETE!');
      console.log('   Direct Bonus:', directBonus ? `$${directBonus.netAmount.toFixed(2)}` : 'None');
      console.log('   Level Incomes:', levelIncomes?.length || 0, 'commission(s)');
      console.log('='.repeat(80) + '\n');
      
    } catch (commissionError) {
      console.log('\n' + '='.repeat(80));
      console.error('❌ ❌ ❌ ERROR GENERATING COMMISSIONS ❌ ❌ ❌');
      console.error('Error Name:', commissionError.name);
      console.error('Error Message:', commissionError.message);
      console.error('Error Stack:', commissionError.stack);
      console.log('='.repeat(80) + '\n');
      
      teamLogger.error("⚠️ Error generating commissions", {
        error: commissionError.message,
        stack: commissionError.stack
      });
      // Don't fail the join process if commission generation fails
    }
    } // End of commission generation if-else block

    teamLogger.success("Referral code applied successfully", {
      code,
      userId,
      sponsorId: referrerMember.userId,
      isNewMember,
    });

    return {
      success: true,
      message: "Successfully joined team using referral code",
      data: {
        teamMember,
        referrerInfo: {
          id: referrerMember.userId,
          level: referrerMember.level,
          directCount: referrerMember.directCount,
        },
      },
    };
  } catch (error) {
    teamLogger.error("Error applying referral code", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Get referral code info for user
export const getMyReferralCode = async (userId) => {
  try {
    teamLogger.start("Getting user referral code", { userId });

    const teamMember = await TeamMember.findOne({ userId })
      .populate("userId", "fname lname email");

    if (!teamMember) {
      return {
        success: false,
        message: "Team member not found. Please create team membership first.",
      };
    }

    // Get sponsor information if sponsorId exists
    let sponsorInfo = null;
    if (teamMember.sponsorId) {
      const sponsorMember = await TeamMember.findById(teamMember.sponsorId)
        .populate("userId", "fname lname email");
      
      if (sponsorMember && sponsorMember.userId) {
        sponsorInfo = {
          name: `${sponsorMember.userId.fname} ${sponsorMember.userId.lname}`,
          email: sponsorMember.userId.email,
        };
      }
    }

    // Calculate team position breakdown
    let mainTeamCount = 0;
    let leftTeamCount = 0;
    let rightTeamCount = 0;

    // Get all direct team members and count by position
    if (teamMember.teamMembers && teamMember.teamMembers.length > 0) {
      const directMembers = await TeamMember.find({
        userId: { $in: teamMember.teamMembers }
      }).select('position');

      directMembers.forEach(member => {
        if (member.position === 'main') mainTeamCount++;
        else if (member.position === 'left') leftTeamCount++;
        else if (member.position === 'right') rightTeamCount++;
      });
    }

    teamLogger.success("Referral code retrieved", { userId, code: teamMember.referralCode });

    return {
      success: true,
      data: {
        referralCode: teamMember.referralCode,
        leftReferralCode: teamMember.leftReferralCode,
        rightReferralCode: teamMember.rightReferralCode,
        referralLink: `${process.env.FRONTEND_URL || "http://localhost:3000"}/join?ref=${teamMember.referralCode}`,
        leftReferralLink: `${process.env.FRONTEND_URL || "http://localhost:3000"}/join?ref=${teamMember.leftReferralCode}`,
        rightReferralLink: `${process.env.FRONTEND_URL || "http://localhost:3000"}/join?ref=${teamMember.rightReferralCode}`,
        userInfo: {
          name: `${teamMember.userId.fname} ${teamMember.userId.lname}`,
          email: teamMember.userId.email,
        },
        stats: {
          directCount: teamMember.directCount || 0,
          totalDownline: teamMember.totalDownline || 0,
          level: teamMember.level || 0,
          totalEarnings: teamMember.totalEarnings || 0,
          leftLegCount: teamMember.leftLegCount || 0,
          rightLegCount: teamMember.rightLegCount || 0,
          binaryActivated: teamMember.binaryActivated || false,
          userPosition: teamMember.position || 'main',
          mainTeamCount,
          leftTeamCount,
          rightTeamCount,
        },
        sponsor: sponsorInfo,
      },
    };
  } catch (error) {
    teamLogger.error("Error getting referral code", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Get all referrals for user
export const getMyReferrals = async (userId, page = 1, limit = 10) => {
  try {
    const skip = (page - 1) * limit;

    teamLogger.start("Getting user referrals", { userId, page, limit });

    const total = await Referral.countDocuments({ referrerId: userId });
    const referrals = await Referral.find({ referrerId: userId })
      .populate("referredUserId", "fname lname email phone createdAt")
      .sort({ referralDate: -1 })
      .skip(skip)
      .limit(limit);

    return {
      success: true,
      data: {
        referrals,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  } catch (error) {
    teamLogger.error("Error getting referrals", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Get downline structure for current user
export const getMyDownlineStructure = async (userId, depth = 5) => {
  try {
    teamLogger.start("Getting complete hierarchy structure for current user", { userId, depth });

    const currentMember = await TeamMember.findOne({ userId }).populate(
      "userId",
      "fname lname email"
    );

    if (!currentMember) {
      return {
        success: false,
        message: "Team member not found. Please create team membership first.",
      };
    }

    // Find the root of the tree by traversing up the sponsor chain
    const findRoot = async (startUserId) => {
      let currentUserId = startUserId;
      let visited = new Set();
      let maxIterations = 100;
      let iterations = 0;
      
      while (currentUserId && iterations < maxIterations) {
        iterations++;
        const currentUserIdStr = currentUserId.toString();
        
        if (visited.has(currentUserIdStr)) {
          teamLogger.warn("Cycle detected in sponsor chain", { userId: currentUserIdStr });
          return currentUserId;
        }
        
        visited.add(currentUserIdStr);
        const member = await TeamMember.findOne({ userId: currentUserId });
        
        if (!member) {
          teamLogger.warn("Member not found in chain", { userId: currentUserIdStr });
          return currentUserId;
        }
        
        if (!member.sponsorId) {
          teamLogger.debug("Root found - no sponsor", { rootUserId: currentUserId });
          return currentUserId;
        }
        
        // sponsorId is a TeamMember reference, get its userId
        const sponsorMember = await TeamMember.findById(member.sponsorId);
        if (!sponsorMember) {
          teamLogger.debug("Root found - sponsor reference broken", { rootUserId: currentUserId });
          return currentUserId;
        }
        
        currentUserId = sponsorMember.userId;
      }
      
      teamLogger.warn("Max iterations reached in findRoot", { startUserId });
      return startUserId;
    };

    // Build the complete hierarchy from root
    const buildCompleteHierarchy = async (buildUserId, currentDepth = 0, maxDepth = 10, targetUserId) => {
      if (currentDepth >= maxDepth) return null;

      const member = await TeamMember.findOne({ userId: buildUserId })
        .populate("userId", "fname lname email")
        .populate("teamMembers", "fname lname email");

      if (!member) return null;

      const teamMembersArray = [];
      for (const teamMemberUser of member.teamMembers) {
        const childUserId = teamMemberUser._id || teamMemberUser;
        const child = await buildCompleteHierarchy(childUserId, currentDepth + 1, maxDepth, targetUserId);
        if (child) {
          teamMembersArray.push(child);
        }
      }

      const userIdStr = member.userId._id ? member.userId._id.toString() : member.userId.toString();
      const targetUserIdStr = targetUserId.toString();

      return {
        _id: member._id,
        userId: member.userId,
        referralCode: member.referralCode,
        directCount: member.directCount,
        level: member.level,
        totalEarnings: member.totalEarnings,
        totalDownline: member.totalDownline || 0,
        teamMembers: teamMembersArray,
        isCurrentUser: userIdStr === targetUserIdStr, // Mark current user
      };
    };

    // Get root user ID by traversing up
    const rootUserId = await findRoot(userId);
    
    teamLogger.debug("Root user found", { rootUserId, startingUser: userId });
    
    // Build complete hierarchy from root
    const hierarchy = await buildCompleteHierarchy(rootUserId, 0, 10, userId);

    teamLogger.success("Complete hierarchy structure retrieved for current user", { userId, rootUserId });

    return {
      success: true,
      data: hierarchy,
      currentUserId: userId.toString(),
    };
  } catch (error) {
    teamLogger.error("Error getting complete hierarchy structure for current user", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Get downline structure for any user (Admin/Public view)
export const getDownlineStructure = async (userId, depth = 5) => {
  try {
    teamLogger.start("Getting complete hierarchy structure", { userId, depth });

    const targetMember = await TeamMember.findOne({ userId })
      .populate("userId", "fname lname email");

    if (!targetMember) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    // Find the root of the tree by traversing up the sponsor chain
    const findRoot = async (startUserId) => {
      let currentUserId = startUserId;
      let visited = new Set();
      let maxIterations = 100;
      let iterations = 0;
      
      while (currentUserId && iterations < maxIterations) {
        iterations++;
        const currentUserIdStr = currentUserId.toString();
        
        if (visited.has(currentUserIdStr)) {
          teamLogger.warn("Cycle detected in sponsor chain", { userId: currentUserIdStr });
          return currentUserId;
        }
        
        visited.add(currentUserIdStr);
        const member = await TeamMember.findOne({ userId: currentUserId });
        
        if (!member) {
          teamLogger.warn("Member not found in chain", { userId: currentUserIdStr });
          return currentUserId;
        }
        
        if (!member.sponsorId) {
          teamLogger.debug("Root found - no sponsor", { rootUserId: currentUserId });
          return currentUserId;
        }
        
        // sponsorId is a TeamMember reference, get its userId
        const sponsorMember = await TeamMember.findById(member.sponsorId);
        if (!sponsorMember) {
          teamLogger.debug("Root found - sponsor reference broken", { rootUserId: currentUserId });
          return currentUserId;
        }
        
        currentUserId = sponsorMember.userId;
      }
      
      teamLogger.warn("Max iterations reached in findRoot", { startUserId });
      return startUserId;
    };

    const buildHierarchy = async (buildUserId, currentDepth = 0, maxDepth = 10, targetUserId) => {
      if (currentDepth >= maxDepth) return null;

      const member = await TeamMember.findOne({ userId: buildUserId })
        .populate("userId", "fname lname email")
        .populate("teamMembers", "fname lname email");

      if (!member) return null;

      const children = await Promise.all(
        member.teamMembers.map((teamMemberUser) => {
          // Extract userId from populated User object
          const childUserId = teamMemberUser._id || teamMemberUser;
          return buildHierarchy(childUserId, currentDepth + 1, maxDepth, targetUserId);
        })
      );

      const userIdStr = member.userId._id ? member.userId._id.toString() : member.userId.toString();
      const targetUserIdStr = targetUserId.toString();

      return {
        _id: member._id,
        userId: member.userId,
        referralCode: member.referralCode,
        directCount: member.directCount,
        level: member.level,
        totalEarnings: member.totalEarnings,
        totalDownline: member.totalDownline || 0,
        children: children.filter((child) => child !== null),
        isTargetUser: userIdStr === targetUserIdStr, // Mark target user
      };
    };

    // Get root user ID by traversing up
    const rootUserId = await findRoot(userId);
    
    teamLogger.debug("Root user found", { rootUserId, startingUser: userId });
    
    // Build complete hierarchy from root
    const hierarchy = await buildHierarchy(rootUserId, 0, 10, userId);

    teamLogger.success("Complete hierarchy structure retrieved", { userId, rootUserId });

    return {
      success: true,
      data: {
        hierarchy,
        targetUserId: userId.toString(),
      },
    };
  } catch (error) {
    teamLogger.error("Error getting complete hierarchy structure", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Get user's own downline only (user as root, no ancestors) - FOR USER PANEL
export const getUserDownlineOnly = async (userId) => {
  try {
    teamLogger.start("Getting user's downline only (user as root)", { userId });

    const currentMember = await TeamMember.findOne({ userId })
      .populate("userId", "fname lname email");

    if (!currentMember) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    // Build hierarchy starting from current user (downline only)
    const buildDownlineFromUser = async (buildUserId, currentDepth = 0, maxDepth = 10) => {
      if (currentDepth >= maxDepth) return null;

      const member = await TeamMember.findOne({ userId: buildUserId })
        .populate("userId", "fname lname email")
        .populate("teamMembers", "fname lname email");

      if (!member) return null;

      const children = await Promise.all(
        member.teamMembers.map((teamMemberUser) => {
          const childUserId = teamMemberUser._id || teamMemberUser;
          return buildDownlineFromUser(childUserId, currentDepth + 1, maxDepth);
        })
      );

      return {
        _id: member._id,
        userId: member.userId,
        referralCode: member.referralCode,
        directCount: member.directCount,
        level: member.level,
        totalEarnings: member.totalEarnings,
        totalDownline: member.totalDownline || 0,
        teamMembers: children.filter((child) => child !== null),
        isCurrentUser: currentDepth === 0, // Mark root as current user
      };
    };

    // Start building from the current user (they are the root)
    const hierarchy = await buildDownlineFromUser(userId, 0, 10);

    teamLogger.success("User's downline retrieved (user as root)", { userId });

    return {
      success: true,
      data: {
        hierarchy,
        currentUserId: userId.toString(),
      },
    };
  } catch (error) {
    teamLogger.error("Error getting user's downline", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Get COMPLETE downline (ALL children: LPRO/RPRO/Main) for a user
// Returns SAME FORMAT as my-downline but includes ALL children from sponsorId
export const getUserBinaryDownline = async (userId) => {
  try {
    teamLogger.start("Getting user's complete downline (including LPRO/RPRO)", { userId });

    const currentMember = await TeamMember.findOne({ userId })
      .populate("userId", "fname lname email");

    if (!currentMember) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    // Build complete tree recursively - includes ALL children (not just teamMembers array)
    const buildCompleteDownline = async (memberIdOrTeamMember, currentDepth = 0, maxDepth = 15) => {
      if (currentDepth >= maxDepth) return null;

      // If we received a TeamMember object, use it directly; otherwise query by _id
      let member;
      if (typeof memberIdOrTeamMember === 'object' && memberIdOrTeamMember.userId) {
        member = memberIdOrTeamMember;
      } else {
        member = await TeamMember.findById(memberIdOrTeamMember)
          .populate("userId", "fname lname email");
      }

      if (!member) return null;

      // ✅ FIND ALL CHILDREN - using sponsorId (includes LPRO/RPRO/Main)
      // This is the KEY difference from old API!
      const allChildren = await TeamMember.find({ 
        sponsorId: member._id
        // No position filter - get ALL positions (left, right, main)
      }).populate("userId", "fname lname email");

      // Recursively build each child's downline
      const childrenTree = await Promise.all(
        allChildren.map(child => buildCompleteDownline(child, currentDepth + 1, maxDepth))
      );

      return {
        _id: member._id,
        userId: member.userId,
        referralCode: member.referralCode,
        position: member.position || "main", // ✅ Shows if joined via main/left/right (LPRO/RPRO)
        directCount: member.directCount || 0,
        leftLegCount: member.leftLegCount || 0,  // ✅ Total descendants in left leg
        rightLegCount: member.rightLegCount || 0, // ✅ Total descendants in right leg
        leftLegPV: member.leftLegPV || 0,        // ✅ Total PV in left leg
        rightLegPV: member.rightLegPV || 0,      // ✅ Total PV in right leg
        level: member.level,
        totalEarnings: member.totalEarnings,
        totalDownline: member.totalDownline || 0,
        teamMembers: childrenTree.filter(child => child !== null), // Same format as old API!
        isCurrentUser: currentDepth === 0,
      };
    };

    // Start building from current user
    const hierarchy = await buildCompleteDownline(currentMember, 0, 15);

    teamLogger.success("User's complete downline retrieved (including LPRO/RPRO)", { 
      userId,
      totalChildren: hierarchy.teamMembers.length
    });

    return {
      success: true,
      data: {
        hierarchy,
        currentUserId: userId.toString(),
      },
    };
  } catch (error) {
    teamLogger.error("Error getting user's complete downline", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Get simple team members list with their directCount and position
// Now includes recursive team member details for each member
export const getSimpleTeamMembersList = async (userId) => {
  try {
    teamLogger.start("Getting simple team members list with recursive details", { userId });

    const member = await TeamMember.findOne({ userId });

    if (!member) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    const teamMembersArray = member.teamMembers || [];

    if (teamMembersArray.length === 0) {
      return {
        success: true,
        data: {
          directCount: 0,
          leftProCount: 0,
          rightProCount: 0,
          mainCount: 0,
          totalPV: 0,
          leftProPV: 0,
          rightProPV: 0,
          mainPV: 0,
          weakerLegPV: 0,
          matchedVolume: 0,
          commissionAmount: 0,
          carryForwardLeft: 0,
          carryForwardRight: 0,
          members: [],
          binaryRank: member.binaryRank || "NONE",
          binaryBonusPercent: member.binaryBonusPercent || 0,
          highestRankAchieved: member.highestRankAchieved || "NONE",
        },
      };
    }

    const teamMemberRecords = await TeamMember.find({
      userId: { $in: teamMembersArray }
    }).populate("userId", "fname lname email");

    let totalLeftPro = 0;
    let totalRightPro = 0;
    let totalMain = 0;

    const membersListPromises = teamMemberRecords.map(async (tm) => {

      const childTeamMembers = tm.teamMembers || [];
      let childrenDetails = [];

      if (childTeamMembers.length > 0) {

        const childRecords = await TeamMember.find({
          userId: { $in: childTeamMembers }
        }).populate("userId", "fname lname email");

        childrenDetails = childRecords.map(child => {
          return {
            userId: child.userId?._id || child.userId,
            email: child.userId?.email || "N/A",
            name: child.userId
              ? `${child.userId.fname} ${child.userId.lname}`
              : "N/A",
            position: child.position || "main",
            directCount: child.directCount || 0,
            referralCode: child.referralCode,
          };
        });
      }

      // Contribution = member itself + their direct children
      const contribution = 1 + (tm.directCount || 0);

      if (tm.position === "left") {
        totalLeftPro += contribution;
      } else if (tm.position === "right") {
        totalRightPro += contribution;
      } else {
        totalMain += contribution;
      }

      return {
        userId: tm.userId?._id || tm.userId,
        email: tm.userId?.email || "N/A",
        name: tm.userId
          ? `${tm.userId.fname} ${tm.userId.lname}`
          : "N/A",
        position: tm.position || "main",
        directCount: tm.directCount || 0,
        referralCode: tm.referralCode,
        teamMembers: childrenDetails,
      };
    });

    const membersList = await Promise.all(membersListPromises);

    const totalDirectCount = totalLeftPro + totalRightPro + totalMain;

    // Calculate total PV (each member generates 94.5 PV)
    const totalPV = totalDirectCount * 94.5;
    const leftProPV = totalLeftPro * 94.5;
    const rightProPV = totalRightPro * 94.5;
    const mainPV = totalMain * 94.5;

    // ========== RANK UPDATE LOGIC BASED ON DIRECT COUNT ==========
    // Use totalDirectCount as totalActiveAffiliates for rank calculation
    const rankData = calculateBinaryRank(totalDirectCount);
    const previousRank = member.binaryRank;
    
    member.binaryRank = rankData.name;
    member.binaryBonusPercent = rankData.bonusPercent;

    // ========== BINARY COMMISSION CALCULATION (1:1 MATCHING - WEAKER LEG) ==========
    // Calculate weaker leg - this is the matched volume (1:1 matching)
    const weakerLegPV = Math.min(leftProPV, rightProPV);
    const matchedVolume = weakerLegPV; // Matched = Weaker leg
    
    // Calculate carry forward (remaining unmatched PV from each leg)
    const carryForwardLeft = leftProPV - matchedVolume;
    const carryForwardRight = rightProPV - matchedVolume;
    
    // Calculate commission based on matched volume and rank bonus percent
    const commissionAmount = matchedVolume * (member.binaryBonusPercent / 100);
    
    // Store carry forward values in member document
    member.carryForwardLeftPV = carryForwardLeft;
    member.carryForwardRightPV = carryForwardRight;
    // ========== END BINARY COMMISSION CALCULATION ==========
    
    // Track highest rank achieved (never decreases)
    const rankHierarchy = ["NONE", "IGNITOR", "SPARK", "RISER", "PIONEER", "INNOVATOR", "TRAILBLAZER", "CATALYST", "MOGUL", "VANGUARD", "LUMINARY", "SOVEREIGN", "ZENITH"];
    const currentRankIndex = rankHierarchy.indexOf(member.binaryRank);
    const highestRankIndex = rankHierarchy.indexOf(member.highestRankAchieved || "NONE");
    
    if (currentRankIndex > highestRankIndex) {
      member.highestRankAchieved = member.binaryRank;
      member.highestRankAchievedDate = new Date();
      teamLogger.info("New highest rank achieved", {
        userId,
        newRank: member.binaryRank,
        previousHighest: rankHierarchy[highestRankIndex],
        totalDirectCount,
      });
    }
    
    // Save updated rank information
    await member.save();
    
    if (previousRank !== member.binaryRank) {
      teamLogger.info("Rank updated based on direct count", {
        userId,
        previousRank,
        newRank: member.binaryRank,
        bonusPercent: member.binaryBonusPercent,
        totalDirectCount,
      });
    }
    // ========== END RANK UPDATE LOGIC ==========

    teamLogger.success("Simple team members list retrieved with rank update", {
      userId,
      directCount: totalDirectCount,
      leftProCount: totalLeftPro,
      rightProCount: totalRightPro,
      mainCount: totalMain,
      totalPV,
      matchedVolume,
      commissionAmount,
      binaryRank: member.binaryRank,
      bonusPercent: member.binaryBonusPercent,
    });

    return {
      success: true,
      data: {
        directCount: totalDirectCount,
        leftProCount: totalLeftPro,
        rightProCount: totalRightPro,
        mainCount: totalMain,
        totalPV: totalPV,
        leftProPV: leftProPV,
        rightProPV: rightProPV,
        mainPV: mainPV,
        weakerLegPV: weakerLegPV,
        matchedVolume: matchedVolume,
        commissionAmount: parseFloat(commissionAmount.toFixed(2)),
        carryForwardLeft: parseFloat(carryForwardLeft.toFixed(2)),
        carryForwardRight: parseFloat(carryForwardRight.toFixed(2)),
        members: membersList,
        binaryRank: member.binaryRank,
        binaryBonusPercent: member.binaryBonusPercent,
        highestRankAchieved: member.highestRankAchieved,
        rankBadge: getRankBadge(member.binaryRank),
        rankColor: getRankColor(member.binaryRank),
      },
    };

  } catch (error) {
    teamLogger.error("Error getting simple team members list", error);

    return {
      success: false,
      message: error.message,
    };
  }
};
// Get referral statistics for a specific user
export const getReferralStats = async (userId) => {
  try {
    teamLogger.start("Getting referral stats", { userId });

    const member = await TeamMember.findOne({ userId })
      .populate("userId", "fname lname email")
      .populate("teamMembers");

    if (!member) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    // Count total team size recursively
    const countTeamSize = async (memberId, visited = new Set()) => {
      if (visited.has(memberId.toString())) return 0;
      visited.add(memberId.toString());

      const currentMember = await TeamMember.findById(memberId);
      if (!currentMember || !currentMember.teamMembers) return 0;

      let count = currentMember.teamMembers.length;
      for (const childId of currentMember.teamMembers) {
        count += await countTeamSize(childId, visited);
      }
      return count;
    };

    // Calculate max depth
    const calculateMaxDepth = async (memberId, currentDepth = 0) => {
      const currentMember = await TeamMember.findById(memberId);
      if (!currentMember || !currentMember.teamMembers || currentMember.teamMembers.length === 0) {
        return currentDepth;
      }

      const childDepths = await Promise.all(
        currentMember.teamMembers.map((childId) => calculateMaxDepth(childId, currentDepth + 1))
      );

      return Math.max(...childDepths);
    };

    const totalTeam = await countTeamSize(member._id);
    const maxDepth = await calculateMaxDepth(member._id);
    const directReferrals = member.directCount || 0;

    // Count active members (members with at least 1 referral)
    const activeMembers = await TeamMember.countDocuments({
      _id: { $in: [member._id, ...member.teamMembers] },
      directCount: { $gt: 0 },
    });

    // Count members by position
    const leftTeamMembers = await TeamMember.countDocuments({
      sponsorId: member._id,
      position: "left",
    });
    const rightTeamMembers = await TeamMember.countDocuments({
      sponsorId: member._id,
      position: "right",
    });
    const mainTeamMembers = await TeamMember.countDocuments({
      sponsorId: member._id,
      position: "main",
    });

    // Calculate binary rank information
    const directCount = member.directCount || 0;
    const totalActiveAffiliates = member.totalActiveAffiliates || totalTeam;
    
    // Get leg counts from database
    const leftLegCount = member.leftLegCount || 0;
    const rightLegCount = member.rightLegCount || 0;
    
    // Calculate PV for each leg (94.5 PV per subscription)
    const leftLegPV = leftLegCount * 94.5;
    const rightLegPV = rightLegCount * 94.5;

    // Calculate binary bonus with correct parameters
    const binaryBonus = calculateBinaryCommission(
      leftLegCount,
      rightLegCount,
      leftLegPV,
      rightLegPV,
      totalActiveAffiliates
    );

    // Get next rank info
    const nextRank = getNextRankInfo(totalActiveAffiliates);

    // Get rank badge and color
    const rankBadge = getRankBadge(binaryBonus.rank);
    const rankColor = getRankColor(binaryBonus.rank);

    const stats = {
      totalTeam,
      directReferrals,
      maxDepth,
      activeMembers,
      totalEarnings: member.totalEarnings || 0,
      currentLevel: member.level || 0,
      referralCode: member.referralCode,
      leftReferralCode: member.leftReferralCode,
      rightReferralCode: member.rightReferralCode,
      userPosition: member.position,
      leftTeamCount: leftTeamMembers,
      rightTeamCount: rightTeamMembers,
      mainTeamCount: mainTeamMembers,
      // Binary tree status (old structure for backward compatibility)
      binaryTree: {
        leftLegCount: member.leftLegCount || 0,
        rightLegCount: member.rightLegCount || 0,
        leftLegFull: member.leftLegFull || false,
        rightLegFull: member.rightLegFull || false,
        leftReferralActive: member.leftReferralActive !== false,
        rightReferralActive: member.rightReferralActive !== false,
        lproAvailable: !member.leftLegFull && member.leftReferralActive !== false,
        rproAvailable: !member.rightLegFull && member.rightReferralActive !== false,
        leftLegPV: leftLegPV,
        rightLegPV: rightLegPV,
      },
      // NEW: Binary Rank System
      binaryRank: {
        activated: binaryBonus.activated,
        currentRank: binaryBonus.rank,
        rankBadge: rankBadge,
        rankColor: rankColor,
        bonusPercent: binaryBonus.bonusPercent,
        weakerLegPV: binaryBonus.weakerLegPV,
        commission: binaryBonus.commission,
        totalActiveAffiliates: totalActiveAffiliates,
        leftLegCount: leftLegCount,
        rightLegCount: rightLegCount,
        leftLegPV: leftLegPV,
        rightLegPV: rightLegPV,
        // 1:2 Matching data
        matchedVolume: binaryBonus.matchedVolume || 0,
        matchedLeft: binaryBonus.matchedLeft || 0,
        matchedRight: binaryBonus.matchedRight || 0,
        carryForwardLeft: binaryBonus.carryForwardLeft || 0,
        carryForwardRight: binaryBonus.carryForwardRight || 0,
        nextRank: nextRank.nextRank || null,
        nextBonusPercent: nextRank.nextBonusPercent || null,
        affiliatesNeeded: nextRank.affiliatesNeeded || 0,
        message: binaryBonus.message,
        needsMoreReferrals: directCount < 10,
        referralsNeeded: Math.max(0, 10 - directCount),
      },
    };

    teamLogger.success("Referral stats retrieved", stats);

    return {
      success: true,
      ...stats,
    };
  } catch (error) {
    teamLogger.error("Error getting referral stats", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// ==================== PAYOUT FUNCTIONS FOR USER PANEL ====================

// Get user's available balance for payout
export const getUserAvailableBalance = async (userId) => {
  try {
    teamLogger.start("Getting user available balance", { userId });

    const member = await TeamMember.findOne({ userId });
    if (!member) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    // Get total commissions
    const totalCommissions = await Commission.aggregate([
      { $match: { referrerId: userId } },
      {
        $group: {
          _id: null,
          totalEarned: { $sum: "$netAmount" },
        },
      },
    ]);

    // Get total payouts
    const totalPayouts = await Payout.aggregate([
      { $match: { userId: userId, status: { $in: ["completed", "processing"] } } },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: "$netAmount" },
        },
      },
    ]);

    const earned = totalCommissions[0]?.totalEarned || 0;
    const paid = totalPayouts[0]?.totalPaid || 0;
    const available = earned - paid;

    teamLogger.success("Available balance retrieved", { userId, earned, paid, available });

    // TEMPORARY: Hardcoded balance for testing
    return {
      success: true,
      data: {
        totalEarned: earned,
        totalPaid: paid,
        availableBalance: 1000, // Temporary test value
        totalEarnings: member.totalEarnings || 0,
      },
    };
  } catch (error) {
    teamLogger.error("Error getting available balance", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Request payout for user
export const createUserPayout = async (userId, payoutData) => {
  try {
    teamLogger.start("Creating user payout request", { userId, amount: payoutData.amount });

    const { amount, payoutMethod, bankDetails, upiId, cryptoWalletAddress, cryptoCurrency, source } = payoutData;

    // Validate amount
    if (!amount || amount <= 0) {
      return {
        success: false,
        message: "Invalid payout amount",
      };
    }

    // Validate payment method specific fields
    if (payoutMethod === "crypto") {
      if (!cryptoWalletAddress || cryptoWalletAddress.trim().length === 0) {
        return {
          success: false,
          message: "Crypto wallet address is required",
        };
      }
      if (cryptoWalletAddress.trim().length < 26) {
        return {
          success: false,
          message: "Invalid crypto wallet address",
        };
      }
      if (!cryptoCurrency || !["USDT", "BTC"].includes(cryptoCurrency)) {
        return {
          success: false,
          message: "Invalid cryptocurrency selected. Please choose USDT or BTC",
        };
      }
    }

    // Get available balance
    const balanceResult = await getUserAvailableBalance(userId);
    if (!balanceResult.success) {
      return balanceResult;
    }

    const { availableBalance } = balanceResult.data;

    // Check minimum payout amount (e.g., 100)
    const minimumPayout = 100;
    if (amount < minimumPayout) {
      return {
        success: false,
        message: `Minimum payout amount is ₹${minimumPayout}`,
      };
    }

    // Check if user has sufficient balance
    if (amount > availableBalance) {
      return {
        success: false,
        message: `Insufficient balance. Available: ₹${availableBalance.toFixed(2)}`,
      };
    }

    // Generate unique reference number
    const referenceNumber = `PAY-${Date.now()}-${userId.toString().slice(-6).toUpperCase()}`;

    // Calculate tax if applicable (e.g., 5% TDS for non-crypto, 0% for crypto)
    const taxRate = payoutMethod === "crypto" ? 0 : 0.05;
    const taxDeducted = amount * taxRate;
    const netAmount = amount - taxDeducted;

    // Create payout request
    const payout = new Payout({
      userId,
      amount,
      netAmount,
      taxDeducted,
      payoutMethod,
      bankDetails,
      upiId,
      cryptoWalletAddress: payoutMethod === "crypto" ? cryptoWalletAddress.trim() : null,
      cryptoCurrency: payoutMethod === "crypto" ? cryptoCurrency : null,
      source: source || "direct_bonus",
      referenceNumber,
      status: "pending",
      description: `Payout request for ₹${amount}${payoutMethod === "crypto" ? ` via ${cryptoCurrency}` : ""}`,
      period: {
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
      },
    });

    await payout.save();

    teamLogger.success("Payout request created", {
      userId,
      payoutId: payout._id,
      referenceNumber,
      payoutMethod,
    });

    const processingTime = payoutMethod === "crypto" ? "24-48 hours" : "2-3 business days";

    return {
      success: true,
      message: `Payout request submitted successfully. It will be processed within ${processingTime}.`,
      data: {
        payoutId: payout._id,
        referenceNumber: payout.referenceNumber,
        amount: payout.amount,
        netAmount: payout.netAmount,
        taxDeducted: payout.taxDeducted,
        status: payout.status,
        payoutMethod: payout.payoutMethod,
        requestedAt: payout.requestedAt,
      },
    };
  } catch (error) {
    teamLogger.error("Error creating payout request", error);
    return {
      success: false,
      message: error.message || "Failed to create payout request",
    };
  }
};

// Get user's payout history
export const getUserPayoutHistory = async (userId, page = 1, limit = 10) => {
  try {
    teamLogger.start("Getting user payout history", { userId, page, limit });

    const skip = (page - 1) * limit;

    const payouts = await Payout.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v");

    const totalPayouts = await Payout.countDocuments({ userId });

    // Get summary statistics
    const summary = await Payout.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          totalNet: { $sum: "$netAmount" },
        },
      },
    ]);

    teamLogger.success("Payout history retrieved", { userId, count: payouts.length });

    return {
      success: true,
      data: {
        payouts,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalPayouts / limit),
          totalPayouts,
          pageSize: limit,
        },
        summary: summary.reduce((acc, item) => {
          acc[item._id] = {
            count: item.count,
            totalAmount: item.totalAmount,
            totalNet: item.totalNet,
          };
          return acc;
        }, {}),
      },
    };
  } catch (error) {
    teamLogger.error("Error getting payout history", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Get specific payout details
export const getUserPayoutDetails = async (userId, payoutId) => {
  try {
    teamLogger.start("Getting payout details", { userId, payoutId });

    const payout = await Payout.findOne({ _id: payoutId, userId })
      .populate("processedBy", "fname lname email")
      .select("-__v");

    if (!payout) {
      return {
        success: false,
        message: "Payout not found",
      };
    }

    teamLogger.success("Payout details retrieved", { payoutId });

    return {
      success: true,
      data: payout,
    };
  } catch (error) {
    teamLogger.error("Error getting payout details", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// Get payout statistics for user
export const getUserPayoutStats = async (userId) => {
  try {
    teamLogger.start("Getting user payout stats", { userId });

    const stats = await Payout.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: null,
          totalRequested: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          totalNetAmount: { $sum: "$netAmount" },
          totalTax: { $sum: "$taxDeducted" },
          pending: {
            $sum: {
              $cond: [{ $eq: ["$status", "pending"] }, 1, 0],
            },
          },
          processing: {
            $sum: {
              $cond: [{ $eq: ["$status", "processing"] }, 1, 0],
            },
          },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
            },
          },
          failed: {
            $sum: {
              $cond: [{ $eq: ["$status", "failed"] }, 1, 0],
            },
          },
          completedAmount: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, "$netAmount", 0],
            },
          },
        },
      },
    ]);

    // Get latest completed payout
    const latestPayout = await Payout.findOne({
      userId,
      status: "completed",
    })
      .sort({ completedAt: -1 })
      .select("amount netAmount completedAt");

    const result = stats[0] || {
      totalRequested: 0,
      totalAmount: 0,
      totalNetAmount: 0,
      totalTax: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      completedAmount: 0,
    };

    teamLogger.success("Payout stats retrieved", { userId });

    return {
      success: true,
      data: {
        ...result,
        latestPayout: latestPayout || null,
      },
    };
  } catch (error) {
    teamLogger.error("Error getting payout stats", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

// ==================== BINARY REWARD SYSTEM ====================

/**
 * Get available rewards for user based on highest rank achieved
 * Rewards are unlocked by highest rank, not current rank
 * Each reward is one-time redeemable
 */
export const getAvailableRewards = async (userId) => {
  try {
    teamLogger.start("Getting available rewards", { userId });

    // Get user's team member data
    const member = await TeamMember.findOne({ userId });
    if (!member) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    // Calculate current rank based on totalActiveAffiliates
    const totalActiveAffiliates = member.totalActiveAffiliates || 0;
    const rankData = calculateBinaryRank(totalActiveAffiliates);
    const currentRank = rankData.name; // rank object has 'name' property

    // Use highest rank achieved (not current rank)
    const highestRank = member.highestRankAchieved || "NONE";
    
    if (highestRank === "NONE") {
      return {
        success: true,
        currentRank: currentRank,
        highestRank: "NONE",
        totalActiveAffiliates: totalActiveAffiliates,
        message: "No rank achieved yet. Build your team to earn ranks!",
        availableRewards: [],
        claimedRewards: [],
      };
    }

    // Get rank hierarchy to determine all unlocked rewards
    const rankHierarchy = [
      "IGNITOR", "SPARK", "RISER", "PIONEER", "INNOVATOR",
      "TRAILBLAZER", "CATALYST", "MOGUL", "VANGUARD",
      "LUMINARY", "SOVEREIGN", "ZENITH"
    ];
    
    const highestRankIndex = rankHierarchy.indexOf(highestRank);
    if (highestRankIndex === -1) {
      return {
        success: true,
        currentRank: currentRank,
        highestRank,
        totalActiveAffiliates: totalActiveAffiliates,
        availableRewards: [],
        claimedRewards: [],
      };
    }

    // All ranks up to and including highest rank are unlocked
    const unlockedRanks = rankHierarchy.slice(0, highestRankIndex + 1);

    // Get already redeemed rewards
    const redeemedRewards = await BinaryReward.find({ userId });
    const redeemedRanks = redeemedRewards.map(r => r.rank);

    // Available rewards = unlocked but not redeemed
    const availableRanks = unlockedRanks.filter(rank => !redeemedRanks.includes(rank));

    // Format available rewards
    const availableRewardsWithDetails = availableRanks.map(rank => {
      const rewardConfig = getRewardForRank(rank);
      return {
        rank,
        badge: rewardConfig?.badge || "🎁",
        title: rewardConfig?.title || `${rank} Reward`,
        rewardType: rewardConfig?.rewardType || "UNKNOWN",
        rewardName: rewardConfig?.rewardName || "Reward",
        rewardDescription: rewardConfig?.rewardDescription || "",
        requiresSize: rewardConfig?.requiresSize || false,
        requiresColor: rewardConfig?.requiresColor || false,
        colors: rewardConfig?.colors || [],
        requiresShipping: rewardConfig?.requiresShipping !== false,
        canRedeem: true,
      };
    });

    teamLogger.success("Available rewards retrieved", {
      userId,
      currentRank,
      highestRank,
      totalActiveAffiliates: totalActiveAffiliates,
      availableCount: availableRewardsWithDetails.length,
      redeemedCount: redeemedRewards.length,
    });

    return {
      success: true,
      currentRank: currentRank,
      highestRank,
      totalActiveAffiliates: totalActiveAffiliates,
      availableRewards: availableRewardsWithDetails,
      claimedRewards: redeemedRewards.map(r => ({
        rank: r.rank,
        rewardType: r.rewardType,
        status: r.status,
        claimedDate: r.claimedDate,
        trackingNumber: r.trackingNumber,
      })),
    };
  } catch (error) {
    teamLogger.error("Error getting available rewards", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Redeem a reward for a specific rank
 * One-time redemption based on highest rank achieved
 */
export const claimReward = async (userId, rewardData) => {
  try {
    const { rank, size, color, shippingAddress, notes } = rewardData;

    teamLogger.start("Redeeming reward", { userId, rank });

    // Validate user
    const member = await TeamMember.findOne({ userId });
    if (!member) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    // Check if user has achieved this rank (based on highest rank, not current)
    const rankHierarchy = [
      "IGNITOR", "SPARK", "RISER", "PIONEER", "INNOVATOR",
      "TRAILBLAZER", "CATALYST", "MOGUL", "VANGUARD",
      "LUMINARY", "SOVEREIGN", "ZENITH"
    ];
    
    const highestRank = member.highestRankAchieved || "NONE";
    const requestedRankIndex = rankHierarchy.indexOf(rank);
    const highestRankIndex = rankHierarchy.indexOf(highestRank);

    if (requestedRankIndex === -1 || requestedRankIndex > highestRankIndex) {
      return {
        success: false,
        message: "You haven't achieved this rank yet.",
      };
    }

    // Check if reward already redeemed
    const existingReward = await BinaryReward.findOne({ userId, rank });
    if (existingReward) {
      return {
        success: false,
        message: "Reward for this rank already redeemed. Each reward can only be claimed once.",
      };
    }

    // Get reward configuration
    const rewardConfig = getRewardForRank(rank);
    if (!rewardConfig) {
      return {
        success: false,
        message: "Invalid reward rank.",
      };
    }

    // Validate shipping address if required
    if (rewardConfig.requiresShipping) {
      if (!shippingAddress || !shippingAddress.street || !shippingAddress.city) {
        return {
          success: false,
          message: "Valid shipping address is required for this reward.",
        };
      }
    }

    // Create reward redemption record
    const reward = new BinaryReward({
      userId,
      rank,
      rewardType: rewardConfig.rewardType,
      rewardValue: rewardConfig.cashAmount || rewardConfig.voucherAmount || 0,
      status: "CLAIMED",
      claimedDate: new Date(),
      shippingAddress: rewardConfig.requiresShipping ? shippingAddress : null,
      size: rewardConfig.requiresSize ? (size || "N/A") : "N/A",
      color: rewardConfig.requiresColor ? (color || null) : null,
      notes: notes || null,
      achievedDate: member.highestRankAchievedDate || new Date(),
    });

    await reward.save();

    teamLogger.success("Reward redeemed successfully", {
      userId,
      rank,
      rewardType: rewardConfig.rewardType,
      rewardId: reward._id,
    });

    return {
      success: true,
      message: "Reward redeemed successfully! It will be processed and delivered soon.",
      reward: {
        id: reward._id,
        rank: reward.rank,
        rewardType: reward.rewardType,
        rewardName: rewardConfig.rewardName,
        status: reward.status,
        claimedDate: reward.claimedDate,
      },
    };
  } catch (error) {
    teamLogger.error("Error redeeming reward", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Get reward claim history for user
 */
export const getRewardHistory = async (userId) => {
  try {
    teamLogger.start("Getting reward history", { userId });

    const rewards = await BinaryReward.find({ userId })
      .sort({ claimedDate: -1 });

    teamLogger.success("Reward history retrieved", {
      userId,
      count: rewards.length,
    });

    return {
      success: true,
      rewards: rewards.map(r => ({
        id: r._id,
        rank: r.rank,
        rewardType: r.rewardType,
        status: r.status,
        claimedDate: r.claimedDate,
        processingDate: r.processingDate,
        shippedDate: r.shippedDate,
        deliveredDate: r.deliveredDate,
        trackingNumber: r.trackingNumber,
        shippingAddress: r.shippingAddress,
        size: r.size,
        color: r.color,
      })),
    };
  } catch (error) {
    teamLogger.error("Error getting reward history", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Update reward status (Admin only)
 */
export const updateRewardStatus = async (rewardId, status, additionalData = {}) => {
  try {
    teamLogger.start("Updating reward status", { rewardId, status });

    const reward = await BinaryReward.findById(rewardId);
    if (!reward) {
      return {
        success: false,
        message: "Reward not found",
      };
    }

    await reward.updateStatus(status, additionalData);

    teamLogger.success("Reward status updated", {
      rewardId,
      status,
      userId: reward.userId,
    });

    return {
      success: true,
      message: "Reward status updated successfully",
      reward: {
        id: reward._id,
        status: reward.status,
        trackingNumber: reward.trackingNumber,
      },
    };
  } catch (error) {
    teamLogger.error("Error updating reward status", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Get all reward claims (Admin only)
 */
export const getAllRewardClaims = async (filters = {}) => {
  try {
    const { status, rank, page = 1, limit = 20 } = filters;

    teamLogger.start("Getting all reward claims", { filters });

    const query = {};
    if (status) query.status = status;
    if (rank) query.rank = rank;

    const skip = (page - 1) * limit;

    const rewards = await BinaryReward.find(query)
      .populate("userId", "fname lname email phone")
      .sort({ claimedDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await BinaryReward.countDocuments(query);

    teamLogger.success("All reward claims retrieved", {
      total,
      page,
      limit,
    });

    return {
      success: true,
      rewards: rewards.map(r => ({
        id: r._id,
        user: {
          id: r.userId._id,
          name: `${r.userId.fname} ${r.userId.lname}`,
          email: r.userId.email,
          phone: r.userId.phone,
        },
        rank: r.rank,
        rewardType: r.rewardType,
        status: r.status,
        claimedDate: r.claimedDate,
        processingDate: r.processingDate,
        shippedDate: r.shippedDate,
        deliveredDate: r.deliveredDate,
        trackingNumber: r.trackingNumber,
        shippingAddress: r.shippingAddress,
        size: r.size,
        color: r.color,
        notes: r.notes,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    teamLogger.error("Error getting all reward claims", error);
    return {
      success: false,
      message: error.message,
    };
  }
};
// ==================== LEG COUNT MANAGEMENT ====================

/**
 * Helper: Recursively count all descendants regardless of position
 */
const countAllDescendants = async (memberId, visited = new Set()) => {
  if (!memberId || visited.has(memberId.toString())) {
    return 0;
  }
  
  visited.add(memberId.toString());
  
  const children = await TeamMember.find({ sponsorId: memberId });
  let count = children.length;
  
  for (const child of children) {
    const descendantCount = await countAllDescendants(child._id, visited);
    count += descendantCount;
  }
  
  return count;
};

/**
 * Update leg counts for ALL upline members when a new member joins
 * This ensures everyone in the upline tree has correct counts including descendants
 * 
 * @param {ObjectId} newMemberId - The new member's TeamMember _id
 * @returns {Promise<Object>} Update results
 */
export const updateUplineLegCounts = async (newMemberId) => {
  try {
    const newMember = await TeamMember.findById(newMemberId);
    
    if (!newMember || !newMember.sponsorId || newMember.position === 'main') {
      return {
        success: true,
        message: "No upline update needed (no sponsor or main position)",
        updatedCount: 0
      };
    }

    let currentSponsorId = newMember.sponsorId;
    let currentPosition = newMember.position; // 'left' or 'right'
    let updatedCount = 0;

    teamLogger.info("🔄 Updating upline leg counts", {
      newMemberId,
      position: currentPosition
    });

    // Traverse up the tree and update each sponsor's leg counts
    while (currentSponsorId) {
      const sponsor = await TeamMember.findById(currentSponsorId);
      
      if (!sponsor) {
        break;
      }

      // Increment the appropriate leg count
      if (currentPosition === 'left') {
        sponsor.leftLegCount = (sponsor.leftLegCount || 0) + 1;
        teamLogger.debug(`  ✅ Updated sponsor leftLegCount: ${sponsor.leftLegCount}`, {
          sponsorId: sponsor._id
        });
      } else if (currentPosition === 'right') {
        sponsor.rightLegCount = (sponsor.rightLegCount || 0) + 1;
        teamLogger.debug(`  ✅ Updated sponsor rightLegCount: ${sponsor.rightLegCount}`, {
          sponsorId: sponsor._id
        });
      }

      // Update totalActiveAffiliates
      sponsor.totalActiveAffiliates = (sponsor.leftLegCount || 0) + (sponsor.rightLegCount || 0);

      await sponsor.save();
      updatedCount++;

      // Move up to the next sponsor
      currentPosition = sponsor.position;
      currentSponsorId = sponsor.sponsorId;
    }

    teamLogger.success(`✅ Upline leg counts updated for ${updatedCount} members`);

    return {
      success: true,
      message: `Updated ${updatedCount} upline members`,
      updatedCount
    };
  } catch (error) {
    teamLogger.error("Error updating upline leg counts", error);
    return {
      success: false,
      message: error.message,
      updatedCount: 0
    };
  }
};

/**
 * Get detailed leg count information for a user
 * Shows stored counts, calculated counts, and complete tree visualization
 */
export const getLegCountDetails = async (userId) => {
  try {
    teamLogger.start(`Getting leg count details for user: ${userId}`);

    const user = await User.findById(userId);
    if (!user) {
      return {
        success: false,
        message: "User not found",
      };
    }

    const teamMember = await TeamMember.findOne({ userId })
      .populate("userId", "fname lname email")
      .populate("sponsorId");

    if (!teamMember) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    // Get stored counts from database
    const storedLeftLegCount = teamMember.leftLegCount || 0;
    const storedRightLegCount = teamMember.rightLegCount || 0;
    const storedTotalActive = teamMember.totalActiveAffiliates || 0;

    // Calculate actual counts manually
    const leftChildren = await TeamMember.find({
      sponsorId: teamMember._id,
      position: 'left'
    }).populate("userId", "fname lname email");

    let calculatedLeftCount = 0;
    const leftLegDetails = [];

    for (const child of leftChildren) {
      const descendantsCount = await countAllDescendants(child._id, new Set());
      const totalContribution = 1 + descendantsCount;
      
      leftLegDetails.push({
        memberId: child._id,
        name: `${child.userId.fname} ${child.userId.lname}`,
        email: child.userId.email,
        directCount: 1,
        descendantsCount: descendantsCount,
        totalContribution: totalContribution,
      });
      
      calculatedLeftCount += totalContribution;
    }

    const rightChildren = await TeamMember.find({
      sponsorId: teamMember._id,
      position: 'right'
    }).populate("userId", "fname lname email");

    let calculatedRightCount = 0;
    const rightLegDetails = [];

    for (const child of rightChildren) {
      const descendantsCount = await countAllDescendants(child._id, new Set());
      const totalContribution = 1 + descendantsCount;
      
      rightLegDetails.push({
        memberId: child._id,
        name: `${child.userId.fname} ${child.userId.lname}`,
        email: child.userId.email,
        directCount: 1,
        descendantsCount: descendantsCount,
        totalContribution: totalContribution,
      });
      
      calculatedRightCount += totalContribution;
    }

    const calculatedTotal = calculatedLeftCount + calculatedRightCount;

    // Check if counts match
    const leftMatch = storedLeftLegCount === calculatedLeftCount;
    const rightMatch = storedRightLegCount === calculatedRightCount;
    const totalMatch = storedTotalActive === calculatedTotal;
    const allMatch = leftMatch && rightMatch && totalMatch;

    teamLogger.success(`Leg count details retrieved for ${user.fname} ${user.lname}`);

    return {
      success: true,
      data: {
        userInfo: {
          userId: user._id,
          name: `${user.fname} ${user.lname}`,
          email: user.email,
        },
        storedCounts: {
          leftLegCount: storedLeftLegCount,
          rightLegCount: storedRightLegCount,
          totalActiveAffiliates: storedTotalActive,
        },
        calculatedCounts: {
          leftLegCount: calculatedLeftCount,
          rightLegCount: calculatedRightCount,
          totalActiveAffiliates: calculatedTotal,
        },
        comparison: {
          leftLegMatch: leftMatch,
          rightLegMatch: rightMatch,
          totalActiveMatch: totalMatch,
          allCountsMatch: allMatch,
        },
        leftLegDetails: leftLegDetails,
        rightLegDetails: rightLegDetails,
        needsUpdate: !allMatch,
      },
    };
  } catch (error) {
    teamLogger.error("Error getting leg count details", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Verify leg counts for a single user or all users
 * Returns mismatches between stored and calculated counts
 */
export const verifyLegCounts = async (userId = null) => {
  try {
    teamLogger.start(userId ? `Verifying leg counts for user: ${userId}` : "Verifying leg counts for all users");

    let members;
    if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, message: "User not found" };
      }
      const teamMember = await TeamMember.findOne({ userId }).populate("userId", "fname lname email");
      if (!teamMember) {
        return { success: false, message: "Team member not found" };
      }
      members = [teamMember];
    } else {
      members = await TeamMember.find({}).populate("userId", "fname lname email");
    }

    const mismatches = [];
    let totalVerified = 0;
    let totalCorrect = 0;
    let totalIncorrect = 0;

    for (const member of members) {
      const storedLeft = member.leftLegCount || 0;
      const storedRight = member.rightLegCount || 0;
      const storedTotal = member.totalActiveAffiliates || 0;

      // Calculate actual counts
      const leftChildren = await TeamMember.find({
        sponsorId: member._id,
        position: 'left'
      });

      let calculatedLeft = 0;
      for (const child of leftChildren) {
        const descendants = await countAllDescendants(child._id, new Set());
        calculatedLeft += 1 + descendants;
      }

      const rightChildren = await TeamMember.find({
        sponsorId: member._id,
        position: 'right'
      });

      let calculatedRight = 0;
      for (const child of rightChildren) {
        const descendants = await countAllDescendants(child._id, new Set());
        calculatedRight += 1 + descendants;
      }

      const calculatedTotal = calculatedLeft + calculatedRight;

      totalVerified++;

      const hasMatch = 
        storedLeft === calculatedLeft && 
        storedRight === calculatedRight && 
        storedTotal === calculatedTotal;

      if (hasMatch) {
        totalCorrect++;
      } else {
        totalIncorrect++;
        mismatches.push({
          userId: member.userId._id,
          name: `${member.userId.fname} ${member.userId.lname}`,
          email: member.userId.email,
          stored: {
            leftLegCount: storedLeft,
            rightLegCount: storedRight,
            totalActiveAffiliates: storedTotal,
          },
          calculated: {
            leftLegCount: calculatedLeft,
            rightLegCount: calculatedRight,
            totalActiveAffiliates: calculatedTotal,
          },
          differences: {
            leftLeg: calculatedLeft - storedLeft,
            rightLeg: calculatedRight - storedRight,
            total: calculatedTotal - storedTotal,
          },
        });
      }
    }

    teamLogger.success(`Verification complete: ${totalVerified} members checked, ${totalCorrect} correct, ${totalIncorrect} incorrect`);

    return {
      success: true,
      data: {
        summary: {
          totalVerified,
          totalCorrect,
          totalIncorrect,
          accuracyPercentage: totalVerified > 0 ? ((totalCorrect / totalVerified) * 100).toFixed(2) : 0,
        },
        mismatches: mismatches,
        allCorrect: totalIncorrect === 0,
      },
    };
  } catch (error) {
    teamLogger.error("Error verifying leg counts", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Recalculate and update leg counts for a user or all users
 */
export const recalculateLegCounts = async (userId = null) => {
  try {
    teamLogger.start(userId ? `Recalculating leg counts for user: ${userId}` : "Recalculating leg counts for all users");

    let members;
    if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, message: "User not found" };
      }
      const teamMember = await TeamMember.findOne({ userId }).populate("userId", "fname lname email");
      if (!teamMember) {
        return { success: false, message: "Team member not found" };
      }
      members = [teamMember];
    } else {
      members = await TeamMember.find({}).populate("userId", "fname lname email");
    }

    const updates = [];
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalUnchanged = 0;

    for (const member of members) {
      const oldLeft = member.leftLegCount || 0;
      const oldRight = member.rightLegCount || 0;
      const oldTotal = member.totalActiveAffiliates || 0;

      // Calculate new counts
      const leftChildren = await TeamMember.find({
        sponsorId: member._id,
        position: 'left'
      });

      let newLeftCount = 0;
      for (const child of leftChildren) {
        const descendants = await countAllDescendants(child._id, new Set());
        newLeftCount += 1 + descendants;
      }

      const rightChildren = await TeamMember.find({
        sponsorId: member._id,
        position: 'right'
      });

      let newRightCount = 0;
      for (const child of rightChildren) {
        const descendants = await countAllDescendants(child._id, new Set());
        newRightCount += 1 + descendants;
      }

      const newTotalCount = newLeftCount + newRightCount;

      totalProcessed++;

      const hasChanges = 
        oldLeft !== newLeftCount || 
        oldRight !== newRightCount || 
        oldTotal !== newTotalCount;

      if (hasChanges) {
        // Update the member
        member.leftLegCount = newLeftCount;
        member.rightLegCount = newRightCount;
        member.totalActiveAffiliates = newTotalCount;
        await member.save();

        totalUpdated++;
        updates.push({
          userId: member.userId._id,
          name: `${member.userId.fname} ${member.userId.lname}`,
          email: member.userId.email,
          before: {
            leftLegCount: oldLeft,
            rightLegCount: oldRight,
            totalActiveAffiliates: oldTotal,
          },
          after: {
            leftLegCount: newLeftCount,
            rightLegCount: newRightCount,
            totalActiveAffiliates: newTotalCount,
          },
          changes: {
            leftLeg: newLeftCount - oldLeft,
            rightLeg: newRightCount - oldRight,
            total: newTotalCount - oldTotal,
          },
        });

        teamLogger.info(`Updated leg counts for ${member.userId.fname} ${member.userId.lname}`, {
          leftLeg: `${oldLeft} → ${newLeftCount}`,
          rightLeg: `${oldRight} → ${newRightCount}`,
          total: `${oldTotal} → ${newTotalCount}`,
        });
      } else {
        totalUnchanged++;
      }
    }

    teamLogger.success(`Recalculation complete: ${totalProcessed} processed, ${totalUpdated} updated, ${totalUnchanged} unchanged`);

    return {
      success: true,
      data: {
        summary: {
          totalProcessed,
          totalUpdated,
          totalUnchanged,
        },
        updates: updates,
      },
      message: `Successfully recalculated leg counts. ${totalUpdated} members updated, ${totalUnchanged} already correct.`,
    };
  } catch (error) {
    teamLogger.error("Error recalculating leg counts", error);
    return {
      success: false,
      message: error.message,
    };
  }
};

/**
 * Get Complete Binary Tree Analytics
 * 
 * Comprehensive endpoint that returns EVERYTHING:
 * - Leg counts (left/right with complete downline)
 * - PV values (left/right with complete tree)
 * - Binary rank and commission percentage
 * - Carry forward values
 * - Matched PV and pairs
 * - Commission earnings summary
 * - Tree validation (stored vs calculated)
 * - Team statistics
 */
export const getCompleteBinaryAnalytics = async (userId) => {
  try {
    teamLogger.start(`Getting complete binary analytics for user: ${userId}`);

    const user = await User.findById(userId);
    if (!user) {
      return {
        success: false,
        message: "User not found",
      };
    }

    const teamMember = await TeamMember.findOne({ userId })
      .populate("userId", "fname lname email phone")
      .populate("sponsorId");

    if (!teamMember) {
      return {
        success: false,
        message: "Team member not found",
      };
    }

    // ==================== 1. USER INFO ====================
    const userInfo = {
      userId: user._id,
      name: `${user.fname} ${user.lname}`,
      email: user.email,
      phone: user.phone || "N/A",
      memberSince: teamMember.createdAt,
    };

    // ==================== 2. REFERRAL CODES ====================
    const referralCodes = {
      leftCode: teamMember.leftReferralCode || generateLeftReferralCode(user._id),
      rightCode: teamMember.rightReferralCode || generateRightReferralCode(user._id),
    };

    // ==================== 3. SPONSOR INFO ====================
    let sponsorInfo = null;
    if (teamMember.sponsorId) {
      const sponsor = await User.findById(teamMember.sponsorId);
      sponsorInfo = sponsor ? {
        sponsorId: sponsor._id,
        sponsorName: `${sponsor.fname} ${sponsor.lname}`,
        sponsorEmail: sponsor.email,
        position: teamMember.position || "N/A",
      } : null;
    }

    // ==================== 4. LEG COUNTS (STORED) ====================
    const storedLegCounts = {
      leftLegCount: teamMember.leftLegCount || 0,
      rightLegCount: teamMember.rightLegCount || 0,
      totalActiveAffiliates: teamMember.totalActiveAffiliates || 0,
      directCount: teamMember.directCount || 0,
    };

    // ==================== 5. LEG COUNTS (CALCULATED - LIVE) ====================
    const leftChildren = await TeamMember.find({
      sponsorId: teamMember._id,
      position: 'left'
    });

    let calculatedLeftCount = 0;
    for (const child of leftChildren) {
      const descendants = await countAllDescendants(child._id, new Set());
      calculatedLeftCount += 1 + descendants;
    }

    const rightChildren = await TeamMember.find({
      sponsorId: teamMember._id,
      position: 'right'
    });

    let calculatedRightCount = 0;
    for (const child of rightChildren) {
      const descendants = await countAllDescendants(child._id, new Set());
      calculatedRightCount += 1 + descendants;
    }

    const calculatedLegCounts = {
      leftLegCount: calculatedLeftCount,
      rightLegCount: calculatedRightCount,
      totalActiveAffiliates: calculatedLeftCount + calculatedRightCount,
    };

    const legCountsMatch = 
      storedLegCounts.leftLegCount === calculatedLeftCount &&
      storedLegCounts.rightLegCount === calculatedRightCount;

    // ==================== 6. PV VALUES (STORED) ====================
    const storedPV = {
      leftLegPV: teamMember.leftLegPV || 0,
      rightLegPV: teamMember.rightLegPV || 0,
      totalPV: (teamMember.leftLegPV || 0) + (teamMember.rightLegPV || 0),
      weakerLegPV: Math.min(teamMember.leftLegPV || 0, teamMember.rightLegPV || 0),
      strongerLegPV: Math.max(teamMember.leftLegPV || 0, teamMember.rightLegPV || 0),
    };

    // ==================== 7. PV VALUES (CALCULATED - LIVE) ====================
    const { calculateCompleteBinaryTreePV } = await import('../../helpers/binaryCommissionHelper.js');
    const calculatedPVData = await calculateCompleteBinaryTreePV(userId);
    
    const calculatedPV = {
      leftLegPV: calculatedPVData.leftPV || 0,
      rightLegPV: calculatedPVData.rightPV || 0,
      totalPV: calculatedPVData.totalPV || 0,
      weakerLegPV: Math.min(calculatedPVData.leftPV || 0, calculatedPVData.rightPV || 0),
      strongerLegPV: Math.max(calculatedPVData.leftPV || 0, calculatedPVData.rightPV || 0),
    };

    const pvMatch = 
      Math.abs(storedPV.leftLegPV - calculatedPV.leftLegPV) < 1 &&
      Math.abs(storedPV.rightLegPV - calculatedPV.rightLegPV) < 1;

    // ==================== 8. BINARY RANK & COMMISSION ====================
    const { calculateBinaryRank } = await import('../../helpers/binaryRankHelper.js');
    const totalTeam = storedLegCounts.totalActiveAffiliates;
    const rankData = calculateBinaryRank(totalTeam);

    const binaryRank = {
      currentRank: rankData.rank,
      commissionPercentage: rankData.percentage,
      requiredMembers: rankData.minMembers,
      membersToNextRank: rankData.nextRankMembers ? rankData.nextRankMembers - totalTeam : null,
      nextRank: rankData.nextRank || "MAX RANK",
      highestRankAchieved: teamMember.highestRankAchieved || "NONE",
    };

    // ==================== 9. CARRY FORWARD VALUES ====================
    const carryForward = {
      carryForwardLeftPV: teamMember.carryForwardLeftPV || 0,
      carryForwardRightPV: teamMember.carryForwardRightPV || 0,
      lastBinaryCalculation: teamMember.lastBinaryCalculation || null,
    };

    // ==================== 10. MATCHING & PAIRING ====================
    const totalLeftPV = (carryForward.carryForwardLeftPV || 0) + (storedPV.leftLegPV || 0);
    const totalRightPV = (carryForward.carryForwardRightPV || 0) + (storedPV.rightLegPV || 0);
    const matchedPV = Math.min(totalLeftPV, totalRightPV);
    const pairs = Math.floor(matchedPV / 94.5);
    const potentialCommission = matchedPV * (rankData.percentage / 100);

    const matching = {
      totalLeftPV,
      totalRightPV,
      matchedPV,
      pairs,
      unmatchedLeftPV: totalLeftPV - matchedPV,
      unmatchedRightPV: totalRightPV - matchedPV,
      potentialCommission,
      pairValue: 94.5,
      matchingRatio: `1:2`,
    };

    // ==================== 11. COMMISSION EARNINGS ====================
    const Commission = (await import('../../models/commissionModel.js')).default;
    
    const commissionStats = await Commission.aggregate([
      { $match: { userId: teamMember._id } },
      {
        $group: {
          _id: "$commissionType",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const commissionBreakdown = {};
    let totalCommissions = 0;

    commissionStats.forEach(stat => {
      commissionBreakdown[stat._id] = {
        total: stat.totalAmount,
        count: stat.count,
      };
      totalCommissions += stat.totalAmount;
    });

    const earnings = {
      totalEarnings: teamMember.totalEarnings || 0,
      directBonusIncome: teamMember.directBonusIncome || 0,
      levelIncome: teamMember.levelIncome || 0,
      binaryIncome: teamMember.binaryIncome || 0,
      availableBalance: teamMember.totalEarnings - (teamMember.totalWithdrawn || 0),
      totalWithdrawn: teamMember.totalWithdrawn || 0,
      commissionBreakdown,
      totalCommissionRecords: commissionStats.reduce((sum, s) => sum + s.count, 0),
    };

    // ==================== 12. VALIDATION STATUS ====================
    const validation = {
      legCountsMatch,
      pvMatch,
      countsNeedUpdate: !legCountsMatch,
      pvNeedsUpdate: !pvMatch,
      allDataValid: legCountsMatch && pvMatch,
      lastUpdated: teamMember.updatedAt,
    };

    // ==================== 13. DIRECT CHILDREN BREAKDOWN ====================
    const leftChildrenDetails = await TeamMember.find({
      sponsorId: teamMember._id,
      position: 'left'
    }).populate("userId", "fname lname email");

    const leftLegBreakdown = [];
    for (const child of leftChildrenDetails) {
      const descendants = await countAllDescendants(child._id, new Set());
      leftLegBreakdown.push({
        memberId: child._id,
        name: `${child.userId.fname} ${child.userId.lname}`,
        email: child.userId.email,
        directDescendants: descendants,
        totalContribution: 1 + descendants,
        pv: child.leftLegPV + child.rightLegPV + 94.5, // Their tree + themselves
      });
    }

    const rightChildrenDetails = await TeamMember.find({
      sponsorId: teamMember._id,
      position: 'right'
    }).populate("userId", "fname lname email");

    const rightLegBreakdown = [];
    for (const child of rightChildrenDetails) {
      const descendants = await countAllDescendants(child._id, new Set());
      rightLegBreakdown.push({
        memberId: child._id,
        name: `${child.userId.fname} ${child.userId.lname}`,
        email: child.userId.email,
        directDescendants: descendants,
        totalContribution: 1 + descendants,
        pv: child.leftLegPV + child.rightLegPV + 94.5, // Their tree + themselves
      });
    }

    // ==================== 14. STATISTICS SUMMARY ====================
    const statistics = {
      teamSize: totalTeam,
      leftLegSize: storedLegCounts.leftLegCount,
      rightLegSize: storedLegCounts.rightLegCount,
      directReferrals: storedLegCounts.directCount,
      teamBalance: `${storedLegCounts.leftLegCount}:${storedLegCounts.rightLegCount}`,
      balancePercentage: totalTeam > 0 ? {
        left: ((storedLegCounts.leftLegCount / totalTeam) * 100).toFixed(2) + '%',
        right: ((storedLegCounts.rightLegCount / totalTeam) * 100).toFixed(2) + '%',
      } : { left: '0%', right: '0%' },
      totalPV: storedPV.totalPV,
      averagePVPerMember: totalTeam > 0 ? (storedPV.totalPV / totalTeam).toFixed(2) : 0,
    };

    teamLogger.success(`Complete binary analytics retrieved for ${user.fname} ${user.lname}`);

    // ==================== FINAL RESPONSE ====================
    return {
      success: true,
      data: {
        userInfo,
        referralCodes,
        sponsorInfo,
        legCounts: {
          stored: storedLegCounts,
          calculated: calculatedLegCounts,
          match: legCountsMatch,
        },
        pv: {
          stored: storedPV,
          calculated: calculatedPV,
          match: pvMatch,
        },
        binaryRank,
        carryForward,
        matching,
        earnings,
        validation,
        leftLegBreakdown,
        rightLegBreakdown,
        statistics,
      },
    };
  } catch (error) {
    teamLogger.error("Error getting complete binary analytics", error);
    return {
      success: false,
      message: error.message,
    };
  }
};