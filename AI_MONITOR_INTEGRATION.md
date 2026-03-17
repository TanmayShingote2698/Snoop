# Snoop AI Monitor Integration Guide

## Overview

The AI Monitor integration adds real-time proctoring capabilities to the Snoop examination system. It uses computer vision and audio analysis to detect suspicious anomalies during student tests and converts them into a comprehensive "cheat score".

## Architecture

### Components

#### 1. **Client-Side Monitoring** (`SnoopMonitor.js`)
- Requests camera and microphone permissions
- Captures video frames at regular intervals
- Sends frames to backend for AI analysis
- Tracks monitoring session state
- Handles anomaly notifications

#### 2. **Backend Monitoring Service** (`monitoring_service.py`)
- Manages individual monitoring sessions
- Runs AI models on video frames:
  - YOLOv8 for object detection
  - MTCNN for face detection
  - MediaPipe for gaze tracking
- Logs anomalies to persistent storage
- Calculates cheat scores

#### 3. **Cheat Score Calculator** (`cheat_score_calculator.py`)
- Combines behavioral violations with AI anomalies
- Generates risk levels and detailed reports
- Provides scoring breakdown for analysis

#### 4. **Test Taking Page Integration** (`takeTestByStudent.ejs`)
- Displays permission request overlay
- Handles monitoring permission workflow
- Collects monitoring data during test
- Submits combined scores with test results

#### 5. **Test Submission Handler** (`student.js`)
- Receives AI monitor data from form
- Parses anomalies and monitoring statistics
- Combines integrity score with cheat score
- Sends comprehensive scoring to ResultServer

## Detected Anomalies

### AI-Based Anomalies

| Anomaly Type | Weight | Description |
|--------------|--------|-------------|
| `phone_detected` | 20 | Student has a phone visible |
| `multiple_persons_detected` | 18 | Multiple people detected in frame |
| `no_face_detected` | 15 | Student's face not visible |
| `laptop_detected` | 12 | Laptop found in frame |
| `book_detected` | 8 | Physical book visible |
| `gaze_away_from_screen` | 8 | Eyes looking away from screen |
| `gaze_looking_left` | 5 | Lateral eye movement detected |
| `gaze_looking_right` | 5 | Lateral eye movement detected |
| `gaze_down` | 3 | Eyes looking downward |

### Behavioral Anomalies

| Violation Type | Weight | Description |
|----------------|--------|-------------|
| Tab switching | 8 | Student left exam tab |
| Fullscreen exit | 15 | Fullscreen mode abandoned |
| Prohibited key press | 6 | Function keys, Alt, Ctrl pressed |
| Mouse leave | 5 | Cursor left browser window |
| Window blur | 5 | Lost browser focus |

## Cheat Score Calculation

### Score Ranges

```
0-20   : LOW RISK        - Minimal anomalies detected
21-40  : MODERATE RISK   - Some concerning behavior
41-60  : MEDIUM RISK     - Notable violations present
61-80  : HIGH RISK       - Multiple serious violations
81-100 : CRITICAL RISK   - Severe cheating indicators
```

### Scoring Formula

```
Final Cheat Score = (AI_Anomalies × 0.6) + (Behavioral_Violations × 0.4)

Where:
  - AI_Anomalies: Score from detected video/audio anomalies (0-50)
  - Behavioral_Violations: Score from detected behavioral violations (0-50)
```

### Implementation

The score is calculated by:

1. **Behavioral Score**: Count violations, apply weights
   - Tab switches: 8 pts each
   - Fullscreen exits: 15 pts each
   - Action violations: 5 pts each
   - Max cap: 50 pts

2. **Anomaly Score**: Count anomalies, apply weights and confidence adjustment
   - Each anomaly type has a weight (3-20 pts)
   - Multiplied by detection confidence (0-1)
   - Aggregated by type
   - Max cap: 50 pts

3. **Combined Score**: Weighted average using 60% AI, 40% behavioral

## Data Flow

### During Test

```
1. Student Grants Permission
   ↓
2. SnoopMonitor.requestPermissions() - Camera/Mic access
   ↓
3. snoopMonitor.startMonitoringSession() - Backend session starts
   ↓
4. Continuous frame capture (every 2 seconds)
   ↓
5. Each frame sent to /api/monitoring/analyze_frame
   ↓
6. Backend runs AI models, detects anomalies
   ↓
7. Anomalies logged in memory & on disk
   ↓
8. Student completes test
```

