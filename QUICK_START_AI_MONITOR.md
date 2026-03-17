# AI Monitor Integration - Quick Start Guide

## ✅ What's Been Integrated

The Snoop system now includes comprehensive AI-powered proctoring that monitors students for suspicious activity during exams. Here's what was added:

### 1. **Client-Side Monitoring** (`SnoopMonitor.js`)
- Captures camera and microphone data from students' browsers
- Sends frames to backend for AI analysis every 2 seconds
- Displays monitoring status and alerts
- Collects cheat score from backend

### 2. **Backend AI Service** (`monitoring_service.py`)
- Analyzes video frames using YOLOv8, MTCNN, and MediaPipe
- Detects:
  - Suspicious objects (phones, books, extra laptops)
  - Multiple people in frame
  - Face visibility issues
  - Gaze direction (looking away from screen)
  - Audio anomalies
- Logs all anomalies for audit trail
- Calculates raw cheat scores

### 3. **Cheat Score System** (`cheat_score_calculator.py`)
- Converts anomalies into quantified risk scores (0-100)
- Combines AI detection with behavioral violations
- Generates risk levels: LOW, MODERATE, MEDIUM, HIGH, CRITICAL
- Provides detailed breakdowns for analysis

### 4. **Test Page Integration**
- Permission request overlay asking for camera/microphone access
- "Grant Permission & Start" button to activate monitoring
- Option to proceed without monitoring
- Live monitoring status indicator during test
- Automatic data collection on submission

### 5. **Score Submission**
- AI cheat scores included in test submissions
- New fields: `cheatScore`, `anomalyData`, `monitoringStats`
- Backend combines AI scores with behavioral integrity scores
- All data stored for results analysis

## 🚀 How It Works

### For Students

1. **Start Test** → Student clicks "Enter Fullscreen & Start"
2. **Permission Request** → AI Monitor overlay asks for camera/mic permission
3. **Grant Permission** → Student clicks "Grant Permission & Start"
4. **Take Exam** → System monitors throughout test
   - Status bar shows "🔴 MONITORING ACTIVE"
   - Frames analyzed in background
   - Alerts if critical anomalies detected
5. **Submit Test** → Monitoring stops automatically
   - Cheat score calculated
   - Data included with submission
6. **Results** → Exam results now include:
   - Integrity Score (behavioral)
   - Cheat Score (AI-based)
   - Combined Risk Level

### For Teachers

Teachers can now see in results:
- **Integrity Score**: Based on behavioral violations (100 = clean)
- **Cheat Score**: Based on AI anomalies (0 = clean, 100 = severe)
- **Risk Level**: LOW/MODERATE/MEDIUM/HIGH/CRITICAL
- **Anomaly Breakdown**: Specific violations detected
- **Monitoring Stats**: Number of frames analyzed, etc.

## 📋 Detected Anomalies

### AI-Detected
- 📱 **Phone detected** (Weight: 20) - Highest severity
- 👥 **Multiple people** (Weight: 18)
- 😶 **No face detected** (Weight: 15)
- 💻 **Laptop detected** (Weight: 12)
- 📚 **Book visible** (Weight: 8)
- 👀 **Gaze away from screen** (Weight: 8)
- 👈 **Looking left** (Weight: 5)
- 👉 **Looking right** (Weight: 5)

### Behavioral (Already Existing)
- Tab switching
- Fullscreen exit
- Prohibited key presses (F12, Alt+Tab, etc.)
- Mouse leaving window

## 📊 Score Example

```
Student takes test:
- AI detects phone once (20 pts)
- AI detects gaze away twice (16 pts)
- 1 tab switch detected (10 pts from behavioral)
- Integrity score: 85 (from behavioral violations)

Calculation:
- AI anomaly score: 20 + 16 = 36/50 = 72%
- Behavioral score: 10/50 = 20%
- Weighted: (72% × 0.6) + (20% × 0.4) = 52.8/100
- Final cheat score: 52.8 (MEDIUM RISK)
```

## ⚙️ Configuration Options

