/**
 * Generate Commissions After Team Structure Setup
 * Run this AFTER you've manually assigned sponsors to test users
 * This will trigger commission generation for all users with payments but no commissions
 */

import mongoose from 'mongoose';
import paymentModel from './models/paymentModel.js';
import { TeamMember } from './models/teamModel.js';
import { generatePurchaseCommissions } from './helpers/commissionService.js';
import Commission from './models/commissionModel.js';
import dotenv from 'dotenv';

dotenv.config();

const generateCommissionsForTeamStructure = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all finished payments
    console.log('📊 Finding all completed payments...');
    const payments = await paymentModel.find({ status: 'finished' }).sort({ createdAt: 1 });
    console.log(`Found ${payments.length} completed payments\n`);

    let commissionsGeneratedCount = 0;
    let skippedCount = 0;
    let processedCount = 0;
    const errors = [];

    console.log('🔄 Processing payments and generating commissions...\n');

    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i];
      
      try {
        // Check if user has a team member entry with sponsor
        const teamMember = await TeamMember.findOne({ userId: payment.userId });
        
        if (!teamMember) {
          console.log(`⚠️  [${i + 1}/${payments.length}] Skipped: Payment ${payment.orderId} (No TeamMember entry)`);
          skippedCount++;
          continue;
        }

        if (!teamMember.sponsorId) {
          console.log(`⚠️  [${i + 1}/${payments.length}] Skipped: Payment ${payment.orderId} (No sponsor - root user)`);
          skippedCount++;
          continue;
        }

        // Check if commissions already exist for this payment
        const existingCommissions = await Commission.find({ transactionId: payment._id });
        
        if (existingCommissions.length > 0) {
          console.log(`⏭️  [${i + 1}/${payments.length}] Skipped: Payment ${payment.orderId} (${existingCommissions.length} commissions already exist)`);
          skippedCount++;
          continue;
        }

        // Generate commissions for this payment
        console.log(`💰 [${i + 1}/${payments.length}] Processing payment: ${payment.orderId} (User: ${teamMember.userId})`);
        
        try {
          const commissions = await generatePurchaseCommissions(
            payment.userId,
            payment.amount || payment.priceAmount || 135,
            payment._id
          );

          if (commissions && commissions.length > 0) {
            const totalCommission = commissions.reduce((sum, c) => sum + c.netAmount, 0);
            commissionsGeneratedCount += commissions.length;
            processedCount++;
            
            console.log(`   ✅ Generated ${commissions.length} commissions (Total: $${totalCommission.toFixed(2)})`);
            commissions.forEach(comm => {
              console.log(`      - ${comm.commissionType}: $${comm.netAmount.toFixed(2)} → User ${comm.userId}`);
            });
          } else {
            console.log(`   ℹ️  No commissions generated (sponsor may not qualify)`);
            processedCount++;
          }
        } catch (commError) {
          console.error(`   ❌ Commission generation failed: ${commError.message}`);
          errors.push({
            paymentId: payment._id,
            orderId: payment.orderId,
            error: `Commission failed: ${commError.message}`,
          });
        }

      } catch (error) {
        console.error(`❌ [${i + 1}/${payments.length}] Error processing payment ${payment.orderId}:`, error.message);
        errors.push({
          paymentId: payment._id,
          orderId: payment.orderId,
          error: error.message,
        });
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 COMMISSION GENERATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Payments Found:        ${payments.length}`);
    console.log(`Payments Processed:          ${processedCount} 💰`);
    console.log(`Commissions Generated:       ${commissionsGeneratedCount} ✅`);
    console.log(`Skipped (no sponsor/exists): ${skippedCount} ⏭️`);
    console.log(`Errors:                      ${errors.length} ❌`);
    console.log('='.repeat(80));

    if (errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      errors.forEach((err, idx) => {
        console.log(`${idx + 1}. ${err.orderId}: ${err.error}`);
      });
    }

    // Verify commission records
    const totalCommissions = await Commission.countDocuments({});
    const pendingCommissions = await Commission.countDocuments({ status: 'pending' });
    const directBonusCount = await Commission.countDocuments({ commissionType: 'direct_bonus' });
    const levelIncomeCount = await Commission.countDocuments({ commissionType: 'level_income' });
    const binaryBonusCount = await Commission.countDocuments({ commissionType: 'binary_bonus' });
    const rewardBonusCount = await Commission.countDocuments({ commissionType: 'reward_bonus' });

    console.log('\n📈 Current Commission Database Status:');
    console.log(`   - Total Commissions: ${totalCommissions}`);
    console.log(`   - Pending: ${pendingCommissions}`);
    console.log(`   - Direct Bonus: ${directBonusCount}`);
    console.log(`   - Level Income: ${levelIncomeCount}`);
    console.log(`   - Binary Bonus: ${binaryBonusCount}`);
    console.log(`   - Reward Bonus: ${rewardBonusCount}`);

    // Show commission breakdown by user (top earners)
    console.log('\n🏆 Top Commission Earners:');
    const topEarners = await Commission.aggregate([
      { $match: { status: 'pending' } },
      {
        $group: {
          _id: '$userId',
          totalEarnings: { $sum: '$netAmount' },
          commissionCount: { $sum: 1 },
        },
      },
      { $sort: { totalEarnings: -1 } },
      { $limit: 10 },
    ]);

    if (topEarners.length > 0) {
      for (const earner of topEarners) {
        const User = (await import('./models/authModel.js')).default;
        const user = await User.findById(earner._id);
        console.log(`   ${user?.email || earner._id}: $${earner.totalEarnings.toFixed(2)} (${earner.commissionCount} commissions)`);
      }
    } else {
      console.log('   No commissions found');
    }

    console.log('\n✅ Script completed successfully!');
    console.log('\n💡 Next Steps:');
    console.log('   1. Check user dashboards to see commission earnings');
    console.log('   2. Verify commission breakdown API: /api/commission/breakdown');
    console.log('   3. Check pending commissions: /api/commission/pending');
    console.log('   4. Test payout requests');

  } catch (error) {
    console.error('\n❌ Fatal Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the script
generateCommissionsForTeamStructure();
