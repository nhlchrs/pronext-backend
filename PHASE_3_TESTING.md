# 🧪 Phase 3: Meetings & Webinars - Testing Checklist

## Pre-Test Setup

### 1. Environment Ready
- [ ] Node.js server running
- [ ] MongoDB connected
- [ ] JWT_SECRET configured
- [ ] Postman collection imported

### 2. Test Data
- [ ] Admin user with role=Admin
- [ ] Users with Basic subscription
- [ ] Users with Premium subscription
- [ ] Users with Pro subscription
- [ ] Test meeting scheduled for future

---

## Admin Meeting Creation Tests

### Test 1: Create Meeting - All Fields
**Endpoint:** `POST /api/admin/meeting/create`  
**Required:** Admin token  

**Request Body:**
```json
{
  "title": "React Advanced Patterns",
  "description": "Learn advanced React patterns and hooks",
  "scheduledAt": "2025-01-20T10:00:00Z",
  "duration": 120,
  "allowedSubscriptionTiers": ["Premium", "Pro"],
  "allowedLevels": ["Intermediate", "Advanced"],
  "maxAttendees": 100,
  "topic": "React Development",
  "tags": ["react", "frontend", "training"],
  "isRecorded": true
}
```

**Expected Result:**
- 200 OK
- Meeting created with zoomMeetingId
- zoomLink generated
- status = "scheduled"

**Status:** [ ] PASS [ ] FAIL

---

### Test 2: Create Meeting - Minimal Fields
**Request Body:**
```json
{
  "title": "Quick Webinar",
  "scheduledAt": "2025-01-20T14:00:00Z",
  "duration": 30
}
```

**Expected:**
- Meeting created with default values
- allowedSubscriptionTiers = ["Premium", "Pro"]
- allowedLevels = all levels

**Status:** [ ] PASS [ ] FAIL

---

### Test 3: Cannot Schedule in Past
**Request Body:**
```json
{
  "title": "Past Meeting",
  "scheduledAt": "2024-01-01T10:00:00Z",
  "duration": 60
}
```

**Expected:** 400 Error - "Meeting must be scheduled in the future"

**Status:** [ ] PASS [ ] FAIL

---

### Test 4: Invalid Duration
**Request Body:**
```json
{
  "title": "Invalid Duration",
  "scheduledAt": "2025-01-20T10:00:00Z",
  "duration": 10
}
```

**Expected:** 400 Error - "Duration must be between 15 and 480 minutes"

**Status:** [ ] PASS [ ] FAIL

---

### Test 5: Missing Required Fields
**Request Body:**
```json
{
  "title": "No Duration"
}
```

**Expected:** 400 Error - "Title, scheduled time, and duration are required"

**Status:** [ ] PASS [ ] FAIL

---

### Test 6: Non-Admin Cannot Create
**Endpoint:** `POST /api/admin/meeting/create`  
**Token:** Regular user token  

**Expected:** 403 Forbidden

**Status:** [ ] PASS [ ] FAIL

---

### Test 7: Invalid Subscription Tier
**Request Body:**
```json
{
  "title": "Invalid Tier",
  "scheduledAt": "2025-01-20T10:00:00Z",
  "duration": 60,
  "allowedSubscriptionTiers": ["InvalidTier"]
}
```

**Expected:** 400 Error - "Invalid subscription tier"

**Status:** [ ] PASS [ ] FAIL

---

### Test 8: Zoom Integration Success
**Steps:**
1. Create meeting
2. Verify zoomMeetingId is generated
3. Verify zoomLink is valid format
4. Verify zoomPasscode is provided

**Status:** [ ] PASS [ ] FAIL

---

## Admin Meeting Management Tests

### Test 9: Get All Meetings
**Endpoint:** `GET /api/admin/meetings`  

**Expected:**
- Array of meetings
- Pagination info
- Correct creator info populated

**Status:** [ ] PASS [ ] FAIL

---

### Test 10: Get Meetings - Pagination
**Endpoint:** `GET /api/admin/meetings?page=1&limit=5`  

**Expected:**
- 5 meetings per page
- Correct page number
- Total count accurate

**Status:** [ ] PASS [ ] FAIL

---

### Test 11: Get Meetings - Filter by Status
**Endpoint:** `GET /api/admin/meetings?status=scheduled`  

**Expected:**
- Only scheduled meetings returned
- Other statuses excluded

**Status:** [ ] PASS [ ] FAIL

---

### Test 12: Get Meetings - Search by Title
**Endpoint:** `GET /api/admin/meetings?search=React`  

**Expected:**
- Only meetings with "React" in title/description

**Status:** [ ] PASS [ ] FAIL

---

### Test 13: Get Single Meeting
**Endpoint:** `GET /api/meeting/:meetingId`  

**Expected:**
- Complete meeting details
- Creator info populated
- All fields present

