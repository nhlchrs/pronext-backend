# 🚀 COMPLETE NOWPAYMENTS TESTING GUIDE

## 📋 What You Have (Current Setup)

### Backend Files ✅
- `test-nowpayments-basic.js` - Tests without authentication
- `test-nowpayments.js` - Tests with JWT token
- `controller/payment/paymentController.js` - Payment API endpoints
- `controller/payment/payment.js` - Payment routes
- `helpers/webhookTestHelper.js` - Webhook testing
- `helpers/nowpaymentsService.js` - NOWPayments integration

### Frontend Files ✅
- `pronet/src/Page/Payment/index.jsx` - Payment page UI
- Payment page with subscription plans
- Real-time crypto payment integration

### API Endpoints Available ✅
```
GET    /api/payments/currencies        - Get available cryptos (public)
POST   /api/payments/estimate         - Get price estimate (public)
GET    /api/payments/minimum-amount   - Get minimum amount (public)
POST   /api/payments/invoice          - Create invoice (auth required)
POST   /api/payments/subscribe        - Create subscription (auth required)
GET    /api/payments/my-payments      - Get user payments (auth required)
GET    /api/payments/status/:id       - Check payment status (auth required)
POST   /api/payments/webhook          - Webhook callback (public)
```

---

## 🎯 STEP-BY-STEP TESTING PROCESS

### ✅ STEP 1: Test Backend API (No Login Needed)

**Open Terminal 1 - Start Backend:**
```powershell
cd c:\Users\alienware\OneDrive\Documents\pronext-backend\pronext-backend
npm start
```

Wait for: `✅ Server running on port 5000`

**Open Terminal 2 - Run Basic Tests:**
```powershell
cd c:\Users\alienware\OneDrive\Documents\pronext-backend\pronext-backend
node test-nowpayments-basic.js
```

**Expected Output:**
```
✅ Backend server is running
✅ Get Currencies - Found 50+ cryptocurrencies
✅ Price Estimate - $10 USD = 0.000XX BTC
✅ Minimum Amount - BTC: 0.0001 BTC
✅ Multi-Currency Estimates
🎉 ALL TESTS PASSED!
```

**If this works:** Your NOWPayments API is configured correctly! ✅

---

### ✅ STEP 2: Test with Authentication

**Open Terminal 3 - Start Frontend:**
```powershell
cd c:\Users\alienware\OneDrive\Documents\pronext-backend\pronet
npm run dev
```

**Browser Steps:**

1. **Register a Test User:**
   - Go to: `http://localhost:5173/register`
   - Fill in details:
     ```
     First Name: Test
     Last Name: User
     Email: payment-test@example.com
     Phone: 1234567890
     Password: Test@123
     ```
   - Click "Create Account"
   - Enter OTP (check backend console for OTP code)
   - Click "Verify"

2. **Login:**
   - Go to: `http://localhost:5173/login`
   - Email: `payment-test@example.com`
   - Password: `Test@123`
   - Click "Sign In"

3. **Get Your JWT Token:**
   - Press `F12` (open DevTools)
   - Go to **Console** tab
   - Type: `localStorage.getItem('token')`
   - Copy the token (long string)

4. **Update Test File:**
   - Open `test-nowpayments.js`
   - Find line 11: `const TOKEN = 'YOUR_JWT_TOKEN_HERE';`
   - Replace with your token:
     ```javascript
     const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
     ```
   - Save file

5. **Run Authenticated Tests:**
   ```powershell
   node test-nowpayments.js
   ```

**Expected Output:**
```
✅ Get Currencies
✅ Get Estimate
✅ Get Minimum Amount
✅ Create Invoice
   Invoice ID: 123456789
   Payment URL: https://nowpayments.io/payment/...
   Pay Amount: 0.00024 BTC
   Pay Address: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
✅ Check Status
🎉 ALL TESTS PASSED!
```

---

### ✅ STEP 3: Test Payment in User Panel

**Go to Payment Page:**
- Navigate to: `http://localhost:5173/payment`
- Or click "Payments" in the header menu

**You should see:**
```
╔══════════════════════════════════════╗
║    SUBSCRIPTION PLANS                ║
╠══════════════════════════════════════╣
║  📦 Monthly Plan - $29.99            ║
║  📦 Quarterly Plan - $79.99 ⭐       ║
║  📦 Annual Plan - $299.99            ║
╚══════════════════════════════════════╝
```

