import mongoose from 'mongoose';
import Commission from './models/commissionModel.js';
import User from './models/authModel.js';
import dotenv from 'dotenv';

dotenv.config();

const checkBinaryCommission = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const user = await User.findOne({ email: 'nihal1@test.com' });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('👤 Checking commissions for:', user.email);
    console.log('   User ID:', user._id);
    console.log('');

    const binaryCommissions = await Commission.find({
      userId: user._id,
      commissionType: 'binary_bonus'
    }).sort({ createdAt: -1 });

    console.log(`📊 Found ${binaryCommissions.length} binary commission records\n`);

    if (binaryCommissions.length > 0) {
      let total = 0;
      binaryCommissions.forEach((comm, index) => {
        console.log(`[${index + 1}] Binary Commission:`);
        console.log('   Amount: $' + comm.netAmount);
        console.log('   Status:', comm.status);
        console.log('   Created:', comm.createdAt);
        console.log('   Description:', comm.description);
        console.log('');
        total += comm.netAmount;
      });
      console.log('💰 Total Binary Commission: $' + total.toFixed(2));
    } else {
      console.log('⚠️  No binary commission records found');
      console.log('   Binary commissions are generated when:');
      console.log('   - You have members in both left and right legs');
      console.log('   - They make purchases (generate PV)');
      console.log('   - The system matches left vs right leg PV');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
};

checkBinaryCommission();
