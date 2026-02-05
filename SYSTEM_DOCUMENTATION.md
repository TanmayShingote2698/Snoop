# Snoop System - Complete File Documentation

A comprehensive guide explaining every file in the system, its purpose, working, and usage.

---

## 📁 Project Structure Overview

```
Snoop system/
├── 📄 SETUP_GUIDE.md           # Installation guide
├── 📄 README.md                 # Project overview
├── 📄 .env.example              # Configuration template
├── 📄 setup.bat                 # Dependency installer
├── 📄 start_all_servers.bat     # Start all servers
├── 📄 stop_all_servers.bat      # Stop all servers
├── 📁 Documents/                # PDF documentation
├── 📁 src/
│   ├── 📁 AnomalyServer/        # AI Proctoring
│   ├── 📁 AuthServer/           # Authentication
│   ├── 📁 BackendServer/        # Main Web App
│   ├── 📁 ResultServer/         # Scoring & Results
│   └── 📁 TestServer/           # Test Management
```

---

# 🔧 CONFIGURATION & SCRIPTS

## .env.example
**Location:** Root folder  
**Purpose:** Template for environment configuration

**Contains:**
- Server port settings (100, 200, 300, 5000)
- Oracle Cloud database credentials
- Security settings (bcrypt rounds, JWT secret)
- Logging configuration

**Usage:**
```bash
copy .env.example .env
# Then edit .env with your settings
```

---

## setup.bat
**Location:** Root folder  
**Purpose:** One-click dependency installation

**What it does:**
1. Checks if Python is installed
2. Checks if Node.js is installed
3. Installs Python packages (flask, bcrypt, etc.)
4. Installs Node.js packages
5. Creates .env from template
6. Creates logs folder

**Usage:** Double-click to run

---

## start_all_servers.bat
**Location:** Root folder  
**Purpose:** Start all 4 servers with one click

**What it does:**
1. Opens Test Server terminal (Port 100)
2. Opens Result Server terminal (Port 200)
3. Opens Auth Server terminal (Port 300)
4. Opens Backend Server terminal (Port 5000)
5. Opens browser to http://localhost:5000

**Usage:** Double-click to run

---

## stop_all_servers.bat
**Location:** Root folder  
**Purpose:** Stop all running servers

**What it does:**
1. Kills all Python processes
2. Kills all Node.js processes

**Usage:** Double-click to run

---

# 🤖 ANOMALY SERVER (AI Proctoring)

**Location:** `src/AnomalyServer/`  
**Technology:** Python, OpenCV, dlib, face_recognition  
**Purpose:** AI-powered exam proctoring to detect cheating

---

## Server.py
**Purpose:** Main orchestrator that runs all AI detection modules

**How it works:**
```python
# Initialize all detection modules
fr = FaceRecognition(user_image, user_id)
ld = LandmarkDetection()
ud = UpperBodyDetection()
mt = MotionTracking()

# Process each video frame
while True:
    ret, frame = video.read()
    fr.run(frame, result)    # Check face
    ld.run(frame, result)    # Check gaze
    ud.run(frame, result)    # Check body
    mt.run(frame, result)    # Check motion
```

**Output:** Integrity score combining all detection results

---

## FaceRecognition.py
**Purpose:** Verify student identity during exam

**Detects:**
| Issue | Threshold | Warning |
|-------|-----------|---------|
| No person visible | 50 frames | "No one detected!" |
| Multiple people | 30 frames | "More than one person!" |
| Wrong person | 50 frames | "Verified User Not found!" |

**How it works:**
1. Loads registered student's face encoding
2. Compares each frame against stored encoding
3. Uses face_recognition library (threshold: 0.6)
4. Tracks warning counts and frame statistics

---

## LandmarkDetection.py
**Purpose:** Track head pose and gaze direction

**Detects:**
- Looking Left (angle < -15°)
- Looking Right (angle > 15°)
- Looking Forward

**How it works:**
1. Uses dlib's 68-point facial landmark predictor
2. Calculates 3D head pose using OpenCV PnP algorithm
3. Logs timestamps when student looks away

