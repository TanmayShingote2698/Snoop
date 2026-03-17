# Teacher's Guide to AI Monitoring Scores & Interpretation

## 📊 Understanding the Score Dashboard

### What Each Column Means

#### **Score (Final Score)**
- **Definition**: Overall exam performance (0-100)
- **Calculation**: Student's correct answers percentage
- **Example**: 85 means student got 85% of questions correct
- **Use**: Represents academic performance alone

#### **Integrity Score**
- **Definition**: Behavioral compliance percentage (0-100%)
- **Measures**: 
  - Did not switch tabs excessively
  - Did not exit fullscreen
  - Did not use prohibited keys
- **Calculation**: `100% - (behavioral_violations_total / max_possible × 100)`
- **Example**: 75% means some violations detected

#### **AI Cheat Score** ⭐ (NEW)
- **Definition**: AI-detected anomalies (0-100 scale)
- **Ranges**:
  - 0-20: Minimal anomalies
  - 21-40: Some suspicious activity
  - 41-60: Multiple red flags
  - 61-80: Significant concern
  - 81-100: High probability of cheating
- **Calculation**: Points from detected objects, faces, gaze direction
- **Example**: 45 means suspicious activity detected multiple times

#### **Combined Score** 📈 (NEW)
- **Definition**: Weighted average of Integrity + AI Score
- **Formula**: (Integrity × 40%) + (AI_Cheat × 60%)
- **Rationale**: AI scores weighted higher (electronic monitoring more reliable)
- **Example**: 
  - Integrity: 80, AI Cheat: 30 → Combined: (80×0.4) + (30×0.6) = 32 + 18 = 50

#### **Risk Level** 🎯 (NEW)
- **Definition**: Classification of cheating probability
- **Thresholds**:
  | Risk Level | Score Range | Color | Meaning |
  |-----------|-------------|-------|---------|
  | 🟢 LOW | 0-20 | Green | No concerns |
  | 🔵 MODERATE | 21-40 | Blue | Minor anomalies |
  | 🟡 MEDIUM | 41-60 | Yellow | Suspicious activity |
  | 🟠 HIGH | 61-80 | Orange | Likely cheating |
  | 🔴 CRITICAL | 81-100 | Red | Definite cheating |

#### **Monitoring Status** 📹 (NEW)
- **Definition**: Whether exam was proctored with AI
- **Active (✓)**: Student granted permission, monitoring ran
- **Inactive (✗)**: Student took exam without monitoring
- **Importance**: Inactive results have N/A for AI scores

#### **Details** 📋 (NEW)
- **Definition**: Specific anomalies detected during exam
- **Click**: Button expands row to show anomaly list
- **Includes**: Anomaly type, confidence level, timestamp

---

## 🔍 Anomaly Types & Severity

### What Anomalies Can Be Detected

**HIGH SEVERITY (20 points each)**
- 📱 **Phone Detected**: Student has smartphone visible
  - Confidence: 85-99%
  - Action: Likely searching for answers
  - Recommendation: Escalate to Academic Integrity

- 👥 **Multiple People**: More than 1 face in frame
  - Confidence: 80-95%
  - Action: Someone else present (possible answer whispering)
  - Recommendation: Disqualify or manual review

**MEDIUM SEVERITY (10-15 points)**
- ❌ **No Face Detected**: Student's face not visible (15 pts)
  - Cause: Looking down, covering face, camera blocked
  - Action: Preventing monitoring
  - Recommendation: Caution, possible obstruction

- 💻 **Laptop Visible**: Laptop in frame besides test screen (12 pts)
  - Cause: Multiple monitors, reference materials
  - Action: Could be using for resources
  - Recommendation: Check what's on laptop

- 📖 **Book Visible**: Physical book in frame (8 pts)
  - Cause: Student positioned with materials visible
  - Action: Reference materials
  - Recommendation: Moderate concern

**LOW-MEDIUM SEVERITY (5-8 points)**
- 👁️ **Gaze Away (8 pts)**: Student looking away from screen >2 seconds
  - Cause: Looking at someone, materials, or thinking
  - Multiplier: Can repeat multiple times
  - Example: 4 instances = 32 points total

