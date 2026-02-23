# Generate Payments and Commissions for Test Users

## ❓ The Problem

After updating users to have `subscriptionStatus: true`, you noticed:
- ❌ Direct Bonus not showing
- ❌ Level Income not showing
- ❌ No commissions generated

### Why This Happens:

**Commissions ONLY generate when:**
1. User makes payment through NOWPayments webhook
2. Payment record is created with `status: "finished"`
3. `generatePurchaseCommissions()` function is triggered
4. Commission records are created for sponsor and upline

**Simply setting `subscriptionStatus: true` does NOT:**
- Create payment records
- Trigger commission calculation
- Generate commission database entries

---

## ✅ The Solution

This script will:
1. ✅ Find all subscribed users who have sponsors
2. ✅ Create payment records ($135 standard package)
3. ✅ Call `generatePurchaseCommissions()` for each user
4. ✅ Generate all commission types:
   - **Direct Bonus** (8.34% - 33.4% based on direct count)
   - **Level Income** (for upline with 10+ directs)
   - **Binary Bonus** (14% for position-based referrals)
   - **Reward Bonus** (1.5% for high performers)

---

## 🚀 How to Run

### Easy Way (PowerShell):
```powershell
.\RUN_GENERATE_COMMISSIONS.ps1
```

### Direct Way:
```bash
node .\GENERATE_TEST_COMMISSIONS.js
```

---

## 📋 What Gets Created

### For Each Subscribed User with a Sponsor:

1. **Payment Record:**
```javascript
{
  userId: user._id,
  orderId: "TEST-{timestamp}-{userId}",
  paymentId: "PAY-{timestamp}-{userId}",
  amount: 135,
  status: "finished",
  provider: "nowpayments",
  metadata: { testPayment: true }
}
```

2. **Commission Records:**
- **Direct Bonus** → Sponsor gets 8.34% - 33.4% (based on total directs)
- **Level Income** → Upline (up to 4 levels) if they have 10+ directs
- **Binary Bonus** → 14% for left/right position referrals
- **Reward Bonus** → 1.5% for sponsors with 10+ directs

---

## 📊 Example Output

```
🔄 Processing users...

💳 [1/50] Payment created: testuser1@test.com ($135)
   💰 Generated 3 commissions (Total: $25.50)
      - direct_bonus: $11.25
      - level_income: $10.00
      - binary_bonus: $4.25

💳 [2/50] Payment created: testuser2@test.com ($135)
   💰 Generated 2 commissions (Total: $15.75)
      - direct_bonus: $11.25
      - reward_bonus: $4.50

⏭️ [3/50] Skipped: testuser3@test.com (Payment already exists)

========================================
📊 PROCESSING SUMMARY
========================================
Total Subscribed Users:   50
Payments Created:         47 💳
Commissions Generated:    156 💰
Skipped:                  3 ⏭️
Errors:                   0 ❌
========================================

📈 Commission Database Status:
   - Total Commissions: 156
   - Pending: 156
   - Direct Bonus: 47
   - Level Income: 89
   - Binary Bonus: 15
   - Reward Bonus: 5
```

---

## ⚠️ Important Notes

### Script Behavior:
- ✅ **Safe to run multiple times** - Skips users who already have payments
- ✅ **Only processes subscribed users** (`subscriptionStatus: true`)
- ✅ **Only processes users WITH sponsors** (Root users skipped)
- ✅ **Respects all qualification rules**:
  - Direct Bonus: Always paid to sponsor
  - Level Income: Only if upline has 10+ directs
  - Binary Bonus: Only for left/right position referrals
  - Reward Bonus: Only if sponsor has 10+ directs

### What Gets Skipped:
- Users without `subscriptionStatus: true`
- Users without TeamMember entry
- Users without a sponsor (root users)
- Users who already have payment records

---

## 🔍 Verification After Running

