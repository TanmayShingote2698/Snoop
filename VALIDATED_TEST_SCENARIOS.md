# Validated Test Scenarios - AI Monitor System

## 🧪 Pre-Deployment Validation Tests

Use these test scenarios to validate the system is working correctly before deploying to production with real student exams.

---

## Test Case 1: Permission & Monitoring Initialization
**Objective**: Verify permission overlay and monitoring state transitions

**Steps**:
1. Navigate to student dashboard
2. Create new test (or select existing)
3. Click "Take This Test"
4. **Verify**: Permission overlay appears with:
   - ✅ Camera icon
   - ✅ Microphone icon
   - ✅ "Grant Permission & Start" button
   - ✅ "Proceed Without Monitoring" button

5. Click "Grant Permission & Start"
6. **Verify**: Browser permission popup appears
7. Click "Allow"
8. **Verify**: 
   - Overlay closes
   - Permission bar updated (✅ Camera/Mic enabled)
   - Status shows: 🔴 MONITORING ACTIVE

**Expected Result**: ✅ Monitoring initialized successfully
**Database Check**: Result table shows `monitoring_enabled = true`
**API Check**: `/getStudentResult` returns `"monitoring_enabled": true`

---

## Test Case 2: Frame Upload (No Anomalies)
**Objective**: Verify frames are captured and uploaded successfully

**Setup**: 
- Monitoring active
- Student visible in frame (normal pose)
- Good lighting

**Steps**:
1. Answer 2-3 questions
2. Wait 30 seconds (3 frame cycles at 2-second intervals)
3. Open DevTools (F12) → Network tab
4. **Verify**: Multiple POST requests to `/api/monitoring/analyze_frame`
5. Click on frame request
6. **Verify Response**:
   ```json
   {
     "status": "success",
     "anomalies_detected": [],
     "frame_processed_time_ms": 150
   }
   ```

7. Navigate to Results Dashboard
8. **Verify**: Shows:
   - `monitoring_enabled: true`
   - `cheat_score: 0` (no anomalies)
   - `anomaly_data: []`

**Expected Result**: ✅ Frames uploaded, no false positives
**Performance Target**: <500ms per frame processing

---

## Test Case 3: Phone Detection Anomaly
**Objective**: Verify phone detection and scoring

**Setup**:
- Monitoring active
- Good lighting
- Have a smartphone available

**Steps**:
1. Start answering questions
2. Hold smartphone clearly visible to camera
3. Keep phone in view for 3 seconds
4. **Verify**: Browser console shows:
   ```
   [ANOMALY DETECTED] suspicious_object_detected
   ```
5. Check DevTools → Console tab
6. **Verify**: Toast notification appears "Anomaly Detected!"

7. Complete test and submit
8. **Verify**: Results show:
   - `cheat_score: 20` (min for phone)
   - `risk_level: "LOW"`
   - `anomaly_data[0].type: "PHONE_DETECTED"`

9. Check Teacher Dashboard
10. **Verify**: Results show:
    - AI Cheat Score: ~20-40
    - Risk Level: 🟢 LOW
    - Monitoring: ✓ Active
    - Details: Shows "phone_detected" in anomaly list

**Expected Result**: ✅ Phone correctly detected and scored
**Anomaly Record**: Shows phone detection with time (within ±5 seconds of actual phone presence)

---

## Test Case 4: Multiple People Detection
**Objective**: Verify multiple face detection

**Setup**:
- Monitoring active
- Have another person available

**Steps**:
1. Start test
2. Have second person stand next to/behind you
3. Ensure both faces visible in frame
4. Wait 3 seconds
5. **Verify**: Console shows `[ANOMALY DETECTED] multiple_faces_detected`

6. Complete and submit test
7. **Verify**: Results show:
   - `cheat_score: 18` (baseline)
   - `anomaly_data` includes `"type": "MULTIPLE_PEOPLE"`

8. Teacher Dashboard:
   - **Verify**: Risk Level shows 🔵 MODERATE or 🟡 MEDIUM
   - **Verify**: Details show multiple people detection

**Expected Result**: ✅ Multiple people correctly detected
**Scoring**: 18 points per detection

---

## Test Case 5: Gaze Away Detection
**Objective**: Verify gaze tracking