- 👀 **Gaze Left/Right (5 pts each)**: Extreme head turn
  - Cause: Looking at materials, another person
  - Direction: Coded as "gaze_looking_left" or "gaze_looking_right"
  - Multiplier: Can accumulate

---

## 📈 Decision Matrix: What to Do With Each Risk Level

### 🟢 LOW (Score 0-20)
**What it means**: Student appears honest
- Minimal anomalies
- Good behavioral compliance
- No red flags

**Actions**:
- ✅ Accept test results
- 📝 Record as valid exam
- ✓ Award full credit (if score is acceptable)

**Example Scores**:
- Integrity: 95%, AI Cheat: 10 → Combined: 12 (LOW)
- Integrity: 90%, AI Cheat: 15 → Combined: 21 (borderline MODERATE)

---

### 🔵 MODERATE (Score 21-40)
**What it means**: Minor anomalies, likely false positives or nervous behavior
- Glancing away frequently (nervous test-taker)
- Minor system violations
- Possible technical issues

**Actions**:
1. 👀 Review anomaly details
2. 🤔 Assess context:
   - Is student known to be anxious? (explains gaze direction)
   - Was there technical issue? (explains face not detected)
   - Check timestamp patterns
3. 🎯 Decision:
   - If anomalies clustered at start: Likely nervousness → Accept
   - If scattered throughout: Worth investigating
   - If duplicated phone detections: Escalate

**Example Investigation**:
- Student has 35 Combined Score
- Anomalies: "gaze_away (5x), gaze_left (3x)"
- No high-severity anomalies
- History: Known test-anxious group
- Decision: Accept, monitor future exams

---

### 🟡 MEDIUM (Score 41-60)
**What it means**: Suspicious activity detected, requires review
- Multiple anomalies
- Pattern of concerning behavior
- Moderate cheating probability

**Actions**:
1. 📋 Review all anomalies chronologically:
   - When did violations occur?
   - Clustered or distributed?
   - What types?

2. 🔎 Check for patterns:
   - Heavy phone/material detection → Likely cheating
   - Mostly gaze anomalies → Could be legitimate
   - Multiple people → Definite concern

3. 📞 Consider evidence:
   - Student test performance vs. historical average
   - Time spent on difficult questions (too fast?)
   - Compare with class average for that exam
   - Check for suspicious score improvement

4. 🎯 Decision Options:
   - **Accept with flagging**: Record the medium risk, flag for manual verification
   - **Suspend pending review**: Contact student for explanation
   - **Request retake**: Have student retake monitored
   - **Reduce score**: Apply penalty (e.g., -10%)

**Example Review**:
```
Student: John Smith
Combined Score: 52 (MEDIUM)
Exam Score: 92 (Normally scores 70)

Anomalies:
- 14:32:15 phone_detected (2 instances)
- 14:35:22 gaze_away (1 instance)
- 14:38:45 multiple_people (1 instance)

Analysis:
✓ Only 2 phone detections (not excessive)
✓ Gaze normal for test situation
✗ Multiple people is concerning

Decision: SUSPEND PENDING REVIEW
Status: Contact student to explain presence of other person
```

---

### 🟠 HIGH (Score 61-80)
**What it means**: Strong evidence of cheating
- Multiple high-severity anomalies
- Clear pattern of misconduct
- High probability of academic dishonesty

**Actions**:
1. ⚠️ DO NOT ACCEPT immediately
2. 💾 Gather documentation:
   - Export all anomaly details
   - Export timestamp data
   - Save screenshots if available
   - Note any other concerning data (behavioral violations, timing)

3. 📞 Contact instructor:
   - Present evidence
   - Request context on student's knowledge
   - Ask if score seems suspicious

4. 🎯 Formal Actions:
   - **Invalidate exam**: Mark as invalid, require retake in controlled environment
   - **Escalate to Academic Integrity Office**: Submit formal report
   - **Request retake**: Schedule in-person proctored exam
   - **Impose penalty**: Reduce score or fail (per institution policy)

