// ========================================================
// MongoDB Shell Script: Update All Users to Subscribed
// Run this in MongoDB Shell or Compass
// ========================================================

// Calculate dates
const now = new Date();
const subscriptionDurationDays = 720; // 2 years
const expiryDate = new Date(now.getTime() + subscriptionDurationDays * 24 * 60 * 60 * 1000);

print("========================================");
print("📊 Starting Subscription Update Process");
print("========================================");
print("Current Date: " + now.toISOString());
print("Expiry Date: " + expiryDate.toISOString());
print("Duration: " + subscriptionDurationDays + " days (2 years)");
print("");

// Get all users
const allUsers = db.users.find({}).toArray();
print("Found " + allUsers.length + " users to update\n");

let updatedCount = 0;
let errorCount = 0;

// Update each user with alternating Pro/Premium tier
allUsers.forEach((user, index) => {
  try {
    // Alternate between Pro and Premium (odd index = Pro, even = Premium)
    const subscriptionTier = (index + 1) % 2 === 1 ? "Pro" : "Premium";
    
    const result = db.users.updateOne(
      { _id: user._id },
      {
        $set: {
          subscriptionStatus: true,
          subscriptionTier: subscriptionTier,
          subscriptionExpiryDate: expiryDate,
          subscriptionActivatedDate: now,
          lastPaymentDate: now
        }
      }
    );
    
    if (result.modifiedCount > 0) {
      updatedCount++;
      print("✅ [" + (index + 1) + "/" + allUsers.length + "] Updated: " + user.email + " → " + subscriptionTier);
    } else {
      errorCount++;
      print("⚠️  [" + (index + 1) + "/" + allUsers.length + "] No change: " + user.email);
    }
  } catch (error) {
    errorCount++;
    print("❌ [" + (index + 1) + "/" + allUsers.length + "] Error: " + user.email + " - " + error);
  }
});

print("\n========================================");
print("📊 UPDATE SUMMARY");
print("========================================");
print("Total Users Found:    " + allUsers.length);
print("Successfully Updated: " + updatedCount + " ✅");
print("Errors/No Change:     " + errorCount);
print("========================================");

// Verify updates
const proCount = db.users.countDocuments({ subscriptionTier: "Pro", subscriptionStatus: true });
const premiumCount = db.users.countDocuments({ subscriptionTier: "Premium", subscriptionStatus: true });
const subscribedCount = db.users.countDocuments({ subscriptionStatus: true });

print("\n📈 Current Subscription Status:");
print("   - Total Subscribed: " + subscribedCount);
print("   - Pro Tier:         " + proCount);
print("   - Premium Tier:     " + premiumCount);
print("\n✅ Script completed!");
