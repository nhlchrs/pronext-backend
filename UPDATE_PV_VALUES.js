import mongoose from 'mongoose';
import User from './models/authModel.js';
import { TeamMember } from './models/teamModel.js';
import dotenv from 'dotenv';

dotenv.config();

const PV_PER_MEMBER = 94.5;

const updatePVValues = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all team members
    const allMembers = await TeamMember.find({}).populate('userId', 'fname lname email');

    console.log(`📋 Found ${allMembers.length} team members\n`);

    for (const member of allMembers) {
      const leftCount = member.leftLegCount || 0;
      const rightCount = member.rightLegCount || 0;
      const calculatedLeftPV = leftCount * PV_PER_MEMBER;
      const calculatedRightPV = rightCount * PV_PER_MEMBER;

      // Only update if PV values are different
      if (member.leftLegPV !== calculatedLeftPV || member.rightLegPV !== calculatedRightPV) {
        member.leftLegPV = calculatedLeftPV;
        member.rightLegPV = calculatedRightPV;
        await member.save();

        console.log(`✅ ${member.userId?.fname || 'Unknown'} ${member.userId?.lname || ''}`);
        console.log(`   Left: ${leftCount} members × 94.5 = ${calculatedLeftPV} PV`);
        console.log(`   Right: ${rightCount} members × 94.5 = ${calculatedRightPV} PV`);
        console.log('');
      }
    }

    console.log('\n✅ All PV values updated!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
};

updatePVValues();
