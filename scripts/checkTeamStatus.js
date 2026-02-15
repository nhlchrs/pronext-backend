import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Define schemas
const userSchema = new mongoose.Schema({
  fname: String,
  lname: String,
  email: String,
}, { strict: false });

const teamMemberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sponsorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referralCode: String,
  leftReferralCode: String,
  rightReferralCode: String,
  position: String,
  directCount: Number,
  leftLegCount: Number,
  rightLegCount: Number,
  level: Number,
  teamMembers: [{ type: mongoose.Schema.Types.ObjectId }],
}, { strict: false });

const User = mongoose.model('User', userSchema);
const TeamMember = mongoose.model('TeamMember', teamMemberSchema);

async function checkTeamStatus() {
  try {
    console.log('🔍 Checking Team Status...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all users
    const users = await User.find({}).select('fname lname email');
    console.log(`👥 Total Users: ${users.length}\n`);

    for (const user of users) {
      const userName = `${user.fname} ${user.lname || ''} (${user.email})`;
      console.log(`\n${'='.repeat(70)}`);
      console.log(`👤 ${userName}`);
      console.log(`${'='.repeat(70)}`);

      // Find team member record
      const teamMember = await TeamMember.findOne({ userId: user._id })
        .populate('sponsorId', 'fname lname email');

      if (!teamMember) {
        console.log('❌ NO TEAM MEMBER RECORD');
        console.log('   Status: Not initialized in team system');
        continue;
      }

      console.log('\n📊 TEAM MEMBER STATUS:');
      console.log(`   Has Sponsor: ${teamMember.sponsorId ? '✅ YES' : '❌ NO'}`);
      console.log(`   Has Joined Team: ${teamMember.sponsorId ? '✅ YES' : '❌ NO - Still showing "Join Team"'}`);
      
      if (teamMember.sponsorId) {
        const sponsor = teamMember.sponsorId;
        console.log(`   Sponsor: ${sponsor.fname} ${sponsor.lname || ''} (${sponsor.email})`);
        console.log(`   Position: ${teamMember.position || 'N/A'}`);
      }

      console.log(`\n📋 REFERRAL CODES:`);
      console.log(`   Main Code (PRO): ${teamMember.referralCode || 'N/A'}`);
      console.log(`   Left Code (LPRO): ${teamMember.leftReferralCode || 'N/A'}`);
      console.log(`   Right Code (RPRO): ${teamMember.rightReferralCode || 'N/A'}`);

      console.log(`\n📈 TEAM STATS:`);
      console.log(`   Level: ${teamMember.level || 0}`);
      console.log(`   Direct Count: ${teamMember.directCount || 0}`);
      console.log(`   Left Leg Count: ${teamMember.leftLegCount || 0}`);
      console.log(`   Right Leg Count: ${teamMember.rightLegCount || 0}`);
      console.log(`   Total in teamMembers array: ${teamMember.teamMembers?.length || 0}`);
      
      const has2x2 = (teamMember.leftLegCount >= 2) && (teamMember.rightLegCount >= 2);
      console.log(`   2:2 Status: ${has2x2 ? '✅ ACHIEVED' : '📊 Building'}`);

      // Check if anyone has THIS user as sponsor
      const directReferrals = await TeamMember.find({ sponsorId: user._id })
        .populate('userId', 'fname lname email');
      
      console.log(`\n👨‍👩‍👧‍👦 DIRECT REFERRALS (${directReferrals.length}):`);
      if (directReferrals.length > 0) {
        directReferrals.forEach((ref, index) => {
          const refUser = ref.userId;
          console.log(`   ${index + 1}. ${refUser.fname} ${refUser.lname || ''} (${refUser.email})`);
          console.log(`      Position: ${ref.position || 'N/A'}`);
        });
      } else {
        console.log('   (None yet)');
      }

      // UI Display Logic Check
      console.log(`\n🖥️  UI DISPLAY CHECK:`);
      console.log(`   Should show "Join Team": ${!teamMember.sponsorId ? '✅ YES' : '❌ NO'}`);
      console.log(`   Should show "Hierarchy": ${teamMember.sponsorId ? '✅ YES' : '❌ NO'}`);
      console.log(`   Hierarchy would show: ${directReferrals.length > 0 ? `${directReferrals.length} direct referrals` : 'Empty (no team built yet)'}`);
    }

    console.log(`\n\n${'='.repeat(70)}`);
    console.log('📊 SUMMARY');
    console.log(`${'='.repeat(70)}`);

    const totalTeamMembers = await TeamMember.countDocuments({});
    const membersWithSponsor = await TeamMember.countDocuments({ sponsorId: { $exists: true, $ne: null } });
    const membersWithoutSponsor = totalTeamMembers - membersWithSponsor;

    console.log(`Total Team Members: ${totalTeamMembers}`);
    console.log(`Members who JOINED a team (has sponsor): ${membersWithSponsor}`);
    console.log(`Members who HAVEN'T joined yet (no sponsor): ${membersWithoutSponsor}`);
    console.log('');

    if (membersWithoutSponsor > 0) {
      const orphans = await TeamMember.find({ 
        sponsorId: { $exists: false } 
      }).populate('userId', 'fname lname email');
      
      console.log('❌ USERS WHO HAVEN\'T JOINED A TEAM:');
      orphans.forEach((member, index) => {
        console.log(`   ${index + 1}. ${member.userId.fname} ${member.userId.lname || ''} (${member.userId.email})`);
      });
    }

    console.log('\n✅ Team status check completed!');

  } catch (error) {
    console.error('❌ Fatal Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkTeamStatus();
