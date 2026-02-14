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
});

const TeamMember = mongoose.model('TeamMember', teamMemberSchema);

async function fixDirectCount() {
  try {
    console.log('🔧 Starting directCount fix...\n');
    console.log('📊 Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all team members
    const allMembers = await TeamMember.find({});
    console.log(`📋 Found ${allMembers.length} team members\n`);

    let fixedCount = 0;
    let errors = 0;

    for (const member of allMembers) {
      try {
        // Count how many people have THIS member as their sponsor
        // This is the true directCount (people who joined using this member's code)
        const directReferrals = await TeamMember.countDocuments({
          sponsorId: member.userId
        });

        // Also verify the binary leg counts
        const leftLegMembers = await TeamMember.countDocuments({
          sponsorId: member.userId,
          position: 'left'
        });

        const rightLegMembers = await TeamMember.countDocuments({
          sponsorId: member.userId,
          position: 'right'
        });

        // Check if update is needed
        const needsUpdate = 
          member.directCount !== directReferrals ||
          member.leftLegCount !== leftLegMembers ||
          member.rightLegCount !== rightLegMembers;

        if (needsUpdate) {
          console.log(`🔄 Fixing member ${member.userId}:`);
          console.log(`   Before: directCount=${member.directCount}, leftLeg=${member.leftLegCount}, rightLeg=${member.rightLegCount}`);
          console.log(`   After:  directCount=${directReferrals}, leftLeg=${leftLegMembers}, rightLeg=${rightLegMembers}`);

          // Update the member
          member.directCount = directReferrals;
          member.leftLegCount = leftLegMembers;
          member.rightLegCount = rightLegMembers;
          member.leftLegFull = leftLegMembers >= 2;
          member.rightLegFull = rightLegMembers >= 2;

          await member.save();
          fixedCount++;
          console.log(`   ✅ Fixed!\n`);
        }
      } catch (error) {
        console.error(`❌ Error fixing member ${member.userId}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Fix Summary:');
    console.log(`   Total Members: ${allMembers.length}`);
    console.log(`   Fixed: ${fixedCount}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Unchanged: ${allMembers.length - fixedCount - errors}`);

    console.log('\n✅ DirectCount fix completed!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the fix
fixDirectCount();
