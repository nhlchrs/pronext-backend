import mongoose from 'mongoose';
import User from './models/authModel.js';
import { TeamMember } from './models/teamModel.js';
import Commission from './models/commissionModel.js';
import dotenv from 'dotenv';

dotenv.config();

const checkCommissionData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find the main user (nihal1@test.com)
    const mainUser = await User.findOne({ email: 'nihal1@test.com' });
    
    if (!mainUser) {
      console.log('❌ Main user (nihal1@test.com) not found');
      return;
    }

    console.log('👤 Main User:', mainUser.fname, mainUser.lname);
    console.log('   Email:', mainUser.email);
    console.log('   User ID:', mainUser._id);
    console.log('');

    // Check team member data
    const teamMember = await TeamMember.findOne({ userId: mainUser._id });
    
    if (!teamMember) {
      console.log('❌ Team member record not found');
      return;
    }

    console.log('👥 Team Member Info:');
    console.log('   Referral Code:', teamMember.referralCode);
    console.log('   Direct Count:', teamMember.directCount);
    console.log('   Total Downline:', teamMember.totalDownline);
    console.log('   Total Earnings:', teamMember.totalEarnings);
    console.log('');

    // Find all direct referrals
    const directReferrals = await TeamMember.find({ sponsorId: mainUser._id })
      .populate('userId', 'fname lname email');
    
    console.log(`📋 Direct Referrals (${directReferrals.length}):`);
    directReferrals.forEach((member, index) => {
      console.log(`   ${index + 1}. ${member.userId.fname} ${member.userId.lname} (${member.userId.email})`);
    });
    console.log('');

    // Check commission records for this user
    const commissions = await Commission.find({ userId: mainUser._id })
      .populate('referrerId', 'fname lname email')
      .sort({ createdAt: -1 });
    
    console.log(`💰 Commission Records for ${mainUser.email}: ${commissions.length} total`);
    
    if (commissions.length === 0) {
      console.log('   ⚠️  No commission records found!');
      console.log('');
      console.log('📝 Possible reasons:');
      console.log('   1. Direct referrals haven\'t made purchases yet');
      console.log('   2. Commissions are only generated when referrals buy packages');
      console.log('   3. You need to trigger commission generation');
      console.log('');
    } else {
      console.log('');
      
      // Group commissions by type
      const byType = {
        direct_bonus: [],
        level_income: [],
        binary_bonus: [],
        reward_bonus: []
      };
      
      commissions.forEach(comm => {
        if (byType[comm.commissionType]) {
          byType[comm.commissionType].push(comm);
        }
      });
      
      console.log('📊 Commission Breakdown:');
      console.log('   Direct Bonus:', byType.direct_bonus.length, 'records, Total: $' + 
        byType.direct_bonus.reduce((sum, c) => sum + c.netAmount, 0).toFixed(2));
      console.log('   Level Income:', byType.level_income.length, 'records, Total: $' + 
        byType.level_income.reduce((sum, c) => sum + c.netAmount, 0).toFixed(2));
      console.log('   Binary Bonus:', byType.binary_bonus.length, 'records, Total: $' + 
        byType.binary_bonus.reduce((sum, c) => sum + c.netAmount, 0).toFixed(2));
      console.log('   Reward Bonus:', byType.reward_bonus.length, 'records, Total: $' + 
        byType.reward_bonus.reduce((sum, c) => sum + c.netAmount, 0).toFixed(2));
      console.log('');
      
      // Show recent commissions
      console.log('📜 Recent Commissions (last 5):');
      commissions.slice(0, 5).forEach((comm, index) => {
        console.log(`   ${index + 1}. ${comm.commissionType}: $${comm.netAmount.toFixed(2)}`);
        console.log(`      From: ${comm.referrerId?.fname || 'N/A'} ${comm.referrerId?.lname || ''}`);
        console.log(`      Date: ${comm.createdAt.toLocaleDateString()}`);
        console.log(`      Status: ${comm.status}`);
      });
    }
    
    console.log('');
    console.log('🔍 Checking if direct referrals have subscription payments...');
    
    // Check for users table subscription status
    const referralUsers = await User.find({
      _id: { $in: directReferrals.map(d => d.userId._id) }
    }).select('fname lname email subscriptionStatus subscriptionType subscriptionExpiryDate');
    
    console.log('');
    console.log('💳 Direct Referrals Subscription Status:');
    referralUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.fname} ${user.lname}`);
      console.log(`      Status: ${user.subscriptionStatus || 'none'}`);
      console.log(`      Type: ${user.subscriptionType || 'none'}`);
      console.log(`      Expires: ${user.subscriptionExpiryDate ? user.subscriptionExpiryDate.toLocaleDateString() : 'N/A'}`);
    });
    
    console.log('');
    console.log('✅ Commission data check complete!');
    console.log('');
    console.log('💡 To generate test commissions, you can:');
    console.log('   1. Run: node GENERATE_TEST_COMMISSIONS.js');
    console.log('   2. Or manually create subscription payments for referrals');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

checkCommissionData();
