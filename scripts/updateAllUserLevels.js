/**
 * Script to update all user levels based on their current directCount
 * Run this to fix users who should have reached higher levels
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TeamMember from '../models/teamModel.js';

dotenv.config();

const LEVEL_THRESHOLDS = {
  1: 10,
  2: 20,
  3: 30,
  4: 40,
};

const updateAllUserLevels = async () => {
  try {
    console.log('🚀 Starting user level update process...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all team members
    const allMembers = await TeamMember.find({});
    console.log(`📊 Found ${allMembers.length} team members\n`);

    let updatedCount = 0;
    let unchangedCount = 0;
    const updates = [];

    for (const member of allMembers) {
      const userId = member.userId;
      const directCount = member.directCount || 0;
      const currentLevel = member.level || 0;

      // Calculate new level based on directCount
      let newLevel = 0;
      if (directCount >= 40) newLevel = 4;
      else if (directCount >= 30) newLevel = 3;
      else if (directCount >= 20) newLevel = 2;
      else if (directCount >= 10) newLevel = 1;

      if (newLevel !== currentLevel) {
        // Update the member's level
        member.level = newLevel;

        // Set levelQualified if reaching level 1+
        if (newLevel >= 1 && !member.levelQualified) {
          member.levelQualified = true;
          member.levelQualifiedDate = new Date();
        }

        await member.save();

        updatedCount++;
        updates.push({
          userId: userId.toString(),
          directCount: directCount,
          oldLevel: currentLevel,
          newLevel: newLevel
        });

        console.log(`✨ Updated User ${userId}:`);
        console.log(`   Direct Count: ${directCount}`);
        console.log(`   Level: ${currentLevel} → ${newLevel}`);
        console.log('');
      } else {
        unchangedCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📈 UPDATE SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Members: ${allMembers.length}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Unchanged: ${unchangedCount}`);
    console.log('='.repeat(60) + '\n');

    if (updates.length > 0) {
      console.log('📋 Detailed Updates:');
      console.table(updates);
    }

    console.log('\n✅ Level update process completed successfully!');

    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error updating user levels:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the script
updateAllUserLevels();
