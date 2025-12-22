// Bonus calculation service based on structure v1.0

export const BONUS_STRUCTURE = {
  packagePrice: 135,
  directBonus: {
    1: { min: 1, max: 3, percentage: 8.34, perSale: 11.25 },
    2: { min: 4, max: 6, percentage: 16.68, perSale: 22.5 },
    3: { min: 7, max: 9, percentage: 25, perSale: 33.75 },
    4: { min: 10, max: Infinity, percentage: 33.4, perSale: 44.5 },
  },
  levelIncome: {
    1: { percentage: 1, perSale: 1.35 },
    2: { percentage: 1.5, perSale: 2.02 },
    3: { percentage: 2, perSale: 2.7 },
    4: { percentage: 3, perSale: 4.05 },
  },
  reward: {
    percentage: 1.5,
    amount: 2.025,
  },
  binary: {
    percentage: 14,
    amount: 18.9,
  },
  totalPayout: 56.4,
};

// Calculate Direct Bonus based on number of directs
export const calculateDirectBonus = (directCount, packagePrice = 135) => {
  let slab = null;
  for (const [key, value] of Object.entries(BONUS_STRUCTURE.directBonus)) {
    if (directCount >= value.min && directCount <= value.max) {
      slab = value;
      break;
    }
  }

  if (!slab) return 0;

  return (packagePrice * slab.percentage) / 100;
};

// Calculate Level Income
export const calculateLevelIncome = (level, salesCount, packagePrice = 135) => {
  if (level < 1 || level > 4) return 0;

  const levelData = BONUS_STRUCTURE.levelIncome[level];
  return (packagePrice * levelData.percentage * salesCount) / 100;
};

// Calculate Reward Bonus
export const calculateRewardBonus = (packagePrice = 135) => {
  return (packagePrice * BONUS_STRUCTURE.reward.percentage) / 100;
};

// Calculate Binary Bonus
export const calculateBinaryBonus = (packagePrice = 135) => {
  return (packagePrice * BONUS_STRUCTURE.binary.percentage) / 100;
};

// Determine user level based on downline structure
export const determineUserLevel = (downlineStructure) => {
  const totalDownline = downlineStructure.total;

  if (totalDownline >= 1000) return 4;
  if (totalDownline >= 500) return 3;
  if (totalDownline >= 100) return 2;
  if (totalDownline >= 10) return 1;
  return 0;
};

// Get direct bonus slab info
export const getDirectBonusSlab = (directCount) => {
  for (const [key, value] of Object.entries(BONUS_STRUCTURE.directBonus)) {
    if (directCount >= value.min && directCount <= value.max) {
      return {
        slabNumber: parseInt(key),
        ...value,
        nextSlab:
          directCount < value.max
            ? null
            : BONUS_STRUCTURE.directBonus[parseInt(key) + 1] || null,
        directsNeeded:
          directCount < value.max ? value.max + 1 - directCount : 0,
      };
    }
  }
  return null;
};

// Calculate total earnings for a period
export const calculateTotalEarnings = (bonusData) => {
  const {
    directBonus = 0,
    levelIncome = 0,
    rewardBonus = 0,
    binaryBonus = 0,
  } = bonusData;

  return directBonus + levelIncome + rewardBonus + binaryBonus;
};

// Check if user qualifies for level income (needs 10 directs)
export const checkLevelIncomQualification = (directCount) => {
  return directCount >= 10;
};

// Generate bonus breakdown report
export const generateBonusBreakdown = (userData, directCount) => {
  const packagePrice = userData.packagePrice || 135;
  const level = userData.level || 0;

  return {
    packagePrice,
    directBonus: calculateDirectBonus(directCount, packagePrice),
    directBonusSlab: getDirectBonusSlab(directCount),
    levelIncome:
      level > 0 ? calculateLevelIncome(level, userData.teamMembers?.length || 0, packagePrice) : 0,
    rewardBonus: calculateRewardBonus(packagePrice),
    binaryBonus: calculateBinaryBonus(packagePrice),
    totalEarnings: calculateTotalEarnings({
      directBonus: calculateDirectBonus(directCount, packagePrice),
      levelIncome: level > 0 ? calculateLevelIncome(level, userData.teamMembers?.length || 0, packagePrice) : 0,
      rewardBonus: calculateRewardBonus(packagePrice),
      binaryBonus: calculateBinaryBonus(packagePrice),
    }),
  };
};

// Calculate next milestone
export const getNextMilestone = (directCount) => {
  const slab = getDirectBonusSlab(directCount);

  if (!slab) {
    return {
      currentSlab: null,
      nextSlab: BONUS_STRUCTURE.directBonus[1],
      directsNeeded: 1 - directCount,
    };
  }

  if (directCount >= 10) {
    return {
      currentSlab: slab,
      milestone: "Max Slab Achieved",
      directsNeeded: 0,
    };
  }

  return {
    currentSlab: slab,
    nextSlab:
      directCount < slab.max
        ? null
        : BONUS_STRUCTURE.directBonus[Math.min(4, Math.ceil(directCount / 3))],
    directsNeeded: slab.directsNeeded,
  };
};
