/**
 * Generate Payment Records and Commissions for Test Users
 * This script creates payment records and triggers commission generation
 * for all subscribed users who have sponsors
 */

import mongoose from 'mongoose';
import User from './models/authModel.js';
import paymentModel from './models/paymentModel.js';
import { TeamMember } from './models/teamModel.js';
import { generatePurchaseCommissions } from './helpers/commissionService.js';
import dotenv from 'dotenv';

dotenv.config();

const PACKAGE_PRICE = 135; // Standard subscription price

const generatePaymentsAndCommissions = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all subscribed users
    console.log('📊 Finding all subscribed users...');
    const subscribedUsers = await User.find({ subscriptionStatus: true });
    console.log(`Found ${subscribedUsers.length} subscribed users\n`);

    let paymentCreatedCount = 0;
    let commissionGeneratedCount = 0;
    let skippedCount = 0;
    const errors = [];

    console.log('🔄 Processing users...\n');

    for (let i = 0; i < subscribedUsers.length; i++) {
      const user = subscribedUsers[i];
      
      try {
        // Check if user has a team member entry
        const teamMember = await TeamMember.findOne({ userId: user._id });
        
        if (!teamMember) {
          console.log(`⚠️  [${i + 1}/${subscribedUsers.length}] Skipped: ${user.email} (No TeamMember entry)`);
          skippedCount++;
          continue;
        }

        if (!teamMember.sponsorId) {
          console.log(`⚠️  [${i + 1}/${subscribedUsers.length}] Skipped: ${user.email} (No sponsor - root user)`);
          skippedCount++;
          continue;
        }

        // Check if payment record already exists for this user
        const existingPayment = await paymentModel.findOne({ userId: user._id, status: 'finished' });
        
        if (existingPayment) {
          console.log(`⏭️  [${i + 1}/${subscribedUsers.length}] Skipped: ${user.email} (Payment already exists)`);
          skippedCount++;
          continue;
        }

        // Create payment record
        const paymentRecord = await paymentModel.create({
          userId: user._id,
          orderId: `TEST-${Date.now()}-${user._id}`,
          paymentId: `PAY-${Date.now()}-${user._id}`,
          invoiceId: `INV-${Date.now()}-${user._id}`,
          amount: PACKAGE_PRICE,
          priceAmount: PACKAGE_PRICE,
          currency: 'USD',
          payCurrency: 'USD',
          status: 'finished', // Completed payment
          provider: 'nowpayments',
          description: `Test subscription payment for ${user.email}`,
          metadata: {
            testPayment: true,
            generatedBy: 'GENERATE_COMMISSIONS_SCRIPT',
            generatedAt: new Date(),
          },
        });

        paymentCreatedCount++;
        console.log(`💳 [${i + 1}/${subscribedUsers.length}] Payment created: ${user.email} ($${PACKAGE_PRICE})`);

        // Generate commissions for this payment
        try {
          const commissions = await generatePurchaseCommissions(
            user._id,
            PACKAGE_PRICE,
            paymentRecord._id
          );

          if (commissions && commissions.length > 0) {
            const totalCommission = commissions.reduce((sum, c) => sum + c.netAmount, 0);
            commissionGeneratedCount += commissions.length;
            
            console.log(`   💰 Generated ${commissions.length} commissions (Total: $${totalCommission.toFixed(2)})`);
            commissions.forEach(comm => {
              console.log(`      - ${comm.commissionType}: $${comm.netAmount.toFixed(2)}`);
            });
          } else {
            console.log(`   ℹ️  No commissions generated (sponsor may not qualify)`);
          }
        } catch (commError) {
          console.error(`   ❌ Commission generation failed: ${commError.message}`);
          errors.push({
            userId: user._id,
            email: user.email,
            error: `Commission failed: ${commError.message}`,
          });
        }

      } catch (error) {
        console.error(`❌ [${i + 1}/${subscribedUsers.length}] Error processing ${user.email}:`, error.message);
        errors.push({
          userId: user._id,
          email: user.email,
          error: error.message,
        });
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 PROCESSING SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Subscribed Users:   ${subscribedUsers.length}`);
    console.log(`Payments Created:         ${paymentCreatedCount} 💳`);
    console.log(`Commissions Generated:    ${commissionGeneratedCount} 💰`);
    console.log(`Skipped:                  ${skippedCount} ⏭️`);
    console.log(`Errors:                   ${errors.length} ❌`);
    console.log('='.repeat(80));

    if (errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      errors.forEach((err, idx) => {
        console.log(`${idx + 1}. ${err.email}: ${err.error}`);
      });
    }

    // Verify commission records
    const Commission = (await import('./models/commissionModel.js')).default;
    const totalCommissions = await Commission.countDocuments({});
    const pendingCommissions = await Commission.countDocuments({ status: 'pending' });
    const directBonusCount = await Commission.countDocuments({ commissionType: 'direct_bonus' });
    const levelIncomeCount = await Commission.countDocuments({ commissionType: 'level_income' });
    const binaryBonusCount = await Commission.countDocuments({ commissionType: 'binary_bonus' });
    const rewardBonusCount = await Commission.countDocuments({ commissionType: 'reward_bonus' });

    console.log('\n📈 Commission Database Status:');
    console.log(`   - Total Commissions: ${totalCommissions}`);
    console.log(`   - Pending: ${pendingCommissions}`);
    console.log(`   - Direct Bonus: ${directBonusCount}`);
    console.log(`   - Level Income: ${levelIncomeCount}`);
    console.log(`   - Binary Bonus: ${binaryBonusCount}`);
    console.log(`   - Reward Bonus: ${rewardBonusCount}`);

    console.log('\n✅ Script completed successfully!');
    console.log('\n💡 Next Steps:');
    console.log('   1. Check user dashboards to see commission earnings');
    console.log('   2. Verify commission breakdown API: /api/commission/breakdown');
    console.log('   3. Check pending commissions: /api/commission/pending');

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
generatePaymentsAndCommissions();
