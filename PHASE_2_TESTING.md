# 🧪 Phase 2: User Management - Testing Checklist

## Pre-Test Setup

### 1. Environment Ready
- [ ] Node.js server running on port 5000
- [ ] MongoDB connected and accessible
- [ ] JWT_SECRET configured in .env
- [ ] Postman collection imported

### 2. Test Data
- [ ] Admin user account created (role: Admin)
- [ ] Regular user account created (role: Educator)
- [ ] Test user for suspension (role: Educator)
- [ ] Test user for blocking (role: Educator)

---

## User Profile Management Tests

### Test 1: Get Own Profile
**Endpoint:** `GET /api/user/profile`  
**Required:** User token  

**Steps:**
1. Login with test user
2. Copy token from response
3. Add to Authorization header: `Bearer TOKEN`
4. Send GET request
5. Verify response contains: fname, lname, email, phone, role, etc.
6. Verify password and OTP are NOT included

**Expected Result:**
```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "_id": "...",
    "fname": "John",
    "lname": "Doe",
    "email": "john@example.com",
    "phone": "+919876543210",
    "role": "Educator",
    ...
  }
}
```

**Status:** [ ] PASS [ ] FAIL

---

### Test 2: Update Profile - All Fields
**Endpoint:** `PUT /api/user/update-profile`  
**Required:** User token  

**Request Body:**
```json
{
  "fname": "Jane",
  "lname": "Smith",
  "email": "jane@example.com",
  "phone": "+919876543211",
  "dob": "1995-06-20",
  "address": "456 Oak Ave, City"
}
```

**Steps:**
1. Send PUT request with all fields
2. Verify response shows updated values
3. Call GET /api/user/profile
4. Confirm all changes persisted

**Expected:** 200 OK with updated user data

**Status:** [ ] PASS [ ] FAIL

---

### Test 3: Update Only Some Fields
**Endpoint:** `PUT /api/user/update-profile`  

**Request Body:**
```json
{
  "fname": "Janet"
}
```

**Steps:**
1. Update only fname
2. Other fields should remain unchanged
3. Verify partial update works

**Status:** [ ] PASS [ ] FAIL

---

### Test 4: Email Uniqueness Validation
**Endpoint:** `PUT /api/user/update-profile`  

**Request Body:**
```json
{
  "fname": "Test",
  "lname": "User",
  "email": "existing@example.com"
}
```

**Steps:**
1. Try to update to email that already exists
2. Should receive 400 error
3. Verify message: "Email already in use"

**Expected:** 400 Error: "Email already in use"

**Status:** [ ] PASS [ ] FAIL

---

### Test 5: Phone Uniqueness Validation
**Endpoint:** `PUT /api/user/update-profile`  

**Request Body:**
```json
{
  "fname": "Test",
  "lname": "User",
  "phone": "+919876543210"
}
```

**Steps:**
1. Try to update to phone that already exists
2. Should receive 400 error
3. Verify message: "Phone number already in use"

**Status:** [ ] PASS [ ] FAIL

---

### Test 6: Missing Required Fields
**Endpoint:** `PUT /api/user/update-profile`  

**Request Body:**
```json
{
  "fname": "Test"
}
```

**Steps:**
1. Send only fname, omit lname
2. Should receive 400 error
3. Verify message: "First name and last name are required"

**Status:** [ ] PASS [ ] FAIL

---

### Test 7: Unauthenticated Update
**Endpoint:** `PUT /api/user/update-profile`  

**Steps:**
1. Send request WITHOUT Authorization header
2. Should receive 401 Unauthorized

**Expected:** 401 Unauthorized

**Status:** [ ] PASS [ ] FAIL

---

### Test 8: Invalid Token
**Endpoint:** `PUT /api/user/update-profile`  

**Steps:**
1. Send request with invalid token
2. Should receive 401 Unauthorized

**Status:** [ ] PASS [ ] FAIL

---

## Password Management Tests

### Test 9: Change Password - Valid
**Endpoint:** `POST /api/user/change-password`  

**Request Body:**
```json
{
  "currentPassword": "oldpass123",
  "newPassword": "newpass456",
  "confirmPassword": "newpass456"
}
```

**Steps:**
1. Send with correct current password
2. Should get success message
3. Try to login with new password
4. Should succeed

**Expected:** 200 OK

**Status:** [ ] PASS [ ] FAIL

---