**Setup**:
- Monitoring active
- Good lighting
- Clear face visibility

**Steps**:
1. Start test
2. Answer 1 question normally
3. Look significantly to the LEFT for 3 seconds
4. **Verify**: Console shows `[ANOMALY DETECTED] gaze detection anomaly`
5. Look RIGHT for 3 seconds
6. **Verify**: Another anomaly detection
7. Look DOWN for 3 seconds
8. **Verify**: Another anomaly detection
9. Return to looking at screen

10. Complete test and submit
11. **Verify**: Results show:
    - Multiple gaze anomalies in `anomaly_data`
    - `cheat_score: 15-40` (5-8 pts per gaze violation)
    - Each anomaly logged: `"type": "GAZE_LOOKING_LEFT"` etc.

**Expected Result**: ✅ Gaze tracking working
**Scoring**: 5-8 points per direction violation

---

## Test Case 6: No Face Detected
**Objective**: Verify face absence detection

**Setup**:
- Monitoring active

**Steps**:
1. Start test
2. Look down away from screen for 5+ seconds
3. Or block camera with hand
4. **Verify**: Console shows `[ANOMALY DETECTED] no_face_detected`

5. Complete test and submit
6. **Verify**: Results show:
    - `anomaly_data` includes `"type": "NO_FACE_DETECTED"`
    - `cheat_score: 15` (for face absence)

**Expected Result**: ✅ Face absence detected
**Note**: Multiple instances accumulate (each 15 points)

---

## Test Case 7: Behavioral Violation (Tab Switch)
**Objective**: Verify integrity scoring for behavioral violations

**Setup**:
- Monitoring active
- Use browser fullscreen when taking test

**Steps**:
1. Start test in fullscreen
2. Answer 1-2 questions
3. Press `ESC` key to exit fullscreen
4. **Verify**: Alert appears "Fullscreen Exit Detected!"
5. **Verify**: Integrity score in test page updates

6. Complete and submit test
7. **Verify**: Results show:
    - `integrity < 100` (reduced due to violation)
    - Combined score reflects penalty
    - Database shows violation in `fullscreen_data` or `action_logs`

**Expected Result**: ✅ Behavioral violations tracked
**Impact**: Reduces integrity score, reflected in combined score

---

## Test Case 8: Combined Score Calculation
**Objective**: Verify correct combined score formula

**Setup**: 
- Take test with controlled anomalies (1-2 detected)

**Test Data**:
- Integrity: 80%
- AI Cheat Score: 30
- Formula: (80 × 0.4) + (30 × 0.6) = 32 + 18 = **50**

**Verify Dashboard**:
- Shows Combined Score: 50
- **Risk Level**: 🟡 MEDIUM

**Expected Result**: ✅ Calculation correct
**Verification**: Calculate on paper, compare with dashboard

---

## Test Case 9: Risk Level Color Coding
**Objective**: Verify correct risk level display and colors

**Test Multiple Scores**:

| Test Name | Combined Score | Expected | Actual | Status |
|-----------|---------------|----------|--------|---------|
| Test_LOW | 15 | 🟢 | 🟢 | ✅ |
| Test_MODERATE | 35 | 🔵 | 🔵 | ✅ |
| Test_MEDIUM | 50 | 🟡 | 🟡 | ✅ |
| Test_HIGH | 70 | 🟠 | 🟠 | ✅ |
| Test_CRITICAL | 85 | 🔴 | 🔴 | ✅ |

**Steps**:
1. Create 5 test exams
2. Have tester take each with controlled scenarios:
   - LOW: No anomalies
   - MODERATE: 1 gaze violation
   - MEDIUM: Phone + 1 gaze
   - HIGH: Phone + 2 people + multiple gazes
   - CRITICAL: Phone + 2 people + excessive gazes + face blocked

3. Check Teacher Dashboard
4. Verify each shows correct emoji and color in background

**Expected Result**: ✅ All color coding correct
**Color Scheme Verification**: 
- 🟢 = Light green background
- 🔵 = Light blue background
- 🟡 = Light yellow background
- 🟠 = Light orange background
- 🔴 = Light red background

---

## Test Case 10: Database Persistence
**Objective**: Verify all data stored correctly in database

**Setup**: Complete several tests with different scenarios