### On Submission

```
1. Test form collected with answers
   ↓
2. snoopMonitor.stopMonitoring() called
   ↓
3. /api/monitoring/end_session calculates cheat score
   ↓
4. anomalyData, cheatScore, monitoringStats added to form
   ↓
5. Form submitted to /student/submitTest
   ↓
6. Backend combines scores:
   - Integrity score (100 - behavioral violations)
   - Cheat score (AI + behavioral)
   - Combined score (weighted average)
   ↓
7. All data sent to ResultServer for storage
```

## Student Experience

### Permission Request Flow

1. **Initial Overlay** (Before fullscreen)
   ```
   "AI Proctoring System"
   - Camera & Microphone required
   - Privacy assurance message
   - [Grant Permission & Start] [Proceed Without]
   ```

2. **Permission Grant**
   - Browser requests device access
   - Student clicks "Allow"
   - Monitoring starts automatically

3. **Active Monitoring**
   - Status bar shows: "🔴 MONITORING ACTIVE - Camera and Mic Recording"
   - Positioned top-right, always visible
   - Updates with different states

4. **Anomaly Detection**
   - Toast/notification for critical anomalies
   - Logged but non-intrusive
   - Summary provided at submission

## API Endpoints

### Start Session
**POST** `/api/monitoring/start_session`

Request:
```json
{
  "session_id": "test-123-student@email-timestamp",
  "test_id": "TEST-001",
  "student_email": "student@university.edu"
}
```

Response:
```json
{
  "status": "success",
  "session_id": "test-123-student@email-timestamp",
  "message": "Monitoring session started"
}
```

### Analyze Frame
**POST** `/api/monitoring/analyze_frame`

Request:
```json
{
  "session_id": "test-123-student@email-timestamp",
  "frame_data": "base64-encoded-jpg-data"
}
```

Response:
```json
{
  "status": "success",
  "anomalies_detected": 2,
  "anomalies": [
    {
      "type": "phone_detected",
      "confidence": 0.95,
      "timestamp": "2026-03-17T10:30:45"
    },
    {
      "type": "gaze_looking_right",
      "confidence": 0.90,
      "timestamp": "2026-03-17T10:30:45"
    }
  ],
  "frame_number": 145
}
```

### End Session
**POST** `/api/monitoring/end_session`

Request:
```json
{
  "session_id": "test-123-student@email-timestamp"
}
```

Response:
```json
{
  "status": "success",
  "session_id": "test-123-student@email-timestamp",
  "cheat_score": 42.5,
  "anomaly_breakdown": {
    "phone_detected": 1,
    "gaze_away_from_screen": 3,
    "no_face_detected": 2
  },
  "total_anomalies": 6,
  "total_frames": 145,
  "test_id": "TEST-001",
  "student_email": "student@university.edu"
}
```

## Form Data Submitted

The test submission now includes:

```javascript
{
  // ... existing fields (email, testID, qna, etc.)
  
  // AI Monitoring Data
  cheatScore: 42.5,
  anomalyData: [
    {type: "phone_detected", confidence: 0.95, timestamp: "..."},
    // ...
  ],
  monitoringStats: {
    sessionId: "test-123-...",
    framesCaptured: 145,
    anomaliesDetected: 6,
    cheatScore: 42.5,
    anomalyBreakdown: {...}
  }
}
```

## Backend Integration

### Modified Student Router

The `/student/submitTest` route now:

1. Parses new form fields
2. Combines integrity score with cheat score
3. Sends to ResultServer with enhanced data structure

```javascript
{
  response: {
    testID: "TEST-001",
    studentEmail: "student@university.edu",
    qna: [...],
    integrity: 75,
    cheatScore: 42.5,
    combinedCheatScore: 55.5,
    anomalyData: [...],
    monitoringStats: {...},
    tabSwitchData: [...],
    fullscreenData: [...],
    actionLogs: [...]
  }
}
```

### ResultServer Enhancements Required

To fully leverage the monitoring data:

1. Store `cheatScore` and `combinedCheatScore` in results table
2. Create `anomaly_logs` table for detailed anomaly records
3. Add `monitoring_enabled` flag to indicate if monitoring was active
4. Update dashboard to display cheat scores alongside integrity scores
5. Add filters to view results by risk level

## Configuration

### Frame Capture Settings