**Status:** [ ] PASS [ ] FAIL

---

### Test 14: Update Meeting
**Endpoint:** `PUT /api/admin/meeting/:meetingId`  

**Request Body:**
```json
{
  "title": "Updated Title",
  "description": "New description",
  "maxAttendees": 200
}
```

**Expected:** 200 OK with updated meeting

**Status:** [ ] PASS [ ] FAIL

---

### Test 15: Cannot Update Ongoing Meeting
**Endpoint:** `PUT /api/admin/meeting/:meetingId`  
**Prerequisites:** Meeting status = "ongoing"  

**Expected:** 400 Error - "Cannot update ongoing or completed meeting"

**Status:** [ ] PASS [ ] FAIL

---

### Test 16: Cancel Meeting
**Endpoint:** `DELETE /api/admin/meeting/:meetingId`  

**Expected:**
- 200 OK
- Meeting status changed to "cancelled"

**Status:** [ ] PASS [ ] FAIL

---

### Test 17: Cannot Cancel Completed Meeting
**Endpoint:** `DELETE /api/admin/meeting/:meetingId`  
**Prerequisites:** Meeting status = "completed"  

**Expected:** 400 Error

**Status:** [ ] PASS [ ] FAIL

---

## Meeting Access Control Tests

### Test 18: Share Meeting with Subscription Tiers
**Endpoint:** `POST /api/admin/meeting/:meetingId/share`  

**Request Body:**
```json
{
  "subscriptionTiers": ["Premium", "Pro"],
  "message": "Shared with Premium users"
}
```

**Expected:**
- 200 OK
- Meeting updated with new tiers
- Eligible user count returned

**Status:** [ ] PASS [ ] FAIL

---

### Test 19: User Sees Only Allowed Meetings
**Endpoint:** `GET /api/user/available-meetings`  
**User:** Premium subscription  

**Expected:**
- Only meetings with Premium in allowedSubscriptionTiers
- Basic-only meetings excluded

**Status:** [ ] PASS [ ] FAIL

---

### Test 20: Pro User Sees Pro+Premium Meetings
**Endpoint:** `GET /api/user/available-meetings`  
**User:** Pro subscription  

**Expected:**
- Meetings for Pro tier
- Meetings for Premium tier (if Pro inherits)
- Meetings for Basic tier (if included)

**Status:** [ ] PASS [ ] FAIL

---

### Test 21: Get Upcoming Meetings
**Endpoint:** `GET /api/meeting/upcoming?limit=5`  

**Expected:**
- Only future meetings
- Only scheduled status
- Sorted by scheduledAt ascending

**Status:** [ ] PASS [ ] FAIL

---

## Meeting Attendance Tests

### Test 22: User Joins Meeting - Gets Zoom Link
**Endpoint:** `GET /api/meeting/:meetingId/join`  
**User:** Has correct subscription tier  

**Expected:**
- 200 OK
- zoomLink provided
- zoomPasscode provided
- User added to attendees
- totalAttendees incremented

**Status:** [ ] PASS [ ] FAIL

---

### Test 23: Cannot Join - Insufficient Subscription
**Endpoint:** `GET /api/meeting/:meetingId/join`  
**User:** Basic tier trying to join Pro-only meeting  

**Expected:** 403 Forbidden - "You do not have access to this meeting"

**Status:** [ ] PASS [ ] FAIL

---

### Test 24: Cannot Join - Meeting Cancelled
**Endpoint:** `GET /api/meeting/:meetingId/join`  
**Meeting:** status = "cancelled"  

**Expected:** 400 Error - "Meeting is not available"

**Status:** [ ] PASS [ ] FAIL

---

### Test 25: Cannot Join - At Max Capacity
**Endpoint:** `GET /api/meeting/:meetingId/join`  
**Prerequisites:** 
- Meeting has maxAttendees = 5
- Already has 5 attendees  

**Expected:** 400 Error - "Meeting is at maximum capacity"

**Status:** [ ] PASS [ ] FAIL

---

### Test 26: Same User Joins Twice
**Endpoint:** `GET /api/meeting/:meetingId/join` (2x)  

**Expected:**
- First join: attendee added, count = 1
- Second join: not duplicated, count = 1

**Status:** [ ] PASS [ ] FAIL

---

### Test 27: View Meeting Attendees
**Endpoint:** `GET /api/admin/meeting/:meetingId/attendees`  

**Expected:**
- Array of attendees with details
- Join/leave times recorded
- Attendance status

**Status:** [ ] PASS [ ] FAIL

---

### Test 28: Attendee List Pagination
**Endpoint:** `GET /api/admin/meeting/:meetingId/attendees?page=1&limit=10`  

**Expected:**
- 10 attendees per page
- Pagination info
- Total count accurate

**Status:** [ ] PASS [ ] FAIL

---

