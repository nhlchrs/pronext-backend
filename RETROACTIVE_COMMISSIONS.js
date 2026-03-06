import mongoose from 'mongoose';
import User from './models/authModel.js';
import { TeamMember } from './models/teamModel.js';
import Commission from './models/commissionModel.js';
import { generateDirectBonusOnJoin, generateLevelIncomesOnJoin } from './helpers/commissionService.js';
import { addPVToLeg } from './helpers/binaryMatchingService.js';
import dotenv from 'dotenv';

dotenv.config();

const PACKAGE_PRICE = 135;
const PV_PER_MEMBER = 94.5;

const retroactivelyGenerateCommissions = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all team members who have a sponsor (they've joined someone's team)
    const allMembers = await TeamMember.find({ sponsorId: { $exists: true, $ne: null } })
      .populate('userId', 'fname lname email')
      .sort({ createdAt: 1 }); // Process oldest first

    console.log(`📋 Found ${allMembers.length} team members with sponsors\n`);

    let commissionsCreated = 0;
    let pvAdded = 0;
    let skipped = 0;

    for (const member of allMembers) {
      if (!member.userId) {
        console.log(`⚠️  Skipping member ${member._id} - no user data`);
        skipped++;
        continue;
      }

      console.log(`\n👤 Processing: ${member.userId.fname} ${member.userId.lname} (${member.userId.email})`);
      console.log(`   Position: ${member.position || 'main'}`);
      console.log(`   Joined: ${member.createdAt}`);

      // Check if commission already exists
      const existingCommission = await Commission.findOne({
        referrerId: member.userId._id,
        commissionType: 'direct_bonus'
      });

      if (existingCommission) {
        console.log(`   ⏭️  Commission already exists - skipping`);
        skipped++;
        continue;
      }

      // Get sponsor details - sponsorId actually contains userId, not TeamMember _id
      const sponsor = await TeamMember.findOne({ userId: member.sponsorId }).populate('userId', 'fname lname email');
      if (!sponsor|| !sponsor.userId) {
        console.log(`   ❌ Sponsor not found (userId: ${member.sponsorId}) - skipping`);
        skipped++;
        continue;
      }

      console.log(`   Sponsor: ${sponsor.userId.fname} ${sponsor.userId.lname}`);

      // 1. Generate Direct Bonus
      try {
        const directBonus = await generateDirectBonusOnJoin(sponsor, member.userId._id, PACKAGE_PRICE);
        if (directBonus) {
          console.log(`   ✅ Direct Bonus: $${directBonus.netAmount.toFixed(2)}`);
          commissionsCreated++;
        } else {
          console.log(`   ℹ️  No direct bonus (sponsor might have 0 directs at that time)`);
        }
      } catch (err) {
        console.log(`   ❌ Error generating direct bonus:`, err.message);
      }

      // 2. Generate Level Income
      try {
        const levelIncomes = await generateLevelIncomesOnJoin(sponsor.userId, member.userId._id, PACKAGE_PRICE);
        if (levelIncomes && levelIncomes.length > 0) {
          const totalLevel = levelIncomes.reduce((sum, c) => sum + c.netAmount, 0);
          console.log(`   ✅ Level Income: $${totalLevel.toFixed(2)} (${levelIncomes.length} levels)`);
          commissionsCreated += levelIncomes.length;
        } else {
          console.log(`   ℹ️  No level income (upline might not qualify)`);
        }
      } catch (err) {
        console.log(`   ❌ Error generating level income:`, err.message);
      }

      // 3. Add PV to binary tree (if left or right position)
      if (member.position === 'left' || member.position === 'right') {
        try {
          // sponsor.userId contains the User's _id
          await addPVToLeg(sponsor.userId._id, member.position, PV_PER_MEMBER);
          console.log(`   ✅ PV Added: ${PV_PER_MEMBER} to ${member.position} leg`);
          pvAdded++;
        } catch (err) {
          console.log(`   ❌ Error adding PV:`, err.message);
        }
      } else {
        console.log(`   ℹ️  Position is 'main' - no PV to add`);
      }
    }

    console.log('\n\n📊 SUMMARY:');
    console.log(`   Total Members Processed: ${allMembers.length}`);
    console.log(`   Commissions Created: ${commissionsCreated}`);
    console.log(`   PV Additions: ${pvAdded}`);
    console.log(`   Skipped: ${skipped}`);

    console.log('\n\n✅ Retroactive generation complete!');
    console.log('   Run TEST_JOIN_COMMISSION.js again to verify results\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
};

retroactivelyGenerateCommissions();