---

## MotionTracking.py
**Purpose:** Detect significant movement during exam

**How it works:**
1. Compares current frame with background
2. Uses Gaussian blur and thresholding
3. Ignores small movements (< 10000 pixel area)
4. Records start/end times of motion events

---

## UpperBodyDetection.py
**Purpose:** Detect additional people nearby

**How it works:**
1. Uses Haar Cascade classifier for upper body detection
2. Logs timestamps when extra person detected

---

## utils/drawFace.py
**Purpose:** Draw facial landmarks on video for debugging

**Draws:** Jawline, eyebrows, nose, eyes, mouth outlines

---

## utils/reference_world.py
**Purpose:** 3D reference model for head pose estimation

**Functions:**
- `ref3DModel()` - Standard 3D face coordinates
- `ref2dImagePoints()` - Map 2D landmarks to 3D
- `cameraMatrix()` - Camera intrinsic matrix

---

## weights/ folder
**Purpose:** Pre-trained AI models

| File | Purpose |
|------|---------|
| `haarcascade_frontalface_default.xml` | Face detection model |
| `haarcascade_upperbody.xml` | Upper body detection model |
| `shape_predictor_68_face_landmarks.dat` | Facial landmark model |

---

# 🔐 AUTH SERVER

**Location:** `src/AuthServer/`  
**Technology:** Python Flask  
**Port:** 300  
**Purpose:** User authentication and registration

---

## server.py
**Purpose:** REST API for authentication

**Endpoints:**
| Route | Method | Purpose |
|-------|--------|---------|
| `/health` | GET | Check if server is running |
| `/addStudent` | POST | Register new student |
| `/addAdmin` | POST | Register new admin |
| `/verifyStudent` | POST | Student login |
| `/verifyAdmin` | POST | Admin login |
| `/validateStudent` | POST | Validate during exam |

**Features added:**
- Health check endpoint
- Environment variable configuration
- Port from .env file

---

## auth_functions.py
**Purpose:** Business logic for authentication

**Key functions:**
| Function | Purpose |
|----------|---------|
| `hash_password()` | Hash password with bcrypt |
| `verify_password()` | Compare password with hash |
| `addStudent()` | Insert student into database |
| `addAdmin()` | Insert admin into database |
| `verifyStudent()` | Check student credentials |
| `verifyAdmin()` | Check admin credentials |

**Security features:**
- bcrypt password hashing (12 rounds)
- No plain text password storage

---

## dbManager.py
**Purpose:** Oracle NoSQL database connection

**Functions:**
| Function | Purpose |
|----------|---------|
| `connect()` | Establish database connection |
| `insertEntry()` | Add record to table |
| `getEntry()` | Get record by key |
| `runQuery()` | Execute SQL query |
| `deleteEntry()` | Remove record |
| `close()` | Close connection |

---

# 📝 TEST SERVER

**Location:** `src/TestServer/`  
**Technology:** Python Flask  
**Port:** 100  
**Purpose:** Create and manage exams

---

## server.py
**Purpose:** REST API for test management

**Endpoints:**
| Route | Method | Purpose |
|-------|--------|---------|
| `/health` | GET | Check if server is running |
| `/createTest` | POST | Create new test |
| `/getTest` | POST | Get test by ID |
| `/getAllTest` | POST | Get all tests |

---

## test_functions.py
**Purpose:** Business logic for tests

**Functions:**
- `createTest()` - Save test to database
- `getTest()` - Retrieve single test
- `getAllTest()` - List all tests

---

# 📊 RESULT SERVER

**Location:** `src/ResultServer/`  
**Technology:** Python Flask  
**Port:** 200  
**Purpose:** Score exams and store results

---

## server.py
**Purpose:** REST API for results and scoring

**Endpoints:**
| Route | Method | Purpose |
|-------|--------|---------|
| `/health` | GET | Check if server is running |
| `/scoreAndStore` | POST | Grade exam and save |
| `/getStudentResult` | POST | Get results by email |
| `/getTestResult` | POST | Get all results for test |
| `/getStudentResponse` | POST | Get specific attempt |

