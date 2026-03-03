import mongoose from 'mongoose';
import User from './models/authModel.js';
import { TeamMember } from './models/teamModel.js';
import Commission from './models/commissionModel.js';
import dotenv from 'dotenv';

dotenv.config();

const PACKAGE_PRICE = 135;

const createDirectCommissions = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find the main user
    const mainUser = await User.findOne({ email: 'nihal1@test.com' });
    
    if (!mainUser) {
      console.log('❌ Main user (nihal1@test.com) not found');
      return;
    }

    console.log('👤 Main User:', mainUser.fname, mainUser.lname, `(${mainUser.email})`);
    console.log('   User ID:', mainUser._id);
    console.log('');

    // Find their team member record
    const mainTeamMember = await TeamMember.findOne({ userId: mainUser._id });
    
    if (!mainTeamMember) {
      console.log('❌ Team member record not found');
      return;
    }

    // Get all direct referrals
    const directReferrals = await TeamMember.find({ sponsorId: mainUser._id })
      .populate('userId', 'fname lname email');

    console.log(`📋 Found ${directReferrals.length} direct referrals\n`);

    // Calculate direct bonus percentage based on total direct count
    const getDirectBonusPercentage = (totalDirects) => {
      if (totalDirects >= 250) return 9;
      if (totalDirects >= 120) return 8;
      if (totalDirects >= 40) return 7;
      if (totalDirects >= 12) return 6;
      if (totalDirects >= 3) return 5;
      return 0;
    };

    let totalDirectsProcessed = 0;
    let totalCommissionGenerated = 0;
    const now = new Date();

    console.log('💰 Creating Direct Referral Commissions...\n');

    // Create commission for each direct referral
    for (const referral of directReferrals) {
      totalDirectsProcessed++;
      
      const bonusPercentage = getDirectBonusPercentage(totalDirectsProcessed);
  const grossAmount = (PACKAGE_PRICE * bonusPercentage) / 100;

      if (grossAmount > 0) {
        // Create commission record
        const commission = await Commission.create({
          userId: mainUser._id,
          referrerId: referral.userId._id,
          transactionId: new mongoose.Types.ObjectId(), // Fake transaction ID
          commissionType: 'direct_bonus',
          level: 1, // Direct referral is level 1
          grossAmount,
          taxPercentage: 0,
          taxAmount: 0,
          netAmount: grossAmount,
          status: 'pending',
          earningDate: now,
          period: {
            month: now.getMonth() + 1,
            year: now.getFullYear(),
          },
          description: `Direct bonus for referral of ${referral.userId.fname} ${referral.userId.lname} (${totalDirectsProcessed} total directs - ${bonusPercentage}%)`,
          metadata: {
            totalDirectCount: totalDirectsProcessed,
            bonusPercentage: bonusPercentage,
            referralName: `${referral.userId.fname} ${referral.userId.lname}`,
          },
        });

        totalCommissionGenerated += grossAmount;

        console.log(`✅ [${totalDirectsProcessed}/${directReferrals.length}] ${referral.userId.fname} ${referral.userId.lname}`);
        console.log(`   Bonus: ${bonusPercentage}% = $${grossAmount.toFixed(2)}`);
        console.log('');
      } else {
        console.log(`⚠️  [${totalDirectsProcessed}/${directReferrals.length}] ${referral.userId.fname} ${referral.userId.lname} - No commission (needs 3+ directs)`);
        console.log('');
      }
    }

    // Update team member's total earnings
    await TeamMember.findOneAndUpdate(
      { userId: mainUser._id },
      { 
        $inc: { totalEarnings: totalCommissionGenerated },
        totalEarningsAmount: totalCommissionGenerated 
      }
    );

    console.log('================================================================================');
    console.log('✅ COMMISSION GENERATION COMPLETE');
    console.log('================================================================================');
    console.log(`Total Direct Referrals:    ${directReferrals.length}`);
    console.log(`Commissions Created:       ${totalDirectsProcessed}`);
    console.log(`Total Commission Amount:   $${totalCommissionGenerated.toFixed(2)}`);
    console.log('================================================================================\n');

    // Verify commissions were created
    const createdCommissions = await Commission.find({ userId: mainUser._id });
    console.log(`💰 Verifying - Found ${createdCommissions.length} commission records\n`);

    // Group by type
    const byType = {};
    createdCommissions.forEach(comm => {
      byType[comm.commissionType] = (byType[comm.commissionType] || 0) + comm.netAmount;
    });

    console.log('📊 Commission Breakdown:');
    Object.keys(byType).forEach(type => {
      console.log(`   ${type}: $${byType[type].toFixed(2)}`);
    });
    console.log('');

    console.log('💡 Next Steps:');
    console.log('   1. Refresh your frontend (earnings breakdown page)');
    console.log('   2. API endpoint: GET /api/commission/breakdown');
    console.log('   3. Check commissions: GET /api/commission/history');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

createDirectCommissions();
