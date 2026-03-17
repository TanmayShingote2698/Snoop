# AI Monitor Implementation - Comprehensive Testing Guide

## 🧪 Pre-Testing Setup

### 1. Database Update
Run the updated SQL script to add new fields:
```bash
# Supabase SQL Editor:
# Execute: database_setup.sql
# New fields added to 'result' table:
# - monitoring_enabled (BOOLEAN)
# - cheat_score (DECIMAL)
# - combined_score (DECIMAL)
# - risk_level (TEXT)
# - anomaly_data (JSONB)
# - monitoring_stats (JSONB)
```

### 2. Start All Servers
```bash
# Windows - Run start_all_servers.bat
cd "c:\Users\lenovo\OneDrive\Desktop\Snoop system\Snoop"
.\start_all_servers.bat

# Or manually:
# Terminal 1: Backend Server
cd src/BackendServer
npm install
npm start

# Terminal 2: Result Server
cd src/ResultServer
python server.py

# Terminal 3: Test Server
cd src/TestServer
python server.py

# Terminal 4: AI Monitor Service
cd src/AIMonitor
python monitoring_service.py

# Terminal 5: Auth Server
cd src/AuthServer
python server.py
```

### 3. Verify Server Health
- BackendServer: http://127.0.0.1:3000
- ResultServer: http://127.0.0.1:200/health
- TestServer: http://127.0.0.1:100/health
- AuthServer: http://127.0.0.1:300/health

## 📋 Testing Scenarios

### Scenario 1: Basic Monitoring Flow
**Objective**: Verify that monitoring starts and stops correctly

**Steps**:
1. Log in as **Student**
2. Create and take a test:
   - Permission overlay should appear
   - Click "Grant Permission & Start"
   - Camera/microphone permission popup should appear in browser
   - Click "Allow"
   - Status bar should show 🔴 MONITORING ACTIVE

3. Take the test (answer 3-5 questions)
4. Submit test
5. **Verify**: 
   - Monitoring stops automatically
   - Page redirects to student home
   - Success message appears

**Expected Result**: ✅ No errors in console, monitoring data collected

---

### Scenario 2: Phone Detection Anomaly
**Objective**: Verify that phone detection triggers anomaly logging

**Steps**:
1. Start a test with monitoring enabled
2. Hold a smartphone visible to the camera
3. Keep phone in view for ~3-5 seconds
4. Observe console output
5. Submit test

**Verify**:
- Browser console shows "[ANOMALY DETECTED]" message
- Network tab shows frame uploads to `/api/monitoring/analyze_frame`
- Toast notification appears: "Anomaly Detected! suspicious_object_detected"
- Test results show `cheat_score > 0`

**Expected Result**: ✅ Phone detected, anomaly recorded, score increased

---

### Scenario 3: Multiple People Detection
**Objective**: Verify detection of multiple faces in frame

**Steps**:
1. Start a test with monitoring enabled
2. Have another person stand behind/beside the camera
3. Ensure both faces are visible in frame
4. Wait 3-5 seconds
5. Submit test

**Verify**:
- Anomaly notification appears
- Cheat score increases significantly
- Risk level elevated to MEDIUM or HIGH

**Expected Result**: ✅ Multiple people detected correctly

---

### Scenario 4: Gaze Tracking
**Objective**: Verify gaze direction detection

**Steps**:
1. Start a test with monitoring enabled
2. Look significantly to the left
3. Hold for 3-5 seconds
4. Look to the right
5. Look down
6. Return to screen
7. Submit test

**Verify**:
- Console shows gaze anomalies: "gaze_looking_left", "gaze_looking_right", "gaze_down"
- Score reflects multiple gaze violations
- Status bar updates as anomalies detected

**Expected Result**: ✅ Gaze tracking functional

---

### Scenario 5: Tab Switching Penalty
**Objective**: Verify behavioral violation penalty

**Steps**:
1. Start a test with monitoring enabled
2. While answering questions, switch to another tab
3. Stay on other tab for 10+ seconds
4. Return to test tab
5. Complete and submit

**Verify**:
- Fullscreen "Tab Switching Detected!" alert appears
- Integrity score reduces
- Combined score affected
- Dashboard shows tab switch count

**Expected Result**: ✅ Behavioral punishment applied

---

### Scenario 6: Teacher Dashboard Display
**Objective**: Verify teacher sees all monitoring data

**Steps**:
1. Complete 2-3 tests with monitoring enabled (with anomalies)
2. Log in as **Teacher**
3. Click "Results" → Select a completed test
4. View result details

