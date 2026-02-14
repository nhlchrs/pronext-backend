import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Define schemas inline
const userSchema = new mongoose.Schema({
  fname: String,
  lname: String,
  email: String,
}, { strict: false });

const teamMemberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referralCode: String,
}, { strict: false });

const User = mongoose.model('User', userSchema);
const TeamMember = mongoose.model('TeamMember', teamMemberSchema);

// Emails to KEEP (not delete)
const PROTECTED_EMAILS = [
  'admin@example.com',
  'your.email+fakedata12883@gmail.com'
];

async function deleteAllUsersExceptProtected() {
  try {
    console.log('🗑️  MASS USER DELETION SCRIPT');
    console.log('=' .repeat(60));
    console.log('⚠️  WARNING: This will DELETE all users except:');
    PROTECTED_EMAILS.forEach(email => console.log(`   ✅ ${email}`));
    console.log('=' .repeat(60));
    console.log('');

    // Wait 3 seconds to allow user to cancel
    console.log('⏳ Starting in 3 seconds... (Press Ctrl+C to cancel)');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('⏳ 2...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('⏳ 1...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('');

    console.log('📊 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find protected users
    const protectedUsers = await User.find({ 
      email: { $in: PROTECTED_EMAILS } 
    }).select('_id email fname lname');

    console.log('🔒 PROTECTED USERS (Will NOT be deleted):');
    protectedUsers.forEach(user => {
      console.log(`   ✅ ${user.email} - ${user.fname} ${user.lname || ''} (ID: ${user._id})`);
    });
    console.log('');

    const protectedUserIds = protectedUsers.map(u => u._id);

    // Find users to delete
    const usersToDelete = await User.find({
      _id: { $nin: protectedUserIds }
    }).select('_id email fname lname');

    console.log(`📋 Found ${usersToDelete.length} users to DELETE:\n`);
    
    if (usersToDelete.length === 0) {
      console.log('✅ No users to delete. Database is clean!');
      return;
    }

    // Show first 10 users that will be deleted
    console.log('Preview (first 10):');
    usersToDelete.slice(0, 10).forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} - ${user.fname} ${user.lname || ''} (ID: ${user._id})`);
    });
    if (usersToDelete.length > 10) {
      console.log(`   ... and ${usersToDelete.length - 10} more users`);
    }
    console.log('');

    const userIdsToDelete = usersToDelete.map(u => u._id);

    // Delete related data
    console.log('🗑️  Step 1: Deleting TeamMembers...');
    const teamMembersDeleted = await TeamMember.deleteMany({
      userId: { $in: userIdsToDelete }
    });
    console.log(`   ✅ Deleted ${teamMembersDeleted.deletedCount} TeamMember records\n`);

    // Delete from other collections (add more as needed)
    console.log('🗑️  Step 2: Deleting from other collections...');
    
    // Commission Schema
    try {
      const Commission = mongoose.model('Commission');
      const commissionsDeleted = await Commission.deleteMany({
        userId: { $in: userIdsToDelete }
      });
      console.log(`   ✅ Deleted ${commissionsDeleted.deletedCount} Commission records`);
    } catch (error) {
      console.log('   ℹ️  Commission collection not found or already clean');
    }

    // Payout Schema
    try {
      const Payout = mongoose.model('Payout');
      const payoutsDeleted = await Payout.deleteMany({
        userId: { $in: userIdsToDelete }
      });
      console.log(`   ✅ Deleted ${payoutsDeleted.deletedCount} Payout records`);
    } catch (error) {
      console.log('   ℹ️  Payout collection not found or already clean');
    }

    // Payment/Subscription related
    try {
      const Payment = mongoose.model('Payment');
      const paymentsDeleted = await Payment.deleteMany({
        userId: { $in: userIdsToDelete }
      });
      console.log(`   ✅ Deleted ${paymentsDeleted.deletedCount} Payment records`);
    } catch (error) {
      console.log('   ℹ️  Payment collection not found or already clean');
    }

    // Bonus Schema
    try {
      const Bonus = mongoose.model('Bonus');
      const bonusesDeleted = await Bonus.deleteMany({
        userId: { $in: userIdsToDelete }
      });
      console.log(`   ✅ Deleted ${bonusesDeleted.deletedCount} Bonus records`);
    } catch (error) {
      console.log('   ℹ️  Bonus collection not found or already clean');
    }

    // Announcement reads/interactions
    try {
      const AnnouncementRead = mongoose.model('AnnouncementRead');
      const readsDeleted = await AnnouncementRead.deleteMany({
        userId: { $in: userIdsToDelete }
      });
      console.log(`   ✅ Deleted ${readsDeleted.deletedCount} AnnouncementRead records`);
    } catch (error) {
      console.log('   ℹ️  AnnouncementRead collection not found or already clean');
    }

    console.log('');

    // Delete users themselves
    console.log('🗑️  Step 3: Deleting Users...');
    const usersDeleted = await User.deleteMany({
      _id: { $in: userIdsToDelete }
    });
    console.log(`   ✅ Deleted ${usersDeleted.deletedCount} Users\n`);

    // Update TeamMembers who had deleted users as sponsors
    console.log('🔧 Step 4: Cleaning up orphaned references...');
    const orphanedTeamMembers = await TeamMember.updateMany(
      { sponsorId: { $in: userIdsToDelete } },
      { $unset: { sponsorId: '' } }
    );
    console.log(`   ✅ Cleaned ${orphanedTeamMembers.modifiedCount} orphaned sponsor references\n`);

    // Final verification
    const remainingUsers = await User.find({}).select('email fname lname');
    
    console.log('');
    console.log('=' .repeat(60));
    console.log('📊 DELETION SUMMARY');
    console.log('=' .repeat(60));
    console.log(`   TeamMembers Deleted: ${teamMembersDeleted.deletedCount}`);
    console.log(`   Users Deleted: ${usersDeleted.deletedCount}`);
    console.log(`   Orphaned References Cleaned: ${orphanedTeamMembers.modifiedCount}`);
    console.log('=' .repeat(60));
    console.log('');
    console.log(`✅ Remaining Users in Database: ${remainingUsers.length}`);
    remainingUsers.forEach(user => {
      const isProtected = PROTECTED_EMAILS.includes(user.email);
      const icon = isProtected ? '🔒' : '👤';
      console.log(`   ${icon} ${user.email} - ${user.fname} ${user.lname || ''}`);
    });
    console.log('');
    console.log('✅ Mass deletion completed successfully!');

  } catch (error) {
    console.error('❌ Fatal Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the deletion
deleteAllUsersExceptProtected();
