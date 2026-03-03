import mongoose from 'mongoose';
import Commission from './models/commissionModel.js';
import User from './models/authModel.js';
import dotenv from 'dotenv';

dotenv.config();

const checkCommissionDates = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const user = await User.findOne({ email: 'nihal1@test.com' });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('👤 User:', user.email);
    console.log('   User ID:', user._id);
    console.log('');

    // Get all commissions for this user
    const commissions = await Commission.find({ userId: user._id });
    
    console.log(`📊 Found ${commissions.length} commission records\n`);

    commissions.forEach((comm, idx) => {
      console.log(`Commission ${idx + 1}:`);
      console.log(`  Type: ${comm.commissionType}`);
      console.log(`  Amount: $${comm.netAmount}`);
      console.log(`  Status: ${comm.status}`);
      console.log(`  createdAt: ${comm.createdAt}`);
      console.log(`  createdAt (ISO): ${comm.createdAt?.toISOString()}`);
      console.log(`  earningDate: ${comm.earningDate}`);
      console.log(`  earningDate (ISO): ${comm.earningDate?.toISOString()}`);
      console.log(`  updatedAt: ${comm.updatedAt}`);
      console.log('');
    });

    // Test with no date filter
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('TEST 1: Aggregation WITHOUT date filter (all-time)');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const allTimeResult = await Commission.aggregate([
      {
        $match: {
          userId: user._id,
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

    console.log('Result:', JSON.stringify(allTimeResult, null, 2));
    console.log('');

    // Test with current month date filter
    let start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    let end = new Date();
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('TEST 2: Aggregation WITH current month date filter');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Date range:');
    console.log(`  Start: ${start.toISOString()}`);
    console.log(`  End: ${end.toISOString()}`);
    console.log('');

    const monthResult = await Commission.aggregate([
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

    console.log('Result:', JSON.stringify(monthResult, null, 2));
    console.log('');

    // Check if commissions fall within the date range
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('DATE RANGE ANALYSIS');
    console.log('═══════════════════════════════════════════════════════════════');
    
    commissions.forEach((comm, idx) => {
      const commDate = comm.createdAt || comm.earningDate;
      const isInRange = commDate >= start && commDate < end;
      console.log(`Commission ${idx + 1}:`);
      console.log(`  Date: ${commDate?.toISOString()}`);
      console.log(`  In current month range: ${isInRange ? '✅ YES' : '❌ NO'}`);
      if (!isInRange) {
        if (commDate < start) {
          const daysBefore = Math.ceil((start - commDate) / (1000 * 60 * 60 * 24));
          console.log(`  --> ${daysBefore} days BEFORE start date`);
        } else {
          const daysAfter = Math.ceil((commDate - end) / (1000 * 60 * 60 * 24));
          console.log(`  --> ${daysAfter} days AFTER end date`);
        }
      }
      console.log('');
    });

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('💡 SOLUTION');
    console.log('═══════════════════════════════════════════════════════════════');
    
    if (monthResult.length === 0 && allTimeResult.length > 0) {
      console.log('⚠️  Commissions exist but are outside the current month date range!');
      console.log('');
      console.log('Options to fix:');
      console.log('1. API should query ALL-TIME earnings (no date filter)');
      console.log('2. Or adjust date range to include all commission dates');
      console.log('3. Or update commission createdAt to be within current month');
    } else {
      console.log('✅ Commissions are within the date range');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('');
    console.log('🔌 Disconnected from MongoDB');
  }
};

checkCommissionDates();
