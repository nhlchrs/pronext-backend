/**
 * Database Cleanup Script
 * 
 * WARNING: This script will DELETE ALL DATA from your MongoDB database!
 * Use with extreme caution - only for development/testing purposes.
 * 
 * Usage: node CLEAN_DATABASE.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Collection names to clean
const COLLECTIONS_TO_CLEAN = [
  'users',
  'teams',
  'commissions',
  'binaryrewards',
  'payouts',
  'payments',
  'meetings',
  'kycs',
  'sessions',
  'files',
  'securemedia',
  'announcements',
  'analytics',
  'incentives',
  'otps',
  'passwordresets',
  'referrals',
  'subscriptions',
  'transactions',
  'wallets',
  'notifications'
];

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function printBanner() {
  console.log('\n' + '='.repeat(70));
  log('DATABASE CLEANUP SCRIPT', 'bright');
  log('⚠️  WARNING: This will DELETE ALL DATA from your database!', 'red');
  console.log('='.repeat(70) + '\n');
}

async function connectDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    log('🔌 Connecting to MongoDB...', 'cyan');
    await mongoose.connect(mongoUri);
    log('✅ Connected to MongoDB successfully', 'green');
    
    const dbName = mongoose.connection.db.databaseName;
    log(`📊 Database: ${dbName}`, 'blue');
    
    return dbName;
  } catch (error) {
    log(`❌ Connection Error: ${error.message}`, 'red');
    throw error;
  }
}

async function getExistingCollections() {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    return collections.map(col => col.name);
  } catch (error) {
    log(`❌ Error listing collections: ${error.message}`, 'red');
    return [];
  }
}

async function cleanDatabase() {
  try {
    log('\n🧹 Starting database cleanup...', 'yellow');
    
    const existingCollections = await getExistingCollections();
    log(`📋 Found ${existingCollections.length} existing collections`, 'blue');
    
    let deletedCount = 0;
    let totalDocuments = 0;

    for (const collectionName of existingCollections) {
      try {
        const collection = mongoose.connection.db.collection(collectionName);
        const count = await collection.countDocuments();
        
        if (count > 0) {
          await collection.deleteMany({});
          totalDocuments += count;
          deletedCount++;
          log(`  ✓ Cleaned ${collectionName}: ${count} documents deleted`, 'green');
        } else {
          log(`  ○ Skipped ${collectionName}: already empty`, 'cyan');
        }
      } catch (error) {
        log(`  ✗ Error cleaning ${collectionName}: ${error.message}`, 'red');
      }
    }

    log(`\n✅ Cleanup complete!`, 'green');
    log(`   📊 Collections cleaned: ${deletedCount}`, 'green');
    log(`   📄 Total documents deleted: ${totalDocuments}`, 'green');
    
    return { deletedCount, totalDocuments };
  } catch (error) {
    log(`❌ Cleanup Error: ${error.message}`, 'red');
    throw error;
  }
}

async function createMasterSponsor() {
  try {
    log('\n👤 Creating master sponsor user...', 'yellow');
    
    // Import User model
    const UserModel = mongoose.model('Users', new mongoose.Schema({
      fname: String,
      lname: String,
      email: { type: String, unique: true },
      phone: String,
      password: String,
      role: { type: String, default: 'user' },
      referralCode: String,
      subscriptionStatus: { type: Boolean, default: false },
      isVerified: { type: Boolean, default: true },
      termsAgreed: { type: Boolean, default: true },
      termsAgreedAt: Date,
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    }));

    const hashedPassword = await bcrypt.hash('Master123', 10);
    
    const masterSponsor = await UserModel.create({
      fname: 'Master',
      lname: 'Sponsor',
      email: 'mastersponsor@test.com',
      phone: '+1234567890',
      password: hashedPassword,
      role: 'admin',
      referralCode: 'MASTER001',
      subscriptionStatus: true,
      isVerified: true,
      termsAgreed: true,
      termsAgreedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    log('✅ Master sponsor created successfully!', 'green');
    log(`   📧 Email: mastersponsor@test.com`, 'cyan');
    log(`   🔑 Password: Master123`, 'cyan');
    log(`   🎫 Referral Code: MASTER001`, 'cyan');
    log(`   👑 Role: admin`, 'cyan');
    
    return masterSponsor;
  } catch (error) {
    log(`❌ Error creating master sponsor: ${error.message}`, 'red');
    throw error;
  }
}

async function promptUser(question) {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdout.write(`${colors.yellow}${question}${colors.reset} `);
    
    process.stdin.once('data', (data) => {
      const answer = data.toString().trim().toLowerCase();
      process.stdin.pause();
      resolve(answer);
    });
  });
}

async function main() {
  try {
    printBanner();
    
    // Prompt for confirmation
    const confirm = await promptUser('Are you sure you want to delete ALL data? (yes/no):');
    
    if (confirm !== 'yes') {
      log('\n❌ Operation cancelled by user', 'yellow');
      process.exit(0);
    }

    // Connect to database
    await connectDatabase();
    
    // Clean database
    const { deletedCount, totalDocuments } = await cleanDatabase();
    
    // Ask if user wants to create master sponsor
    const createMaster = await promptUser('\nDo you want to create a master sponsor user? (yes/no):');
    
    if (createMaster === 'yes') {
      await createMasterSponsor();
    }

    log('\n' + '='.repeat(70), 'green');
    log('🎉 Database reset completed successfully!', 'green');
    log('='.repeat(70) + '\n', 'green');
    
    // Close connection
    await mongoose.connection.close();
    log('🔌 Database connection closed', 'cyan');
    
    process.exit(0);
  } catch (error) {
    log(`\n❌ Fatal Error: ${error.message}`, 'red');
    console.error(error);
    
    // Close connection if open
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    
    process.exit(1);
  }
}

// Handle Ctrl+C
process.on('SIGINT', async () => {
  log('\n\n❌ Operation cancelled by user (Ctrl+C)', 'yellow');
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  process.exit(0);
});

// Run the script
main();
