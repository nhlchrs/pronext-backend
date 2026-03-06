import mongoose from 'mongoose';
import User from './models/authModel.js';
import { TeamMember } from './models/teamModel.js';
import Commission from './models/commissionModel.js';
import dotenv from 'dotenv';

dotenv.config();

const testJoinCommissions = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find nihal1@test.com
    const user = await User.findOne({ email: 'nihal1@test.com' });
    
    if (!user) {
      console.log('❌ User nihal1@test.com not found');
      return;
    }

    console.log('👤 User:', user.email);
    console.log('   User ID:', user._id);
    console.log('');

    // Check TeamMember record
    const teamMember = await TeamMember.findOne({ userId: user._id });
    
    if (!teamMember) {
      console.log('❌ TeamMember record not found');
      return;
    }

    console.log('📋 TeamMember Info:');
    console.log('   Direct Count:', teamMember.directCount);
    console.log('   Left Leg Count:', teamMember.leftLegCount);
    console.log('   Right Leg Count:', teamMember.rightLegCount);
    console.log('   Left Leg PV:', teamMember.leftLegPV);
    console.log('   Right Leg PV:', teamMember.rightLegPV);
    console.log('   Has Sponsor:', !!teamMember.sponsorId);
    console.log('   Position:', teamMember.position || 'main');
    console.log('');

    // Check all commissions for this user
    const allCommissions = await Commission.find({ userId: user._id }).sort({ createdAt: -1 });
    
    console.log(`💰 Total Commission Records: ${allCommissions.length}\n`);

    if (allCommissions.length > 0) {
      const byType = {};
      let total = 0;

      allCommissions.forEach(comm => {
        if (!byType[comm.commissionType]) {
          byType[comm.commissionType] = { count: 0, amount: 0 };
        }
        byType[comm.commissionType].count++;
        byType[comm.commissionType].amount += comm.netAmount;
        total += comm.netAmount;
      });

      console.log('📊 Commission Breakdown:');
      Object.entries(byType).forEach(([type, data]) => {
        console.log(`   ${type}:`);
        console.log(`      Count: ${data.count}`);
        console.log(`      Total: $${data.amount.toFixed(2)}`);
      });
      console.log(`\n   💵 TOTAL: $${total.toFixed(2)}\n`);

      // Show recent 5 commissions
      console.log('📝 Recent Commissions:');
      allCommissions.slice(0, 5).forEach((comm, idx) => {
        console.log(`\n   [${idx + 1}] ${comm.commissionType}`);
        console.log(`       Amount: $${comm.netAmount}`);
        console.log(`       Status: ${comm.status}`);
        console.log(`       Created: ${comm.createdAt}`);
        console.log(`       Description: ${comm.description}`);
        if (comm.metadata?.generatedAtJoin) {
          console.log(`       🎯 Generated at JOIN time`);
        }
      });
    } else {
      console.log('⚠️  No commissions found for this user');
    }

    // Check if there are any team members who joined under this user
    console.log('\n👥 Direct Team Members:');
    const directMembers = await TeamMember.find({ sponsorId: user._id })
      .populate('userId', 'fname lname email');
    
    console.log(`   Found ${directMembers.length} direct members\n`);
    
    if (directMembers.length > 0) {
      directMembers.forEach((member, idx) => {
        console.log(`   [${idx + 1}] ${member.userId?.fname} ${member.userId?.lname}`);
        console.log(`       Email: ${member.userId?.email}`);
        console.log(`       Position: ${member.position || 'main'}`);
        console.log(`       Joined: ${member.createdAt}`);
        console.log('');
      });

      // For each direct member, check if commission was created
      console.log('🔍 Checking if commissions were created for each member:\n');
      for (const member of directMembers) {
        const commissionsForMember = await Commission.find({
          userId: user._id,
          referrerId: member.userId._id
        });

        console.log(`   ${member.userId.fname} ${member.userId.lname}:`);
        if (commissionsForMember.length > 0) {
          commissionsForMember.forEach(comm => {
            console.log(`      ✅ ${comm.commissionType}: $${comm.netAmount}`);
          });
        } else {
          console.log(`      ❌ NO COMMISSIONS FOUND!`);
          console.log(`         This means commission generation failed when they joined`);
        }
        console.log('');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
};

testJoinCommissions();