**Test Subscription Flow:**

1. **Select Cryptocurrency:**
   - Click dropdown
   - Choose: `BTC` (Bitcoin)

2. **Get Price Estimate:**
   - Click "Get Estimate" button
   - Wait 1-2 seconds
   - You should see: `$29.99 = 0.000XX BTC`

3. **Subscribe:**
   - Click "Subscribe Now" button
   - A new window should open with NOWPayments invoice
   - You'll see payment details:
     ```
     Amount to pay: 0.000XX BTC
     Send to address: bc1q...
     Time remaining: 59:59
     ```

4. **Check Browser Console:**
   - Press `F12`
   - Go to **Console** tab
   - Look for these messages:
     ```
     ✅ Invoice created
     ✅ Opening payment URL
     Invoice ID: 123456789
     ```

5. **Check Backend Logs:**
   - Look at Terminal 1 (backend server)
   - Should see:
     ```
     [PAYMENT] Creating subscription payment
     [PAYMENT] Invoice created successfully
     [PAYMENT] Invoice ID: 123456789
     ```

---

### ✅ STEP 4: Test Real Crypto Payment (Optional)

**⚠️ WARNING: This uses REAL cryptocurrency!**

**For Small Test Amount ($5):**

1. **Get Wallet Ready:**
   - Open your crypto wallet (e.g., Binance, Coinbase, MetaMask)
   - Make sure you have BTC/ETH/USDT

2. **Create Payment:**
   - In payment page, select amount: $5
   - Choose currency: BTC
   - Click "Pay Now"
   - New window opens with payment details

3. **Send Payment:**
   - Copy the payment address from NOWPayments page
   - Copy the exact amount (e.g., 0.00012 BTC)
   - Open your wallet
   - Send EXACT amount to the address
   - **IMPORTANT:** Send exact amount, not more or less!

4. **Wait for Confirmation:**
   - Bitcoin: 10-60 minutes
   - Ethereum: 2-5 minutes
   - USDT (TRC20): 1-2 minutes

5. **Check Status:**
   - Backend will receive webhook automatically
   - Your subscription will activate
   - Check in User Dashboard

---

### ✅ STEP 5: Monitor Webhooks (Real-time)

**Open Terminal 4:**
```powershell
cd c:\Users\alienware\OneDrive\Documents\pronext-backend\pronext-backend
node helpers/webhookTestHelper.js --all
```

**What this does:**
- Simulates webhook callbacks
- Tests different payment statuses
- Verifies database updates

**Expected Output:**
```
🧪 Testing Webhook: Payment Created
✅ Webhook received successfully

🧪 Testing Webhook: Payment Confirmed
✅ Database updated
✅ Subscription activated

🧪 Testing Webhook: Payment Failed
✅ Payment marked as failed
```

---

## 🔍 VERIFICATION CHECKLIST

### Backend Tests ✅
- [ ] `node test-nowpayments-basic.js` - All pass
- [ ] Backend server runs without errors
- [ ] NOWPayments API responds
- [ ] Currencies loaded (50+ available)
- [ ] Price estimates work
- [ ] Minimum amounts retrieved

### Frontend Tests ✅
- [ ] User can register
- [ ] User can login
- [ ] Payment page loads
- [ ] Subscription plans display
- [ ] Currency dropdown works
- [ ] "Get Estimate" button works
- [ ] Estimate shows correct conversion
- [ ] "Subscribe Now" opens NOWPayments
- [ ] Payment window opens in new tab

### Authenticated Tests ✅
- [ ] JWT token acquired from login
- [ ] `node test-nowpayments.js` passes
- [ ] Invoice created successfully
- [ ] Payment URL generated
- [ ] Payment status can be checked
- [ ] User payments retrieved

### Payment Flow Tests ✅
- [ ] Invoice opens in new window
- [ ] Payment address displayed
- [ ] Amount matches estimate
- [ ] Countdown timer shows
- [ ] QR code displays (if applicable)

### Database Tests ✅
- [ ] Payment record created in MongoDB
- [ ] User ID linked correctly
- [ ] Invoice ID stored
- [ ] Status tracked (pending → finished)
- [ ] Subscription activated on payment

---

## 🛠️ TROUBLESHOOTING

### ❌ "Cannot connect to backend"
```powershell
# Check if backend is running
Get-Process node

# Restart backend
cd pronext-backend
npm start
```