### 1. Check Commission Totals:
```javascript
// In MongoDB Shell or Compass
db.commissions.countDocuments()
db.commissions.countDocuments({ status: 'pending' })
```

### 2. Check User Dashboard:
- Login as a user who has referrals
- Check `/dashboard` for commission earnings
- Check `/payout` for pending commissions

### 3. API Endpoints:
```bash
# Get pending commissions
GET /api/commission/pending

# Get commission breakdown
GET /api/commission/breakdown

# Get total pending amount
GET /api/commission/total-pending
```

### 4. Check Specific User:
```javascript
// In MongoDB
db.commissions.find({ userId: ObjectId("user_id_here") })
```

---

## 🧪 Test Scenario Example

If you have this structure:
```
User A (sponsor)
  ├─ User B (direct referral)
  └─ User C (direct referral)
```

When you run the script for User B:
1. **Payment created** for User B ($135)
2. **Direct Bonus** paid to User A (8.34% = $11.25)
3. If User A has 10+ directs:
   - **Level Income** also paid
   - **Reward Bonus** also paid
4. If User B joined via left/right position:
   - **Binary Bonus** paid (14% = $18.90)

---

## 🛠️ Troubleshooting

### "No commissions generated"
**Reason:** Sponsor doesn't qualify
- Direct Bonus: Should always generate
- Level Income: Requires sponsor to have 10+ directs
- Binary Bonus: Requires position to be "left" or "right" (not "main")
- Reward Bonus: Requires sponsor to have 10+ directs

**Solution:** Check TeamMember records for direct counts

### "Skipped: No sponsor"
**Reason:** User is a root user (no sponsor)
**Solution:** This is expected - root users don't generate commissions

### "Payment already exists"
**Reason:** Script already ran for this user
**Solution:** This is safe - duplicate prevention working correctly

---

## 📝 Manual Commission Check Query

```javascript
// Check commissions for a specific user
db.commissions.find({ 
  userId: ObjectId("USER_ID_HERE") 
}).pretty()

// Check all direct bonuses
db.commissions.find({ 
  commissionType: "direct_bonus" 
}).count()

// Check pending commission total
db.commissions.aggregate([
  { $match: { status: "pending" } },
  { $group: { 
    _id: null, 
    total: { $sum: "$netAmount" } 
  }}
])
```

---

## 🔄 Related Scripts

1. **UPDATE_ALL_USERS_SUBSCRIPTION.js** - Sets subscription status
2. **GENERATE_TEST_COMMISSIONS.js** - Creates payments & commissions (this file)
3. **COMPLETE_MLM_TEST_SETUP.ps1** - Full MLM system setup

---

## ✅ Success Checklist

After running the script:
- [ ] Payment records created for subscribed users
- [ ] Commission records exist in database
- [ ] Dashboard shows commission earnings
- [ ] `/api/commission/pending` returns data
- [ ] `/api/commission/breakdown` shows correct totals
- [ ] Sponsor users see direct bonus commissions
- [ ] Upline users with 10+ directs see level income
- [ ] Users joined via left/right see binary bonus for sponsors

---

## 💡 Next Steps

1. **Verify in Dashboard:**
   - Login as a user with referrals
   - Check commission totals display
   - Verify breakdown by type

2. **Test Commission APIs:**
   ```bash
   GET /api/commission/pending
   GET /api/commission/breakdown
   GET /api/commission/total-pending
   ```

3. **Check Binary Matching:**
   - Ensure left/right leg counts are correct
   - Verify binary activation status
   - Check binary bonus generation

4. **Payout Testing:**
   - Test payout request functionality
   - Verify crypto wallet integration
   - Check payout approval flow

---

## 📞 Support

If commissions still don't show after running this script:
1. Check browser console for errors
2. Verify API endpoints are returning data
3. Check commission records in MongoDB
4. Verify user has sponsors/referrals setup correctly
5. Check that TeamMember relationships are correct
