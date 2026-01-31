# 🎯 QUICK START - Test NOWPayments NOW!

## 🚀 FASTEST WAY TO TEST (3 Minutes)

### Option 1: Use PowerShell Helper (EASIEST) ⭐

```powershell
cd c:\Users\alienware\OneDrive\Documents\pronext-backend\pronext-backend
.\TEST_PAYMENT_QUICK_START.ps1
```

**What it does:**
- Interactive menu
- Starts backend/frontend automatically
- Runs all tests
- Shows real-time status
- No manual configuration needed!

### Option 2: Manual Testing (Step by Step)

**Terminal 1 - Start Backend:**
```powershell
cd c:\Users\alienware\OneDrive\Documents\pronext-backend\pronext-backend
npm start
```

**Terminal 2 - Test Basic APIs:**
```powershell
cd c:\Users\alienware\OneDrive\Documents\pronext-backend\pronext-backend
node test-nowpayments-basic.js
```

**Expected Result:**
```
✅ Backend server is running
✅ Get Currencies - Found 50+ cryptocurrencies
✅ Price Estimate - $10 USD = 0.000XX BTC
✅ Multi-Currency Estimates
🎉 ALL TESTS PASSED!
```

---

## 🌐 Test in Browser (User Panel)

**Terminal 3 - Start Frontend:**
```powershell
cd c:\Users\alienware\OneDrive\Documents\pronext-backend\pronet
npm run dev
```

**Browser Steps:**

1. **Open:** http://localhost:5173

2. **Register:**
   - Email: `test@example.com`
   - Password: `Test@123`
   - Fill other details

3. **Login:**
   - Use same credentials

4. **Go to Payment Page:**
   - Click "Payments" in header
   - Or: http://localhost:5173/payment

5. **Test Payment:**
   - Select cryptocurrency: `BTC`
   - Choose plan: `Monthly ($29.99)`
   - Click "Subscribe Now"
   - **New window opens** → NOWPayments invoice
   - See payment details!

---

## ✅ What You're Testing

### Backend API Endpoints ✓
```
GET  /api/payments/currencies      ✅ Working
POST /api/payments/estimate        ✅ Working
POST /api/payments/subscribe       ✅ Working
GET  /api/payments/my-payments     ✅ Working
POST /api/payments/webhook         ✅ Working
```

### Frontend Payment Flow ✓
```
✅ Payment page loads
✅ Subscription plans display
✅ Crypto dropdown works
✅ Price estimate shows
✅ Subscribe button works
✅ NOWPayments invoice opens
```

### Integration Tests ✓
```
✅ Backend → NOWPayments API
✅ Frontend → Backend API
✅ Payment creation
✅ Invoice generation
✅ Webhook handling
✅ Database updates
```

---

## 📋 Test Checklist

**Run these in order:**

### ☑️ Phase 1: Backend Tests (No Login)
```powershell
node test-nowpayments-basic.js
```
- [ ] All tests pass
- [ ] Currencies loaded
- [ ] Price estimates work

### ☑️ Phase 2: Frontend Tests (Browser)
1. [ ] Register user
2. [ ] Login successful
3. [ ] Payment page loads
4. [ ] Plans display correctly
5. [ ] Crypto dropdown populated

### ☑️ Phase 3: Payment Flow Test
1. [ ] Select crypto (BTC)
2. [ ] Get estimate (shows conversion)
3. [ ] Click "Subscribe Now"
4. [ ] Invoice opens in new window
5. [ ] Payment details shown

### ☑️ Phase 4: Authenticated API Tests
```powershell
# Get token from browser: localStorage.getItem('token')
# Update test-nowpayments.js line 11
node test-nowpayments.js
```
- [ ] All tests pass
- [ ] Invoice created
- [ ] Status check works

### ☑️ Phase 5: Webhook Tests
```powershell
node helpers/webhookTestHelper.js --all
```
- [ ] Webhooks received
- [ ] Database updated
- [ ] Status changes tracked

---

## 🎯 Expected Results

### ✅ SUCCESS Indicators

**Backend Console:**
```
✅ Server running on port 5000
✅ MongoDB connected
✅ Invoice created for user
✅ Payment URL generated
✅ Webhook received: finished
```

**Frontend Console (F12):**
```
✅ Currencies loaded: 50
✅ Estimate calculated
✅ Invoice ID: 123456789
✅ Opening payment window
```

**Browser:**
- Payment page loads
- Plans show prices
- Dropdown has cryptos
- Estimate shows BTC amount
- New window opens with NOWPayments

**Tests:**
```
🎉 ALL TESTS PASSED!
Total: 5/5 ✅
```

---

## ❌ Troubleshooting Quick Fixes

### "Backend not running"
```powershell
cd pronext-backend
npm start
```

### "No currencies loaded"
Check `.env` file:
```powershell
cat .env | Select-String "NOWPAYMENTS"
```

Should see:
```
NOWPAYMENTS_API_KEY=E40KY46-CE44PTK-NYXG30A-ZG57EW8
```