**Required Documentation For Report**:
```
ACADEMIC INTEGRITY INCIDENT REPORT

Student: [Name]
Exam: [Course] [Exam Name]
Date/Time: [When exam taken]
Monitoring Score: 68 (HIGH)

Evidence:
- Phone detected: 5 instances (each 20 pts = 100 pts, capped at 20)
- Multiple people: 2 instances (each 18 pts)
- Gaze anomalies: Too many to list individually

Pattern Analysis:
[Describe pattern - e.g., "Phone detected twice in first 10 minutes,
suggesting active use of device for research"]

Score Discrepancy:
- Student historical average: X%
- This exam score: Y% (Z% above normal)
- Statistical likelihood: [High/Very High]

Recommendation:
Invalidate exam and require retake in controlled proctoring environment
```

---

### 🔴 CRITICAL (Score 81-100)
**What it means**: Definite evidence of cheating
- Multiple high-severity anomalies
- Phone detected repeatedly
- Multiple people present
- Clear intent to circumvent monitoring

**Actions** - IMMEDIATE:
1. 🚨 INVALID EXAM - Do NOT award credit
2. 📞 CONTACT STUDENT IMMEDIATELY:
   - Inform of academic integrity violation
   - Explain evidence
   - Allow student response

3. 📋 FORMAL REPORT - To Academic Integrity Office:
   - Complete incident report
   - Include all anomaly data
   - Attach evidence exports
   - Request disciplinary process

4. 📌 CONSEQUENCES (Per institution policy):
   - Exam invalidated (F grade for exam)
   - Course grade reduced
   - Academic probation
   - In severe cases: Suspension/Expulsion

**Example Critical Case**:
```
Student: Jane Doe
Score: 88 (CRITICAL)
Exam Time: 45 minutes

Anomalies (Frequency):
- Phone detected: 8 times ← Excessive
- Multiple people: 3 times ← Clear collaboration
- Gaze anomalies: 12 instances
- No face visible: 4 times (40+ seconds total)

Pattern:
- Phone appears at 5:00, 8:30, 12:15, 15:45...
- Multiple people at 10:00, 25:00, 40:00
- Clear pattern of referencing external materials

Score: 95 out of 100 (student's historical average: 72)

Action: CRITICAL
IMMEDIATE REPORT TO ACADEMIC INTEGRITY OFFICE
EXAM INVALIDATED
SCHEDULE DISCIPLINARY MEETING
```

---

## 🧠 Common Scenarios & Recommendations

### Scenario 1: High Score, Low Anomalies
**Data**:
- Final Score: 98
- Integrity: 95%
- AI Cheat: 5
- Combined: 23 (LOW)

**Interpretation**: Excellent honest performance
**Action**: ✅ Accept, celebrate excellent work

---

### Scenario 2: High Score, High Anomalies
**Data**:
- Final Score: 95
- Integrity: 45%
- AI Cheat: 65
- Combined: 67 (HIGH)

**Interpretation**: Excellent score but significant cheating indicators
**Action**: ⚠️ Likely used external help, investigate despite high score
**Consider**: Student may not have understood material

---

### Scenario 3: Low Score with Moderate Anomalies
**Data**:
- Final Score: 42
- Integrity: 70%
- AI Cheat: 35
- Combined: 38 (MODERATE)

**Interpretation**: Poor performance with some anomalies
**Action**: ✓ Likely legitimate poor performance (no advantage from anomalies)
**Consider**: Student may have been anxious, causing gaze anomalies

---

### Scenario 4: Average Score, No Monitoring
**Data**:
- Final Score: 75
- Integrity: N/A
- AI Cheat: N/A
- Combined: N/A
- Monitoring: ✗ Inactive

**Interpretation**: Student opted out of monitoring
**Action**: 
- ✓ Acceptable if institution allows opt-out
- ⚠️ Flag for protocol if opt-out not permitted
- 📝 Document that scores less reliable for this student

---

