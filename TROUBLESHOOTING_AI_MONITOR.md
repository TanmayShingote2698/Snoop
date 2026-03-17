# AI Monitor Testing - Troubleshooting Guide

## 🔴 Critical Issues

### ❌ Database Migration Failed: "Column Already Exists"
**Error Message**: `ERROR: column "cheat_score" of relation "result" already exists`

**Cause**: Migration already ran, or columns added manually

**Solution**:
```sql
-- Check if columns already exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'result' 
AND column_name IN ('cheat_score', 'combined_score', 'risk_level', 
                     'monitoring_enabled', 'anomaly_data', 'monitoring_stats');

-- If they exist, skip migration and proceed with testing
-- If they don't exist, run migration again (error was false alarm)
```

---

### ❌ "monitoring_service.py Not Found" Error
**Error**: `ModuleNotFoundError: No module named 'src.AIMonitor.monitoring_service'`

**Cause**: Module not created from Phase 1

**Solution**:
```bash
# Verify file exists
ls src/AIMonitor/monitoring_service.py

# If it exists, add to PYTHONPATH
set PYTHONPATH=%PYTHONPATH%;c:\Users\lenovo\OneDrive\Desktop\Snoop system\Snoop

# If not, create from backup:
# Contact system admin for Phase 1 implementation files
```

---

### ❌ "YOLO Model Not Found"
**Error**: `FileNotFoundError: [Errno 2] No such file or directory: 'yolov8n.pt'`

**Cause**: Model file missing from AIMonitor folder

**Solution**:
```bash
# Download YOLO model
cd src/AIMonitor
# Option 1: From Python (if ultralytics installed):
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

# Option 2: Direct download (if ultralytics not installed):
# Download from: https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8n.pt
# Place in: src/AIMonitor/yolov8n.pt

# Verify
ls -la yolov8n.pt
# Should show file size ~6.3 MB
```

---

### ❌ All Anomaly Scores are 0
**Symptom**: Monitoring runs, but `cheat_score` always 0, even with phone in frame

**Diagnostic**:
1. Check ResultServer logs:
```bash
# Look for this line:
# "[Suite] Test [ID] - Student [email]: Integrity X%, Cheat 0, Combined 0, Risk LOW"
```

2. Check Browser Console (F12 → Console):
```javascript
// Should see these logs:
// "[FRAME UPLOAD] Sending frame batch [X] with [Y] frames"
// "[ANOMALY DETECTED] suspicious_object_detected"
// "[ANOMALY DETECTED] gaze_away_from_screen"
```

**Common Causes**:

**Issue A: Frames Not Uploading**
- Browser console shows no "[FRAME UPLOAD]" messages
- Solution:
  ```javascript
  // In browser console, check:
  snoopMonitor.isMonitoring()  // Should be true
  snoopMonitor.frameCount      // Should increase every 2 seconds
  snoopMonitor.frameBuffer.length  // Should show pending frames
  
  // If frameCount not increasing:
  // 1. Browser may have blocked canvas access
  // 2. Microphone granted but camera denied
  // Solution: Reload page, click "Grant Permission" again, check browser privacy
  ```

**Issue B: Frames Uploading but No Anomalies Detected**
- Network tab shows POST to `/api/monitoring/analyze_frame` → 200 OK
- But backend logs show "no_anomalies_detected"
- Solution:
  ```
  1. Insufficient lighting: Move to brighter area or use lamp
  2. Camera resolution too low: Check camera device settings
  3. Object too small: Move phone/face closer to camera
  4. YOLO model loading failed: Check Python console for errors
  5. Test with ACTUAL phone (not screenshot): Hold real smartphone
  
  Quick test: Try these in order:
  - Hold phone 6 inches from camera (bright area)
  - Tilt head significantly left/right (gaze detection)
  - Let another person visible in frame (multiple people)
  ```

**Issue C: Anomalies Detected but Score Still 0**
- Console shows "[ANOMALY DETECTED]" messages
- But ResultServer shows "Cheat 0"
- Solution:
  ```bash
  # Check score calculation in monitoring_service.py:
  # Anomaly points:
  # - phone_detected: 20 points
  # - multiple_people: 18 points
  # - gaze_away_from_screen: 8 points
  # - looking_left/right: 5 points each
  
  # If detection happens but score is 0, check:
  # 1. anomalyData format is correct in form submission
  # 2. ResultServer's calculate_risk_level() is being called
  # 3. Database column accepts DECIMAL(5,2) values
  
  # Verify in browser DevTools → Network tab:
  # POST /student/submitTest
  # Form data should include:
  # cheatScore=25&anomalyData=[...]&monitoringStats={...}
  ```

---

## 🟠 Major Issues