**Verify Table Columns**:
- ✅ Student Email
- ✅ Score (Final Score)
- ✅ Integrity (0-100)
- ✅ AI Cheat Score (0-100)
- ✅ Combined Score (0-100)
- ✅ Risk Level (🟢 LOW / 🔵 MODERATE / 🟡 MEDIUM / 🟠 HIGH / 🔴 CRITICAL)
- ✅ Monitoring (Active/Inactive badge)
- ✅ Details (Number of anomalies button)

**Verify Anomaly Details**:
- Click "View Anomalies" button
- Detailed row expands
- Shows:
  - Anomaly type (e.g., "PHONE_DETECTED")
  - Confidence percentage
  - Timestamp

**Expected Result**: ✅ Dashboard displays all monitoring data correctly

---

### Scenario 7: Risk Level Classification
**Objective**: Verify correct risk level calculation

| Cheat Score | Expected Risk | Color |
|------------|--------------|-------|
| 0-20      | LOW          | 🟢 Green |
| 21-40     | MODERATE     | 🔵 Blue |
| 41-60     | MEDIUM       | 🟡 Yellow |
| 61-80     | HIGH         | 🟠 Orange |
| 81-100    | CRITICAL     | 🔴 Red |

**Steps**:
1. Create tests that generate different cheat scores:
   - **Low**: No anomalies, no violations → ~0
   - **High**: Phone + multiple people + gaze away → ~70+
   - **Critical**: Phone + 3+ gaze violations + tab switching → ~85+

2. Check teacher dashboard for correct color coding

**Expected Result**: ✅ Risk levels color-coded correctly

---

### Scenario 8: No Permission Scenario
**Objective**: Verify system works without monitoring

**Steps**:
1. Start a test
2. Click "Proceed Without Monitoring"
3. Take and submit test

**Verify**:
- Test completes normally
- Results show:
  - `monitoring_enabled: false`
  - `cheat_score: 0`
  - `combined_score: 0`
  - `risk_level: LOW`
  - No anomalies recorded

**Expected Result**: ✅ System handles opt-out gracefully

---

### Scenario 9: Permission Denial
**Objective**: Verify handling when user denies permissions

**Steps**:
1. Start a test
2. Click "Grant Permission & Start"
3. Click "Don't Allow" on browser permission prompt
4. Try to submit test

**Verify**:
- Error/warning message displayed
- Firefox/Chrome shows clear error
- User can proceed without monitoring
- Or test blocks submission (configurable)

**Expected Result**: ✅ Graceful error handling

---

### Scenario 10: Concurrent Test Monitoring
**Objective**: Verify system handles multiple simultaneous monitors

**Steps**:
1. Open 2-3 browser windows/tabs
2. Log in with different student accounts in each
3. Start test in each window
4. Take tests simultaneously
5. Submit all tests

**Verify**:
- All monitoring sessions run independently
- No data mixing between students
- All results stored correctly
- ResultServer logs show all sessions
- Backend processes all frames without blocking

**Expected Result**: ✅ Multi-session support working

---

## 🔍 Debugging Checklist

### Frame Capture Issues
```javascript
// Browser Console - Check if frames are being captured
console.log(snoopMonitor.frameCount);  // Should increase every 2 seconds
console.log(snoopMonitor.anomaliesDetected);  // Should show detected anomalies
```

### Backend Not Receiving Frames
1. Check Network tab in DevTools:
   - POST requests to `/api/monitoring/analyze_frame` should appear
   - Status should be 200 (success)
   - Response should include `"anomalies_detected": X`

2. Check Python backend console:
   - Should see frame processing logs
   - Check for errors in anomaly detection

### Database Not Storing Data
1. Verify Supabase connection:
   ```bash
   python -c "from src.ResultServer.dbManager import dbManager; 
              db = dbManager(); db.connect(); 
              print(db.runQuery('SELECT COUNT(*) FROM result'))"
   ```

2. Check result table:
   - Verify new columns exist
   - Check that values are populated

### Dashboard Not Showing Scores
1. Check browser console for JavaScript errors
2. Verify result API returns new fields:
   ```bash
   curl -X POST http://127.0.0.1:200/getStudentResult \
        -d "studentEmail=test@email.com" \
        -H "Content-Type: application/json"
   ```

---

## 📊 Performance Testing

### Load Test with Multiple Students
```bash
# Simulate 10 concurrent tests
for i in {1..10}; do
  curl -X POST http://127.0.0.1:3000/student/takeTest \
       -d "testID=TEST-001&email=student$i@test.com" &
done
wait
```

**Monitor**:
- Backend CPU usage (should be <80%)
- Frame processing latency (<500ms per frame)
- Database write time (<100ms per result)
- Total memory usage

