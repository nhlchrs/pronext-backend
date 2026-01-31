# Bonus Structure Implementation - Version 1.0

## Overview
Complete bonus structure implementation based on the official bonus distribution model. The system automatically generates and tracks commissions when users purchase the $135 package.

## Bonus Structure Summary

| Bonus Type | Percentage | Status |
|-----------|-----------|--------|
| Direct Bonus | 33.4% | Active for 30 days |
| Level Income | 7.5% | After 10 directs |
| Reward | 1.5% | Performance-based |
| Binary | 14% | Position-based |
| **Total Payout** | **56.4%** | - |

---

## 1. Direct Bonus (33.4% Total)
**Duration:** Active for first 30 days from enrollment date
**Resets:** Every 30 days
**Payout:** 24-48 hours after payout request (after 30 days)

### Slab Structure
| Directs | Percentage | Per Sale | Amount per $135 |
|---------|-----------|----------|-----------------|
| 1-3 | 8.34% | $11.25 | $11.25 |
| 4-6 | 16.68% | $22.50 | $22.50 |
| 7-9 | 25% | $33.75 | $33.75 |
| 10+ | 33.4% | $44.50 | $44.50 |

**Implementation Details:**
- Calculated when user joins team using referral code
- Counts unique direct referrals added in current 30-day period
- Slab is determined by direct count at time of purchase
- Automatically resets every 30 days from enrollment date

**Example:**
- User enrolled on Jan 1
- Has 5 directs by Jan 15
- Gets 16.68% = $22.50 per direct's purchase
- On Jan 31, counter resets
- Starting Feb 1, only new directs count toward next cycle

---

## 2. Level Income (7.5% Total)
**Duration:** After reaching 10 directs, remains active until package expiration
**Payout:** 24-48 hours after payout request (after 30 days)

### Level Structure
| Level | Percentage | Per Sale | Requirement |
|-------|-----------|----------|------------|
| Level 1 | 1% | $1.35 | 10 directs |
| Level 2 | 1.5% | $2.02 | 10 directs + 10 more in level 1 |
| Level 3 | 2% | $2.70 | 10 directs + network growth |
| Level 4 | 3% | $4.05 | 10 directs + deep network |

**Implementation Details:**
- Level determined by downline structure depth
- Triggered when sponsor has 10+ directs
- Applied to all upline members (up to 4 levels)
- Each purchase in downline triggers level income payments
- Remains active until package expiry date

**Example Calculation:**
```
Sponsor (Level 1 with 3 members who made sales):
- 1% of $135 × 3 = $4.05

Person 2 levels deep (Level 2 with 6 members):
- 1.5% of $135 × 6 = $12.15

Person 3 levels deep (Level 3 with 2 members):
- 2% of $135 × 2 = $5.40
```

---

## 3. Reward Bonus (1.5%)
**Activation:** When sponsor has 10+ directs
**Amount:** 1.5% of package price = $2.025

**Implementation Details:**
- Generated for high performers
- Paid for each qualifying referral after reaching 10 directs
- Bonus on top of direct bonus and level income

---

## 4. Binary Bonus (14%)
**Activation:** Position-based referrals (left/right)
**Amount:** 14% of package price = $18.90

**Implementation Details:**
- Generated when user joins via left (Lpro) or right (Rpro) code
- Tracked via the `position` field (left/right/main)
- Used to incentivize balanced team building
- Paid to direct sponsor of the referred user

---

## Database Schema Updates

### TeamMember Schema
```javascript
{
  userId: ObjectId,                    // User reference
  sponsorId: ObjectId,                 // Direct sponsor
  referralCode: String,                // Main code
  leftReferralCode: String,            // Lpro code
  rightReferralCode: String,           // Rpro code
  position: String,                    // "main", "left", "right"
  enrollmentDate: Date,                // When user joined (default: now)
  packageExpiryDate: Date,             // When package expires (360 days)
  totalEarnings: Number,               // Career total
  levelQualified: Boolean,             // Has 10+ directs?
  levelQualifiedDate: Date,            // When qualified
}
```

### Commission Schema
```javascript
{
  userId: ObjectId,                    // Commission earner
  referrerId: ObjectId,                // Who generated the commission
  transactionId: ObjectId,             // Payment transaction reference
  commissionType: String,              // "direct_bonus", "level_income", "binary_bonus", "reward_bonus"
  level: Number,                       // Network level (1-4)
  grossAmount: Number,                 // Before tax
  taxPercentage: Number,               // Tax rate
  taxAmount: Number,                   // Tax amount
  netAmount: Number,                   // After tax
  status: String,                      // "pending", "approved", "paid", etc.
  earningDate: Date,                   // When earned
  period: {
    month: Number,                     // For 30-day cycles
    year: Number
  }
}
```

---

## API Endpoints

### User Endpoints

**GET `/api/commission/pending`**
- Get all pending commissions
- Returns: Array of commission objects