### ⚠️ Permission Overlay Doesn't Appear
**Symptom**: Click "Create Test", no permission overlay shown

**Cause**: SnoopMonitor.js not loaded or initialization failed

**Solution**:
1. Check browser console for errors:
   ```javascript
   // DevTools F12 → Console
   // Should see: "[SnoopMonitor] Initializing monitoring system"
   // If not, check: takeTestByStudent.ejs includes SnoopMonitor.js
   ```

2. Verify script is loaded:
   ```javascript
   // In console type:
   typeof SnoopMonitor  // Should return "function"
   snoopMonitor instanceof SnoopMonitor  // Should be true
   ```

3. If undefined, check layout.ejs:
   ```html
   <!-- Should contain: -->
   <script src="/js/SnoopMonitor.js"></script>
   ```

4. Clear browser cache (Ctrl+Shift+Delete):
   - Cache → "All time"
   - Check: "Cookies and other site data"
   - Click Clear

---

### ⚠️ "Permission Denied" Error Immediately
**Symptom**: Browser asks for permission, but immediately shows error

**Cause**: Browser privacy settings or HTTPs required

**Solution**:
```bash
# Option 1: Use Chrome (most reliable)
# Settings → Privacy → Sites → Manage
# Add localhost:3000 to camera/microphone whitelist

# Option 2: Use Firefox
# about:preferences → Privacy
# Permissions → Camera/Microphone
# Block localhost:3000, then Unblock and Allow

# Option 3: Use Edge (secure contexts)
# Settings → Privacy → Manage permissions
# Camera/Microphone → Add localhost:3000

# Option 4: Use HTTPS in production
# Development: HTTP ok on localhost
# Production: Must use HTTPS
```

---

### ⚠️ Permission Granted But Monitoring Never Starts
**Symptom**: "Grant Permission & Start" clicked, permission popup shown, but status stays 🟢 "MONITORING READY"

**Cause**: Frame capture failed to initialize

**Solution**:
```javascript
// In browser console, debug:
snoopMonitor.startMonitoring()  // Call manually
// Watch for errors in console

// Common errors:
// 1. "getUserMedia is not defined" → Browser doesn't support
// 2. "Permission denied" → User clicked "Don't Allow"
// 3. "NotFoundError: Requested device not found" → No camera attached
// 4. "NotAllowedError" → Another app using camera
```

**Try**:
- Restart browser
- Check if another app using camera (Zoom, Teams, etc.) → Close it
- Try different browser
- Disconnect and reconnect camera

---

### ⚠️ Teacher Dashboard Shows "N/A" for All Scores
**Symptom**: Results table has columns but all show "N/A"

**Cause A**: Database columns not added
```sql
-- Verify migration ran:
SELECT cheat_score, combined_score, risk_level
FROM result LIMIT 1;
-- If error "column doesn't exist" → Run migration
```

**Cause B**: Old data in database (before migration)
```javascript
// New tests will have values
// Old tests will show N/A (expected)
// Create a NEW test to verify migration worked
```

**Cause C**: API not returning new fields
```bash
# Check API response:
curl -X POST http://127.0.0.1:200/getTestResult \
  -d "testID=YOUR_TEST_ID" \
  -H "Content-Type: application/x-www-form-urlencoded"

# Response should include:
# "cheat_score": 0,
# "combined_score": 0,
# "risk_level": "LOW",
# etc.

# If missing, re-deploy server.py changes:
# 1. Stop ResultServer
# 2. Verify getTestResult endpoint has new fields
# 3. Restart ResultServer
```

---

### ⚠️ Anomalies Detected but Details Won't Expand
**Symptom**: "View Anomalies" button appears but clicking does nothing

**Cause**: JavaScript toggle function not loaded

**Solution**:
1. Check browser console for errors:
   ```bash
   # F12 → Console
   # Should see: "DOM content loaded, anomaly rows ready"
   # Or similar message
   ```

2. Verify function is defined:
   ```javascript
   // In console:
   typeof toggleAnomalyDetails  // Should be "function"
   ```

3. Check HTML has correct structure:
   ```html
   <!-- Should have elements like: -->
   <button onclick="toggleAnomalyDetails(0)">View Anomalies</button>
   <tr id="anomaly-details-0">...</tr>
   ```

4. If function not found, reload teacherResultDetails.ejs

---

## 🟡 Minor Issues

### ⚠️ Frames Uploading Very Slowly
**Symptom**: Monitoring active but only 1-2 frames per 10 seconds

**Cause**: Network latency or server overload

**Solution**:
```javascript
// Increase frame interval in SnoopMonitor.js:
// Change frameInterval: 2000 → 3000 (milliseconds)
// Reduces load from 30 frames/min to 20 frames/min

// Or reduce quality:
// Change canvas.toDataURL('image/jpeg', 0.5)
// Reduces data size from ~50KB to ~15KB per frame
```

