@echo off
echo ========================================
echo  Snoop System
echo   Setup Script
echo ========================================
echo.

set PROJECT_ROOT=%~dp0

:: Check Python
echo [1/5] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed! Please install Python 3.6+
    pause
    exit /b 1
)
echo Python found!

:: Check Node.js
echo [2/5] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed! Please install Node.js 12+
    pause
    exit /b 1
)
echo Node.js found!

:: Install Python dependencies
echo [3/5] Installing Python dependencies...
pip install flask flask-restful bcrypt python-dotenv supabase >nul 2>&1
cd /d %PROJECT_ROOT%src\AnomalyServer
pip install -r requirements.txt >nul 2>&1
echo Python packages installed!

:: Install Node.js dependencies
echo [4/5] Installing Node.js dependencies...
cd /d %PROJECT_ROOT%src\BackendServer
call npm install >nul 2>&1
echo Node.js packages installed!

:: Create .env file if not exists
echo [5/5] Setting up configuration...
cd /d %PROJECT_ROOT%
if not exist ".env" (
    copy ".env.example" ".env" >nul 2>&1
    echo Created .env configuration file
) else (
    echo .env file already exists
)

:: Create logs directory
if not exist "logs" mkdir logs

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo   Next steps:
echo   1. Edit .env file with your OCI credentials
echo   2. Run start_all_servers.bat to start the application
echo.
pause