**Scoring logic:**
- Auto-scores MCQ questions
- Tracks subjective answers for manual review
- Calculates integrity score from proctoring

---

# 🌐 BACKEND SERVER (Main Web App)

**Location:** `src/BackendServer/`  
**Technology:** Node.js, Express, EJS  
**Port:** 5000  
**Purpose:** Main web interface

---

## index.js
**Purpose:** Express server entry point

**Configuration:**
- EJS template engine
- Express layouts
- Route mounting for /teacher and /student

---

## routers/mainRouter.js
**Purpose:** Root URL routing

**Route:** `GET /` → Landing page (role selection)

---

## routers/student.js
**Purpose:** All student operations

**Routes:**
| Route | Purpose |
|-------|---------|
| `/student/login` | Login page & auth |
| `/student/register` | Registration |
| `/student/showAllTests` | List available tests |
| `/student/takeTest` | Start exam |
| `/student/submitTest` | Submit answers |
| `/student/GetResultByEmail` | View results |

**Security:** Passwords sent to server for bcrypt comparison (not hashed client-side)

---

## routers/teacher.js
**Purpose:** All admin operations

**Routes:**
| Route | Purpose |
|-------|---------|
| `/teacher/login` | Admin login |
| `/teacher/register` | Admin registration |
| `/teacher/enterTestID` | Start test creation |
| `/teacher/createTest` | Test editor |
| `/teacher/submitQues` | Add question |
| `/teacher/showTestAfterCreation` | Preview & save |
| `/teacher/showAllTests` | List tests |

---

## views/ (EJS Templates)

| File | Purpose |
|------|---------|
| `layout.ejs` | Master template with Bootstrap |
| `RootPage.ejs` | Landing page - role selection |
| `studentLogin.ejs` | Student login form |
| `studentRegister.ejs` | Student registration with photo |
| `studentHome.ejs` | Student dashboard |
| `teacherLogin.ejs` | Admin login form |
| `teacherRegister.ejs` | Admin registration |
| `teacherHome.ejs` | Admin dashboard |
| `enterTestID.ejs` | Test configuration |
| `createTest2.ejs` | Question editor |
| `showAllTests.ejs` | List tests (admin) |
| `showAllTestsToStudent.ejs` | List tests (student) |
| `takeTestByStudent.ejs` | Exam interface with timer |
| `showTestAfterCreation.ejs` | Test preview |
| `getResultOfStudent.ejs` | Email input for results |
| `showResultUsingEmail.ejs` | Display results |

---

## package.json
**Purpose:** Node.js project configuration

**Dependencies:**
| Package | Purpose |
|---------|---------|
| express | Web framework |
| ejs | Template engine |
| express-ejs-layouts | Layout support |
| request | HTTP client |
| bcrypt | Password hashing |
| nodemon | Development auto-reload |

---

# 📊 COMPLETE FILE COUNT

| Category | Files |
|----------|-------|
| Configuration & Scripts | 5 |
| AnomalyServer | 9 |
| AuthServer | 3 |
| TestServer | 3 |
| ResultServer | 3 |
| BackendServer | 25+ |
| **Total** | **48+** |

---

# 🔄 Data Flow

```
User → BackendServer (5000)
         ↓
    [Login/Register] → AuthServer (300) → Oracle DB
         ↓
    [Create Test] → TestServer (100) → Oracle DB
         ↓
    [Take Exam] → AnomalyServer (AI) + ResultServer (200) → Oracle DB
         ↓
    [View Results] → ResultServer (200) → Oracle DB
```

---

# 🔒 Security Implementation

| Feature | Implementation |
|---------|----------------|
| Password Hashing | bcrypt (12 rounds) |
| Password Storage | Only hashes stored, never plain text |
| Session Secret | Configurable via .env |
| Health Checks | All servers have /health endpoint |
| Configuration | All secrets in .env file |
