# KYC API Backend Implementation

## Overview
Complete backend API implementation for KYC (Know Your Customer) verification system with admin management and user submission workflows.

## Files Created

### 1. Controller
- **File**: `pronext-backend/controller/kyc/kycController.js` (412 lines)
- Contains all business logic for KYC operations

### 2. Routes
- **File**: `pronext-backend/controller/kyc/kyc.js` (78 lines)
- Defines all KYC endpoints with proper middleware

### 3. Updated
- **File**: `pronext-backend/app.js`
- Added KYC route imports and registration

## API Endpoints

### User Endpoints (Require Authentication)

#### 1. Submit KYC Documents
```
POST /api/kyc/submit
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "documentType": "passport|aadhar|pancard|driving_license",
  "documentNumber": "ABC123456",
  "documentImageUrl": "https://example.com/doc-front.jpg",
  "backImageUrl": "https://example.com/doc-back.jpg",
  "fullName": "John Doe",
  "dateOfBirth": "1990-01-15",
  "gender": "Male|Female|Other",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA"
  }
}
```

**Response (Success - 201)**:
```json
{
  "success": true,
  "message": "KYC submitted for verification",
  "data": {
    "_id": "MongoID",
    "userId": "MongoID",
    "documentType": "passport",
    "fullName": "John Doe",
    "status": "pending",
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

**Response (Duplicate - 200)**:
```json
{
  "success": true,
  "message": "KYC resubmitted for verification",
  "data": {
    "status": "pending",
    "resubmissionCount": 1,
    "lastResubmittedAt": "2024-01-15T10:00:00Z"
  }
}
```

#### 2. Check KYC Status
```
GET /api/kyc/status
Authorization: Bearer <token>
```

**Response (Not Submitted)**:
```json
{
  "success": true,
  "message": "KYC status retrieved",
  "data": {
    "status": "not_submitted",
    "message": "KYC not yet submitted"
  }
}
```

**Response (Submitted)**:
```json
{
  "success": true,
  "message": "KYC status retrieved successfully",
  "data": {
    "status": "pending|verified|rejected|expired",
    "submittedAt": "2024-01-10T10:00:00Z",
    "verifiedAt": null,
    "rejectedAt": null,
    "rejectionReason": null,
    "resubmissionCount": 0,
    "expiryDate": null,
    "verificationNotes": null
  }
}
```

#### 3. Get KYC Record Details
```
GET /api/kyc/:kycId
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "message": "KYC record retrieved successfully",
  "data": {
    "_id": "MongoID",
    "userId": {
      "_id": "MongoID",
      "email": "user@example.com",
      "fname": "John",
      "lname": "Doe"
    },
    "documentType": "passport",
    "documentNumber": "ABC123456",
    "fullName": "John Doe",
    "dateOfBirth": "1990-01-15T00:00:00Z",
    "gender": "Male",
    "status": "pending",
    "createdAt": "2024-01-10T10:00:00Z"
  }
}
```

---

### Admin Endpoints (Require Admin Role)

#### 1. Get All KYC Records
```
GET /api/admin/kyc/list
Authorization: Bearer <admin_token>
```

**Response**:
```json
{
  "success": true,
  "message": "KYC records retrieved successfully",
  "data": [
    {
      "_id": "MongoID",
      "userId": {
        "_id": "MongoID",
        "email": "user@example.com",
        "fname": "John",
        "lname": "Doe",
        "phone": "+1234567890"
      },
      "documentType": "passport",
      "documentNumber": "ABC123456",
      "documentImageUrl": "https://...",
      "backImageUrl": "https://...",
      "fullName": "John Doe",
      "dateOfBirth": "1990-01-15T00:00:00Z",
      "gender": "Male",
      "address": {
        "street": "123 Main St",
        "city": "New York",
        "state": "NY",
        "zipCode": "10001",
        "country": "USA"
      },
      "status": "pending",
      "verificationNotes": null,
      "verifiedAt": null,
      "verifiedBy": null,
      "rejectionReason": null,
      "rejectedAt": null,
      "rejectedBy": null,
      "resubmissionCount": 0,
      "createdAt": "2024-01-10T10:00:00Z",
      "updatedAt": "2024-01-10T10:00:00Z"
    }
  ]
}
```

#### 2. Get KYC Record (Admin View)
```
GET /api/admin/kyc/:kycId
Authorization: Bearer <admin_token>
```

**Response**: Same structure as user endpoint but with all fields populated

#### 3. Verify KYC Document
```
POST /api/admin/kyc/verify
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "kycId": "MongoID",
  "verificationNotes": "Document verified, all details match"
}
```

**Response**:
```json
{
  "success": true,
  "message": "KYC verified successfully",
  "data": {
    "_id": "MongoID",
    "status": "verified",
    "verifiedAt": "2024-01-15T10:30:00Z",
    "verifiedBy": "AdminMongoID",
    "verificationNotes": "Document verified, all details match"
  }
}
```

#### 4. Reject KYC Document
```
POST /api/admin/kyc/reject
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "kycId": "MongoID",
  "rejectionReason": "Document image is unclear, please resubmit with clear images"
}
```

**Response**:
```json
{
  "success": true,
  "message": "KYC rejected successfully",
  "data": {
    "_id": "MongoID",
    "status": "rejected",
    "rejectedAt": "2024-01-15T10:30:00Z",
    "rejectedBy": "AdminMongoID",
    "rejectionReason": "Document image is unclear, please resubmit with clear images"
  }
}
```

#### 5. Get KYC Statistics
```
GET /api/admin/kyc/stats
Authorization: Bearer <admin_token>
```

**Response**:
```json
{
  "success": true,
  "message": "KYC statistics retrieved successfully",
  "data": {
    "totalKYC": 100,
    "pendingKYC": 15,
    "verifiedKYC": 80,
    "rejectedKYC": 5,
    "expiredKYC": 0,
    "verificationRate": "80.00",
    "rejectionRate": "5.00"
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "All required fields must be provided"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

### 403 Forbidden (Not Admin)
```json
{
  "success": false,
  "message": "Admin access required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "KYC record not found"
}
```

### 500 Server Error
```json
{
  "success": false,
  "message": "Error submitting KYC: [error details]"
}
```

---

## Status Values

| Status | Meaning | User Can See | Admin Can Change |
|--------|---------|--------------|-----------------|
| `pending` | Awaiting admin review | ✅ | ✅ |
| `verified` | Approved by admin | ✅ | ❌ |
| `rejected` | Rejected by admin | ✅ | ❌ |
| `expired` | Document expired | ✅ | ❌ |
| `not_submitted` | User hasn't submitted yet | ✅ | ❌ |

---

## Event Emissions

The system emits events through the EventBus for real-time notifications:

### 1. KYC Submitted
```
Event: kyc.submitted
Data: { userId, kycData }
Listener: notificationService.notifyUser(userId, 'kyc_submitted', {...})
```

### 2. KYC Verified
```
Event: kyc.verified
Data: { userId, kycData }
Listener: notificationService.notifyKYCStatusUpdate(userId, kycData)
```

### 3. KYC Rejected
```
Event: kyc.rejected
Data: { userId, reason }
Listener: notificationService.notifyUser(userId, 'kyc_rejected', {...})
```

---

## Middleware

All endpoints use these middleware:

1. **requireSignin**: Verifies Bearer token and authenticates user
2. **isAdmin**: Checks if user has admin role (admin endpoints only)

---

## Database Model Integration

Uses existing `kycModel` with following schema fields:

```javascript
{
  userId: ObjectId,           // Reference to user
  documentType: String,       // Enum: aadhar, pancard, passport, driving_license
  documentNumber: String,     // Document number
  documentImageUrl: String,   // Front image URL
  backImageUrl: String,       // Back image URL
  fullName: String,          // User's full name
  dateOfBirth: Date,         // Birth date
  gender: String,            // Male, Female, Other
  address: Object,           // Address fields
  status: String,            // pending, verified, rejected, expired
  verificationNotes: String, // Admin notes
  verifiedAt: Date,          // Verification timestamp
  verifiedBy: ObjectId,      // Admin who verified
  rejectionReason: String,   // Reason for rejection
  rejectedAt: Date,          // Rejection timestamp
  rejectedBy: ObjectId,      // Admin who rejected
  resubmissionCount: Number, // Count of resubmissions
  lastResubmittedAt: Date,   // Last resubmission timestamp
  expiryDate: Date,          // Document expiry
  createdAt: Date,           // Submission timestamp
  updatedAt: Date            // Last update timestamp
}
```

---

## Logging

All operations are logged using the logging system:

```
KYC_CONTROLLER.start() → operation started
KYC_CONTROLLER.success() → operation successful
KYC_CONTROLLER.error() → operation failed
KYC_CONTROLLER.warn() → validation or missing data
KYC_CONTROLLER.info() → informational messages
```

---

## Authentication Flow

1. User logs in → receives Bearer token
2. User includes token in Authorization header
3. `requireSignin` middleware validates token
4. User ID extracted from token
5. Operation proceeds with user context

Admin operations additionally require `isAdmin` role check.

---

## Example Usage

### Frontend Integration (Axios)

```javascript
// Submit KYC
const submitKYC = async (formData) => {
  const response = await axios.post(
    'http://localhost:5000/api/kyc/submit',
    formData,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
};

// Check Status
const checkStatus = async () => {
  const response = await axios.get(
    'http://localhost:5000/api/kyc/status',
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return response.data;
};

// Admin: Get All KYC
const getAllKYC = async () => {
  const response = await axios.get(
    'http://localhost:5000/api/admin/kyc/list',
    {
      headers: { Authorization: `Bearer ${adminToken}` }
    }
  );
  return response.data;
};

// Admin: Verify KYC
const verifyKYC = async (kycId) => {
  const response = await axios.post(
    'http://localhost:5000/api/admin/kyc/verify',
    { kycId, verificationNotes: 'Approved' },
    {
      headers: { Authorization: `Bearer ${adminToken}` }
    }
  );
  return response.data;
};
```

---

## Testing Scenarios

### Scenario 1: User Submits KYC
1. POST `/api/kyc/submit` with document details
2. Record created with status `pending`
3. Event emitted: `kyc.submitted`
4. User receives notification

### Scenario 2: User Resubmits KYC
1. User already has pending/rejected KYC
2. POST `/api/kyc/submit` with updated documents
3. Existing record updated, resubmissionCount incremented
4. Status reset to `pending`
5. Event emitted: `kyc.submitted`

### Scenario 3: User Checks Status
1. GET `/api/kyc/status`
2. Returns current status with metadata
3. If not submitted, returns special message

### Scenario 4: Admin Verifies KYC
1. Admin views `/api/admin/kyc/list`
2. Admin clicks verify on pending record
3. POST `/api/admin/kyc/verify` with KYC ID
4. Status changes to `verified`
5. Event emitted: `kyc.verified`
6. User receives notification

### Scenario 5: Admin Rejects KYC
1. Admin views `/api/admin/kyc/list`
2. Admin clicks reject on pending record
3. POST `/api/admin/kyc/reject` with reason
4. Status changes to `rejected`
5. Event emitted: `kyc.rejected`
6. User receives rejection notification with reason

---

## Performance Considerations

1. **Indexes**: KYC model has indexes on:
   - userId (unique)
   - status
   - verifiedAt
   - createdAt

2. **Population**: Admin endpoints populate related user and admin data
3. **Counting**: Statistics endpoint uses countDocuments() (efficient for large datasets)

---

## Security Features

✅ Bearer token authentication on all endpoints
✅ Admin-only access control for verify/reject
✅ Input validation on all fields
✅ Error messages don't expose sensitive data
✅ Proper HTTP status codes
✅ Rate limiting applied at app level
✅ CORS enabled

---

## Deployment Checklist

- [ ] Database has kycModel collection
- [ ] EventBus service is initialized
- [ ] Logger module is configured
- [ ] authMiddleware has requireSignin and isAdmin
- [ ] apiResponse helper has required functions
- [ ] CORS is enabled for frontend origin
- [ ] Rate limiting is configured
- [ ] Socket.io is initialized (for events)

---

**Status**: ✅ Complete and Ready  
**Version**: 1.0  
**Last Updated**: 2024
