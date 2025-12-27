# KYC Backend API - Quick Reference

## ✅ Implementation Complete

All backend KYC APIs have been implemented and integrated into the application.

## Files Created/Modified

| File | Type | Action | Lines |
|------|------|--------|-------|
| `controller/kyc/kycController.js` | NEW | Business logic | 412 |
| `controller/kyc/kyc.js` | NEW | Routes | 78 |
| `app.js` | MODIFIED | Route import & registration | 2 changes |

## API Endpoints Summary

### User Endpoints
| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/api/kyc/submit` | Submit KYC docs | ✅ Token |
| GET | `/api/kyc/status` | Check KYC status | ✅ Token |
| GET | `/api/kyc/:kycId` | Get KYC details | ✅ Token |

### Admin Endpoints
| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/admin/kyc/list` | Get all KYC records | ✅ Admin |
| GET | `/api/admin/kyc/:kycId` | Get specific KYC | ✅ Admin |
| POST | `/api/admin/kyc/verify` | Approve KYC | ✅ Admin |
| POST | `/api/admin/kyc/reject` | Reject KYC | ✅ Admin |
| GET | `/api/admin/kyc/stats` | Get statistics | ✅ Admin |

## Key Features

✅ **User Workflows**
- Submit KYC documents
- Check verification status
- Resubmit after rejection
- View their KYC record

✅ **Admin Workflows**
- View all KYC applications
- Verify documents
- Reject with reason
- View statistics
- Track verification rates

✅ **Data Management**
- Proper population of related documents (userId, verifiedBy, rejectedBy)
- Sorting by creation date (newest first)
- Resubmission tracking
- Complete audit trail (timestamps, who verified/rejected)

✅ **Event Integration**
- KYC submitted → notification sent
- KYC verified → user notified
- KYC rejected → user notified with reason

✅ **Error Handling**
- Input validation
- Missing field detection
- Proper HTTP status codes
- Descriptive error messages

## Request/Response Examples

### Submit KYC
```bash
POST http://localhost:5000/api/kyc/submit
Authorization: Bearer <token>

{
  "documentType": "passport",
  "documentNumber": "ABC123456",
  "documentImageUrl": "https://...",
  "fullName": "John Doe",
  "dateOfBirth": "1990-01-15",
  "gender": "Male",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY"
  }
}
```

### Get All KYC (Admin)
```bash
GET http://localhost:5000/api/admin/kyc/list
Authorization: Bearer <admin_token>
```

### Verify KYC
```bash
POST http://localhost:5000/api/admin/kyc/verify
Authorization: Bearer <admin_token>

{
  "kycId": "60d5ec49c1234567890abcde",
  "verificationNotes": "Document verified"
}
```

### Reject KYC
```bash
POST http://localhost:5000/api/admin/kyc/reject
Authorization: Bearer <admin_token>

{
  "kycId": "60d5ec49c1234567890abcde",
  "rejectionReason": "Image unclear, please resubmit"
}
```

## Status Flow

```
[Not Submitted] 
       ↓
   Submit
       ↓
  [Pending] ← Resubmit after rejection
    ↙   ↖
Verify  Reject
  ↓       ↓
[Verified] [Rejected]
```

## Response Format

### Success
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* response data */ }
}
```

### Error
```json
{
  "success": false,
  "message": "Error description"
}
```

## HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Fetch successful |
| 201 | Created | KYC submitted |
| 400 | Bad Request | Missing fields |
| 401 | Unauthorized | Invalid token |
| 403 | Forbidden | Not admin |
| 404 | Not Found | KYC not found |
| 500 | Server Error | Database error |

## Middleware Chain

```
Request
   ↓
requireSignin (verify token)
   ↓
isAdmin (if admin endpoint)
   ↓
Controller Handler
   ↓
Database Operation
   ↓
Event Emission (if applicable)
   ↓
Response
```

## Database Indexes

KYC model has these indexes for performance:
- `userId` (unique)
- `status` with `createdAt` (sort by status then date)
- `verifiedAt` (sort verified records)

## Logging

All operations logged with module: `KYC_CONTROLLER`

```
KYCC_CONTROLLER.start()     → Operation beginning
KYC_CONTROLLER.success()    → Operation complete
KYC_CONTROLLER.error()      → Operation failed
KYC_CONTROLLER.warn()       → Validation issue
KYC_CONTROLLER.info()       → Additional info
```

## Testing with cURL

### Submit KYC
```bash
curl -X POST http://localhost:5000/api/kyc/submit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documentType": "passport",
    "documentNumber": "ABC123",
    "documentImageUrl": "https://example.com/doc.jpg",
    "fullName": "John Doe",
    "dateOfBirth": "1990-01-15",
    "gender": "Male"
  }'
```

### Check Status
```bash
curl http://localhost:5000/api/kyc/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get All KYC (Admin)
```bash
curl http://localhost:5000/api/admin/kyc/list \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Verify KYC
```bash
curl -X POST http://localhost:5000/api/admin/kyc/verify \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "kycId": "60d5ec49c1234567890abcde",
    "verificationNotes": "Verified"
  }'
```

### Reject KYC
```bash
curl -X POST http://localhost:5000/api/admin/kyc/reject \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "kycId": "60d5ec49c1234567890abcde",
    "rejectionReason": "Image unclear"
  }'
```

## Frontend Integration (Already Done)

The frontend already integrates with these endpoints:
- ✅ `/api/admin/kyc/list` - Fetch all KYC records
- ✅ `/api/admin/kyc/verify` - Approve documents
- ✅ `/api/admin/kyc/reject` - Reject documents

See `KYCVerification.tsx` for implementation.

## Statistics Endpoint

Returns KYC verification metrics:
```json
{
  "totalKYC": 100,
  "pendingKYC": 15,
  "verifiedKYC": 80,
  "rejectedKYC": 5,
  "verificationRate": "80.00",
  "rejectionRate": "5.00"
}
```

## Next Steps

1. **Test Endpoints**: Use cURL or Postman to test each endpoint
2. **Verify Events**: Check if notifications are being sent
3. **Frontend Testing**: Test KYCVerification component with real API
4. **Error Cases**: Test error scenarios (missing fields, invalid tokens, etc.)
5. **Performance**: Monitor with multiple concurrent requests
6. **Documentation**: Update Postman collection with new endpoints

## Known Limitations

- No pagination (all records returned at once)
- No filtering besides by status (could add date ranges, document type filters)
- No bulk operations
- No automatic document expiration checks

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid token | Check token is valid and not expired |
| 403 Forbidden | Not admin | Verify user has admin role |
| 404 Not Found | KYC doesn't exist | Check KYC ID is correct |
| 400 Bad Request | Missing fields | Check all required fields are provided |
| 500 Error | Server issue | Check logs for specific error |

---

**Status**: ✅ Ready for Testing  
**Backend Port**: 5000  
**Frontend Integration**: Complete  
**Version**: 1.0
