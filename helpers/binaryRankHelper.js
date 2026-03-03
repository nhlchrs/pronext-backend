/**
 * Binary Rank System Helper
 * 
 * UPDATED SYSTEM:
 * - Phase 1: Binary activates with 1:2 ratio (not 10+ directs)
 * - Phase 2: Weekly 1:1 matching every Friday 23:59
 * - PV Generation: 94.5 PV per $135 subscription
 * - Ranks based on total active affiliates
 */

// Binary Rank Configuration
export const BINARY_RANKS = [
  { name: "NONE", minAffiliates: 0, bonusPercent: 0 },
  { name: "IGNITOR", minAffiliates: 3, bonusPercent: 10 },
  { name: "SPARK", minAffiliates: 12, bonusPercent: 10 },
  { name: "RISER", minAffiliates: 40, bonusPercent: 10 },
  { name: "PIONEER", minAffiliates: 120, bonusPercent: 10 },
  { name: "INNOVATOR", minAffiliates: 250, bonusPercent: 10 },
  { name: "TRAILBLAZER", minAffiliates: 500, bonusPercent: 15 },
  { name: "CATALYST", minAffiliates: 1111, bonusPercent: 15 },
  { name: "MOGUL", minAffiliates: 2777, bonusPercent: 15 },
  { name: "VANGUARD", minAffiliates: 5555, bonusPercent: 15 },
  { name: "LUMINARY", minAffiliates: 11111, bonusPercent: 20 },
  { name: "SOVEREIGN", minAffiliates: 22222, bonusPercent: 20 },
  { name: "ZENITH", minAffiliates: 44444, bonusPercent: 20 },
];

// PV Configuration
export const PV_PER_SUBSCRIPTION = 94.5; // Each $135 subscription = 94.5 PV
export const SUBSCRIPTION_PRICE = 135;

/**
 * Check if binary bonus is activated (1:2 minimum criteria)
 * Formula: (Left >= 1 AND Right >= 2) OR (Right >= 1 AND Left >= 2)
 */
export const isBinaryActivated = (leftLegCount, rightLegCount) => {
  return (leftLegCount >= 1 && rightLegCount >= 2) ||
         (rightLegCount >= 1 && leftLegCount >= 2);
};

/**
 * Calculate binary rank based on total active affiliates
 * @param {number} totalActiveAffiliates - Total active team members
 * @returns {object} Rank object with name and bonusPercent
 */
export const calculateBinaryRank = (totalActiveAffiliates) => {
  // Find the highest rank the user qualifies for
  let currentRank = BINARY_RANKS[0]; // Default to NONE

  for (const rank of BINARY_RANKS) {
    if (totalActiveAffiliates >= rank.minAffiliates) {
      currentRank = rank;
    } else {
      break; // Stop at first unqualified rank
    }
  }

  return currentRank;
};

/**
 * Calculate weaker leg PV (Simple matching - 1:1)
 * Commission is based on the smaller leg
 */
export const calculateWeakerLegPV = (leftLegPV, rightLegPV) => {
  return Math.min(leftLegPV, rightLegPV);
};

/**
 * Calculate 1:2 Matching Volume
 * User can match either:
 * - 1 unit from left with 2 from right
 * - 2 units from left with 1 from right
 * Takes the MAXIMUM possible matching
 */
export const calculate1to2Matching = (leftLegPV, rightLegPV) => {
  // Option 1: Match 1 from left with 2 from right
  // matched_left = MIN(LPro, RPro / 2)
  const matchedLeft = Math.min(leftLegPV, rightLegPV / 2);
  
  // Option 2: Match 2 from left with 1 from right
  // matched_right = MIN(RPro, LPro / 2)
  const matchedRight = Math.min(rightLegPV, leftLegPV / 2);
  
  // Take the maximum matching
  const matchedVolume = Math.max(matchedLeft, matchedRight);
  
  return {
    matchedVolume,
    matchedLeft,
    matchedRight,
    carryForwardLeft: leftLegPV - (matchedVolume === matchedLeft ? matchedVolume : matchedVolume * 2),
    carryForwardRight: rightLegPV - (matchedVolume === matchedRight ? matchedVolume : matchedVolume * 2),
  };
};

/**
 * Calculate binary commission
 * Activation based on leg ratio (1:2 or 2:1)
 * Uses 1:2 Matching Rule for commission calculation
 * Commission = matchedVolume * (bonusPercent / 100)
 */
