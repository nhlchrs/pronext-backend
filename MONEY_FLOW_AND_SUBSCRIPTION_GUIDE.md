# MONEY FLOW AND SUBSCRIPTION CHECKING SYSTEM

## 📊 HOW MONEY IS BEING ADJUSTED IN THE SYSTEM

### 1. **Payment Flow (User Purchases Subscription)**

**File:** `controller/payment/paymentController.js` (Lines 370-550)

#### Step 1: User Initiates Payment
- User purchases subscription package ($135 standard)
- Payment record created in database with status `pending`
- Order sent to NOWPayments crypto gateway

#### Step 2: Webhook Receives Payment Confirmation
**Endpoint:** `POST /api/payments/webhook`

When NOWPayments confirms payment (status = "finished"):

```javascript
// Location: paymentController.js Line ~460
if (payment_status === "finished") {
  // 1. Activate User Subscription
  await userModel.findByIdAndUpdate(paymentRecord.userId, {
    subscriptionStatus: true,
    subscriptionTier: subscriptionTier,
    subscriptionExpiryDate: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
    lastPaymentDate: new Date(),
    subscriptionActivatedDate: new Date(),
  });

  // 2. Generate Commissions for Upline
  const commissions = await generatePurchaseCommissions(
    paymentRecord.userId,
    amount,
    paymentRecord._id
  );

  // 3. Add PV to Binary Tree
  const pvAmount = 94.5; // For $135 package
  await addPVToLeg(buyer.sponsorId, buyer.position, pvAmount);
}
```

### 2. **Commission Generation**

**File:** `helpers/commissionService.js` (Lines 22-60)

#### Commission Types Generated When User Purchases:

**A. Direct Referral Commission**
- **Generated for:** Immediate sponsor who referred the buyer
- **Amount:** 5-9% of purchase amount based on sponsor's total direct referrals
  - 3-11 directs: 5%
  - 12-39 directs: 6%
  - 40-119 directs: 7%
  - 120-249 directs: 8%
  - 250+ directs: 9%
- **Stored in:** `Commission` model with `commissionType: "direct_bonus"`

**Example:**
```javascript
// User buys $135 package
// Sponsor has 5 total directs → 5% commission
// Commission = $135 × 5% = $6.75
```

**B. Level Income Commission**
- **Generated for:** Upline members at levels 1-4
- **Requirement:** Upline member must have 10+ direct referrals to qualify
- **Amount:** 
  - Level 1: 5% of purchase
  - Level 2: 3% of purchase
  - Level 3: 2% of purchase
  - Level 4: 1% of purchase
- **Stored in:** `Commission` model with `commissionType: "level_income"`

**C. Binary Commission (Matching Bonus)**
- **Generated for:** Based on 1:2 matching of left/right leg PV
- **Trigger:** Calculated periodically based on team PV balance
- **Amount:** Based on binary rank (10-20% of matched volume)
- **Stored in:** `Commission` model with `commissionType: "binary_bonus"`

**D. Rank Rewards**
- **Generated for:** Achieving specific binary ranks
- **Stored in:** `BinaryReward` model (not monetary, gifts/benefits)

### 3. **Money Tracking in Database**

#### Commission Model (commissionModel.js)
```javascript
{
  userId: ObjectId,           // Who earns the commission
  referrerId: ObjectId,        // Who made the purchase (buyer)
  transactionId: ObjectId,     // Payment record ID
  commissionType: String,      // direct_bonus, level_income, binary_bonus
  level: Number,               // 1-4 for level income
  grossAmount: Number,         // Commission before tax
  netAmount: Number,           // Commission after tax (what user receives)
  status: String,              // pending, approved, paid, rejected
  earningDate: Date,           // When commission was earned
}
```

#### TeamMember Model (teamModel.js)
```javascript
{
  userId: ObjectId,
  totalEarnings: Number,       // Sum of all netAmount from Commission records
  totalEarningsAmount: Number, // Same as totalEarnings (redundant field)
  directCount: Number,         // Count of direct referrals
}
```

---

## 🔍 CHECKING IF USER IS ALREADY SUBSCRIBED

### 1. **Subscription Status Check**

**Location:** User Model (`models/authModel.js`)

```javascript
{
  subscriptionStatus: Boolean,      // true = active, false = inactive
  subscriptionTier: String,         // Basic, Pro, Premium, Enterprise
  subscriptionExpiryDate: Date,     // When subscription expires
  subscriptionActivatedDate: Date,  // When first activated
  lastPaymentDate: Date,            // Last successful payment
}
```

### 2. **Where Subscription is Checked**

#### A. When User Joins a Team
**File:** `controller/team/teamController.js` (applyReferralCode function)

