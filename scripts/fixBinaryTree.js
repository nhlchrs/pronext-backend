import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Define schema inline
const teamMemberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referralCode: { type: String },
  leftReferralCode: { type: String },
  rightReferralCode: { type: String },
  sponsorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  position: { type: String, enum: ['left', 'right', 'main'] },
  teamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  directCount: { type: Number, default: 0 },
  leftLegCount: { type: Number, default: 0 },
  rightLegCount: { type: Number, default: 0 },
  leftLegFull: { type: Boolean, default: false },
  rightLegFull: { type: Boolean, default: false },
  level: { type: Number, default: 0 },
});

const TeamMember = mongoose.model('TeamMember', teamMemberSchema);

// Define User schema for population
const userSchema = new mongoose.Schema({
  fname: String,
  lname: String,
  email: String,
});
const User = mongoose.model('User', userSchema);

// Level thresholds based on directCount
const LEVEL_THRESHOLDS = {
  1: 10,
  2: 20,
  3: 30,
  4: 40,
};

function calculateLevel(directCount) {
  if (directCount >= LEVEL_THRESHOLDS[4]) return 4;
  if (directCount >= LEVEL_THRESHOLDS[3]) return 3;
  if (directCount >= LEVEL_THRESHOLDS[2]) return 2;
  if (directCount >= LEVEL_THRESHOLDS[1]) return 1;
  return 0;
}

async function fixBinaryTree() {
  try {
    console.log('🔧 Starting Binary Tree Fix...\n');
    console.log('📊 This will correct:');
    console.log('   - directCount (people who joined using your code)');
    console.log('   - leftLegCount (people in your left position)');
    console.log('   - rightLegCount (people in your right position)');
    console.log('   - level (based on directCount)\n');
    
    console.log('📊 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all team members
    const allMembers = await TeamMember.find({}).populate('userId', 'fname lname email');
    console.log(`📋 Found ${allMembers.length} team members\n`);

    let fixedCount = 0;
    let errors = 0;
    const updates = [];

    for (const member of allMembers) {
      try {
        const memberName = member.userId?.fname 
          ? `${member.userId.fname} ${member.userId.lname || ''} (${member.userId.email})`
          : `User ${member.userId}`;

        // Count direct referrals (people who have this member as sponsorId)
        const directReferrals = await TeamMember.countDocuments({
          sponsorId: member.userId
        });

        // Count left leg members (position = 'left')
        const leftLegMembers = await TeamMember.countDocuments({
          sponsorId: member.userId,
          position: 'left'
        });

        // Count right leg members (position = 'right')
        const rightLegMembers = await TeamMember.countDocuments({
          sponsorId: member.userId,
          position: 'right'
        });

        // Calculate new level based on directCount
        const newLevel = calculateLevel(directReferrals);

        // Check if update is needed
        const needsUpdate = 
          member.directCount !== directReferrals ||
          member.leftLegCount !== leftLegMembers ||
          member.rightLegCount !== rightLegMembers ||
          member.level !== newLevel;

        if (needsUpdate) {
          const before = {
            directCount: member.directCount,
            leftLeg: member.leftLegCount,
            rightLeg: member.rightLegCount,
            level: member.level,
          };

          const after = {
            directCount: directReferrals,
            leftLeg: leftLegMembers,
            rightLeg: rightLegMembers,
            level: newLevel,
          };

          // Update the member
          member.directCount = directReferrals;
          member.leftLegCount = leftLegMembers;
          member.rightLegCount = rightLegMembers;
          member.level = newLevel;
          
          // Note: We don't update leftLegFull/rightLegFull because after 2:2, 
          // these flags are no longer relevant (unlimited growth allowed)
          
          await member.save();
          fixedCount++;

          updates.push({
            member: memberName,
            before,
            after,
          });

          console.log(`🔄 Fixed: ${memberName}`);
          console.log(`   Before: Direct=${before.directCount}, L=${before.leftLeg}, R=${before.rightLeg}, Level=${before.level}`);
          console.log(`   After:  Direct=${after.directCount}, L=${after.leftLeg}, R=${after.rightLeg}, Level=${after.level}`);
          
          // Show 2:2 status
          if (after.leftLeg >= 2 && after.rightLeg >= 2) {
            console.log(`   ✨ 2:2 ACHIEVED - Can accept unlimited direct referrals!`);
          } else if (after.leftLeg >= 2) {
            console.log(`   ⚠️  Left leg full (${after.leftLeg}/2) - Right leg available`);
          } else if (after.rightLeg >= 2) {
            console.log(`   ⚠️  Right leg full (${after.rightLeg}/2) - Left leg available`);
          } else {
            console.log(`   📊 Building 2:2 - L=${after.leftLeg}/2, R=${after.rightLeg}/2`);
          }
          console.log('');
        }
      } catch (error) {
        console.error(`❌ Error fixing member ${member.userId}:`, error.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 FIX SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Total Members: ${allMembers.length}`);
    console.log(`   Fixed: ${fixedCount}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Unchanged: ${allMembers.length - fixedCount - errors}`);
    console.log('='.repeat(60));

    // Show members with 2:2 achieved
    const members2x2 = allMembers.filter(m => m.leftLegCount >= 2 && m.rightLegCount >= 2);
    if (members2x2.length > 0) {
      console.log('\n🎯 MEMBERS WITH 2:2 ACHIEVED:');
      console.log('   (These members can now accept unlimited direct referrals)');
      for (const member of members2x2) {
        const memberName = member.userId?.fname 
          ? `${member.userId.fname} ${member.userId.lname || ''}`
          : `User ${member.userId}`;
        console.log(`   ✅ ${memberName} - L=${member.leftLegCount}, R=${member.rightLegCount}, Direct=${member.directCount}, Level=${member.level}`);
      }
    }

    // Show members still building 2:2
    const membersBuilding = allMembers.filter(m => 
      (m.leftLegCount > 0 || m.rightLegCount > 0) && 
      !(m.leftLegCount >= 2 && m.rightLegCount >= 2)
    );
    if (membersBuilding.length > 0) {
      console.log('\n📊 MEMBERS BUILDING 2:2:');
      for (const member of membersBuilding) {
        const memberName = member.userId?.fname 
          ? `${member.userId.fname} ${member.userId.lname || ''}`
          : `User ${member.userId}`;
        const leftStatus = member.leftLegCount >= 2 ? '✅' : `${member.leftLegCount}/2`;
        const rightStatus = member.rightLegCount >= 2 ? '✅' : `${member.rightLegCount}/2`;
        console.log(`   📈 ${memberName} - L=${leftStatus}, R=${rightStatus}, Direct=${member.directCount}, Level=${member.level}`);
      }
    }

    console.log('\n✅ Binary Tree Fix completed!');
    console.log('\n💡 NOTES:');
    console.log('   - directCount = People who joined using YOUR referral code');
    console.log('   - After 2:2 is achieved, LPRO/RPRO codes work without limits');
    console.log('   - All placements after 2:2 count as direct referrals');
    console.log('   - Level is based on directCount (L1=10, L2=20, L3=30, L4=40)');

  } catch (error) {
    console.error('❌ Fatal Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the fix
fixBinaryTree();