### ❌ "No currencies loaded"
```powershell
# Check .env file
cat .env | Select-String "NOWPAYMENTS_API_KEY"

# Test API key directly
curl http://localhost:5000/api/payments/currencies
```

### ❌ "Login token expired"
1. Login again in browser
2. Get fresh token: `localStorage.getItem('token')`
3. Update `test-nowpayments.js`
4. Run tests again

### ❌ "Payment page blank"
1. Clear browser cache: `Ctrl + Shift + Delete`
2. Hard refresh: `Ctrl + F5`
3. Check console for errors: `F12`
4. Check if API URL is correct in `.env`

### ❌ "Invoice not opening"
1. Check browser pop-up blocker
2. Allow pop-ups for localhost:5173
3. Try opening URL manually from console log

### ❌ "Webhook not received"
1. Check backend logs for webhook endpoint
2. Verify IPN secret in `.env`
3. Test webhook manually:
   ```powershell
   node helpers/webhookTestHelper.js --test finished
   ```

---

## 📊 CHECK YOUR RESULTS

### 1. Check MongoDB Database
```javascript
// In MongoDB Compass or Shell
db.payments.find({}).sort({createdAt: -1})

// Should show:
{
  _id: "...",
  userId: "...",
  invoiceId: "123456789",
  amount: 29.99,
  currency: "USD",
  payCurrency: "BTC",
  status: "pending", // or "finished"
  createdAt: "..."
}
```

### 2. Check User Subscription
```javascript
db.users.findOne({ email: "payment-test@example.com" })

// Should have:
{
  subscription: {
    status: "active",
    plan: "Premium",
    expiresAt: "2026-02-18..."
  }
}
```

### 3. Check Backend Logs
Look for these messages:
```
✅ Invoice created for user: 6789...
✅ Payment URL: https://nowpayments.io/payment/...
✅ Webhook received: payment_finished
✅ Subscription activated
```

### 4. Check Frontend Console
```
✅ Currencies loaded: 50
✅ Estimate: 0.00024 BTC
✅ Invoice created
✅ Redirecting to payment...
```

---

## 🎯 QUICK TEST COMMANDS

```powershell
# Start everything
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd pronext-backend; npm start"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd pronet; npm run dev"

# Run all tests
node test-nowpayments-basic.js
node test-nowpayments.js

# Test webhooks
node helpers/webhookTestHelper.js --all

# Check server status
curl http://localhost:5000/api/payments/currencies

# Get price estimate
Invoke-RestMethod -Uri "http://localhost:5000/api/payments/estimate" -Method POST -Body (@{amount=10; currency_from="usd"; currency_to="btc"} | ConvertTo-Json) -ContentType "application/json"
```

---

## ✅ SUCCESS CRITERIA

**You've successfully tested when:**

1. ✅ `test-nowpayments-basic.js` passes all tests
2. ✅ Payment page loads without errors
3. ✅ Can select cryptocurrency
4. ✅ Price estimate shows correctly
5. ✅ "Subscribe Now" opens NOWPayments invoice
6. ✅ Payment details display correctly
7. ✅ Database record created
8. ✅ Webhook test passes

---

## 🎉 NEXT STEPS AFTER TESTING

1. **Test with Real Payment (Small Amount)**
   - Use $1-5 for testing
   - Send from your crypto wallet
   - Verify payment confirmation

2. **Test Different Cryptocurrencies**
   - BTC (Bitcoin)
   - ETH (Ethereum)
   - USDT (Tether)
   - LTC (Litecoin)

3. **Test Error Scenarios**
   - Expired payment
   - Insufficient amount sent
   - Payment cancelled
   - Network timeout

4. **Production Checklist**
   - Update FRONTEND_URL in `.env`
   - Update webhook callback URL
   - Test on deployed server
   - Monitor real transactions

---

## 📞 TESTING SUPPORT FILES

- **Basic Tests:** `test-nowpayments-basic.js`
- **Auth Tests:** `test-nowpayments.js`
- **Webhook Tests:** `helpers/webhookTestHelper.js`
- **Payment Controller:** `controller/payment/paymentController.js`
- **Payment Routes:** `controller/payment/payment.js`
- **Frontend Payment:** `pronet/src/Page/Payment/index.jsx`

---

**Ready to test? Start with STEP 1!** 🚀

**Questions?**
- Check backend console for errors
- Check browser console (F12)
- Check MongoDB for data
- Review logs in terminals
