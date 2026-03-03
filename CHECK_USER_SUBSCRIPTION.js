import mongoose from 'mongoose';
import User from './models/authModel.js';
import { TeamMember } from './models/teamModel.js';
import Commission from './models/commissionModel.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Check User Subscription and Earnings Status
 * Usage: node CHECK_USER_SUBSCRIPTION.js [email]
 */

const checkUserSubscription = async (userEmail) => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find user by email
    const user = await User.findOne({ email: userEmail });
    
    if (!user) {
      console.log(`❌ User not found: ${userEmail}`);
      return;
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('👤 USER INFORMATION');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Name:         ${user.fname} ${user.lname}`);
    console.log(`Email:        ${user.email}`);
    console.log(`User ID:      ${user._id}`);
    console.log(`Role:         ${user.role || 'user'}`);
    console.log('');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('💳 SUBSCRIPTION STATUS');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const isSubscribed = user.subscriptionStatus === true;
    const isExpired = user.subscriptionExpiryDate && new Date(user.subscriptionExpiryDate) < new Date();
    
    if (isSubscribed) {
      console.log('Status:       ✅ ACTIVE');
    } else {
      console.log('Status:       ❌ INACTIVE');
    }
    
    console.log(`Tier:         ${user.subscriptionTier || 'None'}`);
    
    if (user.subscriptionExpiryDate) {
      console.log(`Expires:      ${user.subscriptionExpiryDate.toLocaleDateString()}`);
      if (isExpired) {
        console.log('              ⚠️  EXPIRED!');
      } else {
        const daysLeft = Math.ceil((new Date(user.subscriptionExpiryDate) - new Date()) / (1000 * 60 * 60 * 24));
        console.log(`              (${daysLeft} days remaining)`);
      }
    } else {
      console.log('Expires:      N/A');
    }
    
    if (user.subscriptionActivatedDate) {
      console.log(`Activated:    ${user.subscriptionActivatedDate.toLocaleDateString()}`);
    }
    
    if (user.lastPaymentDate) {
      console.log(`Last Payment: ${user.lastPaymentDate.toLocaleDateString()}`);
    }
    console.log('');

    // Check team membership
    const teamMember = await TeamMember.findOne({ userId: user._id })
      .populate('sponsorId', 'userId')
      .lean();

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('👥 TEAM MEMBERSHIP');
    console.log('═══════════════════════════════════════════════════════════════');
    
    if (teamMember) {
      console.log(`Status:       ✅ Team Member`);
      console.log(`Referral Code: ${teamMember.referralCode}`);
      console.log(`Direct Referrals: ${teamMember.directCount || 0}`);
      console.log(`Total Downline: ${teamMember.totalDownline || 0}`);
      
      if (teamMember.sponsorId) {
        const sponsor = await User.findById(teamMember.sponsorId);
        if (sponsor) {
          console.log(`Sponsor:      ${sponsor.fname} ${sponsor.lname} (${sponsor.email})`);
        }
      } else {
        console.log(`Sponsor:      None (Root User)`);
      }
      
      if (teamMember.position) {
        console.log(`Position:     ${teamMember.position}`);
      }
    } else {
      console.log('Status:       ❌ Not a Team Member');
    }
    console.log('');

    // Check commissions
    const commissions = await Commission.find({ userId: user._id });
    const pendingCommissions = commissions.filter(c => c.status === 'pending');
    const approvedCommissions = commissions.filter(c => c.status === 'approved');
    const paidCommissions = commissions.filter(c => c.status === 'paid');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('💰 COMMISSION EARNINGS');
    console.log('═══════════════════════════════════════════════════════════════');
    
    if (commissions.length === 0) {
      console.log('Status:       ❌ No commissions yet');
      console.log('');
      console.log('💡 To earn commissions:');
      console.log('   1. Ensure you have active subscription');
      console.log('   2. Share your referral code');
      console.log('   3. When referrals purchase, you earn commissions');
    } else {
      const byType = {
        direct_bonus: 0,
        level_income: 0,
        binary_bonus: 0,
        reward_bonus: 0
      };
      
      commissions.forEach(comm => {
        if (byType[comm.commissionType] !== undefined) {
          byType[comm.commissionType] += comm.netAmount;
        }
      });
      
      const totalEarnings = Object.values(byType).reduce((sum, val) => sum + val, 0);
      
      console.log(`Total Earned: $${totalEarnings.toFixed(2)}`);
      console.log('');
      console.log('Breakdown by Type:');
      console.log(`  Direct Referral: $${byType.direct_bonus.toFixed(2)}`);
      console.log(`  Level Income:    $${byType.level_income.toFixed(2)}`);
      console.log(`  Binary Bonus:    $${byType.binary_bonus.toFixed(2)}`);
      console.log(`  Rank Rewards:    $${byType.reward_bonus.toFixed(2)}`);
      console.log('');
      
      console.log('By Status:');
      console.log(`  Pending:  ${pendingCommissions.length} records, $${pendingCommissions.reduce((sum, c) => sum + c.netAmount, 0).toFixed(2)}`);
      console.log(`  Approved: ${approvedCommissions.length} records, $${approvedCommissions.reduce((sum, c) => sum + c.netAmount, 0).toFixed(2)}`);
      console.log(`  Paid:     ${paidCommissions.length} records, $${paidCommissions.reduce((sum, c) => sum + c.netAmount, 0).toFixed(2)}`);
      console.log('');
      
      // Show recent commissions
      const recent = commissions.slice(-3).reverse();
      console.log('Recent Commissions:');
      recent.forEach((comm, idx) => {
        console.log(`  ${idx + 1}. ${comm.commissionType}: $${comm.netAmount.toFixed(2)} (${comm.status})`);
        console.log(`     Date: ${comm.earningDate.toLocaleDateString()}`);
      });
    }
    console.log('');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 ELIGIBILITY STATUS');
    console.log('═══════════════════════════════════════════════════════════════');
    
    console.log('✓ Can Join Teams:         YES (always allowed)');
    console.log(`✓ Can Earn Commissions:   ${isSubscribed && !isExpired ? 'YES' : 'NO'} ${!isSubscribed || isExpired ? '(needs active subscription)' : ''}`);
    console.log(`✓ Can Refer Others:       ${teamMember ? 'YES' : 'NO'} ${!teamMember ? '(needs team membership)' : ''}`);
    console.log(`✓ Level Income Qualified: ${teamMember && teamMember.directCount >= 10 ? 'YES' : 'NO'} ${teamMember && teamMember.directCount < 10 ? '(needs 10+ directs)' : ''}`);
    console.log('');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔗 API ENDPOINTS TO CHECK THIS USER');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Profile:           GET  /api/user/profile');
    console.log('Team Status:       GET  /api/team/check-status');
    console.log('Earnings:          GET  /api/commission/breakdown');
    console.log('Commission History: GET  /api/commission/history');
    console.log('Referral Stats:    GET  /api/team/referral-stats');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Get email from command line args or use default
const userEmail = process.argv[2] || 'nihal1@test.com';

console.log(`\n🔍 Checking subscription status for: ${userEmail}\n`);
checkUserSubscription(userEmail);
