import mongoose from 'mongoose';
import User from './models/authModel.js';
import Commission from './models/commissionModel.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Test the commission breakdown API logic
 */
const testCommissionBreakdown = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find nihal1 user
    const user = await User.findOne({ email: 'nihal1@test.com' });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('👤 Testing for user:', user.email);
    console.log('   User ID:', user._id);
    console.log('');

    // Set date range (current month)
    let start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    let end = new Date();
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);

    console.log('📅 Date Range:');
    console.log('   Start:', start.toISOString());
    console.log('   End:', end.toISOString());
    console.log('');

    // Test the aggregation query (same as API uses)
    console.log('🔍 Running aggregation query...');
    const commissions = await Commission.aggregate([
      {
        $match: {
          userId: user._id,
          createdAt: {
            $gte: start,
            $lt: end,
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

    console.log('📊 Aggregation Results:');
    console.log(JSON.stringify(commissions, null, 2));
    console.log('');

    // Build breakdown object (same as API)
    const breakdown = {
      direct_bonus: 0,
      level_income: 0,
      binary_bonus: 0,
      reward_bonus: 0,
    };

    commissions.forEach((item) => {
      if (item._id === "direct_bonus") breakdown.direct_bonus = item.total;
      if (item._id === "level_income") breakdown.level_income = item.total;
      if (item._id === "binary_bonus") breakdown.binary_bonus = item.total;
      if (item._id === "reward_bonus") breakdown.reward_bonus = item.total;
    });

    console.log('💰 Final Breakdown Object (what API returns):');
    console.log(JSON.stringify(breakdown, null, 2));
    console.log('');

    // Check all commissions for this user (without date filter)
    const allCommissions = await Commission.find({ userId: user._id });
    console.log(`📝 Total commission records (all time): ${allCommissions.length}`);
    
    if (allCommissions.length > 0) {
      console.log('');
      console.log('All Commission Records:');
      allCommissions.forEach((comm, idx) => {
        console.log(`  ${idx + 1}. Type: ${comm.commissionType}`);
        console.log(`     Amount: $${comm.netAmount}`);
        console.log(`     Created: ${comm.createdAt || comm.earningDate}`);
        console.log(`     Status: ${comm.status}`);
      });
      console.log('');
      
      // Check if any are outside date range
      const outsideDateRange = allCommissions.filter(c => {
        const date = c.createdAt || c.earningDate;
        return date < start || date >= end;
      });
      
      if (outsideDateRange.length > 0) {
        console.log('⚠️  WARNING: Some commissions are outside the current month date range!');
        console.log(`   ${outsideDateRange.length} of ${allCommissions.length} commissions will not show in API`);
        console.log('');
        console.log('   Solution options:');
        console.log('   1. Frontend should call API without date filters (show all-time earnings)');
        console.log('   2. Or update commission createdAt dates to current month');
        console.log('');
      }
    }

    // Simulate API response
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📡 SIMULATED API RESPONSE');
    console.log('═══════════════════════════════════════════════════════════════');
    const apiResponse = {
      success: true,
      message: "Commission breakdown retrieved successfully",
      breakdown: breakdown,
      period: {
        startDate: start,
        endDate: end,
      },
    };
    console.log(JSON.stringify(apiResponse, null, 2));
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

testCommissionBreakdown();
