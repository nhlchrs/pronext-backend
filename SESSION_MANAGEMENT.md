# Authentication & Session Management - Implementation Guide

## 📋 Overview
Implemented a **single session per user** authentication system with JWT tokens and session tracking. Users can only have one active session at a time. When a new login occurs, all previous sessions are automatically terminated.

---

## ✅ Completed Features

### 1. Session Model (`models/sessionModel.js`)
Stores information about each user session:
- **Token**: JWT token for the session
- **User ID**: Reference to the user
- **IP Address & User Agent**: Device/browser information
- **Login Time**: When session started
- **Last Activity Time**: Last API call timestamp
- **Expires At**: Session expiration (24 hours from login)
- **Is Active**: Flag to track if session is active

```javascript
// Auto-cleanup of expired sessions via MongoDB TTL
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

---

## 🔑 APIs Implemented

### User Endpoints

#### 1. **POST /api/logout**
Logout current user and terminate their session.

**Request:**
```json
Headers: {
  "Authorization": "JWT_TOKEN"
}
```

**Response (Success):**
```json
{
  "status": 1,
  "message": "Logged out successfully. Session terminated."
}
```

**Key Features:**
- Marks session as inactive
- Works with JWT token in Authorization header
- Single session enforcement

---

#### 2. **GET /api/session/active**
Get information about the user's current active session.

**Request:**
```json
Headers: {
  "Authorization": "JWT_TOKEN"
}
```

**Response (Success):**
```json
{
  "status": 1,
  "message": "Active session retrieved successfully",
  "data": {
    "sessionId": "SESSION_MONGO_ID",
    "loginTime": "2025-01-10T10:30:00.000Z",
    "lastActivityTime": "2025-01-10T10:35:45.000Z",
    "expiresAt": "2025-01-11T10:30:00.000Z",
    "ipAddress": "192.168.1.1",
    "deviceInfo": "Chrome on Windows",
    "user": {
      "id": "USER_ID",
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

---

#### 3. **POST /api/logout-all** (BONUS)
Logout from all sessions/devices.

**Request:**
```json
Headers: {
  "Authorization": "JWT_TOKEN"
}
```

**Response (Success):**
```json
{
  "status": 1,
  "message": "Logged out from all sessions. Total: 3",
  "data": {
    "sessionsTerminated": 3
  }
}
```

---

### Admin Endpoints

#### 4. **GET /api/sessions** (Admin Only)
Get all active sessions (across all users or for a specific user).

**Request:**
```json
Headers: {
  "Authorization": "ADMIN_JWT_TOKEN"
}
Query Parameters:
- userId (optional): Filter by specific user
```

**Response:**
```json
{
  "status": 1,
  "message": "Active sessions retrieved successfully",
  "data": [
    {
      "_id": "SESSION_ID",
      "user": {
        "_id": "USER_ID",
        "fname": "John",
        "lname": "Doe",
        "email": "john@example.com"
      },
      "ipAddress": "192.168.1.1",
      "loginTime": "2025-01-10T10:30:00.000Z",
      "lastActivityTime": "2025-01-10T10:35:45.000Z",
      "expiresAt": "2025-01-11T10:30:00.000Z"
    }
  ]
}
```

---

#### 5. **DELETE /api/session/:sessionId** (Admin Only)
Force logout a specific user session.

**Request:**
```json
Headers: {
  "Authorization": "ADMIN_JWT_TOKEN"
}
Path Parameters:
- sessionId: Session to terminate
```

**Response:**
```json
{
  "status": 1,
  "message": "Session terminated successfully"
}
```

---

## 🔄 Login Flow (Enhanced)

### Before (Old Flow):
1. User registers
2. User enters email/password
3. OTP is sent (no JWT token)
4. Multiple sessions possible

### After (New Flow):
1. User enters email/password
2. ✅ **All previous sessions terminated**
3. ✅ **New JWT token generated**
4. ✅ **Session record created in database**
5. OTP sent
6. ✅ **Only 1 active session per user**

---

## 📝 Code Changes

### 1. **Auth Controller Updates** (`controller/auth/authContoller.js`)

**Import session functions:**
```javascript
import { createSession, enforceSignleSession } from "../session/sessionController.js";
```

**Updated login function:**
```javascript
// Enforce single session (logout all previous sessions)
await enforceSignleSession(user._id);

// Generate JWT token
const jwtPayload = {
  _id: user._id,
  name: `${user.fname} ${user.lname}`,
  email: user.email,
  role: user.role,
};

const token = Jwt.sign(jwtPayload, process.env.JWT_SECRET, {
  expiresIn: "1d",
});

// Create session record
await createSession(user._id, token, req);

// Return token in response
return successResponseWithData(res, "Login successful...", {
  user: { ... },
  token,  // ✅ NEW
});
```

---

## 🛡️ Security Features

### 1. **Single Session Enforcement**
- When user logs in, all previous active sessions are automatically deactivated
- Prevents account takeover from unauthorized logins
- User gets notified if logged in from new device

### 2. **JWT Token in Session**
- Token stored in database linked to user
- Each request validates both JWT and session status
- Session must be active and not expired

### 3. **Session Expiration**
- Auto-expires after 24 hours
- MongoDB TTL index removes expired sessions automatically
- Last activity time updated on each request

### 4. **Activity Tracking**
- IP address captured
- User agent (device/browser) stored
- Last activity time updated
- Admins can see all user sessions

---

## 🚀 Usage Examples

### Example 1: User Login & Get Active Session
```bash
# 1. Login
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# Response includes: token
# {
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
# }

# 2. Get Active Session
curl -X GET http://localhost:5000/api/session/active \
  -H "Authorization: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 3. Logout
curl -X POST http://localhost:5000/api/logout \
  -H "Authorization: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Example 2: Multi-Device Scenario
```
Device 1 (Phone):
- Login → Session created → Token: ABC123

Device 2 (Laptop):
- Login → All previous sessions terminated (Phone logged out!)
        → New session created → Token: XYZ789

Phone:
- Next API call with Token ABC123 → Error: Session expired
```

---

## 📊 Database Schema

### SessionModel
```javascript
{
  user: ObjectId (ref: Users),
  token: String (unique),
  ipAddress: String,
  userAgent: String,
  deviceInfo: String,
  isActive: Boolean (default: true, indexed),
  loginTime: Date,
  lastActivityTime: Date,
  expiresAt: Date (TTL index),
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🔧 Middleware

### **Session Validation Middleware** (`middleware/sessionMiddleware.js`)
Can be used to validate session on protected routes:

```javascript
import { validateSessionMiddleware } from "../middleware/sessionMiddleware.js";

// Protected route example:
router.get("/protected", requireSignin, validateSessionMiddleware, controller);
```

This ensures:
- JWT token is valid
- Session exists and is active
- Session hasn't expired
- Updates last activity time

---

## 🎯 Next Steps

1. ✅ **Phase 1 Complete** - Authentication & Session Management
2. 📋 **Phase 2** - Wallet & Payout System
3. 📋 **Phase 3** - Invoices & Transactions
4. 📋 **Phase 4** - Subscriptions
5. 📋 **Phase 5** - Team Management

---

## 📌 Notes

- All timestamps are in UTC (ISO 8601 format)
- Session token is automatically stored in database on login
- Previous sessions are only deactivated (not deleted) for audit trail
- Admin can see who's online and force logout users if needed
- Session automatically cleans up after 24 hours

---

## ✨ Features Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Single session per user | ✅ | Enforced on login |
| JWT token generation | ✅ | 24-hour expiry |
| Session tracking | ✅ | IP, device, timestamps |
| Logout endpoint | ✅ | Terminates session |
| Active session info | ✅ | User can view details |
| Logout all devices | ✅ | Bonus feature |
| Admin session management | ✅ | View and terminate |
| Auto session cleanup | ✅ | 24-hour TTL |
| Activity tracking | ✅ | Last activity recorded |