**Database Query**:
```sql
SELECT 
  email, 
  test_id,
  mcq_score,
  integrity,
  cheat_score,
  combined_score,
  risk_level,
  monitoring_enabled,
  anomaly_data,
  monitoring_stats
FROM result 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 5;
```

**Verify Each Row**:
- ✅ Email populated
- ✅ Test ID matches exam taken
- ✅ MCQ Score = actual score
- ✅ Integrity = expected 0-100
- ✅ Cheat Score = 0-100
- ✅ Combined Score = (Integrity×0.4) + (Cheat×0.6)
- ✅ Risk Level = Correct classification
- ✅ Monitoring Enabled = true
- ✅ Anomaly Data = JSON array with detected anomalies
- ✅ Monitoring Stats = JSON object with stats

**Expected Result**: ✅ All fields populated correctly
**Data Integrity**: No NULL values, correct data types

---

## Test Case 11: API Response Format
**Objective**: Verify API endpoints return correct monitoring data

**Test Each Endpoint**:

### Endpoint 1: `/getStudentResult`
```bash
curl -X POST http://127.0.0.1:200/getStudentResult \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "studentEmail=test@example.com"
```

**Verify Response**:
```json
{
  "status": "success",
  "results": [
    {
      "test_id": "TEST-001",
      "score": 85,
      "integrity": 90,
      "cheat_score": 20,        // ← NEW
      "combined_score": 48,      // ← NEW
      "risk_level": "LOW",       // ← NEW
      "monitoring_enabled": true, // ← NEW
      "anomaly_data": []         // ← NEW
    }
  ]
}
```

### Endpoint 2: `/getTestResult`
```bash
curl -X POST http://127.0.0.1:200/getTestResult \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "testID=TEST-001"
```

**Verify Response**: Same fields as above (for all students who took this test)

### Endpoint 3: `/getStudentResponse`
```bash
curl -X POST http://127.0.0.1:200/getStudentResponse \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "studentEmail=test@example.com&testID=TEST-001"
```

**Verify Response**: Same fields for specific student/test combo

**Expected Result**: ✅ All endpoints return new monitoring fields
**Data Consistency**: Same values across all endpoints for same student/test

---

## Test Case 12: Dashboard Anomaly Details
**Objective**: Verify anomaly expansion and detail display

**Setup**: Complete test with multiple detected anomalies

**Steps**:
1. Login as Teacher
2. Go to Results
3. Select test with HIGH or CRITICAL risk level
4. Find Results table
5. Click "View Anomalies" button for a result
6. **Verify**: Row expands to show table:

| Type | Confidence | Timestamp |
|------|-----------|-----------|
| PHONE_DETECTED | 92% | 14:32:15 |
| GAZE_LOOKING_LEFT | 78% | 14:35:22 |
| MULTIPLE_PEOPLE | 85% | 14:38:45 |
| ...and 2 more | - | - |

7. Verify table shows:
   - ✅ Anomaly type (readable: "PHONE_DETECTED" not "1023")
   - ✅ Confidence as percentage
   - ✅ Timestamp in HH:MM:SS format
   - ✅ If >5 anomalies, shows "and N more"

8. Click "View Anomalies" again
9. **Verify**: Row collapses

**Expected Result**: ✅ Anomalies expand/collapse, details display correctly
**Performance**: Expansion should be instant (<100ms)

---

## Test Case 13: Opt-Out Scenario
**Objective**: Verify system handles opt-out gracefully

**Steps**:
1. Start test
2. Click "Proceed Without Monitoring"
3. **Verify**: Permission overlay closes
4. Test proceeds normally
5. Answer all questions
6. Submit

7. **Verify Results**:
   - `monitoring_enabled: false`
   - `cheat_score: 0` or null
   - `combined_score: 0` or null
   - `risk_level: "LOW"` or null
   - `anomaly_data: []`

8. Teacher Dashboard:
   - **Verify**: Shows "N/A" or "-" for monitoring columns
   - **Verify**: Risk Level shows "🟢 LOW" (default)
   - **Verify**: No error or warning

**Expected Result**: ✅ System handles opt-out gracefully
**Data**: No monitoring data stored, defaults used

---

## Test Case 14: Permission Denied Scenario
**Objective**: Verify error handling when permission denied