**GET `/api/commission/total-pending`**
- Get total pending commission amount
- Returns: { totalPendingAmount: number }

**GET `/api/commission/breakdown`**
- Get commission breakdown by type
- Query params: startDate, endDate (optional)
- Returns: { breakdown: { directBonus, levelIncome, binaryBonus, rewardBonus } }

**GET `/api/commission/estimated-earnings`**
- Calculate potential future earnings
- Returns: { directBonus, levelIncome, rewardBonus, binaryBonus, total, qualifiesForLevelIncome, directCount, totalDownline }

**GET `/api/commission/history`**
- Get commission history with pagination
- Query params: page, limit
- Returns: { commissions: [], pagination: {} }

**POST `/api/commission/request-payout`**
- Request payout of pending commissions
- Body: { amount, payoutMethod, bankDetails?, upiId? }
- Returns: { payout: {}, referenceNumber: string }

**GET `/api/commission/payout-history`**
- Get user's payout history
- Query params: page, limit
- Returns: { payouts: [], pagination: {} }

### Admin Endpoints

**GET `/api/admin/commissions`**
- Get all commissions (admin only)
- Query params: userId, status, type, page, limit
- Returns: { commissions: [], pagination: {} }

**POST `/api/admin/commission/approve/:id`**
- Approve a pending commission
- Returns: Updated commission object

**POST `/api/admin/commission/reject/:id`**
- Reject a pending commission
- Body: { reason?: string }
- Returns: Updated commission object

---

## Commission Generation Flow

### When User Makes Purchase
1. Payment webhook received (status = "finished")
2. Subscription activated (360 days)
3. `generatePurchaseCommissions()` called with:
   - buyerId: User who purchased
   - amount: $135
   - transactionId: Payment ID

### Direct Bonus Generation
```
1. Check if sponsor is in active 30-day period
2. Count directs added in current 30-day cycle
3. Get slab percentage based on direct count
4. Calculate: amount × percentage / 100
5. Create Commission record with status = "pending"
```

### Level Income Generation
```
1. Get sponsor's sponsor (upline)
2. For each upline member (up to 4 levels):
   a. Check if has 10+ directs
   b. Get level percentage for that depth
   c. Calculate: amount × level_percentage / 100
   d. Create Commission record
3. Continue until no more upline or 4 levels reached
```

### Binary Bonus Generation
```
1. Check buyer's position (left/right/main)
2. If position is left or right:
   a. Calculate: amount × 14 / 100
   b. Create Commission for sponsor
3. If position is main: skip binary bonus
```

### Reward Bonus Generation
```
1. Check if sponsor has 10+ directs
2. If yes:
   a. Calculate: amount × 1.5 / 100
   b. Create Commission record
3. If no: skip reward bonus
```

---

## 30-Day Bonus Cycle Logic

### Enrollment Date Tracking
- Stored when user joins team
- Used as baseline for cycle calculations

### Cycle Calculation
```
Days since enrollment = NOW - enrollmentDate
Cycle number = floor(days / 30)
Cycle start = enrollmentDate + (cycleNumber × 30 days)
Cycle end = cycleNumber × 30 days + 30 days
```

### Direct Count for Slab
```
SELECT COUNT(*)
FROM TeamMembers
WHERE sponsorId = userIdAndFilter by createdAt between cycle_start and cycle_end
```

### Reset Example
```
Enrollment: Jan 1, 2024
Cycle 1: Jan 1 - Jan 30 (Slab based on directs added)
Cycle 2: Jan 31 - Feb 29 (Counter resets, new directs count)
Cycle 3: Mar 1 - Mar 30 (Counter resets again)
...continues until subscription expires
```

---

## Payout Process

### User Initiates Payout
1. Calls `/api/commission/request-payout`
2. Specifies amount and payout method
3. System validates:
   - Amount > 0
   - Amount ≤ total pending commissions
   - Valid payout method (bank_transfer, upi, wallet, cheque)
4. Creates Payout record with status = "pending"

### Admin Reviews & Processes
1. Admin sees payout request
2. Approves or rejects (or auto-processes if configured)
3. For approved payouts:
   - Status = "processing"
   - Funds transferred
   - Status = "completed"
4. For rejected payouts:
   - Status = "failed"
   - Reason recorded

### Timeline
- User can request payout anytime
- Minimum requirement: 30 days after commission earned
- Processing time: 24-48 hours

---

## Tax Handling

### Current Implementation
- taxPercentage: 0% (default)
- taxAmount: 0
- netAmount = grossAmount (no deduction)

### For Future Enhancement
```javascript
// Calculate tax
const TAX_RATE = 0.10; // 10% example
const taxAmount = grossAmount * TAX_RATE;
const netAmount = grossAmount - taxAmount;

// Store in commission record
{
  taxPercentage: TAX_RATE * 100,
  taxAmount,
  netAmount
}
```

---

## Helper Functions Reference

### `commissionService.js`

