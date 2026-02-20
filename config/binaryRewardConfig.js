/**
 * Binary Rank Rewards Configuration - Clean Implementation
 * Each rank unlocks ONE specific reward (one-time redeemable)
 * Rewards are based on highest rank achieved (rank drops don't affect eligibility)
 */

export const BINARY_RANK_REWARDS = {
  IGNITOR: {
    rank: "IGNITOR",
    badge: "🔥",
    title: "Ignitor Rank Achieved!",
    rewardType: "T-SHIRT",
    rewardName: "Premium ProNet T-Shirt",
    rewardDescription: "High-quality branded t-shirt",
    requiresSize: true,
    requiresColor: true,
    colors: ["Black", "White", "Navy Blue", "Red"],
    requiresShipping: true,
  },
  SPARK: {
    rank: "SPARK",
    badge: "⚡",
    title: "Spark Rank Achieved!",
    rewardType: "GIFT_HAMPER",
    rewardName: "Premium Gift Hamper",
    rewardDescription: "Curated selection of premium items",
    requiresSize: false,
    requiresColor: false,
    requiresShipping: true,
  },
  RISER: {
    rank: "RISER",
    badge: "📈",
    title: "Riser Rank Achieved!",
    rewardType: "OFFICE_BAG",
    rewardName: "Professional Office Bag",
    rewardDescription: "Premium quality office/laptop bag",
    requiresSize: false,
    requiresColor: true,
    colors: ["Black", "Brown", "Navy Blue"],
    requiresShipping: true,
  },
  PIONEER: {
    rank: "PIONEER",
    badge: "🎖️",
    title: "Pioneer Rank Achieved!",
    rewardType: "DINNER_SET",
    rewardName: "Premium Dinner Set",
    rewardDescription: "Elegant dinner set for special occasions",
    requiresSize: false,
    requiresColor: false,
    requiresShipping: true,
  },
  INNOVATOR: {
    rank: "INNOVATOR",
    badge: "💡",
    title: "Innovator Rank Achieved!",
    rewardType: "HEADPHONES",
    rewardName: "Premium Wireless Headphones",
    rewardDescription: "High-quality wireless headphones",
    requiresSize: false,
    requiresColor: true,
    colors: ["Black", "Silver", "White"],
    requiresShipping: true,
  },
  CATALYST: {
    rank: "CATALYST",
    badge: "⭐",
    title: "Catalyst Rank Achieved!",
    rewardType: "TITAN_WATCH",
    rewardName: "Titan Watch",
    rewardDescription: "Premium Titan watch",
    requiresSize: false,
    requiresColor: false,
    requiresShipping: true,
  },
  TRAILBLAZER: {
    rank: "TRAILBLAZER",
    badge: "🏆",
    title: "Trailblazer Rank Achieved!",
    rewardType: "PURCHASE_VOUCHER",
    rewardName: "Purchase Voucher",
    rewardDescription: "Shopping voucher for your favorite stores",
    requiresSize: false,
    requiresColor: false,
    requiresShipping: false,
    voucherAmount: 10000,
  },
  VANGUARD: {
    rank: "VANGUARD",
    badge: "🛡️",
    title: "Vanguard Rank Achieved!",
    rewardType: "THAILAND_TOUR_1",
    rewardName: "Thailand Tour (1 Person)",
    rewardDescription: "All-inclusive Thailand tour package for 1 person",
    requiresSize: false,
    requiresColor: false,
    requiresShipping: false,
  },
  LUMINARY: {
    rank: "LUMINARY",
    badge: "✨",
    title: "Luminary Rank Achieved!",
    rewardType: "THAILAND_TOUR_2",
    rewardName: "Thailand Tour (2 People)",
    rewardDescription: "All-inclusive Thailand tour package for 2 people",
    requiresSize: false,
    requiresColor: false,
    requiresShipping: false,
  },
  MOGUL: {
    rank: "MOGUL",
    badge: "💎",
    title: "Mogul Rank Achieved!",
    rewardType: "BAJAJ_CHETAK_EV",
    rewardName: "Bajaj Chetak EV",
    rewardDescription: "Brand new Bajaj Chetak Electric Vehicle",
    requiresSize: false,
    requiresColor: true,
    colors: ["Red", "Blue", "White", "Black"],
    requiresShipping: false,
  },
  SOVEREIGN: {
    rank: "SOVEREIGN",
    badge: "👑",
    title: "Sovereign Rank Achieved!",
    rewardType: "ROYAL_ENFIELD",
    rewardName: "Royal Enfield Motorcycle",
    rewardDescription: "Brand new Royal Enfield motorcycle",
    requiresSize: false,
    requiresColor: true,
    colors: ["Black", "Chrome", "Military Green"],
    requiresShipping: false,
  },
  ZENITH: {
    rank: "ZENITH",
    badge: "🌟",
    title: "Zenith Rank Achieved! (Highest Rank)",
    rewardType: "CASH_REWARD",
    rewardName: "₹4,00,000 Cash Reward",
    rewardDescription: "Four lakh rupees cash reward",
    requiresSize: false,
    requiresColor: false,
    requiresShipping: false,
    cashAmount: 400000,
  },
};

/**
 * Get reward configuration for a specific rank
 */
export const getRewardForRank = (rank) => {
  return BINARY_RANK_REWARDS[rank] || null;
};

/**
 * Get all available ranks
 */
export const getAllRanks = () => {
  return Object.keys(BINARY_RANK_REWARDS);
};

/**
 * Check if rank has rewards available
 */
export const hasRewards = (rank) => {
  return BINARY_RANK_REWARDS[rank] !== undefined;
};

export default {
  BINARY_RANK_REWARDS,
  getRewardForRank,
  getAllRanks,
  hasRewards,
};
