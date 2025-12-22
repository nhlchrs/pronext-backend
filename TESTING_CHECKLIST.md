# ✅ Phase 1 Testing Checklist

## Pre-Testing Setup
- [ ] Dependencies installed (`npm i`)
- [ ] MongoDB connection verified
- [ ] `.env` file configured with JWT_SECRET & MONGODB_URI
- [ ] Server running (`npm run dev`)

---

## 🧪 API Testing (Postman or cURL)

### 1️⃣ Register New User
**Endpoint:** `POST /api/register`
```json
{
  "fname": "John",
  "lname": "Doe",
  "email": "john@example.com",
  "password": "Test@1234",
  "phone": "+919876543210",
  "address": "123 Street",
  "role": "Educator"
}
```
**Expected:** Success - User created ✅

---

### 2️⃣ Login User
**Endpoint:** `POST /api/login`
```json
{
  "email": "john@example.com",
  "password": "Test@1234"
}
```
**Expected Response:**
```json
{
  "status": 1,
  "message": "Login successful...",
  "data": {
    "user": {...},
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```
**Save Token:** Copy and use in next requests ✅

---

### 3️⃣ Get Active Session
**Endpoint:** `GET /api/session/active`
**Headers:** `Authorization: YOUR_TOKEN`

**Expected Response:**
```json
{
  "status": 1,
  "message": "Active session retrieved successfully",
  "data": {
    "sessionId": "...",
    "loginTime": "2025-01-10T...",
    "lastActivityTime": "2025-01-10T...",
    "expiresAt": "2025-01-11T...",
    "user": {...}
  }
}
```
**Verify:** Session info appears ✅

---

### 4️⃣ Test Single Session Enforcement
**Step A:** Open 2 browser tabs/Postman windows
- Tab 1: Login with same user → Get Token A ✅
- Tab 2: Login with same user → Get Token B ✅

**Step B:** Check sessions
- Use Token A → Call any protected route
- Expected: Should fail (Token A is now inactive)
- Use Token B → Call protected route
- Expected: Should work ✅

---

### 5️⃣ Logout Current Session
**Endpoint:** `POST /api/logout`
**Headers:** `Authorization: VALID_TOKEN`

**Expected Response:**
```json
{
  "status": 1,
  "message": "Logged out successfully. Session terminated."
}
```
**Verify:** 
- Session becomes inactive ✅
- Trying to use same token fails ✅

---

### 6️⃣ Logout From All Sessions (Bonus)
**Step A:** Login 3 times (different tokens)
- Token 1, Token 2, Token 3 ✅

**Step B:** Call logout-all with Token 1
**Endpoint:** `POST /api/logout-all`
**Headers:** `Authorization: TOKEN_1`

**Expected Response:**
```json
{
  "status": 1,
  "message": "Logged out from all sessions. Total: 3",
  "data": {
    "sessionsTerminated": 3
  }
}
```

**Verify:**
- All 3 sessions terminated ✅
- All tokens become invalid ✅

---

### 7️⃣ Admin: View All Active Sessions
**Endpoint:** `GET /api/sessions`
**Headers:** `Authorization: ADMIN_TOKEN`
**Query:** `?userId=USER_ID` (optional)

**Expected Response:**
```json
{
  "status": 1,
  "message": "Active sessions retrieved successfully",
  "data": [
    {
      "_id": "...",
      "user": {...},
      "ipAddress": "...",
      "loginTime": "...",
      "lastActivityTime": "...",
      "expiresAt": "..."
    }
  ]
}
```
**Verify:** All active sessions visible ✅

---

### 8️⃣ Admin: Terminate User Session
**Endpoint:** `DELETE /api/session/SESSION_ID`
**Headers:** `Authorization: ADMIN_TOKEN`

**Expected Response:**
```json
{
  "status": 1,
  "message": "Session terminated successfully"
}
```

**Verify:**
- Session marked as inactive ✅
- User can't use that token anymore ✅

---

## 🔍 Database Verification

### Check Sessions Collection
```javascript
// MongoDB Shell
use pronext_db
db.sessions.find()
```

**Expected:**
- Multiple session documents
- Each with: user, token, isActive, expiresAt
- Some with isActive: false (after logout) ✅

---

## 🔐 Security Tests

### Test 1: Invalid Token
**Endpoint:** Any protected route
**Headers:** `Authorization: INVALID_TOKEN`

**Expected:** 401 Unauthorized ✅

---

### Test 2: Expired Token
**Endpoint:** Any protected route
**Headers:** `Authorization: EXPIRED_TOKEN`

**Expected:** 401 Session expired or invalid ✅

---

### Test 3: Token from Inactive Session
**Process:**
1. Login → Get Token A
2. Login again (Token A now inactive)
3. Use Token A on protected route

**Expected:** 401 Session expired or invalid ✅

---

### Test 4: Admin Only Routes
**Without Admin Role:**
- Call `GET /api/sessions` as regular user
- Expected: 403 Admin access required ✅

---

## 📊 Performance Tests

### Test Session Auto-Cleanup
**Setup:** Create session with short expiry (for testing)
**Wait:** 24+ hours
**Check:** MongoDB auto-deletes expired sessions ✅

---

### Test Last Activity Update
**Process:**
1. Login → Get Active Session (lastActivityTime = T1)
2. Wait 5 seconds
3. Call any protected API
4. Get Active Session again (lastActivityTime = T2, T2 > T1)

**Expected:** Time updated ✅

---

## ✨ Edge Cases

### Test 1: Logout Without Active Session
**Setup:** Use expired/invalid token
**Endpoint:** `POST /api/logout`
**Expected:** Error - Session not found ✅

---

### Test 2: Multiple Rapid Logins
**Process:** Send 10 login requests in quick succession
**Expected:** Last one active, others inactive ✅

---

### Test 3: Session Across Different IPs
**Setup:** Login from IP A, then IP B
**Expected:**
- Both IPs visible in session records
- New login from IP B deactivates IP A session ✅

---

## 📋 Checklist Summary

- [ ] All 8 main APIs tested
- [ ] Single session enforcement working
- [ ] Tokens properly validated
- [ ] Admin endpoints secured
- [ ] Database sessions created
- [ ] Sessions properly cleaned up
- [ ] Activity timestamps updating
- [ ] Error handling working
- [ ] Security tests passing
- [ ] Edge cases handled

---

## 🎯 Expected Results

✅ Users can login with email/password  
✅ Only 1 session per user enforced  
✅ JWT tokens properly generated  
✅ Sessions tracked in database  
✅ Old sessions auto-deactivated on new login  
✅ Logout terminates session  
✅ Admins can monitor all sessions  
✅ Expired sessions auto-cleaned  
✅ All error cases handled  

---

## 📞 Troubleshooting

### Issue: Token not returned on login
- ✓ Check if login is returning token in response
- ✓ Verify JWT_SECRET in .env

### Issue: Session not found error
- ✓ Check if session is being created in login
- ✓ Verify SessionModel is imported correctly

### Issue: Old session not deactivated
- ✓ Check enforceSignleSession() function
- ✓ Verify database update is working

### Issue: Admin routes not working
- ✓ Check if user has admin role
- ✓ Verify isAdmin middleware is applied

---

## ✅ Sign-Off

When all tests pass:
- [ ] Phase 1 implementation complete
- [ ] Ready for Phase 2 (Wallet & Payouts)
- [ ] Document any issues found
- [ ] Commit code to repository
