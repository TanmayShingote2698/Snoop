# AI Proctored Examination System - Setup & Run Guide

A complete guide to configure and run the AI Proctored Examination System.

---

## 📋 Prerequisites

Before starting, ensure you have:

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| Python | 3.6+ | `python --version` |
| Node.js | 12+ | `node --version` |
| npm | 6+ | `npm --version` |
| Supabase Account | - | For database |

---

## 🚀 Quick Start (3 Steps)

```
1. Run setup.bat        → Installs all dependencies
2. Run start_all_servers.bat → Starts the application
3. Open http://localhost:5000
```

---

## 📁 Step 1: Install Dependencies

### Option A: Automatic (Recommended)
Double-click `setup.bat` in the project root folder.

### Option B: Manual
```bash
# Python packages
pip install flask flask-restful bcrypt python-dotenv oci borneo
pip install -r src/AnomalyServer/requirements.txt

# Node.js packages
cd src/BackendServer
npm install
```

---

## ⚙️ Step 2: Configure Environment Variables

### 2.1 Create .env File
```bash
# Copy the template
copy .env.example .env
```

### 2.2 Initialize Database (IMPORTANT)

Since the system uses Supabase (PostgreSQL), you must create the necessary tables before running the servers:

1.  Log in to your [Supabase Dashboard](https://app.supabase.com/).
2.  Open the **SQL Editor** in your project.
3.  Copy and paste the contents of `database_setup.sql` (found in the project root).
4.  Click **Run**.

This will create the `admin`, `student`, `test`, and `result` tables required for the system to function.

### 2.3 Edit .env File

---

### 🔧 Server Ports Configuration

```ini
# Change these if ports are already in use on your system
TEST_SERVER_PORT=100      # Test management service
RESULT_SERVER_PORT=200    # Scoring & results service
AUTH_SERVER_PORT=300      # Authentication service
BACKEND_SERVER_PORT=5000  # Main web application
```

**When to change:** If you see "Port already in use" error.

### 🔒 Security Settings

```ini
# Password hashing strength (higher = more secure but slower)
BCRYPT_ROUNDS=12

# Change this to a random string in production!
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Token expiry time
JWT_EXPIRY_HOURS=24
```

**Generating a secure JWT_SECRET:**
```python
# Run this in Python to generate a secure key
import secrets
print(secrets.token_hex(32))
```

---

### 📝 Logging Configuration

```ini
LOG_LEVEL=DEBUG    # Options: DEBUG, INFO, WARNING, ERROR
LOG_DIR=logs       # Where to save log files
```

---

## ▶️ Step 3: Start the Application

### Option A: One-Click Start (Recommended)
Double-click `start_all_servers.bat`

This will:
- Open 4 terminal windows (one per server)
- Start all services automatically
- Open the web app in your browser

### Option B: Manual Start (4 terminals needed)

**Terminal 1 - Test Server:**
```bash
cd src/TestServer
python server.py
```

**Terminal 2 - Result Server:**
```bash
cd src/ResultServer
python server.py
```

**Terminal 3 - Auth Server:**
```bash
cd src/AuthServer
python server.py
```

**Terminal 4 - Backend Server:**
```bash
cd src/BackendServer
npm run dev
```

---

## ✅ Step 4: Verify Installation

### Check Health Endpoints
Open these URLs in your browser:

| Service | Health Check URL |
|---------|-----------------|
| Auth Server | http://localhost:300/health |
| Test Server | http://localhost:100/health |
| Result Server | http://localhost:200/health |
| Web App | http://localhost:5000 |

You should see JSON responses like:
```json
{
  "status": "healthy",
  "service": "AuthServer",
  "port": 300
}
```

---

## 🛑 Stopping the Application

### Option A: One-Click Stop
Double-click `stop_all_servers.bat`

### Option B: Manual
Close all terminal windows, or press `Ctrl+C` in each.

---

## 🔧 Troubleshooting

### Port Already in Use
```
Error: Address already in use
```
**Solution:** Change the port in `.env` file or kill the process using that port:
```bash
netstat -ano | findstr :5000
taskkill /PID <PID_NUMBER> /F
```

### Module Not Found
```
ModuleNotFoundError: No module named 'flask'
```
**Solution:** Run `setup.bat` again or manually install:
```bash
pip install flask flask-restful bcrypt python-dotenv
```

### Oracle DB Connection Failed
```
Error connecting to Oracle NoSQL
```
**Solution:** 
1. Verify OCI credentials in `.env`
2. Check `.oci/oci_api_key.pem` file exists
3. Ensure your IP is whitelisted in Oracle Cloud

### bcrypt Build Error (Windows)
```
error: Microsoft Visual C++ 14.0 is required
```
**Solution:** Install Visual Studio Build Tools with C++ workload.

---

## 📂 Important File Locations

| File | Purpose |
|------|---------|
| `.env` | Your configuration (create from `.env.example`) |
| `start_all_servers.bat` | Start all servers |
| `stop_all_servers.bat` | Stop all servers |
| `setup.bat` | Install dependencies |
| `src/*/server.py` | Python microservices |
| `src/BackendServer/` | Main web application |

---

## 🎓 Using the Application

### For Teachers/Admins:
1. Go to http://localhost:5000
2. Click **Admin**
3. Register a new account
4. Create tests with MCQ and subjective questions
5. View student results

### For Students:
1. Go to http://localhost:5000
2. Click **Student**
3. Register with your photo (for face recognition)
4. Browse available tests
5. Take proctored exams
6. View your results
