# Bonus Structure Quick Reference

## 📊 At a Glance

```
Package Price: $135
Total Payout: 56.4%

Direct Bonus:    33.4%  (1st 30 days)
Level Income:     7.5%  (after 10 directs)
Reward:           1.5%  (performance)
Binary:          14%    (left/right position)
```

---

## 💰 Direct Bonus Slabs

| Direct Count | Bonus % | Per Sale |
|:---:|:---:|:---:|
| 1-3 | 8.34% | $11.25 |
| 4-6 | 16.68% | $22.50 |
| 7-9 | 25% | $33.75 |
| 10+ | 33.4% | $44.50 |

**Resets every 30 days from enrollment date**

---

## 📈 Level Income Requirements

| Level | % | Per Sale | Requirement |
|:---:|:---:|:---:|:---|
| 1 | 1% | $1.35 | 10 directs |
| 2 | 1.5% | $2.02 | Deep network |
| 3 | 2% | $2.70 | Deeper network |
| 4 | 3% | $4.05 | Very deep |

**Activated: After reaching 10 directs**
**Duration: Until package expires (360 days)**

---

## 🔄 30-Day Bonus Cycle

```
Day 1-30:   Count directs → Get slab 1 bonus
Day 31-60:  Counter resets → Get slab 2 bonus
Day 61-90:  Counter resets → Get slab 3 bonus
...repeats until package expires
```

**Only NEW directs in each cycle count toward slab**

---

## 🎯 Key Triggers

| Trigger | Action |
|---------|--------|
| User purchases $135 | Generate all applicable commissions |
| Joins via Lpro | + Binary bonus (14%) |
| Joins via Rpro | + Binary bonus (14%) |
| Sponsor has 10+ directs | + Level income earned by sponsor |
| Day 31 from enrollment | Direct bonus cycle resets |
| Day 361 from purchase | Package expires |

---

## 💳 Payout Flow

1. **Earn:** Commission created with status "pending"
2. **Wait:** Minimum 30 days after earning
3. **Request:** User calls `/api/commission/request-payout`
4. **Process:** Admin approves/rejects (24-48 hours)
5. **Receive:** Money transferred via chosen method

---

## 🔑 API Endpoints (User)

```
GET  /api/commission/pending
GET  /api/commission/total-pending
GET  /api/commission/breakdown
GET  /api/commission/estimated-earnings
GET  /api/commission/history
POST /api/commission/request-payout
GET  /api/commission/payout-history
```

---

## 👨‍💼 API Endpoints (Admin)

```
GET  /api/admin/commissions
POST /api/admin/commission/approve/:id
POST /api/admin/commission/reject/:id
```

---

## 📋 Commission Types

| Type | When | Amount | Notes |
|:---|:---|:---:|:---|
| **direct_bonus** | Direct referral | 8-33.4% | 30-day cycles |
| **level_income** | Downline purchase | 1-3% | 10+ directs |
| **binary_bonus** | Left/Right join | 14% | Position-based |
| **reward_bonus** | Performance | 1.5% | 10+ directs |

---

## ⚙️ Database Fields

**TeamMember additions:**
- `enrollmentDate` - When user joined (tracks 30-day cycles)
- `packageExpiryDate` - When $135 package expires
- `position` - "main", "left", or "right" (for binary bonus)

**Commission schema:**
- `commissionType` - Type of commission
- `level` - Network level (1-4)
- `grossAmount` - Before tax
- `netAmount` - After tax
- `status` - pending/approved/paid/rejected
- `period` - { month, year } for tracking

---

## 📊 Commission Examples

### Example 1: First Purchase
```
Buyer: New member joins via main code
Sponsor: Has 0 directs before this

Direct Bonus:
  - Count: 1 direct
  - Slab: 8.34% (1-3)
  - Amount: $11.25 ✓

Level Income: None (sponsor needs 10)
Binary: None (joined via main code)
Reward: None (sponsor needs 10)

Total earned by sponsor: $11.25
```

### Example 2: 10th Direct Purchase
```
Buyer: 10th direct of sponsor
Sponsor: Now has exactly 10 directs

Direct Bonus:
  - Count: 10 directs
  - Slab: 33.4% (10+)
  - Amount: $44.50 ✓

Level Income: $0 (sponsor is direct referrer)
Binary: $0 (assume main position)
Reward: $2.025 ✓ (now qualifies)

Total earned by sponsor: $46.525

Sponsor's sponsor (if exists) also gets:
  - Level 1 Income: 1% × $135 = $1.35 ✓
```

### Example 3: Deep Network Purchase
```
Structure:
A (10+ directs) → B (10+ directs) → C (10+ directs) → D (2 directs) → E purchases

Commission flow:
  E's direct sponsor D: $0 (doesn't have 10 directs)
  C: $2.70 (Level 3, 2% of $135)
  B: $2.02 (Level 2, 1.5% of $135)
  A: $1.35 (Level 1, 1% of $135)
  D: $11.25-44.50 (Direct bonus based on slab)
```

---

## 🚀 Implementation Status

- ✅ Commission Model created
- ✅ Bonus Calculator implemented
- ✅ Commission Service with all logic
- ✅ Payment webhook integration
- ✅ 30-day cycle tracking
- ✅ Level income qualification
- ✅ Position tracking for binary bonus
- ✅ API endpoints (user & admin)
- ✅ Payout request system

---

## ❓ FAQ

**Q: When do commissions pay out?**
A: 24-48 hours after user requests payout (minimum 30 days after earning)

**Q: Do 30-day cycles continue forever?**
A: No, only while package is active (360 days from purchase)

**Q: Can level income change after 10 directs?**
A: Yes, level increases with deeper network (levels 1-4)

**Q: Does binary bonus pay every referral?**
A: Only if referred via Lpro or Rpro code (left/right position)

**Q: What happens after 360 days?**
A: Package expires, no more commissions earned unless renewed

**Q: Are commissions automatic?**
A: Generated automatically, but user must request payout manually

---

## 🔗 Related Files

- `helpers/bonusCalculator.js` - Percentage calculations
- `helpers/commissionService.js` - Commission generation logic
- `models/commissionModel.js` - Database schema
- `models/teamModel.js` - Team and enrollment tracking
- `controller/payment/paymentController.js` - Webhook integration
- `controller/team/commissionRoutes.js` - API endpoints