### Test 10: Change Password - Wrong Current Password
**Endpoint:** `POST /api/user/change-password`  

**Request Body:**
```json
{
  "currentPassword": "wrongpass",
  "newPassword": "newpass789",
  "confirmPassword": "newpass789"
}
```

**Steps:**
1. Send with incorrect current password
2. Should receive 401 error
3. Verify message: "Current password is incorrect"

**Status:** [ ] PASS [ ] FAIL

---

### Test 11: Change Password - Passwords Don't Match
**Endpoint:** `POST /api/user/change-password`  

**Request Body:**
```json
{
  "currentPassword": "oldpass123",
  "newPassword": "newpass789",
  "confirmPassword": "different789"
}
```

**Steps:**
1. New password and confirm don't match
2. Should receive 400 error
3. Verify message: "New passwords do not match"

**Status:** [ ] PASS [ ] FAIL

---

### Test 12: Change Password - Too Short
**Endpoint:** `POST /api/user/change-password`  

**Request Body:**
```json
{
  "currentPassword": "oldpass123",
  "newPassword": "short",
  "confirmPassword": "short"
}
```

**Steps:**
1. New password less than 6 characters
2. Should receive 400 error
3. Verify message: "at least 6 characters"

**Status:** [ ] PASS [ ] FAIL

---

### Test 13: Change Password - Missing Fields
**Endpoint:** `POST /api/user/change-password`  

**Request Body:**
```json
{
  "currentPassword": "oldpass123"
}
```

**Steps:**
1. Omit newPassword and confirmPassword
2. Should receive 400 error
3. Verify message: "All password fields are required"

**Status:** [ ] PASS [ ] FAIL

---

## Admin Suspension Tests

### Test 14: Suspend User
**Endpoint:** `POST /api/admin/user/:userId/suspend`  
**Required:** Admin token  

**Request Body:**
```json
{
  "reason": "Violating terms of service"
}
```

**Steps:**
1. Get user ID to suspend
2. Send request with admin token
3. Verify user marked as suspended
4. Verify reason stored
5. Verify suspension timestamp recorded
6. Verify admin ID recorded

**Expected:** 200 OK with updated user

**Status:** [ ] PASS [ ] FAIL

---

### Test 15: Suspend - Already Suspended
**Endpoint:** `POST /api/admin/user/:userId/suspend`  

**Steps:**
1. Try to suspend already suspended user
2. Should receive 400 error
3. Verify message: "User is already suspended"

**Status:** [ ] PASS [ ] FAIL

---

### Test 16: Suspend - Missing Reason
**Endpoint:** `POST /api/admin/user/:userId/suspend`  

**Request Body:**
```json
{}
```

**Steps:**
1. Send without reason
2. Should receive 400 error
3. Verify message: "Suspension reason is required"

**Status:** [ ] PASS [ ] FAIL

---

### Test 17: Suspend - Non-Admin User
**Endpoint:** `POST /api/admin/user/:userId/suspend`  
**Required:** Regular user token  

**Steps:**
1. Send with regular user token (not admin)
2. Should receive 403 Forbidden

**Status:** [ ] PASS [ ] FAIL

---

### Test 18: Suspended User Cannot Login
**Endpoint:** `POST /api/login`  

**Steps:**
1. Suspend a user
2. Try to login with that user's credentials
3. Should receive error: "Account suspended"

**Status:** [ ] PASS [ ] FAIL

---

## Admin Reactivation Tests

### Test 19: Reactivate Suspended User
**Endpoint:** `POST /api/admin/user/:userId/reactivate`  
**Required:** Admin token  

**Steps:**
1. Get suspended user ID
2. Send reactivate request
3. Verify isSuspended = false
4. Verify reactivation timestamp
5. Verify admin ID recorded

**Expected:** 200 OK with reactivated user

**Status:** [ ] PASS [ ] FAIL

---

### Test 20: Reactivate - Not Suspended
**Endpoint:** `POST /api/admin/user/:userId/reactivate`  

**Steps:**
1. Try to reactivate active user
2. Should receive 400 error
3. Verify message: "User is not suspended"

**Status:** [ ] PASS [ ] FAIL

---

### Test 21: Reactivated User Can Login
**Endpoint:** `POST /api/login`  

**Steps:**
1. Reactivate suspended user
2. Try to login with reactivated user
3. Should succeed and get token

**Status:** [ ] PASS [ ] FAIL

---

