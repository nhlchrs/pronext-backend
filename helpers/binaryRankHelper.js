/**
 * Binary Rank System Helper
 * 
 * Binary bonus is activated ONLY after 10+ direct referrals (Level 1)
 * Commission is calculated on the SMALLER leg (weaker leg)
 * Ranks are based on total active affiliates
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

// PV (Point Value) configuration
export const PV_PER_AFFILIATE = 42; // Based on subscription (70% of $1.35 = $0.945, calculated on 42 PV)

/**
 * Check if binary bonus is activated
 * Binary is activated when user has 10+ direct referrals
 */
export const isBinaryActivated = (directCount) => {
  return directCount >= 10;
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
 * Calculate weaker leg PV
 * Commission is based on the smaller leg
 */
export const calculateWeakerLegPV = (leftLegPV, rightLegPV) => {
  return Math.min(leftLegPV, rightLegPV);
};

/**
 * Calculate binary commission
 * Only if binary is activated (directCount >= 10)
 * Commission = weakerLegPV * (bonusPercent / 100)
 */
export const calculateBinaryCommission = (
  directCount,
  leftLegPV,
  rightLegPV,
  totalActiveAffiliates
) => {
  // Check if binary is activated
  if (!isBinaryActivated(directCount)) {
    return {
      activated: false,
      commission: 0,
      rank: "NONE",
      bonusPercent: 0,
      weakerLegPV: 0,
      message: "Binary bonus not activated. Need 10+ direct referrals.",
    };
  }

  // Calculate rank and bonus percent
  const rank = calculateBinaryRank(totalActiveAffiliates);
  const weakerLegPV = calculateWeakerLegPV(leftLegPV, rightLegPV);

  // Calculate commission
  const commission = weakerLegPV * (rank.bonusPercent / 100);

  return {
    activated: true,
    commission: parseFloat(commission.toFixed(2)),
    rank: rank.name,
    bonusPercent: rank.bonusPercent,
    weakerLegPV,
    leftLegPV,
    rightLegPV,
    totalActiveAffiliates,
    message: `Binary bonus active. Rank: ${rank.name} (${rank.bonusPercent}%)`,
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
  PV_PER_AFFILIATE,
  isBinaryActivated,
  calculateBinaryRank,
  calculateWeakerLegPV,
  calculateBinaryCommission,
  getNextRankInfo,
  checkCompletionRatio,
  getRankBadge,
  getRankColor,
};
