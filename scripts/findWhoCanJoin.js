import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const userSchema = new mongoose.Schema({
  fname: String,
  lname: String,
  email: String,
}, { strict: false });

const teamMemberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sponsorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referralCode: String,
  position: String,
  directCount: Number,
  teamMembers: [{ type: mongoose.Schema.Types.ObjectId }],
}, { strict: false });

const User = mongoose.model('User', userSchema);
const TeamMember = mongoose.model('TeamMember', teamMemberSchema);

async function findDuplicatesAndOrphans() {
  try {
    console.log('🔍 Checking for duplicates and orphaned users...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all users
    const users = await User.find({}).select('_id fname lname email');
    console.log(`👥 Total Users: ${users.length}`);

    // Find users who are logged in (have token in localStorage)
    // We can't check this from backend, but we can check:
    // 1. Users without team membership
    // 2. Users with team membership but already have sponsor

    const usersWithoutTeamMembership = [];
    const usersWithSponsor = [];
    const usersWithoutSponsor = [];

    for (const user of users) {
      const teamMember = await TeamMember.findOne({ userId: user._id });
      
      if (!teamMember) {
        usersWithoutTeamMembership.push({
          _id: user._id,
          name: `${user.fname} ${user.lname}`,
          email: user.email
        });
      } else if (teamMember.sponsorId) {
        usersWithSponsor.push({
          _id: user._id,
          name: `${user.fname} ${user.lname}`,
          email: user.email,
          sponsorId: teamMember.sponsorId
        });
      } else {
        usersWithoutSponsor.push({
          _id: user._id,
          name: `${user.fname} ${user.lname}`,
          email: user.email,
          referralCode: teamMember.referralCode
        });
      }
    }

    console.log(`\n📋 BREAKDOWN:`);
    console.log(`   Users WITHOUT team membership: ${usersWithoutTeamMembership.length}`);
    console.log(`   Users WITH sponsor (already joined): ${usersWithSponsor.length}`);
    console.log(`   Users WITHOUT sponsor (can join): ${usersWithoutSponsor.length}`);

    if (usersWithoutTeamMembership.length > 0) {
      console.log(`\n❌ USERS WITHOUT TEAM MEMBERSHIP (need to initialize):`);
      usersWithoutTeamMembership.forEach((u, i) => {
        console.log(`   ${i+1}. ${u.email} - ${u.name}`);
      });
    }

    if (usersWithoutSponsor.length > 0) {
      console.log(`\n✅ USERS WHO CAN JOIN A TEAM (have membership but no sponsor):`);
      usersWithoutSponsor.forEach((u, i) => {
        console.log(`   ${i+1}. ${u.email} - ${u.name}`);
        console.log(`      Referral Code: ${u.referralCode}`);
      });
    }

    if (usersWithSponsor.length > 0) {
      console.log(`\n🔒 USERS WITH SPONSORS (already in a team - can't join again):`);
      usersWithSponsor.forEach((u, i) => {
        console.log(`   ${i+1}. ${u.email} - ${u.name}`);
      });
    }

    // Check Logan's team specifically
    console.log(`\n\n${'='.repeat(70)}`);
    console.log(`📊 LOGAN'S TEAM ANALYSIS`);
    console.log(`${'='.repeat(70)}`);

    const logan = await User.findOne({ email: 'nihal@123.com' });
    if (logan) {
      const loganTeamMember = await TeamMember.findOne({ userId: logan._id });
      
      console.log(`\nLogan's TeamMember Data:`);
      console.log(`   Direct Count: ${loganTeamMember.directCount}`);
      console.log(`   TeamMembers Array Length: ${loganTeamMember.teamMembers?.length || 0}`);
      
      // Count actual members with Logan as sponsor
      const actualReferrals = await TeamMember.countDocuments({ sponsorId: logan._id });
      console.log(`   Actual Members with Logan as Sponsor: ${actualReferrals}`);
      
      if (loganTeamMember.directCount !== actualReferrals) {
        console.log(`\n⚠️  MISMATCH DETECTED!`);
        console.log(`   directCount field says: ${loganTeamMember.directCount}`);
        console.log(`   Database count shows: ${actualReferrals}`);
        console.log(`   Difference: ${actualReferrals - loganTeamMember.directCount}`);
      }
    }

    console.log(`\n✅ Analysis complete!`);

  } catch (error) {
    console.error('❌ Fatal Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

findDuplicatesAndOrphans();
