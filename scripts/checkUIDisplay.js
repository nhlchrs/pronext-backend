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
  level: Number,
}, { strict: false });

const User = mongoose.model('User', userSchema);
const TeamMember = mongoose.model('TeamMember', teamMemberSchema);

async function checkUIDisplay() {
  try {
    console.log('🔍 Checking UI Display Logic...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const users = await User.find({}).select('fname lname email');
    
    console.log('📊 WHAT EACH USER SHOULD SEE:\n');
    console.log('='.repeat(70));
    
    for (const user of users) {
      const teamMember = await TeamMember.findOne({ userId: user._id });
      
      console.log(`\n👤 User: ${user.fname} ${user.lname} (${user.email})`);
      console.log(`   User ID: ${user._id}`);
      
      if (!teamMember) {
        console.log('   ❌ NOT a team member (no TeamMember document)');
        console.log('   UI should show:');
        console.log('      - Message: "Join a team now to start earning"');
        console.log('      - Tabs: My Code, Join Team (NO HIERARCHY)');
        console.log('\n   Backend checkMemberStatus returns:');
        console.log('      { success: true, isTeamMember: false }');
      } else {
        console.log('   ✅ IS a team member (has TeamMember document)');
        console.log(`   Referral Code: ${teamMember.referralCode}`);
        console.log(`   Sponsor ID: ${teamMember.sponsorId || 'NONE'}`);
        console.log(`   Position: ${teamMember.position || 'N/A'}`);
        console.log(`   Direct Count: ${teamMember.directCount || 0}`);
        console.log(`   Level: ${teamMember.level || 0}`);
        
        const hasJoinedTeam = !!teamMember.sponsorId;
        
        console.log(`\n   hasJoinedTeam: ${hasJoinedTeam ? '✅ TRUE' : '❌ FALSE'}`);
        
        if (hasJoinedTeam) {
          const sponsor = await User.findById(teamMember.sponsorId);
          console.log(`   Sponsor: ${sponsor ? `${sponsor.fname} ${sponsor.lname}` : 'Unknown'}`);
          console.log('\n   UI should show:');
          console.log('      - Tabs: My Code, Hierarchy (NO JOIN TEAM TAB) ✅');
          console.log('      - User can see their downline');
          console.log('      - User CANNOT join another team');
        } else {
          console.log('   Sponsor: No sponsor (ROOT user or not yet joined)');
          console.log('\n   UI should show:');
          console.log('      - Tabs: My Code, Join Team, Hierarchy');
          console.log('      - User CAN join a team');
          console.log('      - User can build their own network');
        }
        
        console.log('\n   Backend checkMemberStatus returns:');
        console.log('      {');
        console.log('        success: true,');
        console.log('        isTeamMember: true,');
        console.log('        data: {');
        console.log(`          referralCode: "${teamMember.referralCode}",`);
        console.log(`          level: ${teamMember.level || 0},`);
        console.log(`          directCount: ${teamMember.directCount || 0},`);
        console.log(`          sponsorId: ${teamMember.sponsorId ? `"${teamMember.sponsorId}"` : 'null'},`);
        console.log(`          hasJoinedTeam: ${hasJoinedTeam}`);
        console.log('        }');
        console.log('      }');
      }
      
      console.log('\n' + '-'.repeat(70));
    }
    
    console.log('\n\n🔍 FRONTEND LOGIC CHECK:\n');
    console.log('ReferralPage.jsx line 81-84:');
    console.log('  {!hasJoinedTeam && (');
    console.log('    <TabsTrigger value="join-team">Join a Team</TabsTrigger>');
    console.log('  )}');
    console.log('\n✅ If hasJoinedTeam = true → Join Team tab is HIDDEN');
    console.log('❌ If hasJoinedTeam = false → Join Team tab is SHOWN');
    
    console.log('\n\n💡 DEBUGGING TIPS:\n');
    console.log('If a child user still sees "Join Team" tab:');
    console.log('  1. Check browser console for the API response');
    console.log('  2. Check if hasJoinedTeam is being set correctly in state');
    console.log('  3. Clear browser cache and localStorage');
    console.log('  4. Try logging out and back in');
    console.log('  5. Check if window.location.reload() was called after join');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkUIDisplay();