export const calculateBinaryCommission = (
  leftLegCount,
  rightLegCount,
  leftLegPV,
  rightLegPV,
  totalActiveAffiliates
) => {
  // Always calculate rank based on totalActiveAffiliates
  const rank = calculateBinaryRank(totalActiveAffiliates);
  
  // Check if binary commission is activated (1:2 or 2:1 ratio)
  const activated = isBinaryActivated(leftLegCount, rightLegCount);
  
  if (!activated) {
    return {
      activated: false,
      commission: 0,
      rank: rank.name,
      bonusPercent: rank.bonusPercent,
      matchedVolume: 0,
      weakerLegPV: 0,
      leftLegPV,
      rightLegPV,
      carryForwardLeft: leftLegPV,
      carryForwardRight: rightLegPV,
      totalActiveAffiliates,
      message: "Binary commission not activated. Need 1:2 or 2:1 leg ratio.",
    };
  }

  // Calculate 1:2 matching
  const matching = calculate1to2Matching(leftLegPV, rightLegPV);
  
  // Calculate commission based on matched volume
  const commission = matching.matchedVolume * (rank.bonusPercent / 100);

  return {
    activated: true,
    commission: parseFloat(commission.toFixed(2)),
    rank: rank.name,
    bonusPercent: rank.bonusPercent,
    matchedVolume: matching.matchedVolume,
    matchedLeft: matching.matchedLeft,
    matchedRight: matching.matchedRight,
    weakerLegPV: Math.min(leftLegPV, rightLegPV), // For backward compatibility
    leftLegPV,
    rightLegPV,
    carryForwardLeft: matching.carryForwardLeft,
    carryForwardRight: matching.carryForwardRight,
    totalActiveAffiliates,
    message: `Binary commission active. Matched: ${matching.matchedVolume.toFixed(2)} PV at ${rank.bonusPercent}% = $${commission.toFixed(2)}`,
  };
};

/**
 * Get next rank details
 * Shows what user needs to achieve next rank
 */
export const getNextRankInfo = (totalActiveAffiliates) => {
  const currentRank = calculateBinaryRank(totalActiveAffiliates);
  const currentRankIndex = BINARY_RANKS.findIndex(
    (r) => r.name === currentRank.name
  );

  // If at highest rank
  if (currentRankIndex === BINARY_RANKS.length - 1) {
    return {
      isMaxRank: true,
      currentRank: currentRank.name,
      currentBonusPercent: currentRank.bonusPercent,
      message: "You've achieved the highest rank!",
    };
  }

  const nextRank = BINARY_RANKS[currentRankIndex + 1];
  const affiliatesNeeded = nextRank.minAffiliates - totalActiveAffiliates;

  return {
    isMaxRank: false,
    currentRank: currentRank.name,
    currentBonusPercent: currentRank.bonusPercent,
    nextRank: nextRank.name,
    nextBonusPercent: nextRank.bonusPercent,
    affiliatesNeeded: Math.max(0, affiliatesNeeded),
    message: `${affiliatesNeeded} more active affiliates to reach ${nextRank.name}`,
  };
};

/**
 * Check if 1:2 or 2:1 completion criteria is met
 * Reward is given on completion of 1:2 OR 2:1 ratio
 */
export const checkCompletionRatio = (leftLegCount, rightLegCount) => {
  const ratio = leftLegCount / rightLegCount;

  // Check for 1:2 ratio (0.5)
  const is1to2 = ratio === 0.5 || ratio === 2;

  return {
    isComplete: is1to2,
    leftLegCount,
    rightLegCount,
    ratio: `${leftLegCount}:${rightLegCount}`,
    message: is1to2
      ? "Completion ratio achieved! Commission will be calculated."
      : "Keep building to achieve 1:2 or 2:1 ratio",
  };
};

/**
 * Get rank badge emoji/icon
 */
export const getRankBadge = (rankName) => {
  const badges = {
    NONE: "⚪",
    IGNITOR: "🔥",
    SPARK: "⚡",
    RISER: "📈",
    PIONEER: "🎖️",
    INNOVATOR: "💡",
    TRAILBLAZER: "🏆",
    CATALYST: "⭐",
    MOGUL: "💎",
    VANGUARD: "🛡️",
    LUMINARY: "✨",
    SOVEREIGN: "👑",
    ZENITH: "🌟",
  };

  return badges[rankName] || "⚪";
};

/**
 * Get rank color for UI
 */
export const getRankColor = (rankName) => {
  const colors = {
    NONE: "#9CA3AF",
    IGNITOR: "#EF4444",
    SPARK: "#F59E0B",
    RISER: "#10B981",
    PIONEER: "#3B82F6",
    INNOVATOR: "#6366F1",
    TRAILBLAZER: "#8B5CF6",
    CATALYST: "#A855F7",
    MOGUL: "#EC4899",
    VANGUARD: "#F43F5E",
    LUMINARY: "#FCD34D",
    SOVEREIGN: "#FDE047",
    ZENITH: "#FFD700",
  };

  return colors[rankName] || "#9CA3AF";
};

export default {
  BINARY_RANKS,
  PV_PER_SUBSCRIPTION,
  SUBSCRIPTION_PRICE,
  isBinaryActivated,
  calculateBinaryRank,
  calculateWeakerLegPV,
  calculate1to2Matching,
  calculateBinaryCommission,
  getNextRankInfo,
  checkCompletionRatio,
  getRankBadge,
  getRankColor,
};
