/**
 * Update All Existing Users to Have Active Subscriptions
 * This script updates all users to Pro or Premium tier with 2-year subscription
 */

import mongoose from 'mongoose';
import User from './models/authModel.js';
import dotenv from 'dotenv';

dotenv.config();

const updateAllUsersSubscription = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Calculate subscription expiry date (2 years from now)
    const subscriptionDurationDays = 720; // 2 years
    const expiryDate = new Date(Date.now() + subscriptionDurationDays * 24 * 60 * 60 * 1000);
    const now = new Date();

    console.log('📊 Finding all users...');
    const allUsers = await User.find({});
    console.log(`Found ${allUsers.length} users to update\n`);

    let updatedCount = 0;
    let errorCount = 0;
    const errors = [];

    console.log('🔄 Starting subscription updates...\n');

    for (let i = 0; i < allUsers.length; i++) {
      const user = allUsers[i];
      
      try {
        // Alternate between Pro and Premium (odd index = Pro, even index = Premium)
        const subscriptionTier = (i + 1) % 2 === 1 ? "Pro" : "Premium";
        
        const updateResult = await User.findByIdAndUpdate(
          user._id,
          {
            subscriptionStatus: true,
            subscriptionTier: subscriptionTier,
            subscriptionExpiryDate: expiryDate,
            subscriptionActivatedDate: now,
            lastPaymentDate: now,
          },
          { new: true }
        );

        if (updateResult) {
          updatedCount++;
          console.log(`✅ [${i + 1}/${allUsers.length}] Updated: ${user.email} → ${subscriptionTier} (Expires: ${expiryDate.toLocaleDateString()})`);
        } else {
          errorCount++;
          console.log(`❌ [${i + 1}/${allUsers.length}] Failed to update: ${user.email}`);
          errors.push({ userId: user._id, email: user.email, error: 'Update returned null' });
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ [${i + 1}/${allUsers.length}] Error updating ${user.email}:`, error.message);
        errors.push({ userId: user._id, email: user.email, error: error.message });
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 UPDATE SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Users Found:    ${allUsers.length}`);
    console.log(`Successfully Updated: ${updatedCount} ✅`);
    console.log(`Failed Updates:       ${errorCount} ❌`);
    console.log(`Subscription Expiry:  ${expiryDate.toLocaleDateString()} (${subscriptionDurationDays} days / 2 years)`);
    console.log('='.repeat(80));

    if (errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      errors.forEach((err, idx) => {
        console.log(`${idx + 1}. ${err.email} (${err.userId}): ${err.error}`);
      });
    }

    // Verify updates
    console.log('\n🔍 Verifying updates...');
    const proCount = await User.countDocuments({ subscriptionTier: 'Pro', subscriptionStatus: true });
    const premiumCount = await User.countDocuments({ subscriptionTier: 'Premium', subscriptionStatus: true });
    const subscribedCount = await User.countDocuments({ subscriptionStatus: true });

    console.log(`\n📈 Current Subscription Status:`);
    console.log(`   - Total Subscribed Users: ${subscribedCount}`);
    console.log(`   - Pro Tier Users: ${proCount}`);
    console.log(`   - Premium Tier Users: ${premiumCount}`);

    console.log('\n✅ Script completed successfully!');

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
updateAllUsersSubscription();