## Admin Block Tests

### Test 22: Permanently Block User
**Endpoint:** `DELETE /api/admin/user/:userId/block`  
**Required:** Admin token  

**Request Body:**
```json
{
  "reason": "Fraudulent activity detected"
}
```

**Steps:**
1. Send request with admin token
2. Verify isBlocked = true
3. Verify reason stored
4. Verify block timestamp
5. Verify admin ID recorded

**Expected:** 200 OK

**Status:** [ ] PASS [ ] FAIL

---

### Test 23: Block - Already Blocked
**Endpoint:** `DELETE /api/admin/user/:userId/block`  

**Steps:**
1. Try to block already blocked user
2. Should receive 400 error
3. Verify message: "User is already blocked"

**Status:** [ ] PASS [ ] FAIL

---

### Test 24: Block - Missing Reason
**Endpoint:** `DELETE /api/admin/user/:userId/block`  

**Request Body:**
```json
{}
```

**Steps:**
1. Send without reason
2. Should receive 400 error

**Status:** [ ] PASS [ ] FAIL

---

### Test 25: Blocked User Cannot Login
**Endpoint:** `POST /api/login`  

**Steps:**
1. Block a user
2. Try to login
3. Should receive error: "Account blocked"

**Status:** [ ] PASS [ ] FAIL

---

## Admin List Users Tests

### Test 26: List All Users
**Endpoint:** `GET /api/admin/users`  
**Required:** Admin token  

**Steps:**
1. Send GET request
2. Verify array of users returned
3. Verify pagination info included
4. Verify total count accurate

**Expected:** 200 OK with users array

**Status:** [ ] PASS [ ] FAIL

---

### Test 27: List Users - Pagination
**Endpoint:** `GET /api/admin/users?page=2&limit=5`  

**Steps:**
1. Request page 2 with limit 5
2. Verify correct users returned
3. Verify pagination shows page 2
4. Verify correct number of results

**Status:** [ ] PASS [ ] FAIL

---

### Test 28: List Users - Filter by Role
**Endpoint:** `GET /api/admin/users?role=Admin`  

**Steps:**
1. Request users with Admin role
2. Verify only Admin users returned
3. Verify other roles excluded

**Status:** [ ] PASS [ ] FAIL

---

### Test 29: List Users - Filter by Status
**Endpoint:** `GET /api/admin/users?status=suspended`  

**Steps:**
1. Request only suspended users
2. Verify all returned have isSuspended = true
3. Verify active users excluded

**Status:** [ ] PASS [ ] FAIL

---

### Test 30: List Users - Search by Email
**Endpoint:** `GET /api/admin/users?search=john@example.com`  

**Steps:**
1. Search for specific email
2. Verify only matching users returned
3. Try partial search: `?search=john`
4. Verify case-insensitive match

**Status:** [ ] PASS [ ] FAIL

---

### Test 31: List Users - Search by Name
**Endpoint:** `GET /api/admin/users?search=John`  

**Steps:**
1. Search by first/last name
2. Verify matching users returned
3. Verify partial name matching works

**Status:** [ ] PASS [ ] FAIL

---

### Test 32: Get Single User
**Endpoint:** `GET /api/admin/user/:userId`  
**Required:** Admin token  

**Steps:**
1. Send request for specific user
2. Verify user details returned
3. Verify no password/OTP in response

**Status:** [ ] PASS [ ] FAIL

---

## Admin Role Management Tests

### Test 33: Change User Role
**Endpoint:** `PUT /api/admin/user/:userId/role`  
**Required:** Admin token  

**Request Body:**
```json
{
  "role": "Finance"
}
```

**Steps:**
1. Update user role to Finance
2. Verify role updated in response
3. Get user profile to confirm change

**Expected:** 200 OK with updated user

**Status:** [ ] PASS [ ] FAIL

---

### Test 34: Change Role - Invalid Role
**Endpoint:** `PUT /api/admin/user/:userId/role`  

**Request Body:**
```json
{
  "role": "InvalidRole"
}
```

**Steps:**
1. Send invalid role value
2. Should receive 400 error
3. Verify error lists valid roles

**Status:** [ ] PASS [ ] FAIL

---

### Test 35: Change Role - Missing Role
**Endpoint:** `PUT /api/admin/user/:userId/role`  

**Request Body:**
```json
{}
```

**Steps:**
1. Send without role field
2. Should receive 400 error

