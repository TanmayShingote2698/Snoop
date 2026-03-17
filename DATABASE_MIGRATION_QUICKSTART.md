# Database Migration & Pre-Testing Checklist

## 🚀 Quick Start (5 minutes)

### Step 1: Migrate Database Schema
1. Go to **Supabase Dashboard** → Your Project → SQL Editor
2. Run this script:
```sql
-- Add monitoring columns to result table
ALTER TABLE result
ADD COLUMN IF NOT EXISTS monitoring_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cheat_score DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS combined_score DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'LOW',
ADD COLUMN IF NOT EXISTS anomaly_data JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS monitoring_stats JSONB DEFAULT '{}'::jsonb;

-- Verify columns were added
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'result' AND column_name LIKE '%monitoring%'
OR column_name LIKE '%cheat%' OR column_name LIKE '%combined%'
OR column_name LIKE '%risk%' OR column_name LIKE '%anomaly%';
```

3. Should see 6 rows in result (the new columns)

### Step 2: Start All Services
```bash
# Open PowerShell in workspace root
cd "c:\Users\lenovo\OneDrive\Desktop\Snoop system\Snoop"

# Run all servers
.\start_all_servers.bat

# Watch for messages:
# ✓ Backend Server running on port 3000
# ✓ ResultServer running on port 200
# ✓ TestServer running on port 100
# ✓ AuthServer running on port 300
# ✓ AIMonitor listening (monitoring_service.py)
```

### Step 3: Verify Configuration
Check that config files are in place:
- ✅ `src/AIMonitor/config.py` - AI model settings
- ✅ `src/AIMonitor/yolov8n.pt` - YOLO model file
- ✅ All Python servers have monitoring imports

### Step 4: Open Application
- Navigate to: `http://127.0.0.1:3000`
- Login as a student test account

---

## 🧪 5-Minute Quick Test

### Test A: Basic Monitoring (Must Pass)
1. Create/Select a quick test
2. Click "Grant Permission & Start"
3. Allow camera/microphone
4. Wait 5 seconds (monitoring should be active)
5. Answer 1-2 questions
6. Submit test

**✅ Check**:
- No console errors
- Test completes
- Redirects to student home

### Test B: Dashboard Display (Must Pass)
1. Login as **Teacher**
2. Go to Results → Select the test from Test A
3. Verify columns:
   - Student Email ✓
   - Integrity Score ✓
   - **AI Cheat Score** ✓ (NEW)
   - **Combined Score** ✓ (NEW)
   - **Risk Level** ✓ (NEW - should show 🟢 LOW)
   - **Monitoring** ✓ (NEW - should show ✓ Active)
   - **Details** ✓ (NEW - click to see anomalies)

**✅ Check**:
- All columns visible
- No N/A values (should show numbers)
- Color coding applied
- Anomalies expandable

---

## 🔧 Server Health Check

After starting servers, verify all are healthy:

### Backend Server
```bash
curl -X GET http://127.0.0.1:3000/
# Response: Should show HTML or redirect
```

### ResultServer
```bash
curl -X GET http://127.0.0.1:200/health
# Response: Should show server status
```

### TestServer
```bash
curl -X GET http://127.0.0.1:100/health
# Response: Should show server status
```

### AuthServer
```bash
curl -X GET http://127.0.0.1:300/health
# Response: Should show server status
```

---

## 📋 Data Verification

After completing Test B, run these checks:

### Check 1: Result Stored in Database
```sql
-- Supabase SQL Editor
SELECT student_id, email, cheat_score, combined_score, risk_level, 
       monitoring_enabled, anomaly_data
FROM result 
ORDER BY created_at DESC 
LIMIT 1;

-- Should see:
-- monitoring_enabled: true
-- cheat_score: 0-100 (or 0 if no anomalies)
-- combined_score: number
-- risk_level: 'LOW', 'MODERATE', 'MEDIUM', 'HIGH', or 'CRITICAL'
-- anomaly_data: [] (or array with objects if anomalies detected)
```

### Check 2: API Returns Monitoring Data
```bash
# ResultServer endpoint
curl -X POST http://127.0.0.1:200/getStudentResult \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "studentEmail=[your-test-email]"

# Response should include:
# "monitoring_enabled": true,
# "cheat_score": 0,
# "combined_score": 0,
# "risk_level": "LOW",
# "anomaly_data": []
```

---

## 🎬 Next Steps After Quick Test

If both tests pass ✅:
1. Run full test suite from `TESTING_GUIDE_AI_MONITOR.md`
2. Test different anomaly scenarios (phone, multiple people, etc.)
3. Verify all 10 test scenarios
4. Check performance metrics
5. Create final test report

If tests fail ❌:
1. Check `DATABASE_MIGRATION_ERRORS.md` for solutions
2. Review server console logs
3. Check browser developer console
4. Verify all servers started correctly

---

## 🚨 Troubleshooting Quick Links

| Problem | Solution |
|---------|----------|
| "Cannot find monitoring columns" | Run SQL migration script in Supabase editor |
| Backend shows 404 on monitoring endpoint | Verify `monitoring_service.py` running |
| Dashboard shows "N/A" for cheat scores | Clear browser cache, refresh page |
| Permission popup doesn't appear | Try in Chrome/Edge, check HTTPS settings |
| No anomalies detected | Check lighting, hold phone very close to camera |
| Database not updating | Verify Supabase connection string in config |

---

## 📞 Support Resources

- **Technical Docs**: `SYSTEM_DOCUMENTATION.md`
- **Integration Guide**: `AI_MONITOR_INTEGRATION.md`
- **Quick Reference**: `QUICK_START_AI_MONITOR.md`
- **Full Testing**: `TESTING_GUIDE_AI_MONITOR.md` (this file)
- **Server Logs**: Check terminal windows for each service

---

**Status**: Ready to Test ✅
**Last Updated**: March 17, 2026
**Estimated Time**: 5-30 minutes (quick test) or 2-4 hours (full test suite)