**Steps**:
1. Start test
2. Click "Grant Permission & Start"
3. **When browser popup appears**: Click "Don't Allow" / "Block"
4. **Verify**: Clear error message appears (browser dependent)
   - Chrome: "Permission denied"
   - Firefox: Similar message
   - Edge: Similar message

5. **Options should appear**:
   - Option A: Retry permission
   - Option B: Proceed without monitoring
   - Option C: Cancel test

6. Click "Proceed Without Monitoring"
7. **Verify**: Test continues (same as Test Case 13)

**Expected Result**: ✅ Graceful error handling, user not blocked

---

## Test Case 15: Concurrent Student Testing
**Objective**: Verify system supports multiple simultaneous monitors

**Setup**: Have at least 2 student accounts available

**Steps**:
1. Open 2 browser windows
2. In Window 1: Log in as Student A
3. In Window 2: Log in as Student B
4. Window 1: Start test with monitoring
5. Window 2: Start test with monitoring simultaneously
6. Both windows: Take test
7. Both windows: Submit simultaneously

8. **Server checks**:
   - ✅ Both tests complete without error
   - ✅ ResultServer logs show both sessions
   - ✅ No data mixing between students

9. **Database checks**:
   - Query for results: Should see both students
   - Student A's result has Student A's data
   - Student B's result has Student B's data
   - No cross-contamination

10. **Teacher Dashboard**:
    - Both tests appear with separate scores
    - Anomaly data correct for each

**Expected Result**: ✅ Multi-session support working
**Performance**: Both tests process without lag

---

## Test Case 16: Performance Load Test
**Objective**: Verify system performance under typical load

**Setup**: Prepare for 5 concurrent students

**Steps**:
1. Record baseline:
   - Memory usage: _____
   - CPU usage: _____

2. Have 5 students start tests simultaneously
3. Monitor server performance:
   - Backend CPU: Should stay <60%
   - Backend Memory: Should stay <1GB (Python)
   - ResultServer CPU: Should stay <40%
   - Database queries: <100ms typical

4. All 5 complete tests in 10-15 minutes
5. All 5 submit simultaneously

6. **Record final**:
   - Memory usage: _____
   - CPU usage: _____
   - Query times: _____
   - Frame processing average: _____ms

**Expected Result**: ✅ System handles 5 concurrent users
**Performance Targets**:
- Frame processing: <500ms
- API response: <200ms
- Database query: <100ms
- Memory stable: <2GB total

---

## 📋 Final Validation Checklist

After completing all 16 test cases:

### Functionality
- [ ] Monitoring starts on permission grant
- [ ] Frames captured and uploaded
- [ ] Anomalies detected correctly
- [ ] Scores calculated accurately
- [ ] Database stores all data
- [ ] API returns all fields
- [ ] Dashboard displays all columns
- [ ] Anomaly details expand/collapse
- [ ] Color coding correct for risk levels

### Edge Cases
- [ ] Opt-out works gracefully
- [ ] Permission deny handled
- [ ] Multiple concurrent users supported
- [ ] No data mixing between students

### Performance
- [ ] Frame processing <500ms
- [ ] API response <200ms
- [ ] Dashboard loads in <3 seconds
- [ ] System handles 5+ concurrent users

### Data Quality
- [ ] All database fields populated
- [ ] Timestamps accurate
- [ ] Confidence scores realistic
- [ ] Risk levels calculate correctly

### User Experience
- [ ] Permission overlay clear
- [ ] Monitoring status visible
- [ ] Anomaly notifications helpful
- [ ] Dashboard intuitive
- [ ] No console errors

### Security & Privacy
- [ ] Student data isolated
- [ ] No data leakage between tests
- [ ] Encryption in transit (HTTPS in prod)
- [ ] Only necessary data collected

---

## ✅ Deployment Approval

**System is ready for deployment when**:
- ✅ All 16 test cases pass
- ✅ No critical issues
- ✅ Performance meets targets
- ✅ Data integrity verified
- ✅ No security concerns

**Sign-off**:

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Lead | _________ | _________ | _________ |
| Tech Lead | _________ | _________ | _________ |
| Compliance | _________ | _________ | _________ |

---

**Last Updated**: March 17, 2026
**Status**: Validated Test Scenarios Ready