## Meeting Start/End Tests

### Test 29: Start Meeting
**Endpoint:** `POST /api/admin/meeting/:meetingId/start`  
**Prerequisites:** status = "scheduled"  

**Expected:**
- Status changed to "ongoing"
- meetingStartedAt recorded

**Status:** [ ] PASS [ ] FAIL

---

### Test 30: Cannot Start Already Ongoing
**Endpoint:** `POST /api/admin/meeting/:meetingId/start`  
**Prerequisites:** status = "ongoing"  

**Expected:** 400 Error

**Status:** [ ] PASS [ ] FAIL

---

### Test 31: End Meeting Without Recording
**Endpoint:** `POST /api/admin/meeting/:meetingId/end`  
**Prerequisites:** status = "ongoing"  

**Request Body:**
```json
{}
```

**Expected:**
- Status changed to "completed"
- meetingEndedAt recorded
- recordingUrl = null

**Status:** [ ] PASS [ ] FAIL

---

### Test 32: End Meeting With Recording
**Endpoint:** `POST /api/admin/meeting/:meetingId/end`  

**Request Body:**
```json
{
  "recordingUrl": "https://zoom.us/recording/..."
}
```

**Expected:**
- Status changed to "completed"
- recordingUrl stored

**Status:** [ ] PASS [ ] FAIL

---

### Test 33: Cannot End Non-Ongoing Meeting
**Endpoint:** `POST /api/admin/meeting/:meetingId/end`  
**Prerequisites:** status = "completed"  

**Expected:** 400 Error - "Meeting is not currently ongoing"

**Status:** [ ] PASS [ ] FAIL

---

## Statistics & Reporting Tests

### Test 34: Get Meeting Statistics
**Endpoint:** `GET /api/admin/meeting-stats`  

**Expected Response:**
```json
{
  "totalMeetings": 25,
  "scheduledMeetings": 10,
  "ongoingMeetings": 2,
  "completedMeetings": 10,
  "cancelledMeetings": 3,
  "meetingsByTier": {
    "Premium": 15,
    "Pro": 10
  }
}
```

**Status:** [ ] PASS [ ] FAIL

---

### Test 35: Statistics - Counts Accurate
**Steps:**
1. Get statistics
2. Manually count meetings in each status
3. Verify numbers match

**Status:** [ ] PASS [ ] FAIL

---

## Security & Authorization Tests

### Test 36: Unauthenticated Cannot Access
**Endpoint:** `GET /api/user/available-meetings`  
**Headers:** No Authorization  

**Expected:** 401 Unauthorized

**Status:** [ ] PASS [ ] FAIL

---

### Test 37: Invalid Token Rejected
**Endpoint:** `GET /api/user/available-meetings`  
**Token:** invalid_token_123  

**Expected:** 401 Unauthorized

**Status:** [ ] PASS [ ] FAIL

---

### Test 38: Non-Admin Cannot Create Meeting
**Endpoint:** `POST /api/admin/meeting/create`  
**Token:** Educator user  

**Expected:** 403 Forbidden

**Status:** [ ] PASS [ ] FAIL

---

### Test 39: Suspended User Cannot Join
**Endpoint:** `GET /api/meeting/:meetingId/join`  
**User:** Suspended user  

**Expected:** Access denied (either through session or separate check)

**Status:** [ ] PASS [ ] FAIL

---

### Test 40: Blocked User Cannot Join
**Endpoint:** `GET /api/meeting/:meetingId/join`  
**User:** Blocked user  

**Expected:** Access denied

**Status:** [ ] PASS [ ] FAIL

---

## Integration Tests

### Test 41: End-to-End Meeting Flow
**Steps:**
1. Admin creates meeting
2. Admin shares with Premium tier
3. Premium user sees meeting
4. Premium user joins (gets link)
5. Admin starts meeting
6. Admin adds attendee
7. Admin ends meeting with recording
8. Verify all status changes

**Status:** [ ] PASS [ ] FAIL

---

### Test 42: Multiple Users, Different Tiers
**Steps:**
1. Create 3 meetings with different tier restrictions
2. Basic user tries each
3. Premium user tries each
4. Pro user tries each
5. Verify access control works

**Status:** [ ] PASS [ ] FAIL

---

## Performance Tests

### Test 43: List Meetings Performance
**Endpoint:** `GET /api/admin/meetings?limit=50`  

**Expected:** Response time < 500ms

**Status:** [ ] PASS (___ms) [ ] FAIL

---

### Test 44: Search Performance
**Endpoint:** `GET /api/admin/meetings?search=common_term`  

**Expected:** Response time < 500ms with 1000+ meetings

**Status:** [ ] PASS (___ms) [ ] FAIL

---

## Summary

Total Tests: 44  
Pass Required: 42+  

**Tests Passed:** ___/44  
**Tests Failed:** ___/44  
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