**Status:** [ ] PASS [ ] FAIL

---

## Admin Statistics Tests

### Test 36: Get User Statistics
**Endpoint:** `GET /api/admin/user-stats`  
**Required:** Admin token  

**Steps:**
1. Send GET request
2. Verify response includes:
   - totalUsers
   - activeUsers
   - suspendedUsers
   - blockedUsers
   - usersByRole object

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 150,
    "activeUsers": 145,
    "suspendedUsers": 3,
    "blockedUsers": 2,
    "usersByRole": {
      "Educator": 120,
      "Admin": 5,
      "Finance": 15,
      "Support": 10
    }
  }
}
```

**Status:** [ ] PASS [ ] FAIL

---

### Test 37: Statistics - Counts Accurate
**Endpoint:** `GET /api/admin/user-stats`  

**Steps:**
1. Get statistics
2. Sum all roles, should equal totalUsers
3. Add active + suspended + blocked
4. Verify math is correct

**Status:** [ ] PASS [ ] FAIL

---

## Account Deletion Tests

### Test 38: Delete Own Account
**Endpoint:** `POST /api/user/delete-account`  
**Required:** User token  

**Request Body:**
```json
{
  "password": "userpassword123"
}
```

**Steps:**
1. Send correct password
2. Verify success message
3. Verify isDeleted = true
4. Try to login - should fail

**Expected:** 200 OK

**Status:** [ ] PASS [ ] FAIL

---

### Test 39: Delete Account - Wrong Password
**Endpoint:** `POST /api/user/delete-account`  

**Request Body:**
```json
{
  "password": "wrongpass"
}
```

**Steps:**
1. Send incorrect password
2. Should receive 401 error
3. Verify message: "Password is incorrect"

**Status:** [ ] PASS [ ] FAIL

---

### Test 40: Delete Account - Missing Password
**Endpoint:** `POST /api/user/delete-account`  

**Request Body:**
```json
{}
```

**Steps:**
1. Send without password
2. Should receive 400 error

**Status:** [ ] PASS [ ] FAIL

---

## Integration & Security Tests

### Test 41: Session Invalidation on Suspension
**Steps:**
1. User A is logged in (has active session)
2. Admin suspends User A
3. User A tries to access /api/user/profile
4. Should receive "Account suspended" error
5. Session should be invalidated

**Status:** [ ] PASS [ ] FAIL

---

### Test 42: No Sensitive Data in Responses
**Steps:**
1. Get any user profile endpoint
2. Verify response does NOT include:
   - password field
   - otp field
3. Verify any hashed fields are excluded

**Status:** [ ] PASS [ ] FAIL

---

### Test 43: Cross-User Access Prevention
**Steps:**
1. Login as User A
2. Try to call /api/user/update-profile with User B's data
3. Should update only User A's profile
4. User B data should not change

**Status:** [ ] PASS [ ] FAIL

---

### Test 44: Audit Trail Tracking
**Steps:**
1. Suspend a user (record admin and timestamp)
2. Query database directly
3. Verify suspendedBy, suspendedAt populated
4. Verify values are correct

**Status:** [ ] PASS [ ] FAIL

---

### Test 45: Database Integrity
**Steps:**
1. Run all tests
2. Check for orphaned references
3. Verify indexes working
4. Check for duplicate emails/phones

**Status:** [ ] PASS [ ] FAIL

---

## Performance Tests

### Test 46: List Users - Response Time
**Endpoint:** `GET /api/admin/users?limit=100`  

**Steps:**
1. Request 100 users
2. Measure response time
3. Should be < 500ms

**Status:** [ ] PASS (____ms) [ ] FAIL

---

### Test 47: Search Performance
**Endpoint:** `GET /api/admin/users?search=test`  

**Steps:**
1. Search with common term
2. Measure response time
3. Should be < 500ms

**Status:** [ ] PASS (____ms) [ ] FAIL

---

## Summary

Total Tests: 47  
Required Passes: 45+  

**Tests Passed:** ___/47  
**Tests Failed:** ___/47  
**Pass Rate:** ___%  

**Overall Status:** [ ] READY FOR DEPLOYMENT [ ] NEEDS FIXES

---

## Notes Section
```
Add any bugs, observations, or special notes here:

_________________________________________________________________

_________________________________________________________________

_________________________________________________________________
```

---

**Testing Completed By:** _______________  
**Date:** _______________  
**Signature:** _______________  
