# Update All Users to Subscribed Status

This guide provides scripts to update all existing users in the database to have active subscriptions.

## 📋 What Gets Updated

All users will receive:
- **subscriptionStatus**: `true` (active subscription)
- **subscriptionTier**: Alternating between `"Pro"` and `"Premium"`
  - Odd-numbered users → Pro
  - Even-numbered users → Premium
- **subscriptionExpiryDate**: 2 years from now (720 days)
- **subscriptionActivatedDate**: Current timestamp
- **lastPaymentDate**: Current timestamp

---

## 🚀 Option 1: Node.js Script (Recommended)

### Run with PowerShell:
```powershell
.\RUN_UPDATE_SUBSCRIPTIONS.ps1
```

### Or run directly:
```bash
node .\UPDATE_ALL_USERS_SUBSCRIPTION.js
```

**Features:**
- ✅ Detailed progress logging
- ✅ Error tracking
- ✅ Verification after updates
- ✅ Summary report with counts

---

## 🗄️ Option 2: MongoDB Shell Script

### Using MongoDB Shell:
```bash
mongosh "your-mongodb-uri" UPDATE_SUBSCRIPTIONS_MONGO_SHELL.js
```

### Using MongoDB Compass:
1. Open MongoDB Compass
2. Connect to your database
3. Go to "Mongosh" tab at the bottom
4. Copy-paste the contents of `UPDATE_SUBSCRIPTIONS_MONGO_SHELL.js`
5. Press Enter to execute

---

## 📊 Example Output

```
========================================
📊 Starting Subscription Update Process
========================================
Found 50 users to update

✅ [1/50] Updated: user1@test.com → Pro
✅ [2/50] Updated: user2@test.com → Premium
✅ [3/50] Updated: user3@test.com → Pro
...

========================================
📊 UPDATE SUMMARY
========================================
Total Users Found:    50
Successfully Updated: 50 ✅
Failed Updates:       0 ❌
Subscription Expiry:  2/24/2028 (720 days / 2 years)
========================================

📈 Current Subscription Status:
   - Total Subscribed Users: 50
   - Pro Tier Users: 25
   - Premium Tier Users: 25

✅ Script completed successfully!
```

---

## ⚠️ Important Notes

1. **Backup First**: Always backup your database before running mass updates
2. **Test Environment**: Test on a development database first
3. **Environment Variables**: Ensure `.env` file has correct `MONGODB_URI`
4. **Reversibility**: This update is not automatically reversible - keep backups!

---

## 🔄 Manual MongoDB Query (Alternative)

If you want to run a simple update query manually in MongoDB:

```javascript
// Update ALL users to Pro tier with 2-year subscription
db.users.updateMany(
  {},  // Empty filter = all users
  {
    $set: {
      subscriptionStatus: true,
      subscriptionTier: "Pro",
      subscriptionExpiryDate: new Date(Date.now() + 720 * 24 * 60 * 60 * 1000),
      subscriptionActivatedDate: new Date(),
      lastPaymentDate: new Date()
    }
  }
)
```

---

## 📝 Verification Queries

Check subscription status after update:

```javascript
// Count subscribed users
db.users.countDocuments({ subscriptionStatus: true })

// Count by tier
db.users.countDocuments({ subscriptionTier: "Pro" })
db.users.countDocuments({ subscriptionTier: "Premium" })

// Check expiry dates
db.users.find(
  { subscriptionStatus: true },
  { email: 1, subscriptionTier: 1, subscriptionExpiryDate: 1 }
).limit(10)
```

---

## 🛠️ Troubleshooting

### Script won't run:
- Make sure you're in the `pronext-backend` directory
- Verify `.env` file exists with correct MongoDB connection string
- Check Node.js is installed: `node --version`

### Some users not updating:
- Check the error log in the script output
- Verify user documents don't have validation errors
- Ensure MongoDB connection has write permissions

### Want to revert changes:
- Restore from backup
- Or manually set specific users:
  ```javascript
  db.users.updateOne(
    { email: "user@example.com" },
    { 
      $set: { 
        subscriptionStatus: false,
        subscriptionTier: "Basic"
      }
    }
  )
  ```

---

## ✅ Success Checklist

After running the script, verify:
- [ ] All users have `subscriptionStatus: true`
- [ ] Users have either Pro or Premium tier
- [ ] Expiry dates are set to ~2 years in the future
- [ ] No users left with `subscriptionStatus: false` (unless intentional)
- [ ] Count of Pro users ≈ Count of Premium users (for alternating assignment)

---

## 📞 Support

If you encounter issues:
1. Check the error messages in the script output
2. Verify your MongoDB connection
3. Ensure your .env file is properly configured
4. Check that you have the necessary database permissions
