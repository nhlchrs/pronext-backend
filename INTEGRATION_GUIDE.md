# 🚀 QUICK INTEGRATION GUIDE

## How to Use New Features in Your Controllers

---

## 1️⃣ EMIT EVENTS FROM CONTROLLERS

### Import in your controller:
```javascript
import eventBus from "../../services/eventBus.js";
```

### Examples:

#### When user registers:
```javascript
const newUser = await userModel.create({...});
eventBus.emitUserRegistered(newUser);
```

#### When commission is earned:
```javascript
const commission = await Commission.create({...});
eventBus.emitCommissionEarned(commission.userId, commission);
```

#### When payout is completed:
```javascript
const payout = await Payout.findByIdAndUpdate(payoutId, { status: "completed" });
eventBus.emitPayoutCompleted(payoutId);
```

#### When user is promoted:
```javascript
const user = await User.findByIdAndUpdate(userId, { level: newLevel });
eventBus.emitLevelPromotion(userId, { newLevel });
```

---

## 2️⃣ SEND NOTIFICATIONS FROM CONTROLLERS

### Import in your controller:
```javascript
import { NotificationService } from "../../services/notificationService.js";

// Get io from express app
const notificationService = new NotificationService(req.io);
```

### Examples:

#### Notify specific user:
```javascript
notificationService.notifyUser(userId, "payout_update", {
  payoutId: payout._id,
  status: payout.status,
  amount: payout.netAmount,
});
```

#### Notify commission earned:
```javascript
notificationService.notifyCommissionEarned(userId, commissionData);
```

#### Broadcast announcement to all:
```javascript
notificationService.broadcastNotification("announcement", announcementData);
```

#### Notify multiple users:
```javascript
notificationService.notifyUsers([userId1, userId2], "announcement", data);
```

---

## 3️⃣ USE LOGGING IN CONTROLLERS

### Import:
```javascript
import { auditLogger } from "../../middleware/loggingMiddleware.js";
```

### Log admin actions:
```javascript
// When admin suspends user
auditLogger("suspend_user", req.user._id, userId, {
  reason: suspensionReason,
  timestamp: new Date(),
});

// When admin approves payout
auditLogger("approve_payout", req.user._id, payout.userId, {
  payoutId: payout._id,
  amount: payout.netAmount,
});
```

---

## 4️⃣ SUBSCRIBE TO EVENTS IN CONTROLLERS

Listen for events and trigger actions:

```javascript
import eventBus from "../../services/eventBus.js";

// When any commission is earned, auto-update analytics
eventBus.on("commission.earned", async (data) => {
  const { userId, commissionData } = data;
  
  // Update user's total commission
  await User.findByIdAndUpdate(userId, {
    $inc: { totalCommissionEarned: commissionData.netAmount },
  });
});

// When payout is completed, send thank you email
eventBus.on("payout.completed", async (data) => {
  const { payoutId } = data;
  const payout = await Payout.findById(payoutId).populate("userId");
  
  // Send email
  await sendPayoutCompletionEmail(payout.userId.email);
});
```

---

## 5️⃣ EXAMPLE: COMMISSION CALCULATION ENDPOINT

```javascript
import eventBus from "../../services/eventBus.js";
import { NotificationService } from "../../services/notificationService.js";

export const calculateAndCreateCommission = async (req, res) => {
  try {
    const { userId, referrerId, amount, type, level } = req.body;

    // Validate
    if (!userId || !referrerId || !amount) {
      return ErrorResponse(res, "Missing required fields", 400);
    }

    // Calculate commission
    const taxAmount = (amount * 18) / 100; // 18% tax
    const netAmount = amount - taxAmount;

    // Create commission
    const commission = await Commission.create({
      userId,
      referrerId,
      commissionType: type,
      level,
      grossAmount: amount,
      taxAmount,
      netAmount,
      status: "pending",
      earningDate: new Date(),
    });

    // Emit event for real-time notification
    eventBus.emitCommissionEarned(userId, commission);

    // Send notification
    const notificationService = new NotificationService(req.io);
    notificationService.notifyCommissionEarned(userId, commission);

    // Update user's total
    await User.findByIdAndUpdate(userId, {
      $inc: { totalCommissionEarned: netAmount },
    });

    return successResponseWithData(
      res,
      commission,
      "Commission calculated successfully"
    );
  } catch (error) {
    return ErrorResponse(res, error.message, 500);
  }
};
```

---

## 6️⃣ EXAMPLE: PAYOUT WORKFLOW

### Step 1: User requests payout
```javascript
export const requestPayout = async (req, res) => {
  try {
    const { amount, payoutMethod, bankDetails } = req.body;
    const userId = req.user._id;

    // Create payout request
    const payout = await Payout.create({
      userId,
      amount,
      netAmount: amount, // Taxes calculated by admin
      payoutMethod,
      bankDetails,
      status: "pending",
      referenceNumber: `PAY-${Date.now()}`,
    });

    // Emit event
    eventBus.emitPayoutRequested(userId, payout);

    return successResponseWithData(res, payout, "Payout requested");
  } catch (error) {
    return ErrorResponse(res, error.message, 500);
  }
};
```