**Check Network**:
- Open DevTools → Network tab
- Filter by XHR
- Each frame upload should be <2 seconds
- If >5 seconds, network is congested

---

### ⚠️ High CPU Usage on Backend
**Symptom**: Python process using 80%+ CPU

**Cause**: Processing frames too fast or model optimization

**Solution**:
```bash
# Option 1: Reduce frame rate
# Increase frameInterval from 2000ms to 3000ms

# Option 2: Skip frames
# Process every 2nd frame instead of every frame

# Option 3: Use lighter model
# Change from yolov8n.pt to yolov8n.pt (nano model)
# Already using nano, can't go lighter

# Option 4: Enable GPU acceleration (if NVIDIA GPU available)
# Edit config.py:
device = 'cuda' instead of 'cpu'
```

---

### ⚠️ Cheat Score Sometimes Increases Gradually
**Symptom**: Student does nothing wrong but score slowly increases to 5-10

**Cause**: Gaze detection sensitivity or lighting conditions

**Solution**:
```python
# In monitoring_service.py, adjust gaze confidence threshold:
# Change: if confidence > 0.6:
# To: if confidence > 0.8:
# (Higher threshold = fewer false positives)

# Or adjust gaze angle threshold:
# Change: if abs(gaze_angle) > 30 degrees
# To: if abs(gaze_angle) > 45 degrees
```

---

### ⚠️ Multiple People Detection Too Sensitive
**Symptom**: Sometimes detects 2 people when only 1 in frame

**Cause**: Model detecting objects in background (poster, photo)

**Solution**:
```python
# In monitoring_service.py, check confidence:
# faces = detector.detect_faces(frame)
# Add: if confidence > 0.85: (increased threshold)

# Or filter by face area:
# if bbox_area > (frame_width * frame_height * 0.1):
#     (only count significant faces)
```

---

### ⚠️ Dashboard Slow When Viewing Many Results
**Symptom**: ResultDetails page takes 5+ seconds to load

**Cause**: Rendering large anomaly arrays or N+1 queries

**Solution**:
```sql
-- If database query is slow:
-- Add index on test_id for faster lookups
CREATE INDEX idx_result_test_id ON result(test_id);

-- Or limit displayed results:
-- In teacherResultDetails.ejs, show only 5 anomalies
-- with "and X more" message
```

---

## 🟢 Performance Issues

### ✓ Optimize Frame Processing
If processing < 200ms per frame (good):
- ✅ No changes needed
- Keep current settings

If processing 200-500ms (acceptable):
- ⚠️ Monitor, optimize if needed
- Reduce model complexity

If processing > 500ms (slow):
- 🔴 Optimize immediately
- Reduce frame resolution
- Increase frame interval
- Use GPU acceleration

---

## 📋 Support Community

### Getting Help
1. **Check logs** → Most issues visible in console output
2. **Check this guide** → 90% of issues covered above
3. **Check browser DevTools** (F12):
   - Console: JavaScript errors
   - Network: API response status/timing
   - Application: Local storage/cookies
4. **Restart services** → Often fixes transient issues

### Collecting Debug Info
When reporting issue, provide:
1. Browser console screenshot (F12 → Console)
2. Network tab screenshot (F12 → Network tab)
3. Server console output (terminal window)
4. Database query result (if schema issue)
5. Steps to reproduce
6. Expected vs actual behavior

---

## 🔍 Advanced Debugging

### Enable Verbose Logging
```python
# In monitoring_service.py, add:
import logging
logging.basicConfig(level=logging.DEBUG)

# Now you'll see:
# DEBUG: Frame received: 640x480, jpeg quality 0.8
# DEBUG: YOLO model processing...
# DEBUG: Detected 1 object: phone (0.95 confidence)
# DEBUG: Anomaly score: 20 points
```

### Capture Raw Frame for Analysis
```python
# In analyze_frame() function:
# Save problematic frames for manual inspection
import cv2
cv2.imwrite(f'debug_frame_{timestamp}.jpg', frame)

# Then analyze manually:
# Was object really detected?
# Was confidence score correct?
# Is model working as expected?
```

### Test Model Independently
```python
# Test YOLO without web service:
from ultralytics import YOLO
from PIL import Image

model = YOLO('yolov8n.pt')
image = Image.open('test_image.jpg')
results = model(image)

# Check detections
for detection in results[0].boxes:
    print(f"Object: {detection.cls}, Confidence: {detection.conf}")
```

---

**Status**: Comprehensive Troubleshooting Guide
**Last Updated**: March 17, 2026
**Coverage**: 30+ issues and solutions
