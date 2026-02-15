import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function ensureUniqueIndexes() {
  try {
    console.log('🔧 Ensuring Unique Indexes on TeamMember Collection...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const collection = db.collection('teammembers');

    // Get existing indexes
    const existingIndexes = await collection.indexes();
    console.log('📋 Current Indexes:');
    existingIndexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)} ${index.unique ? '(UNIQUE)' : ''}`);
    });
    console.log();

    // Check if unique index on userId exists
    const hasUniqueUserId = existingIndexes.some(
      index => index.key.userId && index.unique
    );

    if (!hasUniqueUserId) {
      console.log('⚠️  Unique index on userId not found. Creating...\n');
      
      try {
        await collection.createIndex({ userId: 1 }, { unique: true, background: true });
        console.log('✅ Created unique index on userId\n');
      } catch (error) {
        if (error.code === 11000) {
          console.log('❌ Cannot create unique index - duplicate userId values exist in database!');
          console.log('   Run fixTeamMembersArray.js first to remove duplicates.\n');
        } else {
          throw error;
        }
      }
    } else {
      console.log('✅ Unique index on userId already exists\n');
    }

    // Check if unique index on referralCode exists
    const hasUniqueReferralCode = existingIndexes.some(
      index => index.key.referralCode && index.unique
    );

    if (!hasUniqueReferralCode) {
      console.log('⚠️  Unique index on referralCode not found. Creating...\n');
      
      try {
        await collection.createIndex({ referralCode: 1 }, { unique: true, background: true });
        console.log('✅ Created unique index on referralCode\n');
      } catch (error) {
        if (error.code === 11000) {
          console.log('❌ Cannot create unique index - duplicate referralCode values exist!');
        } else {
          throw error;
        }
      }
    } else {
      console.log('✅ Unique index on referralCode already exists\n');
    }

    // Check if unique index on leftReferralCode exists
    const hasUniqueLeftCode = existingIndexes.some(
      index => index.key.leftReferralCode && index.unique
    );

    if (!hasUniqueLeftCode) {
      console.log('⚠️  Unique index on leftReferralCode not found. Creating...\n');
      
      try {
        await collection.createIndex({ leftReferralCode: 1 }, { unique: true, background: true });
        console.log('✅ Created unique index on leftReferralCode\n');
      } catch (error) {
        if (error.code === 11000) {
          console.log('❌ Cannot create unique index - duplicate leftReferralCode values exist!');
        } else {
          throw error;
        }
      }
    } else {
      console.log('✅ Unique index on leftReferralCode already exists\n');
    }

    // Check if unique index on rightReferralCode exists
    const hasUniqueRightCode = existingIndexes.some(
      index => index.key.rightReferralCode && index.unique
    );

    if (!hasUniqueRightCode) {
      console.log('⚠️  Unique index on rightReferralCode not found. Creating...\n');
      
      try {
        await collection.createIndex({ rightReferralCode: 1 }, { unique: true, background: true });
        console.log('✅ Created unique index on rightReferralCode\n');
      } catch (error) {
        if (error.code === 11000) {
          console.log('❌ Cannot create unique index - duplicate rightReferralCode values exist!');
        } else {
          throw error;
        }
      }
    } else {
      console.log('✅ Unique index on rightReferralCode already exists\n');
    }

    // Get final indexes
    const finalIndexes = await collection.indexes();
    console.log('\n📊 Final Indexes:');
    finalIndexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)} ${index.unique ? '(UNIQUE)' : ''}`);
    });

    console.log('\n✅ Index verification complete!');
    console.log('\n💡 TIP: These unique indexes will prevent duplicate TeamMember');
    console.log('   documents from being created in the future.');

  } catch (error) {
    console.error('❌ Fatal Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

ensureUniqueIndexes();