### "Payment page blank"
1. Hard refresh: `Ctrl + F5`
2. Clear cache: `Ctrl + Shift + Delete`
3. Check console: `F12`

### "Token expired"
1. Login again
2. Console: `localStorage.getItem('token')`
3. Copy new token
4. Update `test-nowpayments.js`

### "Invoice won't open"
1. Allow pop-ups for localhost:5173
2. Check browser console for URL
3. Copy and open manually

---

## 🔍 How to Verify Everything Works

### 1. Check Backend Logs
Look for:
```
✅ Currencies retrieved
✅ Invoice created
✅ Payment ID: 123456789
```

### 2. Check Browser Console (F12)
Look for:
```
✅ API call success
✅ Invoice URL received
✅ Window opened
```

### 3. Check Database (MongoDB)
```javascript
db.payments.find({}).sort({createdAt: -1}).limit(1)
```

Should show:
```json
{
  "invoiceId": "123456789",
  "userId": "...",
  "amount": 29.99,
  "status": "pending"
}
```

### 4. Check Test Results
```
test-nowpayments-basic.js  → 5/5 passed ✅
test-nowpayments.js        → 5/5 passed ✅
webhookTestHelper.js       → All passed ✅
```

---

## 💡 What Each Test Does

### `test-nowpayments-basic.js`
- ✅ Gets available cryptocurrencies
- ✅ Calculates price estimates
- ✅ Checks minimum amounts
- ✅ Tests multi-currency conversion
- ⚠️ **NO login required**

### `test-nowpayments.js`
- ✅ Creates payment invoice
- ✅ Gets payment status
- ✅ Checks user payments
- ✅ Verifies authentication
- ⚠️ **Requires JWT token**

### `webhookTestHelper.js`
- ✅ Simulates payment webhooks
- ✅ Tests status updates
- ✅ Verifies database changes
- ✅ Checks subscription activation
- ⚠️ **Backend must be running**

### Frontend Payment Page
- ✅ Displays subscription plans
- ✅ Shows cryptocurrency options
- ✅ Calculates real-time estimates
- ✅ Creates NOWPayments invoices
- ✅ Opens payment window
- ⚠️ **Both servers must run**

---

## 🎬 Complete Test Flow

```
1. Start Backend (Terminal 1)
   ↓
2. Run Basic Tests (Terminal 2)
   ✅ Verify API works
   ↓
3. Start Frontend (Terminal 3)
   ↓
4. Register & Login (Browser)
   ↓
5. Go to Payment Page
   ↓
6. Select BTC
   ↓
7. Click "Get Estimate"
   ✅ See conversion rate
   ↓
8. Click "Subscribe Now"
   ✅ Invoice window opens
   ↓
9. See Payment Details
   ✅ Address, amount, QR code
   ↓
10. Run Authenticated Tests
    ✅ All pass
    ↓
11. Test Webhooks
    ✅ Database updates
    ↓
✅ TESTING COMPLETE!
```

---

## 📚 Documentation Files

1. **[COMPLETE_PAYMENT_TESTING_GUIDE.md](COMPLETE_PAYMENT_TESTING_GUIDE.md)**
   - Full detailed guide
   - All scenarios covered
   - Troubleshooting section

2. **[TEST_PAYMENT_QUICK_START.ps1](TEST_PAYMENT_QUICK_START.ps1)**
   - Interactive PowerShell script
   - Automated testing
   - Menu-driven interface

3. **This File (YOU ARE HERE)**
   - Quick reference
   - Fast testing steps
   - Success criteria

---

## 🚀 START TESTING NOW!

**Choose your method:**

### Method A: PowerShell Helper (RECOMMENDED) ⭐
```powershell
.\TEST_PAYMENT_QUICK_START.ps1
```

### Method B: Manual Commands
```powershell
# Terminal 1
npm start

# Terminal 2
node test-nowpayments-basic.js

# Terminal 3 (in pronet folder)
npm run dev

# Browser
http://localhost:5173/payment
```

### Method C: Run All Tests
```powershell
npm start
Start-Sleep 5
node test-nowpayments-basic.js
node helpers/webhookTestHelper.js --all
```

---

## ✅ Success = All These Work

1. ✅ Backend starts without errors
2. ✅ `test-nowpayments-basic.js` passes
3. ✅ Frontend loads payment page
4. ✅ Crypto dropdown has options
5. ✅ Estimate button shows conversion
6. ✅ Subscribe opens NOWPayments
7. ✅ Payment details display
8. ✅ Database records created

---

## 🎉 READY TO TEST?

**Just run this:**
```powershell
cd c:\Users\alienware\OneDrive\Documents\pronext-backend\pronext-backend
.\TEST_PAYMENT_QUICK_START.ps1
```

**Then select: `8. ✅ Run ALL Tests`**

That's it! Everything else is automatic! 🚀

---

**Questions? Check logs:**
- Backend: Terminal 1
- Frontend: Terminal 3
- Browser: F12 Console
- Tests: Terminal 2 output

**All working? You're ready for real crypto payments!** 💰