---

## 🐛 Known Issues & Troubleshooting

### Issue: Permissions Not Granted
**Symptom**: Browser doesn't ask for camera/mic permission
**Solution**:
- Ensure HTTPS in production (localhost works for HTTP)
- Check browser privacy settings
- Try different browser

### Issue: No Anomalies Detected
**Symptom**: Monitoring runs but cheat score is 0
**Solutions**:
- Check lighting conditions
- Camera resolution too low?
- Try holding phone very close
- Check YOLO model loaded correctly

### Issue: Integrity Score Shows 0
**Symptom**: All tests show integrity = 0
**Solution**:
- Check ResultServer is receiving data correctly
- Verify form submission includes monitoring data
- Check browser console for form data

### Issue: Dashboard Shows N/A for All Scores
**Symptom**: Teacher dashboard displays "N/A" for cheat scores
**Solutions**:
- Verify `monitoring_enabled` field in database
- Check API response includes new fields
- Refresh page and clear browser cache

---

## ✅ Final Validation Checklist

- [ ] Database schema updated with new fields
- [ ] All 5 servers started without errors
- [ ] Student can grant monitoring permission
- [ ] Anomalies are detected and logged
- [ ] Cheat scores calculated correctly
- [ ] Combined scores reflect both AI and behavioral
- [ ] Risk levels displayed with correct colors
- [ ] Teacher dashboard shows all monitoring data
- [ ] Anomaly details expand/collapse correctly
- [ ] System works without monitoring enabled
- [ ] Multiple concurrent students monitored correctly
- [ ] No data leakage between students
- [ ] Results stored in database correctly
- [ ] ResutServer returns all new fields in API
- [ ] Frontend displays all data without errors
- [ ] Timestamps formatted correctly
- [ ] Performance acceptable (<2sec per submission)

---

## 📈 Metrics to Track

After testing completion, document:

1. **Detection Accuracy**
   - True positives (actual violations detected)
   - False positives (normal behavior flagged)
   - False negatives (violations missed)

2. **Performance**
   - Average frame processing time: ___ ms
   - Average API response time: ___ ms
   - Peak memory usage: ___ MB
   - Database write time: ___ ms

3. **User Experience**
   - Permission grant success rate: ___%
   - Monitoring failure rate: ___%
   - Test completion rate: ___%

4. **Data Quality**
   - Tests with monitoring enabled: ___
   - Average anomalies per test: ___
   - Average cheat score: ___
   - Risk level distribution:
     - LOW: ___%
     - MODERATE: ___%
     - MEDIUM: ___%
     - HIGH: ___%
     - CRITICAL: ___%

---

## 🎯 Success Criteria

✅ **Functional Success**:
- All anomaly types detected correctly
- Scores calculated accurately
- Dashboard displays data clearly
- No system errors or crashes

✅ **Performance Success**:
- Frame processing < 500ms
- API response < 200ms
- Memory usage stable
- Handles 10+ concurrent tests

✅ **User Experience Success**:
- Permission workflow intuitive
- Monitoring active indication clear
- Results display informative
- No excessive false positives

✅ **Data Integrity Success**:
- No data loss between students
- Results stored completely
- Audit trail preserved
- Privacy requirements met

---

## 📝 Test Report Template

```
AI MONITOR INTEGRATION TEST REPORT
Date: [DATE]
Tester: [NAME]

OVERALL STATUS: [PASS/FAIL]

Scenarios Tested:
- Scenario 1 (Basic Flow): [PASS/FAIL]
- Scenario 2 (Phone Detection): [PASS/FAIL]
- Scenario 3 (Multiple People): [PASS/FAIL]
- Scenario 4 (Gaze Tracking): [PASS/FAIL]
- Scenario 5 (Tab Switching): [PASS/FAIL]
- Scenario 6 (Dashboard): [PASS/FAIL]
- Scenario 7 (Risk Levels): [PASS/FAIL]
- Scenario 8 (No Permission): [PASS/FAIL]
- Scenario 9 (Permission Denial): [PASS/FAIL]
- Scenario 10 (Concurrent): [PASS/FAIL]

Issues Found:
1. [ISSUE]: [DESCRIPTION]
   Severity: [Critical/High/Medium/Low]
   Status: [Open/Fixed/Workaround]

Performance Metrics:
- Frame processing: ___ ms
- API response: ___ ms
- Memory peak: ___ MB

Recommendations:
- [RECOMMENDATION 1]
- [RECOMMENDATION 2]

Approved By: [NAME]
```

---

**Last Updated**: March 17, 2026
**Status**: Ready for Testing