### Step 2: Admin approves payout
```javascript
export const approvePayout = async (req, res) => {
  try {
    const { payoutId } = req.params;
    const adminId = req.user._id;

    // Update to processing
    const payout = await Payout.findByIdAndUpdate(
      payoutId,
      { status: "processing", processedBy: adminId, processedAt: new Date() },
      { new: true }
    );

    // Emit event
    eventBus.emitPayoutApproved(payoutId);

    // Notify user
    const notificationService = new NotificationService(req.io);
    notificationService.notifyPayoutUpdate(payout.userId, payout);

    return successResponseWithData(res, payout, "Payout approved");
  } catch (error) {
    return ErrorResponse(res, error.message, 500);
  }
};
```

### Step 3: Complete payout
```javascript
export const completePayout = async (req, res) => {
  try {
    const { payoutId, transactionId } = req.params;

    // Update to completed
    const payout = await Payout.findByIdAndUpdate(
      payoutId,
      {
        status: "completed",
        transactionId,
        completedAt: new Date(),
      },
      { new: true }
    );

    // Emit event
    eventBus.emitPayoutCompleted(payoutId);

    // Notify user
    const notificationService = new NotificationService(req.io);
    notificationService.notifyPayoutUpdate(payout.userId, payout);

    return successResponseWithData(res, payout, "Payout completed");
  } catch (error) {
    return ErrorResponse(res, error.message, 500);
  }
};
```

---

## 7️⃣ FRONTEND SOCKET.IO SETUP

### Connect to server:
```javascript
import io from "socket.io-client";

const socket = io("http://localhost:5000");

// On connection
socket.on("connect", () => {
  console.log("Connected to server");
  
  // Tell server you're online
  socket.emit("user_online", userId);
  
  // Subscribe to your notifications
  socket.emit("subscribe_notifications", userId);
  
  // Subscribe to payout updates
  socket.emit("subscribe_payout_updates", userId);
});
```

### Listen to notifications:
```javascript
socket.on("notification", (data) => {
  console.log("Notification received:", data);
  
  switch (data.type) {
    case "commission_earned":
      console.log(`You earned ${data.data.amount} in commission`);
      updateDashboard();
      break;
    
    case "payout_update":
      console.log(`Payout status: ${data.data.status}`);
      updatePayoutStatus(data.data);
      break;
    
    case "incentive_qualified":
      console.log(`You qualified for: ${data.data.title}`);
      showBadge(data.data.title);
      break;
  }
});

// Payout channel subscription
socket.on("payout_status", (payoutData) => {
  console.log("Payout status update:", payoutData);
  updatePayoutInUI(payoutData);
});

// Analytics updates
socket.on("notification_subscribed", () => {
  console.log("Notification subscription confirmed");
});
```

---

## 8️⃣ LOGGING BEST PRACTICES

### In middlewares/routes that modify data:
```javascript
import { auditLoggingMiddleware } from "../../middleware/loggingMiddleware.js";

// Add to sensitive routes
router.post("/admin/user/:userId/suspend", 
  auditLoggingMiddleware,  // ← Add this
  requireSignin, 
  isAdmin, 
  suspendUser
);
```

### Manual audit logs:
```javascript
import { auditLogger } from "../../middleware/loggingMiddleware.js";

export const suspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    
    const user = await User.findByIdAndUpdate(userId, {
      isSuspended: true,
      suspensionReason: reason,
      suspendedAt: new Date(),
      suspendedBy: req.user._id,
    });

    // Log the action
    auditLogger("suspend_user", req.user._id, userId, {
      reason,
      suspendedAt: new Date(),
    });

    return successResponseWithData(res, user, "User suspended");
  } catch (error) {
    return ErrorResponse(res, error.message, 500);
  }
};
```

---

## 9️⃣ ERROR HANDLING WITH LOGGING

Errors are automatically logged. Just throw or return:

```javascript
export const riskyOperation = async (req, res) => {
  try {
    // Your code
  } catch (error) {
    // The errorLogger middleware will catch it
    // and log to logs/error.log
    return ErrorResponse(res, error.message, 500);
  }
};
```

---

## 🔟 TESTING EVENTS

### Test emission:
```javascript
import eventBus from "../../services/eventBus.js";

// In your test file
eventBus.emitCommissionEarned("userId123", {
  _id: "comm123",
  netAmount: 1000,
  commissionType: "direct_bonus",
});

// Listen to verify
eventBus.on("commission.earned", (data) => {
  console.log("Event received:", data);
});
```

### Check logs:
```bash
# View application logs
tail -f logs/app.log

# View error logs
tail -f logs/error.log

# View audit logs
tail -f logs/audit.log
```

---

## 📋 CHECKLIST FOR NEW FEATURES

When adding new features:

- ✅ Define models with proper fields & indexes
- ✅ Create controller endpoints
- ✅ Emit events via eventBus when needed
- ✅ Trigger notifications for user-facing actions
- ✅ Log admin actions via auditLogger
- ✅ Test Socket.io events in frontend
- ✅ Verify logs are being written

---

## 🆘 COMMON ISSUES

### Issue: Notifications not received
**Solution:** Check if socket is connected and user subscribed
```javascript
socket.emit("subscribe_notifications", userId);
```

### Issue: Events not firing
**Solution:** Import eventBus correctly
```javascript
import eventBus from "../../services/eventBus.js";
// Then emit
eventBus.emitEvent(...);
```

### Issue: Logs not being created
**Solution:** Check logs directory exists and is writable
```bash
mkdir -p logs
ls -la logs/
```

### Issue: Real-time data not updating
**Solution:** Verify Socket.io middleware is loaded in app.js
```javascript
app.use((req, res, next) => {
  req.io = io;  // ← Make sure this is present
  next();
});
```

---

**Happy coding! 🚀**