```javascript
// Location: teamController.js Line ~1750
export const applyReferralCode = async (userId, code) => {
  // Check if user already has a sponsor (already in a team)
  const existingMember = await TeamMember.findOne({ userId });
  
  if (existingMember && existingMember.sponsorId) {
    return {
      success: false,
      message: "You are already part of a team. Cannot join another team.",
    };
  }
  
  // ⚠️ NO SUBSCRIPTION CHECK HERE
  // Users can join teams even without active subscription
  // Subscription only needed for earning commissions
}
```

**Important:** The system does NOT check subscription status when joining a team. Users can join teams before purchasing.

#### B. When Checking Commission Eligibility
**File:** `middleware/authMiddleware.js` (requireActiveSubscription)

```javascript
// Location: authMiddleware.js Line ~236
export const requireActiveSubscription = (req, res, next) => {
  if (!req.user.subscriptionStatus) {
    return res.status(403).json({
      success: false,
      message: "Active subscription required to access this feature"
    });
  }
  
  // Check if subscription expired
  if (req.user.subscriptionExpiryDate && 
      new Date(req.user.subscriptionExpiryDate) < new Date()) {
    return res.status(403).json({
      success: false,
      message: "Subscription expired. Please renew."
    });
  }
  
  next();
};
```

### 3. **API Endpoints to Check Subscription**

#### Check Current User's Subscription
```
GET /api/user/profile
Authorization: Bearer {token}

Response:
{
  "user": {
    "subscriptionStatus": true,
    "subscriptionTier": "Pro",
    "subscriptionExpiryDate": "2028-02-22",
    "subscriptionActivatedDate": "2026-02-22"
  }
}
```

#### Check Team Member Status (includes subscription)
```
GET /api/team/check-status
Authorization: Bearer {token}

Response:
{
  "success": true,
  "isTeamMember": true,
  "data": {
    "subscriptionActive": true,
    "subscriptionTier": "Pro",
    "subscriptionExpiry": "2028-02-22"
  }
}
```

---

## 💰 COMMISSION WITHDRAWAL FLOW

### 1. **Viewing Available Earnings**
```
GET /api/commission/breakdown
Response: {
  "direct_bonus": 20.25,
  "level_income": 0,
  "binary_bonus": 0
}
```

### 2. **Commission Status States**
- **pending:** Commission earned but awaiting approval
- **approved:** Ready for withdrawal
- **paid:** Already withdrawn to user
- **rejected:** Denied (fraud detection, etc.)

### 3. **Withdrawal Process** (Not yet implemented)
Future endpoints:
- `POST /api/commission/request-withdrawal` - Request payout
- `GET /api/commission/withdrawal-history` - View past withdrawals
- Admin approves withdrawals via admin panel

---

## 🔐 SECURITY & VALIDATION

### 1. **Payment Webhook Security**
**File:** `controller/payment/paymentController.js` Line ~405

```javascript
// Verify NOWPayments signature
const signature = req.headers["x-signature"];
if (!nowpaymentsService.verifyIPNSignature(dataForSignature, signature)) {
  return ErrorResponse(res, "Invalid signature", 401);
}
```

### 2. **Commission Generation Rules**
- ✅ Only generate when payment status = "finished"
- ✅ Check sponsor exists before creating commission
- ✅ Verify upline members have 10+ directs for level income
- ✅ Prevent duplicate commission generation

### 3. **Subscription Expiry Handling**
- Automatic expiry check in middleware
- User loses access to subscriber-only features
- Can renew anytime (commissions resume)

---

## 📝 SUMMARY

### How Money Flows:
1. **User Pays** → NOWPayments processes payment
2. **Webhook Confirms** → User subscription activated
3. **Commissions Generated** → Added to Commission table (status: pending)
4. **Admin Reviews** → Changes status to approved
5. **User Withdraws** → Status changes to paid (future feature)

### Subscription Checking:
- ✅ **At Profile View:** `/api/user/profile`
- ✅ **At Protected Routes:** `requireActiveSubscription` middleware
- ✅ **At Commission Breakdown:** `/api/commission/breakdown`
- ❌ **NOT at Team Join:** Users can join teams without subscription

### Where to Query User Subscription:
```javascript
// Backend
const user = await User.findById(userId);
console.log(user.subscriptionStatus); // true/false
console.log(user.subscriptionExpiryDate);

// Frontend API Call
const response = await fetch('/api/user/profile', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { user } = await response.json();
console.log('Subscribed:', user.subscriptionStatus);
```

---

## 🚀 FILES TO CHECK FOR MONEY FLOW

1. **Payment Processing:** `controller/payment/paymentController.js`
2. **Commission Generation:** `helpers/commissionService.js`
3. **Commission Calculation:** `helpers/bonusCalculator.js`
4. **Subscription Middleware:** `middleware/authMiddleware.js`
5. **Team Joining:** `controller/team/teamController.js`
6. **Commission Routes:** `controller/team/commissionRoutes.js`
7. **User Model:** `models/authModel.js`
8. **Commission Model:** `models/commissionModel.js`
9. **Team Model:** `models/teamModel.js`
