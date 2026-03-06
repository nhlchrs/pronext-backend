import mongoose from 'mongoose';
import User from './models/authModel.js';
import { TeamMember } from './models/teamModel.js';
import dotenv from 'dotenv';

dotenv.config();

const checkSponsorIds = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected\n');

    const members = await TeamMember.find({ sponsorId: { $exists: true, $ne: null } })
      .populate('userId', 'fname lname email')
      .limit(5);

    for (const member of members) {
      console.log(`👤 ${member.userId?.fname} ${member.userId?.lname}`);
      console.log(`   Member _id: ${member._id}`);
      console.log(`   sponsorId: ${member.sponsorId}`);
      console.log(`   sponsorId type: ${typeof member.sponsorId}`);
      
      // Try to find the sponsor
      const sponsor = await TeamMember.findById(member.sponsorId);
      if (sponsor) {
        console.log(`   ✅ Sponsor found: ${sponsor._id}`);
      } else {
        console.log(`   ❌ Sponsor NOT found in database!`);
        
        // Check if it's stored as a userId instead
        const sponsorByUserId = await TeamMember.findOne({ userId: member.sponsorId });
        if (sponsorByUserId) {
          console.log(`   ⚠️  Found as userId! Need to convert.`);
        }
      }
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
};

checkSponsorIds();