**generatePurchaseCommissions(buyerId, amount, transactionId)**
- Main entry point for commission generation
- Returns: Array of created Commission records

**generateDirectBonus(sponsorTeam, buyerId, transactionId, amount)**
- Creates direct bonus commission
- Checks 30-day period eligibility

**generateLevelIncomes(sponsorId, buyerId, transactionId, amount)**
- Generates level income for upline members
- Traverses up to 4 levels

**generateBinaryBonus(sponsorTeam, buyerId, transactionId, amount)**
- Creates binary bonus for position-based referrals

**generateRewardBonus(sponsorTeam, buyerId, transactionId, amount)**
- Creates reward bonus for high performers

**isIn30DayBonusPeriod(enrollmentDate)**
- Checks if user is in active 30-day bonus period
- Returns: boolean

**getCurrentBonusPeriod(enrollmentDate)**
- Calculates current 30-day cycle dates
- Returns: { startDate, endDate, cycleNumber, month, year }

**getPendingCommissions(userId)**
- Fetches all pending commissions for user
- Returns: Array of Commission objects

**getTotalPendingAmount(userId)**
- Calculates total pending commission amount
- Returns: number

**getCommissionBreakdown(userId, startDate, endDate)**
- Gets commission totals by type
- Returns: { directBonus, levelIncome, binaryBonus, rewardBonus }

**calculateEstimatedEarnings(userId)**
- Projects potential future earnings
- Returns: Breakdown with qualification status

---

## Testing Scenarios

### Scenario 1: New User Purchase
```
1. User A enrolls with sponsor B
2. User A purchases $135 package
3. Expected commissions for B:
   - Direct Bonus: 8.34% = $11.25 (Slab 1: 1 direct)
   - Level Income: None (B needs 10 directs)
   - Reward: None (B needs 10 directs)
   - Binary: Only if A joined via Lpro/Rpro
```

### Scenario 2: Sponsor Reaches 10 Directs
```
1. Sponsor B now has 10+ directs
2. User C (direct of B) purchases $135
3. Expected commissions for B:
   - Direct Bonus: 33.4% = $44.50 (Slab 4: 10+ directs)
   - Level Income: N/A (B is the direct sponsor)
   - Reward: 1.5% = $2.025
4. B's sponsor (if exists) gets:
   - Level 1 Income: 1% = $1.35
```

### Scenario 3: 30-Day Cycle Reset
```
Enrollment Date: Jan 1
- Jan 15: 3 directs purchase → 8.34% each ($33.75 total)
- Jan 31: Cycle still active
- Feb 1: Cycle resets
- Feb 8: New directs purchase → counted toward new cycle
- Original 3 directs don't count anymore
```

### Scenario 4: Deep Downline Purchase
```
Structure:
- Sponsor A (10+ directs) ✓ Level 1
  - Member B (10+ directs) ✓ Level 2
    - Member C (10+ directs) ✓ Level 3
      - Member D (5 directs) ✗ Level 4 (not qualified)
        - Member E (purchases)

Commission recipients:
- D: 0 (no commission - not 10 directs)
- C: 2% = $2.70 (Level 3)
- B: 1.5% = $2.02 (Level 2)
- A: 1% = $1.35 (Level 1)
- E's direct sponsor: Direct Bonus based on slab
```

---

## Important Notes

1. **Package Duration:** 360 days from purchase
2. **Bonus Cycles:** Repeat every 30 days from enrollment date
3. **Level Income:** Requires minimum 10 direct referrals
4. **Position Tracking:** Left/Right positions get binary bonus
5. **Payout Requirement:** Must wait 30 days after earning commission
6. **No Auto-Payout:** Commissions are pending until explicitly requested
7. **Upline Limit:** Maximum 4 levels for level income
8. **Tax Ready:** Structure supports future tax deduction implementation

---

## Implementation Checklist

- ✅ Commission Model: Stores all commission types
- ✅ Bonus Calculator: Calculates percentages and amounts
- ✅ Commission Service: Generates commissions on purchase
- ✅ Payment Webhook: Triggers commission generation
- ✅ 30-Day Cycle: Tracks and resets enrollment periods
- ✅ Level Income: Qualifies after 10 directs
- ✅ Position Tracking: Records join position (left/right/main)
- ✅ API Endpoints: User and admin commission management
- ✅ Payout System: Request and track payout status
- ✅ Database Fields: enrollmentDate and packageExpiryDate added

---

## Next Steps (Optional Enhancements)

1. **Email Notifications:** Commission earned, payout processed
2. **Earning Dashboard:** Visual charts of earnings by type
3. **Tax Calculation:** Auto-deduct applicable taxes
4. **Referral Limits:** Cap commissions per user per period
5. **Commission Disputes:** User can dispute commission amounts
6. **Bulk Payout:** Admin can process multiple payouts
7. **Commission History Export:** CSV/PDF reports
8. **Auto-Payout:** Option to auto-request payout on threshold