Located in `SnoopMonitor.js` constructor:

```javascript
{
  frameInterval: 2000,        // ms between frame captures (default: 2 seconds)
  frameQuality: 0.7,          // JPEG compression quality (0-1)
  canvasWidth: 640,           // Frame resolution width
  canvasHeight: 480,          // Frame resolution height
  apiBaseUrl: '/api'          // Backend API base URL
}
```

### AI Model Settings

Located in `AIMonitor/config.py`:

```python
YOLO_CONFIDENCE_THRESHOLD = 0.50          # Object detection sensitivity
MTCNN_MIN_FACE_SIZE = 40                 # Minimum face size to detect
GAZE_AWAY_DURATION_THRESHOLD = 3.0       # Seconds before gaze anomaly
AUDIO_ANOMALY_DURATION = 2.0             # Seconds before audio anomaly
```

## Troubleshooting

### Unable to Request Permissions

**Issue**: "Permission denied" error when trying to access camera

**Solutions**:
- Ensure HTTPS is used (required for device access)
- Check browser permissions in settings
- Device may not have camera/microphone
- Browser may require manual permission confirmation

### No Anomalies Detected

**Issue**: Monitor is active but not detecting any anomalies

**Possible causes**:
- Student is genuinely following test rules
- Light conditions poor for face detection
- Camera angle not capturing full frame
- Models not properly initialized

**Debugging steps**:
1. Check browser console for errors
2. Verify frames are being sent (Network tab)
3. Check `anomaly_log.json` for backend logs
4. Verify YOLO model file exists: `AIMonitor/yolov8n.pt`

### High False Positive Rate

**Issue**: Too many anomalies detected that aren't actually problematic

**Solutions**:
- Adjust confidence thresholds in `config.py`
- Increase frame interval (capture less frequently)
- Review specific anomaly types triggering false positives
- Improve lighting conditions or camera positioning

## Privacy & Data Handling

### Data Collection

- Video frames NOT stored - only analyzed and discarded
- Anomalies logged with timestamps for audit
- Audio processed but not recorded (only sound levels analyzed)
- Session data cleared after submission

### Privacy Controls

- Student can opt-out of monitoring
- Camera/microphone access requires permission
- No face data stored permanently
- Compliance with GDPR/FERPA standards

### Data Retention

- Anomaly logs retained per institutional policy
- Test results retained per exam retention schedule
- Video frames deleted after analysis (not stored)
- Monitoring sessions purged after 30 days

## Future Enhancements

1. **Multi-proctoring**: Allow human proctors to observe live
2. **Behavioral ML**: Machine learning model for behavior patterns
3. **Audio Analysis**: Speech detection for collaboration attempts
4. **Screen Recording**: Optional secure recording of desktop
5. **AR Liveness**: Additional biometric verification
6. **Predictive Analytics**: Flag probable cheaters before submission

## Support & Documentation

For issues or questions:

1. Check logs: `src/AIMonitor/anomaly_log.json`
2. Review console output: Browser DevTools → Console tab
3. Check backend logs: `logs/monitoring.log`
4. Consult AIMonitor documentation: `src/AIMonitor/monitoring_pipeline.py`

## Files Modified/Created

### New Files
- `src/BackendServer/public/js/SnoopMonitor.js` - Client monitoring library
- `src/AIMonitor/monitoring_service.py` - Backend monitoring service
- `src/AIMonitor/cheat_score_calculator.py` - Score calculation logic

### Modified Files
- `src/BackendServer/views/layout.ejs` - Added SnoopMonitor script
- `src/BackendServer/views/takeTestByStudent.ejs` - Added monitoring UI & handlers
- `src/BackendServer/routers/student.js` - Enhanced form submission
- `src/BackendServer/views/layout.ejs` - Added monitoring status styles

## Testing Checklist

- [ ] Permission request overlay appears
- [ ] "Grant Permission" button starts monitoring
- [ ] Status bar shows "MONITORING ACTIVE"
- [ ] Frames captured and sent to backend
- [ ] Frames with phone detected trigger alerts
- [ ] Multiple people detection works
- [ ] Gaze tracking functional
- [ ] Face detection working
- [ ] Anomalies logged to JSON
- [ ] Monitoring stops on test completion
- [ ] Cheat score calculated
- [ ] Data submitted with form
- [ ] No errors in browser console
- [ ] Backend logs show frame analysis
- [ ] Results stored with cheat score
