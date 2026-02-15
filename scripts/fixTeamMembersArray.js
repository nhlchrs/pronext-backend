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
  leftLegCount: Number,
  rightLegCount: Number,
  teamMembers: [{ type: mongoose.Schema.Types.ObjectId }],
}, { strict: false });

const User = mongoose.model('User', userSchema);
const TeamMember = mongoose.model('TeamMember', teamMemberSchema);

async function fixTeamMembersArray() {
  try {
    console.log('🔧 Starting TeamMembers Array Fix...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Check for duplicate TeamMember documents
    console.log('🔍 Checking for duplicate TeamMember documents...\n');
    
    const allMembers = await TeamMember.find({}).populate('userId', 'fname lname email');
    const userIdMap = new Map();
    const duplicates = [];
    
    for (const member of allMembers) {
      const userId = member.userId._id.toString();
      if (userIdMap.has(userId)) {
        duplicates.push({
          userId,
          name: `${member.userId.fname} ${member.userId.lname}`,
          email: member.userId.email,
          documents: [userIdMap.get(userId), member]
        });
      } else {
        userIdMap.set(userId, member);
      }
    }

    if (duplicates.length > 0) {
      console.log(`❌ FOUND ${duplicates.length} USERS WITH DUPLICATE TeamMember DOCUMENTS:\n`);
      
      for (const dup of duplicates) {
        console.log(`   User: ${dup.name} (${dup.email})`);
        console.log(`   Documents found: ${dup.documents.length + 1}`);
        
        // Find the document with actual data (non-zero counts)
        const docs = [userIdMap.get(dup.userId), ...dup.documents];
        const goodDoc = docs.find(d => d.directCount > 0 || d.sponsorId);
        const badDocs = docs.filter(d => d._id.toString() !== goodDoc._id.toString());
        
        console.log(`   ✓ Keeping: _id=${goodDoc._id} (Direct=${goodDoc.directCount}, L=${goodDoc.leftLegCount}, R=${goodDoc.rightLegCount})`);
        console.log(`   ✗ Deleting: ${badDocs.length} duplicate(s)`);
        
        for (const bad of badDocs) {
          await TeamMember.deleteOne({ _id: bad._id });
          console.log(`      Deleted: _id=${bad._id} (Direct=${bad.directCount}, L=${bad.leftLegCount}, R=${bad.rightLegCount})`);
        }
        console.log();
      }
    } else {
      console.log('✅ No duplicate TeamMember documents found\n');
    }

    // Step 2: Fix teamMembers arrays for all members
    console.log('🔧 Fixing teamMembers arrays...\n');
    
    const members = await TeamMember.find({}).populate('userId', 'fname lname email');
    let fixedCount = 0;

    for (const member of members) {
      const memberName = `${member.userId.fname} ${member.userId.lname}`;
      
      // Find all users who have this member as sponsor
      const directReferrals = await TeamMember.find({ sponsorId: member.userId }).select('userId');
      const correctUserIds = directReferrals.map(ref => ref.userId);
      
      // Check if teamMembers array matches
      const currentArray = member.teamMembers || [];
      const currentSet = new Set(currentArray.map(id => id.toString()));
      const correctSet = new Set(correctUserIds.map(id => id.toString()));
      
      const needsUpdate = 
        currentArray.length !== correctUserIds.length ||
        !correctUserIds.every(id => currentSet.has(id.toString()));
      
      if (needsUpdate) {
        console.log(`🔄 Fixing: ${memberName} (${member.userId.email})`);
        console.log(`   Before: teamMembers.length = ${currentArray.length}`);
        console.log(`   After:  teamMembers.length = ${correctUserIds.length}`);
        console.log(`   directCount = ${member.directCount} (should match ${correctUserIds.length})`);
        
        member.teamMembers = correctUserIds;
        
        // Also fix directCount if it doesn't match
        if (member.directCount !== correctUserIds.length) {
          console.log(`   ⚠️  Fixing directCount: ${member.directCount} → ${correctUserIds.length}`);
          member.directCount = correctUserIds.length;
        }
        
        await member.save();
        fixedCount++;
        console.log('   ✅ Fixed!\n');
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 FIX SUMMARY`);
    console.log(`${'='.repeat(60)}`);
    console.log(`   Total Members: ${members.length}`);
    console.log(`   Duplicates Removed: ${duplicates.length}`);
    console.log(`   TeamMembers Arrays Fixed: ${fixedCount}`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Step 3: Verify Logan's data
    console.log('🔍 Verifying Logan\'s data...\n');
    const logan = await User.findOne({ email: 'nihal@123.com' });
    if (logan) {
      const loganTeamMember = await TeamMember.findOne({ userId: logan._id });
      const actualReferrals = await TeamMember.find({ sponsorId: logan._id })
        .populate('userId', 'fname lname email');
      
      console.log('📊 LOGAN\'S CURRENT STATUS:');
      console.log(`   Direct Count: ${loganTeamMember.directCount}`);
      console.log(`   TeamMembers Array Length: ${loganTeamMember.teamMembers?.length || 0}`);
      console.log(`   Actual Referrals in Database: ${actualReferrals.length}`);
      console.log(`   Left Leg Count: ${loganTeamMember.leftLegCount}`);
      console.log(`   Right Leg Count: ${loganTeamMember.rightLegCount}`);
      
      if (loganTeamMember.directCount === actualReferrals.length && 
          loganTeamMember.teamMembers?.length === actualReferrals.length) {
        console.log('\n   ✅ ALL VALUES MATCH - System is consistent!\n');
      } else {
        console.log('\n   ⚠️  MISMATCH DETECTED - Running fix again...\n');
      }
      
      console.log('   Referrals:');
      actualReferrals.forEach((ref, i) => {
        console.log(`   ${i+1}. ${ref.userId.fname} ${ref.userId.lname} - Position: ${ref.position}`);
      });
    }

    console.log('\n✅ Fix completed!');

  } catch (error) {
    console.error('❌ Fatal Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

fixTeamMembersArray();