### Scenario 5: Suspicious Improvement Pattern
**Data** (Student Jane):
- Exam 1 (Monitored): 70 → Combined 35 (LOW)
- Exam 2 (Monitored): 72 → Combined 38 (MODERATE)
- Exam 3 (Monitored): 88 → Combined 52 (MEDIUM)
- Exam 4 (No monitoring): 94

**Interpretation**: Score improves when unmonitored
**Action**: 
- ⚠️ Investigate if unmonitored exam was authorized
- 🔄 Require monitoring for all future exams
- 📊 Report pattern to academic advisor

---

## 🛡️ Privacy & Ethical Considerations

### What Data Is Collected
- **What IS recorded**: 
  - Video frames (not stored, only analyzed)
  - Detected objects/anomalies
  - Timestamps
  - Aggregate scoring

- **What IS NOT recorded**:
  - Student's face/identity details (only "face detected")
  - Audio/microphone data
  - Student's actual answers
  - Browsing history

### Student Rights
- Right to know monitoring is happening (permission requirement)
- Right to see what anomalies were detected
- Right to appeal/explain anomalies
- Right to retake exam if flagged
- Right to privacy (data only used for this exam)

### Using Data Responsibly
✅ **DO**:
- Use scores as part of holistic review
- Consider context and circumstances
- Allow student appeals/explanations
- Document decision rationale
- Follow institutional policy

❌ **DO NOT**:
- Use as sole basis for discipline
- Assume guilt without investigation
- Discriminate based on technical limitations (lighting, hardware)
- Report data beyond academic integrity office
- Use for purposes beyond exam integrity

---

## 📞 When to Escalate

**Escalate to Academic Integrity Office When**:
- Combined Score ≥ 60 (HIGH or CRITICAL)
- Pattern of HIGH scores on unmonitored exams
- Multiple violations across exams
- Any CRITICAL (81+) score
- Student doesn't accept explanation

**Escalate to IT Department When**:
- Multiple students showing same pattern (possible coordinated cheating)
- System seems malfunctioning (false positives across class)
- Data concerns (scores not being saved)

**Escalate to Instructor/Dean When**:
- Multiple formal violations in one course
- Student challenges recommendation
- Need guidance on penalty severity

---

## 🎓 Training Checklist for Teachers

Before using the monitoring system, ensure you:

✅ Understand score components (Score, Integrity, AI Cheat, Combined)
✅ Know risk level thresholds (LOW to CRITICAL)
✅ Can interpret anomaly types and their meanings
✅ Reviewed decision matrix for each risk level
✅ Know institution's academic integrity policy
✅ Understand privacy requirements
✅ Can export and document findings
✅ Know how to contact Academic Integrity Office
✅ Understand appeal process for students
✅ Have read troubleshooting guide for technical issues

---

## 📞 FAQ - Teacher Questions

**Q: If a student gets 98 but has HIGH risk level, should I fail them?**
A: Not automatically. Investigate first. Could indicate:
- Smart student using allowed resources
- Lucky guesses with external help
- System false positive
Gather context before deciding.

**Q: What if monitoring says cheating but test score is low?**
A: Students didn't benefit from cheating, so less severe. Could be:
- Attempted cheating but didn't understand materials
- Accidentally triggered false anomalies
- Recommend reduced penalty vs. HIGH score case

**Q: Can I make my own decisions about risk levels?**
A: Yes, use them as guidance but apply judgment. Consider:
- Student's academic history
- Pattern across multiple exams
- Contextual factors (technical issues, personal circumstances)

**Q: What if multiple students have same anomaly pattern?**
A: Could indicate:
- System issue (calibration problem)
- Coordinated cheating ring (escalate immediately)
- Room lighting/setup issue (environmental)
Contact IT to investigate.

**Q: How do I handle student appeals?**
A: Process:
1. Listen to student's explanation
2. Review anomaly details with them
3. Check for legitimate causes (anxiety, lighting, etc.)
4. Consult with Academic Integrity Office
5. Document decision and reason

---

**Last Updated**: March 17, 2026
**Audience**: Instructors and Academic Integrity Officers
**Version**: 1.0 - Initial Release