### Frame Capture Frequency
File: `src/BackendServer/public/js/SnoopMonitor.js`
```javascript
frameInterval: 2000  // Every 2 seconds (change to 1000 for 1 sec, etc.)
```

### Detection Sensitivity
File: `src/AIMonitor/config.py`
```python
YOLO_CONFIDENCE_THRESHOLD = 0.50  # Lower = more detections
MTCNN_MIN_FACE_SIZE = 40          # Detection sensitivity
```

### Score Weights
File: `src/AIMonitor/cheat_score_calculator.py`
- Modify `ANOMALY_WEIGHTS` dictionary to adjust anomaly severity
- Modify `BEHAVIORAL_WEIGHTS` dictionary for behavioral violations

## 🔐 Privacy & Security

✅ **What's Protected:**
- Video frames are analyzed but NOT stored
- Only anomaly data and timestamps logged
- Camera/mic access requires explicit permission
- Audio processed in real-time, not recorded
- Session data automatically cleaned after use

⚠️ **Student Options:**
- Can choose "Proceed Without Monitoring" (will note lower score reliability)
- Can opt-out of specific features (pending policy)
- Privacy notice shown in permission overlay

## 🧪 Testing the Integration

### Quick Test
1. Take a test yourself
2. Grant camera/microphone permission
3. During test, hold up a phone to camera
4. Verify "phone_detected" alert appears
5. Submit test and check results for cheat score

### Testing Specific Anomalies
- **Phone detection**: Hold phone in frame
- **Multiple people**: Have someone stand behind student
- **Face detection issue**: Look away from camera
- **Gaze tracking**: Move eyes drastically while looking at screen

### Debugging
1. Open browser DevTools (F12 on Windows)
2. Go to Console tab
3. Look for "[SnoopMonitor]" logs
4. Check Network tab to see frame uploads
5. Backend logs: `src/AIMonitor/anomaly_log.json`

## 📈 Next Steps

### For Full Implementation

1. **Integrate with ResultServer**
   - Modify result storage to include `cheat_score` and `combined_score` fields
   - Store `anomaly_logs` separately for audit
   - Update results query endpoints

2. **Update Dashboard**
   - Show cheat scores in test results
   - Add filters/sorting by risk level
   - Display anomaly breakdowns
   - Create analytics graphs

3. **Teacher Interface Enhancements**
   - Risk level badges (🟢 LOW, 🟡 MEDIUM, 🔴 HIGH)
   - Anomaly details view
   - Timeline of violations
   - Bulk export with scores

4. **Student Result Display**
   - Show students their cheat scores (optional)
   - Explain what anomalies were detected
   - Educational context about violations

5. **API Endpoints** (If exposing)
   - GET `/api/results/:studentEmail` - including scores
   - GET `/api/anomalies/:testId` - detailed anomaly report
   - POST `/api/flag-cheating/:testId` - teacher flagging

### Optional Enhancements

- [ ] Live monitoring dashboard for teachers
- [ ] Automated cheating flags for high scores
- [ ] Machine learning model for pattern detection
- [ ] Screen recording (high privacy concern)
- [ ] AR liveness verification
- [ ] Historical anomaly patterns per student

## 🚨 Important Notes

### GDPR/Privacy Compliance
- Students must consent to monitoring
- Clear disclosure of what's being monitored
- Data retention policies must be defined
- May need legal/institutional review

### False Positives
- System may flag innocent activities
- Manual review by teachers recommended for high scores
- Can adjust thresholds if too sensitive
- Monitor rate and adjust over time

### Performance Considerations
- Monitoring adds bandwidth (frame uploads every 2 sec)
- Backend processing load depends on model hardware
- Test with expected concurrent user count
- May need optimization for large classes

## 📞 Support

For issues:
1. Check browser console (F12) for errors
2. Verify camera/mic permissions granted
3. Check internet connectivity (frames require upload)
4. Review logs in `anomaly_log.json`
5. Consult `AI_MONITOR_INTEGRATION.md` for detailed docs

---

**Integration Date**: March 2026
**Status**: ✅ Ready for Testing
**Last Updated**: March 17, 2026
